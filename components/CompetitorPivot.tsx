import React, { useState, useMemo } from 'react';
import { ScheduleRow } from '@/lib/db';
import {
    Table,
    Box,
    Text,
    Group,
    Checkbox,
    Popover,
    ScrollArea,
    Button,
    ActionIcon,
    Divider,
    TextInput,
    Badge,
    Collapse,
    UnstyledButton,
    Stack,
    Modal,
    ThemeIcon,
    Alert
} from '@mantine/core';
import { IconFilter, IconChevronRight, IconChevronDown, IconSearch, IconX, IconSparkles, IconInfoCircle } from '@tabler/icons-react';


interface Props {
    schedules: ScheduleRow[];
}

// Data Keys
const KEY_BROADCASTER = 'other_broad_name';
const KEY_MID = 'other_mgroupn_name';
const KEY_SMALL = 'other_sgroupn_name';
const KEY_BRAND = 'other_brand_name';
const KEY_PRODUCT = 'other_product_name';
const KEY_MD = 'other_md_name_1';

// Helper to get value
const getValue = (row: ScheduleRow, key: string): string => {
    return (row as any)[key] || '(없음)';
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

export default function CompetitorPivot({ schedules }: Props) {
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
            sets[KEY_BROADCASTER].add(row.other_broad_name || '(없음)');
            sets[KEY_MID].add(row.other_mgroupn_name || '(없음)');
            sets[KEY_SMALL].add(row.other_sgroupn_name || '(없음)');
            sets[KEY_BRAND].add(row.other_brand_name || '(없음)');
            sets[KEY_PRODUCT].add(row.other_product_name || '(없음)');
            sets[KEY_MD].add(row.other_md_name_1 || '(없음)');
        });

        // Convert to Arrays sorted
        return {
            broadcasters: Array.from(sets[KEY_BROADCASTER]).sort(),
            mids: Array.from(sets[KEY_MID]).sort(),
            smalls: Array.from(sets[KEY_SMALL]).sort(),
            brands: Array.from(sets[KEY_BRAND]).sort(),
            products: Array.from(sets[KEY_PRODUCT]).sort(),
            mds: Array.from(sets[KEY_MD]).sort(),
        };
    }, [schedules]);

    // 2. Filter State (All selected by default)
    const [selectedFilters, setSelectedFilters] = useState<{ [key: string]: Set<string> }>({});

    // Initialize state if empty
    useMemo(() => {
        if (Object.keys(selectedFilters).length === 0 && schedules.length > 0) {
            // Filter Mids: Only those with valid Small AND Brand
            const validMids = new Set<string>();
            schedules.forEach(row => {
                const mid = row.other_mgroupn_name || '(없음)';
                const small = row.other_sgroupn_name;
                const brand = row.other_brand_name;
                if (small && brand) {
                    validMids.add(mid);
                }
            });

            // Note: If validMids is empty (weird?), maybe fallback to all? 
            // The requirement implies filtering. If none, none checked.

            setSelectedFilters({
                [KEY_BROADCASTER]: new Set(uniqueValues.broadcasters),
                [KEY_MID]: validMids,
                [KEY_SMALL]: new Set(uniqueValues.smalls),
                [KEY_BRAND]: new Set(uniqueValues.brands),
                [KEY_PRODUCT]: new Set(uniqueValues.products),
                [KEY_MD]: new Set(uniqueValues.mds),
            });
        }
    }, [uniqueValues, schedules]); // Wait for uniqueValues

    // Handle Change
    const handleFilterChange = (key: string, set: Set<string>) => {
        setSelectedFilters(prev => ({ ...prev, [key]: set }));
    };

    // 3. Filter Data
    const filteredData = useMemo(() => {
        if (Object.keys(selectedFilters).length === 0) return schedules;

        return schedules.filter(row => {
            const b = row.other_broad_name || '(없음)';
            const m = row.other_mgroupn_name || '(없음)';
            const s = row.other_sgroupn_name || '(없음)';
            const br = row.other_brand_name || '(없음)';
            const p = row.other_product_name || '(없음)';
            const md = row.other_md_name_1 || '(없음)';

            // Safe check: if key not in filter (not initialized?), assume true
            if (selectedFilters[KEY_BROADCASTER] && !selectedFilters[KEY_BROADCASTER].has(b)) return false;
            if (selectedFilters[KEY_MID] && !selectedFilters[KEY_MID].has(m)) return false;
            if (selectedFilters[KEY_SMALL] && !selectedFilters[KEY_SMALL].has(s)) return false;
            if (selectedFilters[KEY_BRAND] && !selectedFilters[KEY_BRAND].has(br)) return false;
            if (selectedFilters[KEY_PRODUCT] && !selectedFilters[KEY_PRODUCT].has(p)) return false;
            if (selectedFilters[KEY_MD] && !selectedFilters[KEY_MD].has(md)) return false;

            return true;
        });
    }, [schedules, selectedFilters]);

    // 4. Pivot Logic
    // Tree: Mid -> Small -> Brand
    // Value: Sum(weights_time / 60) per Broadcaster
    type TreeItem = {
        name: string;
        isLeaf: boolean;
        children?: Map<string, TreeItem>; // Map for fast lookup
        values: { [broadcaster: string]: number }; // Sum
    };

    const tree = useMemo(() => {
        const root = new Map<string, TreeItem>(); // Key: Mid

        filteredData.forEach(row => {
            const mid = row.other_mgroupn_name || '(없음)';
            const small = row.other_sgroupn_name || '(없음)';
            const brand = row.other_brand_name || '(없음)';
            const broadcaster = row.other_broad_name || '(없음)';
            const weight = (row.weights_time || 0) / 60; // Minutes to Hours? Or Minutes? User said 'weights_time / 60'. Assuming weights_time is minutes, result is hours.

            // 1. Mid Node
            if (!root.has(mid)) {
                root.set(mid, { name: mid, isLeaf: false, children: new Map(), values: {} });
            }
            const midNode = root.get(mid)!;
            midNode.values[broadcaster] = (midNode.values[broadcaster] || 0) + weight;

            // 2. Small Node
            if (!midNode.children!.has(small)) {
                midNode.children!.set(small, { name: small, isLeaf: false, children: new Map(), values: {} });
            }
            const smallNode = midNode.children!.get(small)!;
            smallNode.values[broadcaster] = (smallNode.values[broadcaster] || 0) + weight;

            // 3. Brand Node (Leaf in this view, though it might aggregate multiple rows)
            if (!smallNode.children!.has(brand)) {
                smallNode.children!.set(brand, { name: brand, isLeaf: true, values: {} });
            }
            const brandNode = smallNode.children!.get(brand)!;
            brandNode.values[broadcaster] = (brandNode.values[broadcaster] || 0) + weight;
        });

        return root;
    }, [filteredData]);

    // 5. Sorted Columns (Only visible broadcasters based on selection OR data?)
    const columns = useMemo(() => {
        const list = uniqueValues.broadcasters;
        if (!selectedFilters[KEY_BROADCASTER]) return list;
        return list.filter(b => selectedFilters[KEY_BROADCASTER].has(b));
    }, [uniqueValues.broadcasters, selectedFilters]);

    // 7. Calculate Top 5 Mids for Ranking
    const top5Mids = useMemo(() => {
        const midTotals: { name: string, total: number }[] = [];
        tree.forEach((node) => {
            // Calculate total for visible columns only
            const total = columns.reduce((acc, col) => acc + (node.values[col] || 0), 0);
            midTotals.push({ name: node.name, total });
        });

        // Sort descending
        midTotals.sort((a, b) => b.total - a.total);

        // Take top 5 and map to rank (1-based)
        const rankMap = new Map<string, number>();
        midTotals.slice(0, 5).forEach((item, index) => {
            if (item.total > 0) { // Only rank if total > 0
                rankMap.set(item.name, index + 1);
            }
        });
        return rankMap;
    }, [tree, columns]);

    // 6. Expansion State
    const [expanded, setExpanded] = useState<Set<string>>(new Set());


    const toggleExpand = (id: string) => {
        const newSet = new Set(expanded);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpanded(newSet);
    };

    // Render Row Helper
    const renderRows = (nodes: Map<string, TreeItem>, level: number, parentId: string) => {
        // Sort nodes by name?
        const sortedNodes = Array.from(nodes.values()).sort((a, b) => a.name.localeCompare(b.name));

        return sortedNodes.map(node => {
            const id = parentId ? `${parentId}-${node.name}` : node.name;
            const isExpanded = expanded.has(id);
            const indent = level * 20;

            const hasChildren = !node.isLeaf && node.children && node.children.size > 0;

            // Ranking Logic (Only for Level 0)
            const rank = (level === 0) ? top5Mids.get(node.name) : undefined;
            let rowBg = level === 0 ? '#f8f9fa' : (level === 1 ? '#fff' : '#fafafa'); // Default
            let badge = null;

            if (rank) {
                if (rank === 1) {
                    rowBg = '#fff9db';
                    badge = <Badge color="yellow" variant="filled" size="xs" circle style={{ width: 16, height: 16, minWidth: 16, padding: 0 }}>{rank}</Badge>;
                }
                else if (rank === 2) {
                    rowBg = '#f1f3f5';
                    badge = <Badge color="gray" variant="filled" size="xs" circle style={{ width: 16, height: 16, minWidth: 16, padding: 0 }}>{rank}</Badge>;
                }
                else if (rank === 3) {
                    rowBg = '#fff4e6';
                    badge = <Badge color="orange" variant="filled" size="xs" circle style={{ width: 16, height: 16, minWidth: 16, padding: 0 }}>{rank}</Badge>;
                }
                else {
                    badge = <Badge color="blue" variant="filled" size="xs" circle style={{ width: 16, height: 16, minWidth: 16, padding: 0 }}>{rank}</Badge>;
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
                                {badge && <Box style={{ display: 'flex' }}>{badge}</Box>}
                                <Text size="sm" fw={level === 0 ? 700 : (level === 1 ? 500 : 400)}>
                                    {node.name}
                                </Text>
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
                        <Table.Td style={{ textAlign: 'right', fontWeight: 700, backgroundColor: rank ? 'transparent' : '#f9f9f9' }}>
                            {(() => {
                                const total = columns.reduce((acc, col) => acc + (node.values[col] || 0), 0);
                                return total === 0 ? '-' : total.toFixed(2);
                            })()}
                        </Table.Td>
                    </Table.Tr>
                    {hasChildren && isExpanded && renderRows(node.children!, level + 1, id)}
                </MantineFragment>
            );
        });
    };

    // Global Filter Bar (Product & MD)
    // "상단에 배치"
    return (
        <Stack gap="sm" align="stretch" style={{ height: '100%', overflow: 'hidden' }}>
            {/* Global Filters */}
            <Group>
                <Box style={{ width: 200 }}>
                    <FilterHeader
                        label="상품명 (Filter)"
                        values={uniqueValues.products}
                        selected={selectedFilters[KEY_PRODUCT] || new Set()}
                        onChange={(s) => handleFilterChange(KEY_PRODUCT, s)}
                    />
                </Box>
                <Box style={{ width: 200 }}>
                    <FilterHeader
                        label="MD CAT (Filter)"
                        values={uniqueValues.mds}
                        selected={selectedFilters[KEY_MD] || new Set()}
                        onChange={(s) => handleFilterChange(KEY_MD, s)}
                    />
                </Box>
            </Group>

            <ScrollArea style={{ flex: 1 }} type="auto">
                <Table withTableBorder withColumnBorders highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ width: 300, position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f9f9f9' }}>
                                <Group gap={0} wrap="nowrap" align="center">
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
                                </Group>
                            </Table.Th>
                            {columns.map(col => (
                                <Table.Th key={col} style={{ textAlign: 'center', minWidth: 100, position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f9f9f9' }}>
                                    <Text size="sm">{col}</Text>
                                </Table.Th>
                            ))}
                            <Table.Th style={{ textAlign: 'center', minWidth: 100, backgroundColor: '#f9f9f9', position: 'sticky', top: 0, zIndex: 10 }}>
                                <Text size="sm" fw={700}>분류별 가중시 합계</Text>
                            </Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {renderRows(tree, 0, '')}
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
                                const total = filteredData
                                    .filter(r => (r.other_broad_name || '(없음)') === col)
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
                                    const total = filteredData
                                        .filter(r => colSet.has(r.other_broad_name || '(없음)'))
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



// Helper component for fragment to avoid key warning issues with map
const MantineFragment = ({ children }: { children: React.ReactNode }) => <>{children}</>;
