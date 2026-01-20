import React, { useState, useMemo, useEffect } from 'react';
import { ScheduleRow } from '@/lib/db';
import {
    Table,
    Box,
    Text,
    Group,
    Checkbox,
    Popover,
    ScrollArea,
    ActionIcon,
    Divider,
    TextInput,
    Badge,
    UnstyledButton,
    Stack,
    Tooltip,
    ThemeIcon,
    Loader
} from '@mantine/core';
import { IconFilter, IconChevronRight, IconChevronDown, IconSearch, IconSparkles, IconHistory } from '@tabler/icons-react';

interface Props {
    schedules: ScheduleRow[];
    onItemClick?: (item: ScheduleRow) => void;
}

// Data Keys
const KEY_BROADCASTER = 'other_broad_name';
const KEY_MID = 'other_mgroupn_name';
const KEY_SMALL = 'other_sgroupn_name';
const KEY_BRAND = 'company_brand_name';
const KEY_PRODUCT = 'other_product_name';
const KEY_MD = 'other_md_name_1';

// Brand Status Type
type BrandStatus = {
    found: boolean;
    count: number;
    details: any[]; // BrandBroadcastRow[]
};

type BrandCheckResult = {
    [key: string]: BrandStatus;
};

// Header Filter Component
interface FilterHeaderProps {
    label: string;
    values: string[]; // All unique values
    selected: Set<string>;
    onChange: (selected: Set<string>) => void;
}

const FilterHeader = ({ label, values, selected, onChange }: FilterHeaderProps) => {
    const [opened, setOpened] = useState(false);
    const [search, setSearch] = useState('');

    const filteredValues = values.filter(v => v.toLowerCase().includes(search.toLowerCase()));

    // Check if all displayed values are selected
    const allSelected = filteredValues.every(v => selected.has(v));
    const someSelected = filteredValues.some(v => selected.has(v));
    const active = selected.size < values.length; // Active if filtered

    const toggleAll = () => {
        const newSet = new Set(selected);
        if (allSelected) {
            filteredValues.forEach(v => newSet.delete(v));
        } else {
            filteredValues.forEach(v => newSet.add(v));
        }
        onChange(newSet);
    };

    const toggleValue = (val: string) => {
        const newSet = new Set(selected);
        if (newSet.has(val)) newSet.delete(val);
        else newSet.add(val);
        onChange(newSet);
    };

    return (
        <Group gap={4} wrap="nowrap" justify="flex-start" style={{ width: '100%' }}>
            <Text fw={700} size="sm">{label}</Text>
            <Popover opened={opened} onChange={setOpened} width={250} position="bottom-end" shadow="md">
                <Popover.Target>
                    <ActionIcon variant={active ? "filled" : "subtle"} color={active ? "blue" : "gray"} size="sm" onClick={() => setOpened((o) => !o)}>
                        <IconFilter size={12} />
                    </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown p="xs">
                    <TextInput
                        placeholder="검색..."
                        size="xs"
                        mb="xs"
                        value={search}
                        onChange={(e) => setSearch(e.currentTarget.value)}
                        rightSection={<IconSearch size={12} />}
                    />
                    <Box mb="xs">
                        <Checkbox
                            label="(전체 선택)"
                            size="xs"
                            checked={allSelected}
                            indeterminate={someSelected && !allSelected}
                            onChange={toggleAll}
                        />
                    </Box>
                    <Divider mb="xs" />
                    <ScrollArea.Autosize mah={200} type="always">
                        <Stack gap={4}>
                            {filteredValues.map(v => (
                                <Checkbox
                                    key={v}
                                    label={v}
                                    size="xs"
                                    checked={selected.has(v)}
                                    onChange={() => toggleValue(v)}
                                />
                            ))}
                            {filteredValues.length === 0 && <Text c="dimmed" size="xs">결과 없음</Text>}
                        </Stack>
                    </ScrollArea.Autosize>
                </Popover.Dropdown>
            </Popover>
        </Group>
    );
};

