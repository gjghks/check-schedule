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
    Card
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconBell, IconCalendar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
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

export default function ScheduleDashboard({ schedules, availableDates, currentDate, weekRange }: Props) {
    const router = useRouter();
    const [selectedItemState, setSelectedItemState] = useState<{ item: ScheduleRow, isShinsegae: boolean } | null>(null);
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

    // Data Stucture for Weekly View
    const weekData = useMemo(() => {
        // We map: Key=`YYYY/MM/DD` -> Value=Map<ChannelName, Map<Hour, Items[]>>
        // Actually, simple Map<DateString, Map<Hour, ItemForRender[]>> might be better.
        // ItemForRender: standard struct for rendering.

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

                // 1. Add Shinsegae Item (Use BD_BTIME) - Deduplicate if needed?
                // Since rows are Pairs, we get multiple rows for one Shinsegae Item.
                // We should use a Set outside to track added Shinsegae Items?
                // Actually, if we just render them, they will stack.
                // Let's rely on distinct `bd_btime` + `g_prog_name`?
                // The user wants clean grid.
                // I'll add "Shinsegae" entry only if I haven't added this specific time/prog yet?
                // But loop order is arbitrary.
                // Easier: Add render entry for Shinsegae. We filter duplicates at Render time OR use a Set here.

                // Let's add them all to the map, then in render logic we deduplicate.
                // Shinsegae Time: BD_BTIME
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

    // Helper to render a single item in the cell
    const renderItem = (entry: { isShinsegae: boolean, item: ScheduleRow }) => {
        const { isShinsegae, item } = entry;
        const raw = JSON.parse(item.raw_data || '{}');

        // Fields
        const productName = isShinsegae ? (raw.G_PROG_NAME || '방송정보없음') : item.other_product_name;
        const channelName = isShinsegae ? 'Shinsegae' : item.other_broad_name;
        const channelInfo = CHANNELS.find(c => c.name === channelName) || (isShinsegae ? CHANNELS[0] : null);
        const channelLabel = channelInfo?.label || (isShinsegae ? '신세계' : channelName);

        const startTime = isShinsegae ? item.bd_btime : item.other_btime;
        // Use other_etime if available from DB column or raw data
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
                    onClick={(e) => { e.stopPropagation(); setSelectedItemState({ item, isShinsegae }); openModal(); }}
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
        <AppShell header={{ height: 60 }} padding="md">
            <AppShell.Header p="xs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Group>
                    <Text fw={700} size="xl" c="blue" style={{ letterSpacing: -1 }}>
                        CheckSchedule
                    </Text>
                    <Text size="sm" c="dimmed">주간 편성 분석 (Weekly Analysis)</Text>
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
            </AppShell.Header>

            <AppShell.Main>
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

                                        // Deduplicate and Sort Logic
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

                                        // Sort by Time
                                        uniqueEntries.sort((a, b) => {
                                            const tA = parseTime(a.isShinsegae ? a.item.bd_btime : a.item.other_btime);
                                            const tB = parseTime(b.isShinsegae ? b.item.bd_btime : b.item.other_btime);
                                            return tA - tB;
                                        });

                                        return (
                                            <Box key={d.date} style={{ flex: 1, borderRight: '1px solid #f0f0f0', padding: 4, minWidth: 150, verticalAlign: 'top' }}>
                                                {uniqueEntries.map(e => renderItem(e))}
                                            </Box>
                                        );
                                    })}
                                </Box>
                            ))}
                        </Box>

                    </Box>
                </Box>
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
