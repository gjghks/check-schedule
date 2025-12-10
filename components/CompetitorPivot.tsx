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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Props {
    schedules: ScheduleRow[];
}

// Data Keys
const KEY_BROADCASTER = 'other_broad_name'; // Column
const KEY_MID = 'OTHER_MGROUPN_NAME'; // Row 1 (from raw)
const KEY_SMALL = 'OTHER_SGROUPN_NAME'; // Row 2 (from raw)
const KEY_BRAND = 'OTHER_BRAND_NAME'; // Row 3 (from raw)
const KEY_PRODUCT = 'OTHER_PRODUCT_NAME'; // Filter (from raw or col) - Use col 'other_product_name'
const KEY_MD = 'OTHER_MD_NAME_1'; // Filter (from raw) - Use raw

// Helper to get value
const getValue = (row: ScheduleRow, key: string, isRaw: boolean): string => {
    if (isRaw) {
        try {
            const raw = JSON.parse(row.raw_data || '{}');
            return raw[key] || '(없음)';
        } catch {
            return '(없음)';
        }
    }
    return (row as any)[key] || '(없음)'; // Broadcaster is in root
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
            const raw = JSON.parse(row.raw_data || '{}');
            sets[KEY_BROADCASTER].add(row.other_broad_name || '(없음)');
            sets[KEY_MID].add(raw[KEY_MID] || '(없음)');
            sets[KEY_SMALL].add(raw[KEY_SMALL] || '(없음)');
            sets[KEY_BRAND].add(raw[KEY_BRAND] || '(없음)');
            sets[KEY_PRODUCT].add(row.other_product_name || '(없음)');
            sets[KEY_MD].add(raw[KEY_MD] || '(없음)');
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
                const raw = JSON.parse(row.raw_data || '{}');
                const mid = raw[KEY_MID] || '(없음)';
                const small = raw[KEY_SMALL]; // Check raw existence
                const brand = raw[KEY_BRAND];
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
            const raw = JSON.parse(row.raw_data || '{}');
            const b = row.other_broad_name || '(없음)';
            const m = raw[KEY_MID] || '(없음)';
            const s = raw[KEY_SMALL] || '(없음)';
            const br = raw[KEY_BRAND] || '(없음)';
            const p = row.other_product_name || '(없음)';
            const md = raw[KEY_MD] || '(없음)';

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
            const raw = JSON.parse(row.raw_data || '{}');
            const mid = raw[KEY_MID] || '(없음)';
            const small = raw[KEY_SMALL] || '(없음)';
            const brand = raw[KEY_BRAND] || '(없음)';
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
    const [aiModalOpen, setAiModalOpen] = useState(false);

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
                <Button
                    leftSection={<IconSparkles size={16} />}
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'cyan', deg: 90 }}
                    onClick={() => setAiModalOpen(true)}
                >
                    생성형 AI 분석
                </Button>
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
            <Modal
                opened={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                title={<Group gap={8}><IconSparkles size={20} color="#7950f2" /><Text fw={700} size="lg">경쟁사 편성 데이터 AI 분석 결과</Text></Group>}
                size="70%"
                padding="md"
            >
                <ScrollArea.Autosize mah="70vh" type="auto">
                    <AiSummaryContent />
                </ScrollArea.Autosize>
            </Modal>
        </Stack>
    );
}

