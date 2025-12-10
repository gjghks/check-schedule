'use client';

import { useState, useMemo } from 'react';
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
    Tabs
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconBell, IconCalendar, IconChevronLeft, IconChevronRight, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

// Set locale
dayjs.locale('ko');

interface Props {
    schedules: ScheduleRow[];
    availableDates: string[];
    currentDate: string;
    weekRange: { start: string, end: string };
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

// --- Sub Components ---

interface ScheduleCardProps {
    entry: { isShinsegae: boolean, item: ScheduleRow };
    onClick: (entry: { isShinsegae: boolean, item: ScheduleRow }) => void;
}

const ScheduleCard = ({ entry, onClick }: ScheduleCardProps) => {
    const { isShinsegae, item } = entry;
    const raw = JSON.parse(item.raw_data || '{}');

    // Fields
    const productName = isShinsegae ? (raw.G_PROG_NAME || '방송정보없음') : item.other_product_name;
    const channelName = isShinsegae ? 'Shinsegae' : item.other_broad_name;
    const channelInfo = CHANNELS.find(c => c.name === channelName) || (isShinsegae ? CHANNELS[0] : null);
    const channelLabel = channelInfo?.label || (isShinsegae ? '신세계' : channelName);

    const startTime = isShinsegae ? item.bd_btime : item.other_btime;
    const endTime = isShinsegae ? item.bd_etime : (item.other_etime || raw.OTHER_ETIME || '??:??');

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

    const category = isShinsegae ? raw.MD_NAME : (raw.OTHER_MD_NAME_1 || raw.OTHER_MD_NAME_2);

    // Colors etc
    const logoColor = channelInfo?.color || 'gray';
    const logoLabel = channelInfo?.label || (isShinsegae ? 'S' : 'OT');

    const isAlert = !isShinsegae && ((item.sche_sml_score >= 6) || (item.item_sml_score >= 1.5));
    const showBell = isAlert || (item.comp_alert && item.comp_alert.trim() !== '');

    const price = item.product_sale_price || raw.PRODUCT_SALE_PRICE || 0;

    const tooltipLabel = (
        <div style={{ textAlign: 'left' }}>
            <div>{channelLabel} | {duration}분</div>
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

const ScheduleCell = ({ entries, onCardClick }: ScheduleCellProps) => {
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
            return !isShinsegae && ((item.sche_sml_score >= 6) || (item.item_sml_score >= 1.5) || (item.comp_alert && item.comp_alert.trim() !== ''));
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

export default function ScheduleDashboard({ schedules, availableDates, currentDate, weekRange }: Props) {
    const router = useRouter();
    const [selectedItemState, setSelectedItemState] = useState<{ item: ScheduleRow, isShinsegae: boolean } | null>(null);
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
    // Default tab is 'competitor' which corresponds to the first tab requested by the user
    // The second tab is 'weekly' which contains the current dashboard
    const [activeTab, setActiveTab] = useState<string | null>('competitor');

    // Data Stucture for Weekly View
    const weekData = useMemo(() => {
        // We map: Key=`YYYY/MM/DD` -> Value=Map<ChannelName, Map<Hour, Items[]>>
        const map = new Map<string, Map<number, { isShinsegae: boolean, item: ScheduleRow }[]>>();

        // Initialize days
        let curr = dayjs(weekRange.start.replace(/\//g, '-'));
        for (let i = 0; i < 7; i++) {
            map.set(curr.format('YYYY/MM/DD'), new Map());
            curr = curr.add(1, 'day');
        }

        schedules.forEach(row => {
            const dateRaw = row.bd_date; // YYYY/MM/DD
            if (map.has(dateRaw)) {
                const hourMap = map.get(dateRaw)!;

                // 1. Add Shinsegae Item (Use BD_BTIME)
                const sTimeStr = row.bd_btime || '00:00:00';
                const sHour = parseInt(sTimeStr.split(':')[0], 10);

                if (!hourMap.has(sHour)) hourMap.set(sHour, []);
                hourMap.get(sHour)!.push({ isShinsegae: true, item: row });

                // 2. Add Competitor Item (Use OTHER_BTIME)
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
        // Use weekRange.start (Monday) as the anchor for stable navigation
        const currentMon = dayjs(weekRange.start.replace(/\//g, '-'));
        const nextDate = dir === 'next' ? currentMon.add(1, 'week') : currentMon.subtract(1, 'week');
        router.push(`/?date=${nextDate.format('YYYY/MM/DD')}`);
    };

    // Date Picker Change
    const onDateChange = (val: any) => {
        if (val) {
            const str = dayjs(val).format('YYYY/MM/DD');
            router.push(`/?date=${str}`);
        }
    };

    // Item Click Handler
    const handleItemClick = (entry: { isShinsegae: boolean, item: ScheduleRow }) => {
        setSelectedItemState(entry);
        openModal();
    };

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
        <AppShell header={{ height: 110 }} padding="md">
            <AppShell.Header p="xs" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Top Row: Title & Date Picker Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Group>
                        <Text fw={700} size="xl" c="blue" style={{ letterSpacing: -1 }}>
                            CheckSchedule
                        </Text>
                        <Text size="sm" c="dimmed">편성 분석 시스템</Text>
                    </Group>

                    <Group>
                        <ThemeIcon variant="default" onClick={() => moveWeek('prev')} style={{ cursor: 'pointer' }}><IconChevronLeft size={16} /></ThemeIcon>
                        <DatePickerInput
                            placeholder="날짜 선택"
                            value={dateValue}
                            onChange={onDateChange}
                            valueFormat="YYYY/MM/DD"
                            leftSection={<IconCalendar size={16} />}
                            style={{ width: 140 }}
                            styles={{ input: { textAlign: 'center' } }}
                        />
                        <ThemeIcon variant="default" onClick={() => moveWeek('next')} style={{ cursor: 'pointer' }}><IconChevronRight size={16} /></ThemeIcon>
                    </Group>
                </div>

                {/* Bottom Row: Tabs */}
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
                            gap: 4
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
            </AppShell.Header>

            <AppShell.Main>
                {/* 1. Competitor Schedule Analysis Tab Content */}
                {activeTab === 'competitor' && (
                    <Box p="xl" style={{ textAlign: 'center', color: '#868e96', marginTop: 50 }}>
                        <Text size="lg">준비 중입니다.</Text>
                        <Text size="sm">경쟁사 편성 분석 화면이 여기에 표시됩니다.</Text>
                    </Box>
                )}

                {/* 2. Weekly Schedule Analysis Tab Content */}
                {activeTab === 'weekly' && (
                    <Box style={{ overflowX: 'auto', paddingBottom: 20 }}>
                        <Box style={{ minWidth: 1000, display: 'flex', flexDirection: 'column' }}>

                            {/* Header Row (Time + Mon-Sun) */}
                            <Box style={{ display: 'flex' }}>
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
                                                    if (!sTimeSet.has(e.item.bd_btime)) {
                                                        sTimeSet.add(e.item.bd_btime);
                                                        uniqueEntries.push(e);
                                                    }
                                                } else {
                                                    uniqueEntries.push(e);
                                                }
                                            });

                                            // Note: Sorting happens inside ScheduleCell now initially to handle priority properly?
                                            // Actually ScheduleCell does sorting. We pass unique items.

                                            return (
                                                <ScheduleCell
                                                    key={d.date}
                                                    entries={uniqueEntries}
                                                    onCardClick={handleItemClick}
                                                />
                                            );
                                        })}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                )}
            </AppShell.Main>

            <Modal opened={modalOpened} onClose={closeModal} title="상세 정보" centered size="lg">
                {selectedItemState && (() => {
                    const { item: selectedItem, isShinsegae } = selectedItemState;
                    const raw = JSON.parse(selectedItem.raw_data || '{}');
                    const productName = isShinsegae ? (raw.G_PROG_NAME || '방송정보없음') : (raw.OTHER_PRODUCT_NAME || '상품명 없음');
                    const isAlert = (selectedItem.sche_sml_score >= 6) || (selectedItem.item_sml_score >= 1.5);
                    const description = raw.OTHER_ITEM_DESC || '설명 없음';
                    const price = selectedItem.product_sale_price || raw.PRODUCT_SALE_PRICE || 0;

                    // Time Calculation
                    const startTime = isShinsegae ? selectedItem.bd_btime : selectedItem.other_btime;
                    const endTime = isShinsegae ? selectedItem.bd_etime : (selectedItem.other_etime || raw.OTHER_ETIME || '??:??');
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
                                    <Text fw={500}>{isShinsegae ? '신세계라이브쇼핑' : (raw.OTHER_BROAD_NAME || '경쟁사')}</Text>
                                </Box>
                            </Group>

                            <Box>
                                <Text c="dimmed" size="xs">판매가</Text>
                                <Text fw={700} size="lg" c="blue">{price > 0 ? `${price.toLocaleString()}원` : '-'}</Text>
                            </Box>

                            <Box>
                                <Text c="dimmed" size="xs">상품 설명</Text>
                                {/* Render HTML content safely with line breaks preserved */}
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

        </AppShell>
    );
}
