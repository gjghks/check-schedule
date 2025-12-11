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
                                            const finalEntries = (activeTab === 'weekly' && weeklySubTab === 'duplicate')
                                                ? uniqueEntries.filter(e => e.isShinsegae || (((e.item.sche_sml_score || 0) >= 6) || ((e.item.item_sml_score || 0) >= 1.5) || (e.item.comp_alert && e.item.comp_alert.trim() !== '')))
                                                : uniqueEntries;

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
                <ScrollArea.Autosize mah="80vh" type="auto">
                    <AiSummaryContent />
                </ScrollArea.Autosize>
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
    return (
        <Stack gap="lg">
            {/* Section 1 */}
            <Box>
                <Title order={4} mb="sm" c="violet">1. 당사 상품 담당별 편성 현황 (전월 대비)</Title>
                <Box h={300}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={[
                                { name: '상품1담당', prev: 40.2, curr: 36.9 },
                                { name: '상품2담당', prev: 34.2, curr: 28.9 },
                                { name: '상품3담당', prev: 25.3, curr: 24.2 },
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis label={{ value: '비중(%)', angle: -90, position: 'insideLeft' }} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar dataKey="prev" name="전월" fill="#8884d8" />
                            <Bar dataKey="curr" name="금월" fill="#82ca9d" />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
                <Alert variant="light" color="gray" title="세부 현황">
                    <Stack gap="xs">
                        <Text size="sm"><b>① 상품 1담당 (생활/식품/무형 등)</b>: 전체 비중 36.9% (▼ 3.3%p). 건강식품(▼3.4%p) 감소폭 최대.</Text>
                        <Text size="sm"><b>② 상품 2담당 (패션/뷰티)</b>: 전체 비중 28.9% (▼ 5.3%p). 의류(▼4.4%p) 급감.</Text>
                        <Text size="sm"><b>③ 상품 3담당 (레포츠/브랜드패션)</b>: 전체 비중 24.2% (▼ 1.1%p). 레포츠(▲1.9%p) 유일 증가.</Text>
                    </Stack>
                </Alert>
            </Box>

            <Divider />

            {/* Section 2 */}
            <Box>
                <Title order={4} mb="sm" c="violet">2. 경쟁사별 편성 데이터 현황</Title>
                <Box h={300}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={[
                                { name: '현대', div1: 41.0, div2: 35.9, div3: 0, etc: 23.1 },
                                { name: 'GS', div1: 49.0, div2: 35.6, div3: 0, etc: 15.4 },
                                { name: '롯데', div1: 43.4, div2: 46.9, div3: 9.1, etc: 0.6 },
                                { name: 'CJ', div1: 44.3, div2: 51.7, div3: 4.0, etc: 0 },
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={60} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar dataKey="div1" name="상품1담당" stackId="a" fill="#8884d8" />
                            <Bar dataKey="div2" name="상품2담당" stackId="a" fill="#82ca9d" />
                            <Bar dataKey="div3" name="상품3담당" stackId="a" fill="#ffc658" />
                            <Bar dataKey="etc" name="기타/미매핑" stackId="a" fill="#ff8042" />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
                <Alert variant="light" color="gray" title="세부 현황">
                    <Stack gap="xs">
                        <Text size="sm"><b>롯데/CJ:</b> 패션/뷰티(2담당) 비중이 높음 (CJ 51.7%, 롯데 46.9%). CJ는 의류 비중 급증(23.5%).</Text>
                        <Text size="sm"><b>현대/GS:</b> 상품1담당(식품/생활) 비중이 높으나, 현대는 미매핑(15.6%) 이슈 존재.</Text>
                    </Stack>
                </Alert>
            </Box>

            <Divider />

            {/* Section 3 */}
            <Box>
                <Title order={4} mb="sm" c="violet">3. 카테고리별 비교 (당사 vs 경쟁사)</Title>
                <Box h={350}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={[
                                { name: '의류', shinsegae: 15.7, lotte: 23.9, cj: 23.5, hyundai: 17.2, gs: 15.0 },
                                { name: '뷰티', shinsegae: 12.9, lotte: 13.0, cj: 19.0, hyundai: 12.0, gs: 18.7 },
                                { name: '건강식품', shinsegae: 16.8, lotte: 13.8, cj: 19.3, hyundai: 11.2, gs: 19.7 },
                                { name: '레포츠', shinsegae: 13.8, lotte: 8.2, cj: 3.2, hyundai: 4.2, gs: 3.5 },
                                { name: '생활가전', shinsegae: 6.3, lotte: 14.3, cj: 10.6, hyundai: 13.1, gs: 15.4 },
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis label={{ value: '비중(%)', angle: -90, position: 'insideLeft' }} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar dataKey="shinsegae" name="당사" fill="#fa5252" />
                            <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                            <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                            <Bar dataKey="hyundai" name="현대" fill="#119586" />
                            <Bar dataKey="gs" name="GS" fill="#6CC218" />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
                <Alert variant="light" color="red" title="Insight">
                    <Stack gap="xs">
                        <Text size="sm"><b>당사 강세:</b> 레포츠(13.8%)는 경쟁사 대비 압도적 높음. 여행(4.7%)도 업계 최고 수준.</Text>
                        <Text size="sm"><b>당사 약세:</b> 의류(15.7%)는 롯데/CJ 대비 8%p 낮음. 생활가전(6.3%)은 최하위.</Text>
                    </Stack>
                </Alert>
            </Box>
        </Stack>
    );
}