function AiSummaryContent() {
    return (
        <Stack gap="lg" p="xs">
            {/* 0. Summary */}
            <Box>
                <Text fw={700} size="xl" mb="sm" c="violet">요약</Text>
                <Alert variant="light" color="violet" icon={<IconSparkles />}>
                    <Stack gap="xs">
                        <Text size="sm"><b>분석 범위:</b> 2025-12-08 ~ 2025-12-14 · 방송사: 롯데, CJ · MD CAT: 의류</Text>
                        <Text size="sm"><b>편성 규모:</b> 총 64건 · 총 방송 4,360분 (슬롯당 평균 68.1분)</Text>
                        <Text size="sm"><b>핵심 인사이트 1줄:</b> 여성 의류, 특히 아우터·니트 중심 편성 구조로 프라임·주간 롱런 슬롯과 심야 단기 슬롯을 조합한 운영 패턴.</Text>
                        <Text size="sm"><b>핵심 인사이트 2줄:</b> 25FW 신상품 편성이 84.4%를 차지하며, 25SS는 주로 심야·비프라임에 배치된 재고/클리어런스 성격.</Text>
                        <Text size="sm"><b>핵심 인사이트 3줄:</b> CJ는 고가/프리미엄, 롯데는 중가 위주 가격 포지셔닝과 방송사별 전용 브랜드 구성을 통해 명확한 차별화 전략을 취함.</Text>
                    </Stack>
                </Alert>
            </Box>

            <Box mt="md" mb="md">
                <Text fw={700} size="lg" mb="sm">시각화 분석</Text>
                <Group grow align="start">
                    <Stack align="center" gap="xs">
                        <Text size="sm" fw={700} c="dimmed">시간대별 슬롯 비중</Text>
                        <Box style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: '심야(0~6시)', value: 43.8, color: '#4c6ef5' },
                                            { name: '아침(6~10시)', value: 17.2, color: '#fab005' },
                                            { name: '주간(10~18시)', value: 17.2, color: '#82c91e' },
                                            { name: '프라임(18~24시)', value: 21.9, color: '#fa5252' },
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {[
                                            { name: '심야(0~6시)', value: 43.8, color: '#4c6ef5' },
                                            { name: '아침(6~10시)', value: 17.2, color: '#fab005' },
                                            { name: '주간(10~18시)', value: 17.2, color: '#82c91e' },
                                            { name: '프라임(18~24시)', value: 21.9, color: '#fa5252' },
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </Box>
                        <Alert variant="light" color="blue" title="Insight" p="xs">
                            <Text size="xs">심야 시간이 <b>43.8%</b>로 가장 높은 비중을 차지하며, 재고 소진 및 테스트 편성이 집중됨.</Text>
                        </Alert>
                    </Stack>

                    <Stack align="center" gap="xs">
                        <Text size="sm" fw={700} c="dimmed">방송사별 편성 규모 비교</Text>
                        <Box style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        { name: '롯데', slots: 35, minutes: 2440 },
                                        { name: 'CJ', slots: 29, minutes: 1920 },
                                    ]}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: '슬롯(건)', angle: -90, position: 'insideLeft' }} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: '시간(분)', angle: 90, position: 'insideRight' }} />
                                    <RechartsTooltip />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="slots" name="슬롯 수" fill="#8884d8" barSize={30} />
                                    <Bar yAxisId="right" dataKey="minutes" name="방송 시간" fill="#82ca9d" barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                        <Alert variant="light" color="green" title="Insight" p="xs">
                            <Text size="xs">롯데가 슬롯 수 및 방송 시간 모두 소폭 우위이나, 양사 모두 <b>효율적 운영 전략</b> 유사.</Text>
                        </Alert>
                    </Stack>
                </Group>
            </Box>

            <Divider />

            {/* 1. Data Overview */}
            <Box>
                <Text fw={700} size="lg" mb="sm">1. 데이터 개요</Text>
                <Stack gap="sm">
                    <Box>
                        <Text size="sm" fw={700}>• 조회 조건</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 편성일: 2025-12-08 ~ 2025-12-14</Text>
                            <Text size="sm" c="dimmed">- 방송사: 롯데, CJ</Text>
                            <Text size="sm" c="dimmed">- MD CAT: 의류 (전체 64건 모두 의류로 매핑)</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 편성 규모</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 총 편성 슬롯: 64건</Text>
                            <Text size="sm" c="dimmed">- 총 방송 시간: 4,360분 (약 72.7시간)</Text>
                            <Text size="sm" c="dimmed">- 슬롯당 평균 방송 시간: 68.1분</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 데이터 범위·제한</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 포함 필드: 방송사, 편성일시, 대·중·소분류, 브랜드, 상품명, 판매가, MD CAT, 타사아이템코드/명.</Text>
                            <Text size="sm" c="dimmed">- 주의사항: 의류 중심으로 사전 필터링된 샘플이며, 시즌 정보는 상품명 텍스트(25FW/25SS) 기반 추출로 일부 미표기(4.7%).</Text>
                        </Stack>
                    </Box>
                </Stack>
            </Box>

            {/* 2. Structure Insight */}
            <Box>
                <Text fw={700} size="lg" mb="sm">2. 편성 구조 인사이트</Text>
                <Stack gap="sm">
                    <Box>
                        <Text size="sm" fw={700}>• 시간대별 편성 패턴</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 주요 시간대 구간: 심야(0~6시) / 아침(6~10시) / 주간(10~18시) / 프라임(18~24시)</Text>
                            <Text size="sm" c="dimmed">- 슬롯 분포: 심야 43.8%(28건) · 아침 17.2%(11건) · 주간 17.2%(11건) · 프라임 21.9%(14건)</Text>
                            <Text size="sm" c="dimmed">- 방송 시간 분포: 심야 17.8%(775분) · 아침 23.9%(1,040분) · 주간 25.7%(1,120분) · 프라임 32.7%(1,425분)</Text>
                            <Text size="sm" c="dimmed">- 특징 요약: 심야는 평균 27.7분의 짧은 편성이 다수이고, 아침·주간·프라임은 90~100분대 롱런 편성이 기본값.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 요일별 편성 패턴</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 요일별 편성 건수: 평일(월~금) 52건(81.3%) · 주말(토·일) 12건(18.8%)로 평일 편성 집중.</Text>
                            <Text size="sm" c="dimmed">- 요일별 방송 시간: 월~금 합산 3,550분(81.4%) · 토 525분(12.0%) · 일 285분(6.5%).</Text>
                            <Text size="sm" c="dimmed">- 요일별 핵심 특징: 의류 편성은 주중에 몰고, 주말에는 상대적으로 의류 비중을 낮추는 운영 패턴으로 해석 가능.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 방송사별 운영 차이</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 방송사별 편성 비중: 롯데 35건(54.7%, 2,440분/56.0%) · CJ 29건(45.3%, 1,920분/44.0%).</Text>
                            <Text size="sm" c="dimmed">- 슬롯당 평균 방송 시간: 롯데 69.7분 · CJ 66.2분으로 유사한 수준.</Text>
                            <Text size="sm" c="dimmed">- 특징 요약: 롯데가 물량과 총 방송 시간에서 소폭 우위이며, 두 방송사 모두 “1시간 내외 롱런 + 심야 단기 슬롯” 조합을 활용.</Text>
                        </Stack>
                    </Box>
                </Stack>
            </Box>

            {/* 3. Category/Product */}
            <Box>
                <Text fw={700} size="lg" mb="sm">3. 카테고리·상품 인사이트</Text>
                <Stack gap="sm">
                    <Box>
                        <Text size="sm" fw={700}>• 카테고리 구성</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 대분류 비중: 의류 98.4%(63건) · 스포츠/레저 1.6%(1건, 여성 골프의류).</Text>
                            <Text size="sm" c="dimmed">- 중분류 비중: 여성의류 90.6%(58건) · 남성의류 7.8%(5건) · 골프 1.6%(1건).</Text>
                            <Text size="sm" c="dimmed">- 소분류 상위: 자켓/코트 35.9%(23건) · 니트/스웨터 20.3%(13건) · 패딩 점퍼 10.9%(7건) · 팬츠/바지 9.4%(6건).</Text>
                            <Text size="sm" c="dimmed">- 핵심 메시지: 슬롯의 절반 이상이 아우터(자켓/코트·패딩)와 니트로 구성된 여성 중심 편성 구조이며, 남성·골프 카테고리는 보조적 역할.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 시즌 구성(FW/SS 등)</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 시즌별 비중: 25FW 84.4%(54건) · 25SS 10.9%(7건) · 시즌 미표기 4.7%(3건).</Text>
                            <Text size="sm" c="dimmed">- 시즌별 시간대 패턴: 25SS 7건 중 심야 5건 · 아침 1건 · 주간 1건으로, 구 시즌 상품은 주로 심야·비프라임에 배치.</Text>
                            <Text size="sm" c="dimmed">- 해석: 25FW 신상품 중심의 메인 편성 구조이며, 25SS는 재고 소진/클리어런스 성격으로 심야 슬롯을 활용하는 전략.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 가격대 구조</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 가격 분포: 최소 39,900원 · 중앙값 129,000원 · 평균 약 223,000원 · 최대 1,990,000원.</Text>
                            <Text size="sm" c="dimmed">- 가격대 구간별 비중: 10만 미만 34.4%(22건) · 10~20만 43.8%(28건) · 20~30만 7.8%(5건) · 30만 이상 14.1%(9건).</Text>
                            <Text size="sm" c="dimmed">- 시간대·가격대 관계: 30만 이상 고가 상품 9건 중 44%가 심야, 22%가 주간, 22%가 프라임에 편성되어 고가 아우터도 심야 다회 노출 전략을 활용.</Text>
                        </Stack>
                    </Box>
                </Stack>
            </Box>

            {/* 4. Brand/Item */}
            <Box>
                <Text fw={700} size="lg" mb="sm">4. 브랜드·아이템 인사이트</Text>
                <Stack gap="sm">
                    <Box>
                        <Text size="sm" fw={700}>• 브랜드 집중도</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 상위 브랜드 Top5(공백 제거 기준): 셀렙샵 7회 · 시슬리 5회 · 3.1필립림 4회 · ST.JOHN 3회 · 오일릴리 3회.</Text>
                            <Text size="sm" c="dimmed">- 브랜드 집중도: 상위 5개 브랜드가 전체 슬롯의 34.4%(22/64)를 차지.</Text>
                            <Text size="sm" c="dimmed">- 브랜드 포트폴리오 특징: 여성 프리미엄/컨템포러리 브랜드 비중이 높고, 일부 남성·골프·캐주얼 브랜드가 보강하는 구조.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 방송사-브랜드 매트릭스</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 양 방송사에 동시에 편성된 브랜드는 없음(브랜드_norm 기준, CJ·롯데 모두 0보다 큰 브랜드 없음).</Text>
                            <Text size="sm" c="dimmed">- 롯데 전용 대표 브랜드: 시슬리, 3.1필립림, LBL, 오일릴리, 폴앤조, USPA, 아르마니익스체인지 등.</Text>
                            <Text size="sm" c="dimmed">- CJ 전용 대표 브랜드: 셀렙샵, ST.JOHN, 더엣지, 로보, 에디바우어, 힐크릭, 페어라이어 등.</Text>
                            <Text size="sm" c="dimmed">- 특징: 방송사별로 브랜드 포트폴리오를 사실상 분리 운영하여, 채널 아이덴티티를 브랜드 레벨에서 차별화.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 반복 편성 패턴</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 동일 상품/라인업의 주간 내 반복 횟수: 동일 상품명 기준 2~3회 이상 반복된 상품이 10개, 전체 슬롯의 약 32.8%(21/64)를 차지.</Text>
                            <Text size="sm" c="dimmed">- 반복 시간대 패턴: 반복 편성 노출의 76%가 심야(0~6시)에 집중되어, 심야 다회 노출로 판매·반응을 누적시키는 전략으로 보임.</Text>
                            <Text size="sm" c="dimmed">- 대표 사례: 시슬리 25SS 점퍼/자켓, BOB 다운 점퍼, 콜롬보 카멜100 코트, 다니엘크레뮤 본딩 슬랙스 등 동일 상품이 심야 위주로 여러 차례 편성.</Text>
                            <Text size="sm" c="dimmed">- 해석: 심야 테스트 및 재방을 통해 수요 검증 후, 일부 상품을 주간/프라임으로 승격시키는 스테이지형 운영 가능성이 높음.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 아이템 코드 활용 방식(선택)</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 동일 아이템 코드에 여러 상품명이 묶인 사례 존재(예: 코드 00000596이 다양한 셀렙샵/셀렙샵에디션 아우터 상품을 포함).</Text>
                            <Text size="sm" c="dimmed">- 코드 단위 해석: 개별 SKU보다는 브랜드·라인업(예: 셀렙샵에디션_패딩/점퍼) 단위로 묶는 상위 코드로 활용되는 구조로 추정.</Text>
                        </Stack>
                    </Box>
                </Stack>
            </Box>

            {/* 5. Quality/Outliers */}
            <Box>
                <Text fw={700} size="lg" mb="sm">5. 데이터 품질·이상치 체크</Text>
                <Stack gap="sm">
                    <Box>
                        <Text size="sm" fw={700}>• 브랜드/카테고리 표기 이슈</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 브랜드명 표기 불일치: ‘3.1 필립 림’ vs ‘3.1필립림’, ‘폴 앤조’ vs ‘폴앤조’ 등 공백 여부에 따라 다른 값으로 인식될 위험.</Text>
                            <Text size="sm" c="dimmed">- 카테고리 불일치: 대분류 ‘스포츠/레저’이지만 MD CAT는 ‘의류’로 매핑된 여성 골프의류 1건 존재.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 가격·시간 데이터 이슈</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 가격 데이터는 전 건 숫자 변환 가능하며, 명확한 누락값/0원 데이터는 없음.</Text>
                            <Text size="sm" c="dimmed">- 편성시간 극단값: 최소 15분(주로 심야 짧은 슬롯) · 최대 150분(프라임/심야 롱런 특집)으로, 운영 전략 관점의 선택으로 해석 가능.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 분석 시 유의사항</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 시즌 미표기 상품(3건)은 상품명 외 추가 정보 없이 FW/SS 구분이 어려우므로, 시즌별 실적/편성 분석 시 별도 처리 필요.</Text>
                            <Text size="sm" c="dimmed">- 타사아이템코드는 라인업 단위 코드로 보이므로, SKU 단위 분석보다는 슬롯·브랜드·카테고리 기준 분석에 적합.</Text>
                        </Stack>
                    </Box>
                </Stack>
            </Box>

            {/* 6. Insights */}
            <Box>
                <Text fw={700} size="lg" mb="sm">6. 당사 시사점 및 액션 아이템</Text>
                <Stack gap="sm">
                    <Box>
                        <Text size="sm" fw={700}>• 편성 전략 시사점</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 시간대 전략: 신상/고가 아우터는 프라임·주간 롱런 + 심야 반복 편성 조합, 구 시즌/25SS는 심야 위주 편성이라는 구조를 벤치마킹 가능.</Text>
                            <Text size="sm" c="dimmed">- 카테고리 믹스: 평일에 의류(특히 여성 아우터)를 집중시키고, 주말에는 타 카테고리 비중을 높이는 형태로 카테고리 믹스를 설계할 수 있음.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 브랜드·상품 전략 시사점</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 브랜드 포트폴리오: 타사는 방송사별 전용 브랜드 전략으로 차별화 중이며, 당사는 공백 브랜드/가격대 포지셔닝 또는 동일 브랜드의 다른 스토리텔링·구성으로 차별화 여지.</Text>
                            <Text size="sm" c="dimmed">- 반복 편성/재방 전략: 심야 다회 노출 → 성과 검증 → 핵심 시간대 승격이라는 구조를 당사 반복 편성 정책 및 추천 로직에 적용 가능.</Text>
                        </Stack>
                    </Box>
                    <Box>
                        <Text size="sm" fw={700}>• 운영·시스템 측 시사점</Text>
                        <Stack gap={4} pl="md" mt={4}>
                            <Text size="sm" c="dimmed">- 데이터 정제 필요 영역: 브랜드 공백 제거(‘3.1필립림’, ‘폴앤조’ 등)와 시즌 태깅 자동화, 대분류·MD CAT 정합성 체크 로직 확보.</Text>
                            <Text size="sm" c="dimmed">- 추천/에이전트 활용 아이디어: 타사 시간대·시즌·가격대 패턴을 학습시켜, 우리 편성표에 대해 “어떤 상품을 언제·몇 분 편성할지” 자동 제안하는 에이전트 설계에 활용 가능.</Text>
                        </Stack>
                    </Box>
                </Stack>
            </Box>
        </Stack>
    );
}

// Helper component for fragment to avoid key warning issues with map
const MantineFragment = ({ children }: { children: React.ReactNode }) => <>{children}</>;
