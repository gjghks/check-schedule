'use client';

import { useState, useMemo, useEffect } from 'react';
import { ScheduleRow } from '@/lib/db';
import {
    AppShell,
    Group,
    Text,
    Box,
    Badge,
    ThemeIcon,
    Modal,
    Stack,
    Divider,
    Title,
    Tooltip,
    Card,
    Tabs,
    Button,
    SegmentedControl,
    Alert,
    ScrollArea
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconBell, IconCalendar, IconChevronLeft, IconChevronRight, IconChevronDown, IconChevronUp, IconSparkles } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useRouter } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import CompetitorPivot from './CompetitorPivot';

// Set locale
dayjs.locale('ko');

interface Props {
    schedules: ScheduleRow[];
    availableDates: string[];
    currentDate: string;
    weekRange: { start: string, end: string };
    viewRange?: { start: string, end: string };
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

const CHANNELS = [
    { id: 'shinsegae', name: 'Shinsegae', label: '신세계', color: '#000000' },
    { id: 'hyundai', name: '현대홈쇼핑', label: '현대', color: '#119586' },
    { id: 'gs', name: 'GS홈쇼핑', label: 'GS', color: '#6CC218' },
    { id: 'lotte', name: '롯데홈쇼핑', label: '롯데', color: '#EE3124' },
    { id: 'cj', name: 'CJ온스타일', label: 'CJ', color: '#6A00A6' },
    { id: 'sk', name: 'SK스토아', label: 'SK', color: '#E6007E' },
    { id: 'kt', name: 'KT알파', label: 'KT', color: '#ED1C24' },
] as const;

// Helper to parse time string into minutes for sorting
const parseTime = (timeStr: string | undefined | null): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};

// ... (Sub Components ScheduleCard etc omitted, keep existing) ...
// ACTUALLY I cannot omit sub components in replace_file_content if I replace the top. 
// I will target specific chunks. This tool call targets the imports and Props.
// I will use multiple chunks.

// ... 