export default function CompetitorPivot({ schedules, onItemClick }: Props) {
    // 1. Extract Full Lists for Filters
    const uniqueValues = useMemo(() => {
        const sets = {
            [KEY_BROADCASTER]: new Set<string>(),
            [KEY_MID]: new Set<string>(),
            [KEY_SMALL]: new Set<string>(),
            [KEY_BRAND]: new Set<string>(),
            [KEY_PRODUCT]: new Set<string>(),
            [KEY_MD]: new Set<string>(),
        };

        schedules.forEach(row => {
            sets[KEY_BROADCASTER].add(row.other_broad_name || '(미매핑)');
            sets[KEY_MID].add(row.other_mgroupn_name || '(미매핑)');
            sets[KEY_SMALL].add(row.other_sgroupn_name || '(미매핑)');
            sets[KEY_BRAND].add(row.company_brand_name || '(미매핑)');
            sets[KEY_PRODUCT].add(row.other_product_name || '(미매핑)');
            sets[KEY_MD].add(row.other_md_name_1 || '(미매핑)');
        });

        // Defined Order
        const PREFERRED_ORDER = ['현대홈쇼핑', 'GS홈쇼핑', '롯데홈쇼핑', 'CJ온스타일', 'CJ홈쇼핑', 'SK스토아', 'KT알파'];
        const MD_CAT_ORDER = ['주방', '가전', '리빙', '푸드', '건강식품', '여행', '보험', '일반렌탈', '대품렌탈', '의류', '잡화', '뷰티', '레포츠', '언더웨어', '브랜드패션', '미매핑', '(미매핑)', '(없음)'];

        // Convert to Arrays sorted
        return {
            broadcasters: Array.from(sets[KEY_BROADCASTER]).sort((a, b) => {
                const idxA = PREFERRED_ORDER.indexOf(a);
                const idxB = PREFERRED_ORDER.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            }),
            mids: Array.from(sets[KEY_MID]).sort(),
            smalls: Array.from(sets[KEY_SMALL]).sort(),
            brands: Array.from(sets[KEY_BRAND]).sort(),
            products: Array.from(sets[KEY_PRODUCT]).sort(),
            mds: Array.from(sets[KEY_MD]).sort((a, b) => {
                const idxA = MD_CAT_ORDER.indexOf(a);
                const idxB = MD_CAT_ORDER.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1; // Specific order comes first
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            }),
        };
    }, [schedules]);

    // 2. Filter State
    const [selectedFilters, setSelectedFilters] = useState<{ [key: string]: Set<string> }>({});

    // Initialize or Update state when data changes
    useEffect(() => {
        if (schedules.length > 0) {
            // Filter Mids: Only those with valid Small AND Brand
            const validMids = new Set<string>();
            schedules.forEach(row => {
                const mid = row.other_mgroupn_name || '(미매핑)';
                const small = row.other_sgroupn_name;
                const brand = row.company_brand_name;
                if (small && brand) {
                    validMids.add(mid);
                }
            });

            const midsToSelect = validMids.size > 0 ? validMids : new Set(uniqueValues.mids);

            setSelectedFilters({
                [KEY_BROADCASTER]: new Set(uniqueValues.broadcasters),
                [KEY_MID]: midsToSelect,
                [KEY_SMALL]: new Set(uniqueValues.smalls),
                [KEY_BRAND]: new Set(uniqueValues.brands),
                [KEY_PRODUCT]: new Set(uniqueValues.products),
                [KEY_MD]: new Set(uniqueValues.mds),
            });
        } else {
            setSelectedFilters({});
        }
    }, [uniqueValues, schedules]);

    const handleFilterChange = (key: string, set: Set<string>) => {
        setSelectedFilters(prev => ({ ...prev, [key]: set }));
    };

    // 3. Filter Data
    const filteredData = useMemo(() => {
        if (Object.keys(selectedFilters).length === 0) return schedules;

        return schedules.filter(row => {
            const b = row.other_broad_name || '(미매핑)';
            const m = row.other_mgroupn_name || '(미매핑)';
            const s = row.other_sgroupn_name || '(미매핑)';
            const br = row.company_brand_name || '(미매핑)';
            const p = row.other_product_name || '(미매핑)';
            const md = row.other_md_name_1 || '(미매핑)';

            if (selectedFilters[KEY_BROADCASTER] && !selectedFilters[KEY_BROADCASTER].has(b)) return false;
            if (selectedFilters[KEY_MID] && !selectedFilters[KEY_MID].has(m)) return false;
            if (selectedFilters[KEY_SMALL] && !selectedFilters[KEY_SMALL].has(s)) return false;
            if (selectedFilters[KEY_BRAND] && !selectedFilters[KEY_BRAND].has(br)) return false;
            if (selectedFilters[KEY_PRODUCT] && !selectedFilters[KEY_PRODUCT].has(p)) return false;
            if (selectedFilters[KEY_MD] && !selectedFilters[KEY_MD].has(md)) return false;

            return true;
        });
    }, [schedules, selectedFilters]);

    // 3.5 Deduplicate Data
    const uniqueFilteredData = useMemo(() => {
        const uniqueMap = new Map<string, ScheduleRow>();
        const result: ScheduleRow[] = [];

        filteredData.forEach(row => {
            if (!row.other_broad_name) {
                result.push(row);
            } else {
                const key = `${row.bd_date}_${row.other_broad_name}_${row.other_btime}`;
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, row);
                    result.push(row);
                }
            }
        });
        return result;
    }, [filteredData]);

    // 4. Pivot Logic
    type TreeItem = {
        name: string;
        isLeaf: boolean;
        children?: Map<string, TreeItem>;
        values: { [broadcaster: string]: number };
    };

    const tree = useMemo(() => {
        const root = new Map<string, TreeItem>();

        uniqueFilteredData.forEach(row => {
            const md = row.other_md_name_1 || '(미매핑)';
            const mid = row.other_mgroupn_name || '(미매핑)';
            const small = row.other_sgroupn_name || '(미매핑)';
            const brand = row.company_brand_name || '(미매핑)';
            const broadcaster = row.other_broad_name || '(미매핑)';
            const weight = (row.weights_time || 0) / 60;

            // 1. MD
            if (!root.has(md)) root.set(md, { name: md, isLeaf: false, children: new Map(), values: {} });
            const mdNode = root.get(md)!;
            mdNode.values[broadcaster] = (mdNode.values[broadcaster] || 0) + weight;

            // 2. Mid
            if (!mdNode.children!.has(mid)) mdNode.children!.set(mid, { name: mid, isLeaf: false, children: new Map(), values: {} });
            const midNode = mdNode.children!.get(mid)!;
            midNode.values[broadcaster] = (midNode.values[broadcaster] || 0) + weight;

            // 3. Small
            if (!midNode.children!.has(small)) midNode.children!.set(small, { name: small, isLeaf: false, children: new Map(), values: {} });
            const smallNode = midNode.children!.get(small)!;
            smallNode.values[broadcaster] = (smallNode.values[broadcaster] || 0) + weight;

            // 4. Brand
            if (!smallNode.children!.has(brand)) smallNode.children!.set(brand, { name: brand, isLeaf: true, values: {} });
            const brandNode = smallNode.children!.get(brand)!;
            brandNode.values[broadcaster] = (brandNode.values[broadcaster] || 0) + weight;
        });

        return root;
    }, [uniqueFilteredData]);

    // 5. Sorted Columns
    const columns = useMemo(() => {
        const list = uniqueValues.broadcasters;
        if (!selectedFilters[KEY_BROADCASTER]) return list;
        return list.filter(b => selectedFilters[KEY_BROADCASTER].has(b));
    }, [uniqueValues.broadcasters, selectedFilters]);



    // 6. Expansion State
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        const newSet = new Set(expanded);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpanded(newSet);
    };


    // --- Brand Status Checking Logic ---
    const [brandStatus, setBrandStatus] = useState<BrandCheckResult>({});
    const [checkingBrands, setCheckingBrands] = useState(false);

    useEffect(() => {
        const checkBrands = async () => {
            const targets: { md: string, mid: string, small: string, brand: string }[] = [];
            const seen = new Set<string>();

            uniqueFilteredData.forEach(row => {
                const md = row.other_md_name_1;
                const mid = row.other_mgroupn_name;
                const small = row.other_sgroupn_name;
                const brand = row.company_brand_name;

                if (md && mid && small && brand) {
                    const key = `${md}|${mid}|${small}|${brand}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        targets.push({ md, mid, small, brand });
                    }
                }
            });

            if (targets.length === 0) return;

            setCheckingBrands(true);
            try {
                const response = await fetch('/api/brands/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ searches: targets })
                });
                const data = await response.json();
                if (data.results) {
                    setBrandStatus(data.results);
                }
            } catch (err) {
                console.error("Failed to check brands", err);
            } finally {
                setCheckingBrands(false);
            }
        };

        const timer = setTimeout(() => {
            checkBrands();
        }, 1000);

        return () => clearTimeout(timer);
    }, [uniqueFilteredData]);

    // Calculate Brand Stats (Operating/Non-Operating) per Node
    const brandAggregatedStats = useMemo(() => {
        const stats = new Map<string, { operating: Set<string>, nonOperating: Set<string> }>();

        const getOrInit = (k: string) => {
            if (!stats.has(k)) stats.set(k, { operating: new Set(), nonOperating: new Set() });
            return stats.get(k)!;
        };

        uniqueFilteredData.forEach(row => {
            const md = row.other_md_name_1;
            const mid = row.other_mgroupn_name;
            const small = row.other_sgroupn_name;
            const brand = row.company_brand_name;

            // Skip bad data or unmapped brands
            if (!md || !mid || !small || !brand) return;
            if (brand === '미매핑' || brand === '(미매핑)') return;

            const key = `${md}|${mid}|${small}|${brand}`;
            const status = brandStatus[key];

            if (status) {
                const targetSet = status.found ? 'operating' : 'nonOperating';

                // Add to MD level
                getOrInit(md)[targetSet].add(brand);

                // Add to Mid level
                getOrInit(`${md}|${mid}`)[targetSet].add(brand);

                // Add to Small level
                getOrInit(`${md}|${mid}|${small}`)[targetSet].add(brand);
            }
        });

        return stats;
    }, [uniqueFilteredData, brandStatus]);

    const renderRowsWithStatus = (nodes: Map<string, TreeItem>, level: number, pathContext: { md: string, mid: string, small: string }) => {
        const MD_CAT_ORDER = ['주방', '가전', '리빙', '푸드', '건강식품', '여행', '보험', '일반렌탈', '대품렌탈', '의류', '잡화', '뷰티', '레포츠', '언더웨어', '브랜드패션', '미매핑', '(미매핑)', '(없음)'];

        const sortedNodes = Array.from(nodes.values()).sort((a, b) => {
            if (level === 0) {
                const idxA = MD_CAT_ORDER.indexOf(a.name);
                const idxB = MD_CAT_ORDER.indexOf(b.name);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
            }
            return a.name.localeCompare(b.name);
        });

        return sortedNodes.map(node => {
            const newContext = { ...pathContext };
            if (level === 0) newContext.md = node.name;
            else if (level === 1) newContext.mid = node.name;
            else if (level === 2) newContext.small = node.name;

            const id = [pathContext.md, pathContext.mid, pathContext.small, node.name].filter(Boolean).join('-');
            const isExpanded = expanded.has(id);
            const indent = level * 20;
            const hasChildren = !node.isLeaf && node.children && node.children.size > 0;

            const rowBg = level === 0 ? '#f8f9fa' : (level === 1 ? '#fff' : '#fafafa');

            // Brand Status Check
            let contentElement = <Text size="sm" fw={level === 0 ? 700 : (level === 1 ? 500 : 400)}>{node.name}</Text>;

            // Add Brand Stats Count for Levels 0, 1, 2
            if (level < 3) {
                let key = "";
                if (level === 0) key = node.name;
                else if (level === 1) key = `${pathContext.md}|${node.name}`;
                else if (level === 2) key = `${pathContext.md}|${pathContext.mid}|${node.name}`;

                const stats = brandAggregatedStats.get(key);

                if (stats && (stats.nonOperating.size > 0 || stats.operating.size > 0)) {
                    contentElement = (
                        <Group gap={8}>
                            <Text size="sm" fw={level === 0 ? 700 : (level === 1 ? 500 : 400)}>{node.name}</Text>

                            {/* Non-Operating Badge */}
                            {stats.nonOperating.size > 0 && (
                                <Popover width={200} position="bottom" withArrow shadow="md">
                                    <Popover.Target>
                                        <Badge
                                            size="xs"
                                            color="red"
                                            variant="light"
                                            style={{ cursor: 'pointer', textTransform: 'none' }}
                                        >
                                            미운영 {stats.nonOperating.size}
                                        </Badge>
                                    </Popover.Target>
                                    <Popover.Dropdown>
                                        <Text size="xs" fw={700} mb={4}>미운영 브랜드 목록</Text>
                                        <ScrollArea.Autosize mah={200}>
                                            <Stack gap={4}>
                                                {Array.from(stats.nonOperating).sort().map(b => (
                                                    <Text key={b} size="xs" c="dimmed">• {b}</Text>
                                                ))}
                                            </Stack>
                                        </ScrollArea.Autosize>
                                    </Popover.Dropdown>
                                </Popover>
                            )}

                            {/* Operating Badge */}
                            {stats.operating.size > 0 && (
                                <Popover width={200} position="bottom" withArrow shadow="md">
                                    <Popover.Target>
                                        <Badge
                                            size="xs"
                                            color="blue"
                                            variant="light"
                                            style={{ cursor: 'pointer', textTransform: 'none' }}
                                        >
                                            운영 {stats.operating.size}
                                        </Badge>
                                    </Popover.Target>
                                    <Popover.Dropdown>
                                        <Text size="xs" fw={700} mb={4}>운영 브랜드 목록</Text>
                                        <ScrollArea.Autosize mah={200}>
                                            <Stack gap={4}>
                                                {Array.from(stats.operating).sort().map(b => (
                                                    <Text key={b} size="xs" c="blue">• {b}</Text>
                                                ))}
                                            </Stack>
                                        </ScrollArea.Autosize>
                                    </Popover.Dropdown>
                                </Popover>
                            )}
                        </Group>
                    );
                }
            }

            // Brand Level (Level 3)
            if (level === 3) {
                const key = `${newContext.md}|${newContext.mid}|${newContext.small}|${node.name}`;
                const status = brandStatus[key];

                if (status) {
                    if (!status.found) {
                        contentElement = (
                            <Popover width={500} position="bottom-start" withArrow shadow="md">
                                <Popover.Target>
                                    <Group gap={4} style={{ cursor: 'pointer' }}>
                                        <Text size="sm" c="dimmed">{node.name}</Text>
                                        <Badge size="xs" color="gray" variant="light">미운영</Badge>
                                    </Group>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Text size="xs" fw={700} mb="xs">경쟁사 편성 이력 (해당 기간)</Text>
                                    <ScrollArea.Autosize mah={300}>
                                        <Table striped highlightOnHover withTableBorder variant="vertical">
                                            <Table.Tbody>
                                                {uniqueFilteredData
                                                    .filter(r =>
                                                        r.other_md_name_1 === newContext.md &&
                                                        r.other_mgroupn_name === newContext.mid &&
                                                        r.other_sgroupn_name === newContext.small &&
                                                        r.company_brand_name === node.name
                                                    )
                                                    .sort((a, b) => (a.bd_date || '').localeCompare(b.bd_date || ''))
                                                    .map((row, i) => (
                                                        <Table.Tr
                                                            key={i}
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => onItemClick && onItemClick(row)}
                                                        >
                                                            <Table.Td style={{ fontSize: 11 }}>
                                                                <Group justify="space-between" mb={2}>
                                                                    <Text span fw={700} c="blue">{row.other_broad_name}</Text>
                                                                    <Text span c="dimmed">{row.bd_date} {row.other_btime}~{row.other_etime}</Text>
                                                                </Group>
                                                                <div style={{ fontWeight: 600 }}>{row.other_product_name}</div>
                                                                {row.product_sale_price && <div style={{ color: 'gray' }}>판매가: {row.product_sale_price.toLocaleString()}원</div>}
                                                            </Table.Td>
                                                        </Table.Tr>
                                                    ))}
                                            </Table.Tbody>
                                        </Table>
                                    </ScrollArea.Autosize>
                                </Popover.Dropdown>
                            </Popover>
                        );
                    } else {
                        contentElement = (
                            <Popover width={400} position="bottom-start" withArrow shadow="md">
                                <Popover.Target>
                                    <Group gap={4} style={{ cursor: 'pointer' }}>
                                        <Text size="sm" c="blue" fw={500}>{node.name}</Text>
                                        <ThemeIcon size="xs" variant="light" color="blue"><IconHistory size={10} /></ThemeIcon>
                                    </Group>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Text size="xs" fw={700} mb="xs">당사 방송 이력 ({status.count}건)</Text>
                                    <ScrollArea.Autosize mah={200}>
                                        <Table striped highlightOnHover withTableBorder variant="vertical">
                                            <Table.Tbody>
                                                {status.details.slice(0, 50).map((d: any, i: number) => (
                                                    <Table.Tr key={i}>
                                                        <Table.Td style={{ fontSize: 11 }}>
                                                            <div>{d.bd_date} {d.bd_btime}~{d.bd_etime}</div>
                                                            <div style={{ fontWeight: 600 }}>{d.prog_name}</div>
                                                            <div style={{ color: 'gray' }}>{d.goods_name}</div>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                ))}
                                            </Table.Tbody>
                                        </Table>
                                    </ScrollArea.Autosize>
                                </Popover.Dropdown>
                            </Popover>
                        );
                    }
                }
            }

            return (
                <MantineFragment key={id}>
                    <Table.Tr bg={rowBg}>
                        <Table.Td style={{ paddingLeft: indent + 10 }}>
                            <Group gap={8} wrap="nowrap">
                                {hasChildren && (
                                    <UnstyledButton onClick={() => toggleExpand(id)}>
                                        {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                    </UnstyledButton>
                                )}
                                {contentElement}
                            </Group>
                        </Table.Td>
                        {columns.map(col => {
                            const val = node.values[col] || 0;
                            return (
                                <Table.Td key={col} style={{ textAlign: 'right' }}>
                                    {val === 0 ? '-' : val.toFixed(2)}
                                </Table.Td>
                            );
                        })}
                        <Table.Td style={{ textAlign: 'right', fontWeight: 700, backgroundColor: '#f9f9f9' }}>
                            {(() => {
                                const total = columns.reduce((acc, col) => acc + (node.values[col] || 0), 0);
                                return total === 0 ? '-' : total.toFixed(2);
                            })()}
                        </Table.Td>
                    </Table.Tr>
                    {hasChildren && isExpanded && renderRowsWithStatus(node.children!, level + 1, newContext)}
                </MantineFragment>
            );
        });
    };

    return (
        <Stack gap="sm" align="stretch" style={{ height: '100%', overflow: 'hidden' }}>
            <Group>
                <Box style={{ width: 200 }}>
                    <FilterHeader
                        label="상품명 (Filter)"
                        values={uniqueValues.products}
                        selected={selectedFilters[KEY_PRODUCT] || new Set()}
                        onChange={(s) => handleFilterChange(KEY_PRODUCT, s)}
                    />
                </Box>
                <Text size="xs" c="dimmed" style={{ display: 'flex', alignItems: 'center' }}>
                    <Text span fw={700} mr={4}>* 미운영 판단 기준:</Text>
                    당사에서 25년 1월 1일부터 현재까지 운영중인 브랜드중 미운영인 경쟁사 브랜드.
                </Text>
            </Group>

            <ScrollArea style={{ flex: 1 }} type="auto">
                <Table withTableBorder withColumnBorders highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ width: 450, position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f9f9f9' }}>
                                <Group gap={0} wrap="nowrap" align="center">
                                    <Box style={{ flex: 1, minWidth: 0 }}>
                                        <FilterHeader
                                            label="MD CAT"
                                            values={uniqueValues.mds}
                                            selected={selectedFilters[KEY_MD] || new Set()}
                                            onChange={(s) => handleFilterChange(KEY_MD, s)}
                                        />
                                    </Box>
                                    <IconChevronRight size={12} style={{ opacity: 0.5, margin: '0 2px', flexShrink: 0 }} />

                                    <Box style={{ flex: 1, minWidth: 0 }}>
                                        <FilterHeader
                                            label="중분류"
                                            values={uniqueValues.mids}
                                            selected={selectedFilters[KEY_MID] || new Set()}
                                            onChange={(s) => handleFilterChange(KEY_MID, s)}
                                        />
                                    </Box>
                                    <IconChevronRight size={12} style={{ opacity: 0.5, margin: '0 2px', flexShrink: 0 }} />

                                    <Box style={{ flex: 1, minWidth: 0 }}>
                                        <FilterHeader
                                            label="소분류"
                                            values={uniqueValues.smalls}
                                            selected={selectedFilters[KEY_SMALL] || new Set()}
                                            onChange={(s) => handleFilterChange(KEY_SMALL, s)}
                                        />
                                    </Box>
                                    <IconChevronRight size={12} style={{ opacity: 0.5, margin: '0 2px', flexShrink: 0 }} />

                                    <Box style={{ flex: 1, minWidth: 0 }}>
                                        <FilterHeader
                                            label="브랜드"
                                            values={uniqueValues.brands}
                                            selected={selectedFilters[KEY_BRAND] || new Set()}
                                            onChange={(s) => handleFilterChange(KEY_BRAND, s)}
                                        />
                                    </Box>
                                    {checkingBrands && <IconSparkles size={16} className="mantine-rotate" style={{ marginLeft: 4 }} />}
                                </Group>
                            </Table.Th>
                            {columns.map(col => (
                                <Table.Th key={col} style={{ textAlign: 'center', minWidth: 70, position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f9f9f9' }}>
                                    <Text size="sm">{col}</Text>
                                </Table.Th>
                            ))}
                            <Table.Th style={{ textAlign: 'center', minWidth: 100, backgroundColor: '#f9f9f9', position: 'sticky', top: 0, zIndex: 10 }}>
                                <Text size="sm" fw={700}>분류별 가중시 합계</Text>
                            </Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {renderRowsWithStatus(tree, 0, { md: '', mid: '', small: '' })}
                        {Array.from(tree.keys()).length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={columns.length + 2} style={{ textAlign: 'center', padding: 20 }}>
                                    데이터가 없습니다.
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                    <Table.Tfoot>
                        <Table.Tr style={{ backgroundColor: '#f1f3f5', borderTop: '2px solid #dee2e6' }}>
                            <Table.Td style={{ fontWeight: 800, textAlign: 'center' }}>
                                방송사별 가중시 합계
                            </Table.Td>
                            {columns.map(col => {
                                const total = uniqueFilteredData
                                    .filter(r => (r.other_broad_name || '(미매핑)') === col)
                                    .reduce((acc, r) => acc + ((r.weights_time || 0) / 60), 0);
                                return (
                                    <Table.Td key={col} style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {total === 0 ? '-' : total.toFixed(2)}
                                    </Table.Td>
                                );
                            })}
                            <Table.Td style={{ textAlign: 'right', fontWeight: 800 }}>
                                {(() => {
                                    const colSet = new Set(columns);
                                    const total = uniqueFilteredData
                                        .filter(r => colSet.has(r.other_broad_name || '(미매핑)'))
                                        .reduce((acc, r) => acc + ((r.weights_time || 0) / 60), 0);
                                    return total === 0 ? '-' : total.toFixed(2);
                                })()}
                            </Table.Td>
                        </Table.Tr>
                    </Table.Tfoot>
                </Table>
            </ScrollArea>
        </Stack>
    );
}

const MantineFragment = ({ children }: { children: React.ReactNode }) => <>{children}</>;