export default function ScheduleDashboard({ schedules, availableDates, currentDate, weekRange, viewRange }: Props) {
    const router = useRouter();
    const [selectedItemState, setSelectedItemState] = useState<{ item: ScheduleRow, isShinsegae: boolean } | null>(null);
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
    const [activeTab, setActiveTab] = useState<string | null>('competitor');
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [weeklySubTab, setWeeklySubTab] = useState<'duplicate' | 'all'>('duplicate');

    // Range Picker State for Competitor Tab
    const [rangeValue, setRangeValue] = useState<[Date | null, Date | null]>([
        viewRange ? dayjs(viewRange.start.replace(/\//g, '-')).toDate() : null,
        viewRange ? dayjs(viewRange.end.replace(/\//g, '-')).toDate() : null,
    ]);

    // Update range picker if prop changes (url changes)
    useEffect(() => {
        if (viewRange) {
            setRangeValue([
                dayjs(viewRange.start.replace(/\//g, '-')).toDate(),
                dayjs(viewRange.end.replace(/\//g, '-')).toDate(),
            ]);
        }
    }, [viewRange]);

    // Handle Range Change
    const onRangeChange = (val: any) => {
        setRangeValue(val);
        if (val[0] && val[1]) {
            const start = dayjs(val[0]).format('YYYY/MM/DD');
            const end = dayjs(val[1]).format('YYYY/MM/DD');
            router.push(`/?start=${start}&end=${end}`);
        }
    };

    // Data Stucture for Weekly View (Keep existing logic)
    const weekData = useMemo(() => {
        const map = new Map<string, Map<number, { isShinsegae: boolean, item: ScheduleRow }[]>>();
        let curr = dayjs(weekRange.start.replace(/\//g, '-'));
        for (let i = 0; i < 7; i++) {
            map.set(curr.format('YYYY/MM/DD'), new Map());
            curr = curr.add(1, 'day');
        }
        // ... (keep logic) ...
        // Wait, if I replace the component body start, I lose the rest.
        // I should use chunks carefully.

        schedules.forEach(row => {
            const dateRaw = row.bd_date;
            if (map.has(dateRaw)) {
                const hourMap = map.get(dateRaw)!;
                // ...
                if (row.bd_btime) {
                    const sTimeStr = row.bd_btime;
                    const sHour = parseInt(sTimeStr.split(':')[0], 10);
                    if (!hourMap.has(sHour)) hourMap.set(sHour, []);
                    hourMap.get(sHour)!.push({ isShinsegae: true, item: row });
                }

                if (row.other_broad_name) {
                    const cTimeStr = row.other_btime || '00:00:00';
                    const cHour = parseInt(cTimeStr.split(':')[0], 10);
                    if (!hourMap.has(cHour)) hourMap.set(cHour, []);
                    hourMap.get(cHour)!.push({ isShinsegae: false, item: row });
                }
            }
        });
        return map;
    }, [schedules, weekRange]);

    // Navigate Week
    const moveWeek = (dir: 'prev' | 'next') => {
        const currentMon = dayjs(weekRange.start.replace(/\//g, '-'));
        const nextDate = dir === 'next' ? currentMon.add(1, 'week') : currentMon.subtract(1, 'week');
        router.push(`/?date=${nextDate.format('YYYY/MM/DD')}`); // This clears start/end params comfortably which is correct for switching to week view logic? 
        // Note: If user is in 'competitor' tab and clicks arrow... 
        // Competitor Tab uses 'Range Picker'. Arrows are for 'Weekly' tab navigation.
        // I should HIDE arrows in Competitor Tab?
        // User requirements: "Competitor Analysis tab top right date features change to [Range Selection]".
        // So in Competitor tab, we don't show the week navigator.
    };

    // Date Picker Change (for Weekly)
    const onDateChange = (val: any) => {
        if (val) {
            const str = dayjs(val).format('YYYY/MM/DD');
            router.push(`/?date=${str}`);
        }
    };

    const handleTodayClick = () => {
        const todayStr = dayjs().format('YYYY/MM/DD');
        if (activeTab === 'competitor') {
            setRangeValue([dayjs().toDate(), dayjs().toDate()]);
            router.push(`/?start=${todayStr}&end=${todayStr}`);
        } else {
            router.push(`/?date=${todayStr}`);
        }
    };

    // ... renderItem ... (no change needed in logic, but need to preserve code if replacing full body)

    // Generate Day Columns
    const days = useMemo(() => {
        const arr = [];
        let curr = dayjs(weekRange.start.replace(/\//g, '-'));
        for (let i = 0; i < 7; i++) {
            arr.push({ date: curr.format('YYYY/MM/DD'), label: WEEKDAYS[i] });
            curr = curr.add(1, 'day');
        }
        return arr;
    }, [weekRange]);

    const dateValue = dayjs(currentDate.replace(/\//g, '-')).toDate();

    return (
        <AppShell header={{ height: 110 }} padding="0">
            <AppShell.Header p="xs" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {/* Row 1: Title */}
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', paddingLeft: 8, paddingTop: 4 }}>
                    <Group>
                        <Text fw={700} size="xl" c="blue" style={{ letterSpacing: -1 }}>
                            CheckSchedule
                        </Text>
                        <Text size="sm" c="dimmed">편성 분석 시스템</Text>
                    </Group>
                </div>

                {/* Row 2: Tabs + Date Picker Controls */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingRight: 8 }}>
                    <Tabs
                        value={activeTab}
                        onChange={setActiveTab}
                        variant="outline"
                        radius="md"
                        styles={{
                            tab: {
                                fontWeight: 600,
                                padding: '8px 20px',
                                borderBottom: 'none',
                            },
                            list: {
                                gap: 4,
                                borderBottom: 'none'
                            },
                            root: {
                                marginBottom: -1 // Align with border
                            }
                        }}
                    >
                        <Tabs.List>
                            <Tabs.Tab value="competitor" color="blue">
                                경쟁사 편성 분석
                            </Tabs.Tab>
                            <Tabs.Tab value="weekly" color="blue">
                                주간 편성 상세
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs>

                    <Box pb={4}>
                        <Group>
                            {activeTab === 'weekly' && (
                                <>
                                    <Button
                                        leftSection={<IconSparkles size={16} />}
                                        variant="gradient"
                                        gradient={{ from: 'violet', to: 'cyan', deg: 90 }}
                                        size="xs"
                                        mr="xs"
                                        onClick={() => setAiModalOpen(true)}
                                    >
                                        생성형 AI 분석
                                    </Button>
                                    <SegmentedControl
                                        value={weeklySubTab}
                                        onChange={(v) => setWeeklySubTab(v as any)}
                                        data={[
                                            { label: '중복', value: 'duplicate' },
                                            { label: '상세', value: 'all' },
                                        ]}
                                        size="xs"
                                        mr="xs"
                                    />
                                </>
                            )}
                            <Button variant="default" size="sm" onClick={handleTodayClick}>오늘</Button>
                            {activeTab === 'competitor' ? (
                                <DatePickerInput
                                    type="range"
                                    allowSingleDateInRange
                                    placeholder="분석 기간 선택"
                                    value={rangeValue}
                                    onChange={onRangeChange}
                                    valueFormat="YYYY/MM/DD (ddd)"
                                    locale="ko"
                                    leftSection={<IconCalendar size={16} />}
                                    style={{ width: 260 }}
                                    styles={{ input: { textAlign: 'center' } }}
                                    size="sm"
                                />
                            ) : (
                                <>
                                    <ThemeIcon variant="default" onClick={() => moveWeek('prev')} style={{ cursor: 'pointer' }}><IconChevronLeft size={16} /></ThemeIcon>
                                    <DatePickerInput
                                        placeholder="날짜 선택"
                                        value={dateValue}
                                        onChange={onDateChange}
                                        valueFormat="YYYY/MM/DD (ddd)"
                                        locale="ko"
                                        leftSection={<IconCalendar size={16} />}
                                        style={{ width: 160 }}
                                        styles={{ input: { textAlign: 'center' } }}
                                        size="sm"
                                    />
                                    <ThemeIcon variant="default" onClick={() => moveWeek('next')} style={{ cursor: 'pointer' }}><IconChevronRight size={16} /></ThemeIcon>
                                </>
                            )}
                        </Group>
                    </Box>
                </div>
            </AppShell.Header>

            <AppShell.Main>
                {/* 1. Competitor Schedule Analysis Tab Content */}
                <Box style={{ display: activeTab === 'competitor' ? 'flex' : 'none', flexDirection: 'column', height: 'calc(100vh - 110px)', padding: '10px 20px 20px 20px' }}>
                    <CompetitorPivot schedules={schedules} />
                </Box>

                {/* 2. Weekly Schedule Analysis Tab Content */}
                <Box style={{ display: activeTab === 'weekly' ? 'flex' : 'none', flexDirection: 'column', height: 'calc(100vh - 110px)', paddingTop: 10 }}>
                    <Box style={{ overflow: 'auto', flex: 1, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 }}>
                        <Box style={{ minWidth: 1000, display: 'flex', flexDirection: 'column' }}>
                            {/* Header Row (Time + Mon-Sun) */}
                            <Box style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'white' }}>
                                <Box style={{ width: 60, flexShrink: 0, padding: '4px 0', textAlign: 'center', borderRight: '1px solid #eee', borderBottom: '2px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text fw={700} size="sm">시간대</Text>
                                </Box>
                                {days.map((d) => (
                                    <Box key={d.date} style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderBottom: '2px solid #ddd', minWidth: 150, borderRight: '1px solid #f0f0f0' }}>
                                        <Text fw={700}>{d.date.substring(5)} ({d.label})</Text>
                                    </Box>
                                ))}
                            </Box>

                            {/* Grid Body (Rows by Hour) */}
                            <Box style={{ display: 'flex', flexDirection: 'column' }}>
                                {Array.from({ length: 24 }).map((_, hour) => (
                                    <Box key={hour} style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
                                        {/* Time Label Cell */}
                                        <Box style={{
                                            width: 60,
                                            flexShrink: 0,
                                            borderRight: '1px solid #eee',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: '#f8f9fa'
                                        }}>
                                            <Text size="xs" fw={700} c="dimmed">
                                                {hour.toString().padStart(2, '0')}
                                            </Text>
                                        </Box>

                                        {/* Day Cells */}
                                        {days.map(d => {
                                            const dayItemsMap = weekData.get(d.date);
                                            const entries = dayItemsMap?.get(hour) || [];

                                            // Deduplicate Logic (Same unique check)
                                            const uniqueEntries: { isShinsegae: boolean, item: ScheduleRow }[] = [];
                                            const sTimeSet = new Set<string>();

                                            entries.forEach(e => {
                                                if (e.isShinsegae) {
                                                    const bTime = e.item.bd_btime || '';
                                                    if (!sTimeSet.has(bTime)) {
                                                        sTimeSet.add(bTime);
                                                        uniqueEntries.push(e);
                                                    }
                                                } else {
                                                    uniqueEntries.push(e);
                                                }
                                            });

                                            // Sub-tab Filtering (Duplicate vs All)
                                            // Sub-tab Filtering (Duplicate vs All)
                                            let finalEntries = uniqueEntries;
                                            if (activeTab === 'weekly' && weeklySubTab === 'duplicate') {
                                                const alerts = uniqueEntries.filter(e => !e.isShinsegae && (((e.item.sche_sml_score || 0) >= 6) || ((e.item.item_sml_score || 0) >= 1.5) || (e.item.comp_alert && e.item.comp_alert.trim() !== '')));
                                                const alertCats = new Set<string>();
                                                alerts.forEach(a => {
                                                    if (a.item.other_md_name_1) alertCats.add(a.item.other_md_name_1);
                                                    if (a.item.other_md_name_2) alertCats.add(a.item.other_md_name_2);
                                                });
                                                finalEntries = uniqueEntries.filter(e => {
                                                    if (!e.isShinsegae) {
                                                        return alerts.includes(e);
                                                    }
                                                    return alertCats.has(e.item.md_name || '');
                                                });
                                            }

                                            return (
                                                <ScheduleCell
                                                    key={d.date}
                                                    entries={finalEntries}
                                                    onCardClick={(entry) => {
                                                        setSelectedItemState(entry);
                                                        openModal();
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </AppShell.Main>

            <Modal opened={modalOpened} onClose={closeModal} title="상세 정보" centered size="lg">
                {selectedItemState && (() => {
                    const { item: selectedItem, isShinsegae } = selectedItemState;
                    const productName = isShinsegae ? (selectedItem.g_prog_name || '방송정보없음') : (selectedItem.other_product_name || '상품명 없음');
                    const isAlert = !isShinsegae && (((selectedItem.sche_sml_score || 0) >= 6) || ((selectedItem.item_sml_score || 0) >= 1.5));
                    const description = selectedItem.other_item_desc || '설명 없음';
                    const price = selectedItem.product_sale_price || 0;

                    // Time Calculation
                    const startTime = isShinsegae ? selectedItem.bd_btime : selectedItem.other_btime;
                    const endTime = isShinsegae ? selectedItem.bd_etime : (selectedItem.other_etime || '??:??');
                    let duration = 0;
                    const s = parseTime(startTime);
                    const e = parseTime(endTime);
                    if (s > 0 && e > 0) {
                        duration = e - s;
                        if (duration < 0) duration += 1440;
                    }

                    return (
                        <Stack>
                            <Title order={4}>{productName}</Title>
                            <Divider />
                            <Group grow>
                                <Box>
                                    <Text c="dimmed" size="xs">방송시간</Text>
                                    <Text fw={500}>{startTime} ~ {endTime} ({duration}분)</Text>
                                </Box>
                                <Box>
                                    <Text c="dimmed" size="xs">채널</Text>
                                    <Text fw={500}>{isShinsegae ? '신세계라이브쇼핑' : (selectedItem.other_broad_name || '경쟁사')}</Text>
                                </Box>
                            </Group>

                            <Group grow>
                                <Box>
                                    <Text c="dimmed" size="xs">판매가</Text>
                                    <Text fw={700} size="lg" c="blue">{price > 0 ? `${price.toLocaleString()}원` : '-'}</Text>
                                </Box>
                                <Box>
                                    <Text c="dimmed" size="xs">가중분</Text>
                                    <Text fw={700} size="lg">{selectedItem.weights_time ? selectedItem.weights_time : '-'}</Text>
                                </Box>
                            </Group>

                            <Box>
                                <Text c="dimmed" size="xs">상품 설명</Text>
                                <Box
                                    style={{ fontSize: 14, lineHeight: 1.5 }}
                                    dangerouslySetInnerHTML={{ __html: (description || '').replace(/\n/g, '<br/>') }}
                                />
                            </Box>

                            {isAlert && (
                                <Box p="xs" bg="red.0" style={{ border: '1px solid #ffd8d8', borderRadius: 4 }}>
                                    <Group gap="xs">
                                        <IconBell size={16} color="red" />
                                        <Text size="sm" fw={700} c="red">유사도 알림 발생</Text>
                                    </Group>
                                    <Text size="sm" mt={4}>{selectedItem.comp_alert}</Text>
                                </Box>
                            )}
                        </Stack>
                    );
                })()}
            </Modal>

            <Modal
                opened={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                title={<Group gap={8}><IconSparkles size={20} color="#7950f2" /><Text fw={700} size="lg">생성형 AI 분석 결과</Text></Group>}
                size="80%"
                padding="md"
            >
                <AiSummaryContent />
            </Modal>
        </AppShell>
    );
}// --- Sub Components ---

interface ScheduleCardProps {
    entry: { isShinsegae: boolean, item: ScheduleRow };
    onClick: (entry: { isShinsegae: boolean, item: ScheduleRow }) => void;
}

function ScheduleCard({ entry, onClick }: ScheduleCardProps) {
    const { isShinsegae, item } = entry;

    // Fields
    const productName = isShinsegae ? (item.g_prog_name || '방송정보없음') : item.other_product_name;
    const channelName = isShinsegae ? 'Shinsegae' : item.other_broad_name;
    const channelInfo = CHANNELS.find(c => c.name === channelName) || (isShinsegae ? CHANNELS[0] : null);
    const channelLabel = channelInfo?.label || (isShinsegae ? '신세계' : channelName);

    const startTime = isShinsegae ? item.bd_btime : item.other_btime;
    const endTime = isShinsegae ? item.bd_etime : (item.other_etime || '??:??');

    const displayTimeStart = startTime?.substring(0, 5);
    const displayTimeEnd = endTime?.substring(0, 5);

    // Calc Duration
    let duration = 0;
    const s = parseTime(startTime);
    const e = parseTime(endTime);
    if (s > 0 && e > 0) {
        duration = e - s;
        if (duration < 0) duration += 1440;
    }

    const category = isShinsegae ? item.md_name : (item.other_md_name_1 || item.other_md_name_2);

    // Colors etc
    const logoColor = channelInfo?.color || 'gray';
    const logoLabel = channelInfo?.label || (isShinsegae ? 'S' : 'OT');

    const isAlert = !isShinsegae && (((item.sche_sml_score || 0) >= 6) || ((item.item_sml_score || 0) >= 1.5));
    const showBell = isAlert || (item.comp_alert && item.comp_alert.trim() !== '');

    const price = item.product_sale_price || 0;

    const tooltipLabel = (
        <div style={{ textAlign: 'left' }}>
            <div>{channelLabel} | {duration}분 | {item.weights_time ?? 0}</div>
            <div>{productName}</div>
            {price > 0 && <div>[판매가] {price.toLocaleString()}</div>}
        </div>
    );

    return (
        <Tooltip label={tooltipLabel} key={`${item.id}-${isShinsegae ? 'S' : 'C'}`} withArrow multiline>
            <Card
                padding={4}
                radius="sm"
                withBorder
                onClick={(e) => { e.stopPropagation(); onClick(entry); }}
                style={{
                    marginBottom: 4,
                    cursor: 'pointer',
                    backgroundColor: isAlert ? '#ffe3e3' : 'white',
                    borderColor: isAlert ? '#ffc9c9' : '#eee',
                }}
            >
                {/* Header: Logo + Time */}
                <Group gap={4} wrap="nowrap" mb={2}>
                    <Badge
                        size="xs"
                        variant="filled"
                        color={logoColor}
                        radius="xs"
                        style={{ minWidth: 24, padding: 0, justifyContent: 'center', height: 16, fontSize: 9 }}
                    >
                        {logoLabel}
                    </Badge>
                    <Text size="xs" fw={700} style={{ fontSize: '10px' }}>
                        {displayTimeStart} ~ {displayTimeEnd}
                    </Text>
                </Group>

                {/* Body: Cat | Name */}
                <Text size="xs" style={{ fontSize: '10px', lineHeight: 1.2 }} lineClamp={2}>
                    {showBell && <IconBell size={8} color="red" style={{ marginRight: 2, verticalAlign: 'middle' }} />}
                    <Text span fw={700} c="dimmed">{category}</Text>
                    <Text span c="dimmed" mx={2}>|</Text>
                    {productName}
                </Text>
            </Card>
        </Tooltip>
    );
};

interface ScheduleCellProps {
    entries: { isShinsegae: boolean, item: ScheduleRow }[];
    onCardClick: (entry: { isShinsegae: boolean, item: ScheduleRow }) => void;
}

function ScheduleCell({ entries, onCardClick }: ScheduleCellProps) {
    const [expanded, setExpanded] = useState(false);

    // Sort by Time first
    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => {
            const tA = parseTime(a.isShinsegae ? a.item.bd_btime : a.item.other_btime);
            const tB = parseTime(b.isShinsegae ? b.item.bd_btime : b.item.other_btime);
            return tA - tB;
        });
    }, [entries]);

    // Visiblity Logic
    // Limit: 3
    // Alert items MUST show
    const MAX_VISIBLE = 3;

    // Filter items to show in collapsed state
    const visibleEntries = useMemo(() => {
        if (expanded || sortedEntries.length <= MAX_VISIBLE) return sortedEntries;

        const alertItems = sortedEntries.filter(e => {
            const { isShinsegae, item } = e;
            return !isShinsegae && (((item.sche_sml_score || 0) >= 6) || ((item.item_sml_score || 0) >= 1.5) || (item.comp_alert && item.comp_alert.trim() !== ''));
        });

        // Use a set to track items already selected
        const selectedSet = new Set(alertItems);

        // Fill remaining slots
        let remaining = MAX_VISIBLE - selectedSet.size;
        if (remaining < 0) remaining = 0; // If alerts > MAX, we just show all alerts, no normal items (unless we want to enforce MIN 3 total? Yes let's show at least alerts)

        // Add normal items in time order until limit
        for (const entry of sortedEntries) {
            if (remaining <= 0) break;
            if (!selectedSet.has(entry)) {
                selectedSet.add(entry);
                remaining--;
            }
        }

        // Return in original time sorted order
        return sortedEntries.filter(e => selectedSet.has(e));
    }, [sortedEntries, expanded]);

    const hiddenCount = sortedEntries.length - visibleEntries.length;

    return (
        <Box style={{ flex: 1, borderRight: '1px solid #f0f0f0', padding: 4, minWidth: 150, verticalAlign: 'top', display: 'flex', flexDirection: 'column' }}>
            {visibleEntries.map((e) => (
                <ScheduleCard
                    key={`${e.item.id}-${e.isShinsegae ? 'S' : 'C'}`}
                    entry={e}
                    onClick={onCardClick}
                />
            ))}

            {/* Collapse/Expand Controls */}
            {sortedEntries.length > MAX_VISIBLE && (
                <Box>
                    {!expanded ? (
                        <Box
                            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                            style={{
                                cursor: 'pointer',
                                border: '1px dashed #ccc',
                                borderRadius: 4,
                                padding: '4px',
                                textAlign: 'center',
                                backgroundColor: '#fdfdfd'
                            }}
                        >
                            <Group gap={2} justify="center">
                                <Text size="xs" c="dimmed" fw={500}>더보기 ({hiddenCount})</Text>
                                <IconChevronDown size={12} color="gray" />
                            </Group>
                        </Box>
                    ) : (
                        <Box
                            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                            style={{
                                cursor: 'pointer',
                                borderTop: '1px solid #eee',
                                marginTop: 4,
                                paddingTop: 4,
                                textAlign: 'center'
                            }}
                        >
                            <IconChevronUp size={12} color="gray" />
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};

function AiSummaryContent() {
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', fontSize: '12px' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>{label}</p>
                    {payload.map((p: any) => (
                        <p key={p.name} style={{ color: p.color, margin: 0 }}>
                            {p.name}: {p.value}%
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <Stack gap="xl">
            {/* Summary Box */}
            <Alert variant="filled" color="violet" title="요약 (Summary)">
                <Text size="sm" fw={700} mb="xs">
                    주요 데이터: 당사 '레포츠' 16.0% 편성, CJ '패션/뷰티' 50.1% 편성, GS '건강식품' 20.5% 편성
                </Text>
                <Stack gap={4}>
                    <Text size="sm">• <b>당사 편성:</b> 상품3담당(레포츠/언더웨어) 비중이 <b>28.2%</b>로 전월 대비 <b>2.9%p</b> 상승함.</Text>
                    <Text size="sm">• <b>경쟁사 데이터:</b> CJ(상품2 50.1%), GS(상품1 52.0%), 롯데(상품2 46.5%), 현대(상품1 42.4%).</Text>
                </Stack>
            </Alert>

            <Divider />

            {/* Section 1 */}
            <Box>
                <Title order={4} mb="sm" c="violet">1. 당사 상품 담당별 편성 현황</Title>
                <Box h={250}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={[
                                { name: '상품1담당', prev: 40.2, curr: 38.5 },
                                { name: '상품2담당', prev: 34.3, curr: 31.7 },
                                { name: '상품3담당', prev: 25.3, curr: 28.2 },
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis label={{ value: '(%)', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 12 }} />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="prev" name="전월" fill="#8884d8" barSize={40} />
                            <Bar dataKey="curr" name="금월" fill="#82ca9d" barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
                <Box mt="md">
                    <Text size="sm" mb="xs">당사 상품3담당 비중은 28.2%이며, 상품1담당 38.5%, 상품2담당 31.7% 순으로 구성됨.</Text>
                    <Stack gap="sm">
                        <Box>
                            <Text size="sm" fw={700}>1) 상품1담당 (생활/식품/건강/무형)</Text>
                            <Text size="xs" pl="sm">• <b>비중:</b> 38.5% (전월 대비 -1.7%p)</Text>
                            <Text size="xs" pl="sm">• <b>세부 구성:</b> 건강식품 18.4% (▼1.7%p), 무형(여행/보험) 9.7%, 생활가전 6.4%, 리빙 5.2%</Text>
                        </Box>
                        <Box>
                            <Text size="sm" fw={700}>2) 상품2담당 (패션/뷰티)</Text>
                            <Text size="xs" pl="sm">• <b>비중:</b> 31.7% (전월 대비 -2.6%p)</Text>
                            <Text size="xs" pl="sm">• <b>세부 구성:</b> 의류 18.2% (▼1.9%p), 뷰티 13.1% (▼1.0%p), 잡화 0.3%</Text>
                        </Box>
                        <Box>
                            <Text size="sm" fw={700}>3) 상품3담당 (레포츠/언더웨어/브랜드)</Text>
                            <Text size="xs" pl="sm">• <b>비중:</b> 28.2% (전월 대비 +2.9%p)</Text>
                            <Text size="xs" pl="sm">• <b>세부 구성:</b> 레포츠 16.0% (▲4.0%p), 브랜드패션 7.5%, 언더웨어 4.7%</Text>
                        </Box>
                    </Stack>
                </Box>
            </Box>

            <Divider />

            {/* Section 2 */}
            <Box>
                <Title order={4} mb="sm" c="violet">2. 경쟁사별 현황</Title>
                <Box h={380}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={[
                                { name: '현대', cloth: 18.0, beauty: 12.1, health: 11.9, leports: 4.0, living: 5.4, kitchen: 6.3, app: 2.3, food: 3.2, misc: 6.5, travel: 3.8, ins: 8.1, rental: 1.3, under: 0.8, others: 16.3 },
                                { name: 'GS', cloth: 16.4, beauty: 20.0, health: 20.5, leports: 3.5, living: 10.5, kitchen: 3.5, app: 2.5, food: 3.8, misc: 2.0, travel: 2.9, ins: 6.9, rental: 1.4, under: 0.9, others: 5.2 },
                                { name: '롯데', cloth: 23.5, beauty: 13.1, health: 13.6, leports: 8.5, living: 8.1, kitchen: 2.3, app: 3.1, food: 6.5, misc: 9.9, travel: 2.4, ins: 3.0, rental: 3.8, under: 0.9, others: 1.3 },
                                { name: 'CJ', cloth: 23.0, beauty: 18.9, health: 20.4, leports: 3.2, living: 6.1, kitchen: 4.9, app: 1.3, food: 3.6, misc: 8.2, travel: 2.3, ins: 4.9, rental: 2.2, under: 0.8, others: 0.2 },
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(value)}`} allowDecimals={false} />
                            <YAxis dataKey="name" type="category" width={40} tick={{ fontSize: 12 }} />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="cloth" name="의류" stackId="a" fill="#8884d8" />
                            <Bar dataKey="beauty" name="뷰티" stackId="a" fill="#82ca9d" />
                            <Bar dataKey="health" name="건강식품" stackId="a" fill="#ffc658" />
                            <Bar dataKey="food" name="푸드" stackId="a" fill="#d0ed57" />
                            <Bar dataKey="leports" name="레포츠" stackId="a" fill="#ff8042" />
                            <Bar dataKey="living" name="리빙" stackId="a" fill="#0088fe" />
                            <Bar dataKey="kitchen" name="주방" stackId="a" fill="#00c49f" />
                            <Bar dataKey="app" name="가전" stackId="a" fill="#005f87" />
                            <Bar dataKey="misc" name="잡화" stackId="a" fill="#a4de6c" />
                            <Bar dataKey="travel" name="여행" stackId="a" fill="#8dd1e1" />
                            <Bar dataKey="ins" name="보험" stackId="a" fill="#83a6ed" />
                            <Bar dataKey="rental" name="렌탈" stackId="a" fill="#8e44ad" />
                            <Bar dataKey="under" name="언더웨어" stackId="a" fill="#d35400" />
                            <Bar dataKey="others" name="기타" stackId="a" fill="#e0e0e0" />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
                <Stack gap="md" mt="md">
                    <Box>
                        <Text size="sm" fw={700}>1) 현대홈쇼핑</Text>
                        <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품1(42.4%) {'>'} 상품2(36.6%) {'>'} 상품3(4.9%)</Text>
                        <Text size="xs" pl="sm">• <b>주요 데이터:</b> 상품1 비중 42.4% (▼10.5%p), 주방 6.3%</Text>
                        <Text size="xs" pl="sm">• <b>상위 아이템:</b> 쿡셀 후라이팬(172분), 로보락(169분), 니카사 다리미(99분)</Text>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>2) GS샵</Text>
                        <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품1(52.0%) {'>'} 상품2(38.4%) {'>'} 상품3(4.3%)</Text>
                        <Text size="xs" pl="sm">• <b>주요 데이터:</b> 건강식품 20.5%, 뷰티 20.0%, 패션 16.4%</Text>
                        <Text size="xs" pl="sm">• <b>상위 아이템:</b> 로보락(188분), 비에날씬(469분), 다이슨(334분)</Text>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>3) 롯데홈쇼핑</Text>
                        <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품2(46.5%) {'>'} 상품1(42.8%) {'>'} 상품3(9.4%)</Text>
                        <Text size="xs" pl="sm">• <b>주요 데이터:</b> 의류 23.5%, 잡화 9.9%</Text>
                        <Text size="xs" pl="sm">• <b>상위 아이템:</b> LBL 니트(232분), 폴앤조 자켓(495분), 더케이예다함(21분)</Text>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>4) CJ온스타일</Text>
                        <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품2(50.1%) {'>'} 상품1(45.6%) {'>'} 상품3(3.9%)</Text>
                        <Text size="xs" pl="sm">• <b>주요 데이터:</b> 상품2담당 50.1%, 의류 23.0% (▲5.5%p)</Text>
                        <Text size="xs" pl="sm">• <b>상위 아이템:</b> 셀렙샵 패딩(862분), 비에날씬(358분), 휘슬러 냄비(202분)</Text>
                    </Box>
                </Stack>
            </Box>

            <Divider />

            {/* Section 3 */}
            <Box>
                <Title order={4} mb="lg" c="violet">3. 카테고리별 비교 (당사 vs 경쟁사)</Title>

                {/* 3-1 Kitchen/Living */}
                <Box mb="xl">
                    <Title order={5} mb="xs">1) 주방 / 가전 / 리빙</Title>
                    <Box h={200}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: '주방', shinsegae: 1.2, lotte: 2.3, cj: 4.9, hyundai: 6.3, gs: 3.5 },
                                    { name: '가전', shinsegae: 0.0, lotte: 3.1, cj: 1.3, hyundai: 2.3, gs: 2.5 },
                                    { name: '리빙', shinsegae: 5.2, lotte: 8.1, cj: 6.1, hyundai: 5.4, gs: 10.5 },
                                ]}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                barGap={4}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                <Bar dataKey="gs" name="GS" fill="#6CC218" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                    <Stack gap={2} mt="xs">
                        <Text size="xs"><b>주방:</b> 현대(6.3%) {'>'} CJ(4.9%) {'>'} GS(3.5%) {'>'} 롯데(2.3%) {'>'} 당사(1.2%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 쿡셀 후라이팬(현대), 휘슬러 냄비(CJ), 타파웨어(GS).</Text>
                        <Text size="xs"><b>가전:</b> 롯데(3.1%) {'>'} GS(2.5%) {'>'} 현대(2.3%) {'>'} CJ(1.3%) {'>'} 당사(0.0%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 로보락 무선청소기(롯데, GS, 현대), LG전자 건조기(현대).</Text>
                        <Text size="xs"><b>리빙:</b> GS(10.5%) {'>'} 롯데(8.1%) {'>'} CJ(6.1%) {'>'} 현대(5.4%) {'>'} 당사(5.2%)</Text>
                        <Text size="xs" c="dimmed" pl="sm">주요 아이템: 조선호텔 침구(GS), 일월 전기매트(현대), 코웨이 공기청정기(CJ).</Text>
                    </Stack>
                </Box>

                {/* 3-2 Food/Health */}
                <Box mb="xl">
                    <Title order={5} mb="xs">2) 푸드 / 건강식품</Title>
                    <Box h={200}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: '푸드', shinsegae: 4.1, lotte: 6.5, cj: 3.6, hyundai: 3.2, gs: 3.8 },
                                    { name: '건강식품', shinsegae: 18.4, lotte: 13.6, cj: 20.4, hyundai: 11.9, gs: 20.5 },
                                ]}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                barGap={4}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                <Bar dataKey="gs" name="GS" fill="#6CC218" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                    <Stack gap={2} mt="xs">
                        <Text size="xs"><b>푸드:</b> 롯데(6.5%) {'>'} 당사(4.1%) {'>'} GS(3.8%) {'>'} CJ(3.6%) {'>'} 현대(3.2%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 김치(GS), 고등어(현대), 낫또(롯데).</Text>
                        <Text size="xs"><b>건강식품:</b> GS(20.5%) {'>'} CJ(20.4%) {'>'} 당사(18.4%) {'>'} 롯데(13.6%) {'>'} 현대(11.9%)</Text>
                        <Text size="xs" c="dimmed" pl="sm">주요 아이템: 비에날씬 유산균(GS/CJ), 여에스더 글루타치온(롯데).</Text>
                    </Stack>
                </Box>

                {/* 3-3 Travel/Ins/Rental */}
                <Box mb="xl">
                    <Title order={5} mb="xs">3) 여행 / 보험 / 렌탈</Title>
                    <Box h={200}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: '여행', shinsegae: 4.7, lotte: 2.4, cj: 2.3, hyundai: 3.8, gs: 2.9 },
                                    { name: '보험', shinsegae: 2.9, lotte: 3.0, cj: 4.9, hyundai: 8.1, gs: 6.9 },
                                    { name: '일반렌탈', shinsegae: 0.6, lotte: 3.8, cj: 2.2, hyundai: 1.2, gs: 1.4 },
                                    { name: '대품렌탈', shinsegae: 1.6, lotte: 0.0, cj: 0.0, hyundai: 0.1, gs: 0.0 },
                                ]}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                barGap={4}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                <Bar dataKey="gs" name="GS" fill="#6CC218" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                    <Stack gap={2} mt="xs">
                        <Text size="xs"><b>여행:</b> 당사(4.7%) {'>'} 현대(3.8%) {'>'} GS(2.9%) {'>'} 롯데(2.4%) {'>'} CJ(2.3%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 롯데관광 서유럽(당사), 교원투어 동유럽(GS).</Text>
                        <Text size="xs"><b>보험:</b> 현대(8.1%) {'>'} GS(6.9%) {'>'} CJ(4.9%) {'>'} 롯데(3.0%) {'>'} 당사(2.9%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 신한라이프(현대), 라이나생명(CJ).</Text>
                        <Text size="xs"><b>일반렌탈:</b> 롯데(3.8%) {'>'} CJ(2.2%) {'>'} GS(1.4%) {'>'} 현대(1.2%) {'>'} 당사(0.6%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 코웨이 정수기(롯데), 바디프랜드 안마의자(롯데).</Text>
                        <Text size="xs"><b>대품렌탈:</b> 당사(1.6%) {'>'} 현대(0.1%) {'>'} GS(0.0%) = 롯데(0.0%) = CJ(0.0%)</Text>
                        <Text size="xs" c="dimmed" pl="sm">주요 아이템: 더케이예다함상조(당사).</Text>
                    </Stack>
                </Box>

                {/* 3-4 Clothing/Beauty */}
                <Box mb="xl">
                    <Title order={5} mb="xs">4) 의류 / 잡화 / 뷰티</Title>
                    <Box h={200}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: '의류', shinsegae: 18.2, lotte: 23.5, cj: 23.0, hyundai: 18.0, gs: 16.4 },
                                    { name: '잡화', shinsegae: 0.3, lotte: 9.9, cj: 8.2, hyundai: 6.5, gs: 2.0 },
                                    { name: '뷰티', shinsegae: 13.1, lotte: 13.1, cj: 18.9, hyundai: 12.1, gs: 20.0 },
                                ]}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                barGap={4}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                <Bar dataKey="gs" name="GS" fill="#6CC218" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                    <Stack gap={2} mt="xs">
                        <Text size="xs"><b>의류:</b> 롯데(23.5%) {'>'} CJ(23.0%) {'>'} 당사(18.2%) {'>'} 현대(18.0%) {'>'} GS(16.4%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: LBL/폴앤조(롯데), 셀렙샵에디션(CJ), 라삐아프(GS).</Text>
                        <Text size="xs"><b>잡화:</b> 롯데(9.9%) {'>'} CJ(8.2%) {'>'} 현대(6.5%) {'>'} GS(2.0%) {'>'} 당사(0.3%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 가이거 토트백(롯데), 헬시온 부츠(현대), 락포트 부츠(CJ).</Text>
                        <Text size="xs"><b>뷰티:</b> GS(20.0%) {'>'} CJ(18.9%) {'>'} 롯데(13.1%) = 당사(13.1%) {'>'} 현대(12.1%)</Text>
                        <Text size="xs" c="dimmed" pl="sm">주요 아이템: 다이슨(GS/CJ), 동국제약 팩(CJ), 도미나스(롯데).</Text>
                    </Stack>
                </Box>

                {/* 3-5 Leports/Under */}
                <Box mb="xl">
                    <Title order={5} mb="xs">5) 레포츠 / 언더웨어</Title>
                    <Box h={200}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: '레포츠', shinsegae: 16.0, lotte: 8.5, cj: 3.2, hyundai: 4.0, gs: 3.5 },
                                    { name: '언더웨어', shinsegae: 4.7, lotte: 0.9, cj: 0.8, hyundai: 0.8, gs: 0.9 },
                                    { name: '브랜드P', shinsegae: 7.5, lotte: 0.0, cj: 0.0, hyundai: 0.0, gs: 0.0 },
                                ]}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                barGap={4}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                <Bar dataKey="gs" name="GS" fill="#6CC218" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                    <Stack gap={2} mt="xs">
                        <Text size="xs"><b>레포츠:</b> 당사(16.0%) {'>'} 롯데(8.5%) {'>'} 현대(4.0%) {'>'} GS(3.5%) {'>'} CJ(3.2%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 비버리힐즈폴로클럽 패딩(당사), 휠라 운동화(롯데).</Text>
                        <Text size="xs"><b>언더웨어:</b> 당사(4.7%) {'>'} GS(0.9%) = 롯데(0.9%) {'>'} 현대(0.8%) = CJ(0.8%)</Text>
                        <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 아날도바시니 내의(당사), 코데즈컴바인(현대).</Text>
                        <Text size="xs"><b>브랜드패션:</b> 당사(7.5%) {'>'} 현대(0.0%) = GS(0.0%) = 롯데(0.0%) = CJ(0.0%)</Text>
                        <Text size="xs" c="dimmed" pl="sm">특이사항: 당사 단독 편성 카테고리.</Text>
                    </Stack>
                </Box>
            </Box>
        </Stack>
    );
}
