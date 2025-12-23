'use client';

import { useEffect, useState, useMemo } from 'react';
import { Table, ScrollArea, Box, Text, Group, LoadingOverlay, Card, Badge, ThemeIcon, Alert } from '@mantine/core';
import { IconArrowUp, IconArrowDown, IconCalendar, IconChevronRight, IconChevronDown } from '@tabler/icons-react';


interface RatioData {
    info: string;
    data: any[][];
    error?: string;
}

export default function CompetitorRatioTab() {
    const [data, setData] = useState<RatioData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/competitor-ratio')
            .then((res) => res.json())
            .then((res) => {
                console.log('Competitor Ratio API Response:', res);
                setData(res);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Fetch error:', err);
                setLoading(false);
            });
    }, []);

    // Hierarchy Processing
    const processedMap = useMemo(() => {
        if (!data || !data.data) return [];

        const rows: any[] = [];
        // Stack to track current parents: [Level 0 Parent ID, Level 1 Parent ID, ...]
        const parentStack: number[] = [];

        // Filter empty rows first
        const validData = data.data.filter(r => r[0]);

        validData.forEach((row, index) => {
            // Heuristic for Level:
            // Level 0: "상품N담당(소계)", "합계", "MD CAT 미매핑(소계)" -> No "└─"
            // Level 1: "   └─ Team(소계)" -> Contains "└─" AND "(소계)"
            // Level 2: "        └─ Category" -> Contains "└─" AND NO "(소계)"? 
            // Be careful with "MD CAT 미매핑" -> "└─ 미매핑(소계)". This is Level 0 -> Level 1.
            // Actually, let's use the raw string inspection.

            const rawName = String(row[1] || '');
            const nameClean = rawName.replace(/ㄴ/g, '').replace(/_/g, '').trim().replace(/^└─\s*/, '');

            let level = 0;
            if (rawName.includes('└─')) {
                // Check indentation roughly by length difference or strict unicode check
                // In the data log: 
                // Level 1: 3 NBSP + └─ (Char index ~3)
                // Level 2: 8 NBSP + └─ (Char index ~8)
                // Let's assume simpler: 
                // If it has "(소계)" and "└─", it's likely Level 1 (Team).
                // If it has "└─" but NO "(소계)", it's likely Level 2 (Category).
                // EXCEPT "미매핑(소계)" under "MD CAT". 

                // Better heuristic using known prefixes from previous steps if possible, 
                // but dynamic is better.

                // Let's count approximate leading spaces if possible, but row[1] might be cleaned.
                // The 'paddingLeft' logic previously used:
                // startsWith('ㄴ') ? 20 : (startsWith('__') ? 30 : 10)
                // Inspect the raw strings from previous JSON logs:
                // "   └─ " vs "        └─ "

                // Let's try:
                if (rawName.match(/^\s{5,}/) || rawName.includes('        └─')) {
                    level = 2;
                } else {
                    level = 1;
                }

                // Fallback for "미매핑(소계)" which acts as child of Level 0 but might look like Level 1.
                // If parentStack has only Level 0, and this is Level 1, good.
            } else {
                level = 0;
            }

            // Setup ID
            const id = index;

            // Update Stack
            // If current level is X, we need parent at X-1.
            // Ensure stack is correct size.
            // If we find Level 0, clear stack.
            // If Level 1, keep Level 0 in stack, remove Level 1+ if any.

            if (level === 0) {
                parentStack.length = 0; // Reset
                parentStack[0] = id;
            } else if (level === 1) {
                parentStack.length = 1; // Keep Level 0
                parentStack[1] = id;
            } else {
                // Level 2
                parentStack.length = 2; // Keep Level 0, 1
                // We don't push Level 2 to stack as it has no children in this dataset usually
            }

            const parentId = level > 0 ? parentStack[level - 1] : null;

            rows.push({
                ...row,
                id,
                level,
                parentId,
                nameDisplay: nameClean,
                hasChildren: false // Will update later
            });
        });

        // Second pass to set hasChildren
        const idMap = new Map(rows.map(r => [r.id, r]));
        rows.forEach(r => {
            if (r.parentId !== null) {
                const p = idMap.get(r.parentId);
                if (p) p.hasChildren = true;
            }
        });

        return rows;
    }, [data]);

    // Expanded State
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    // Default collapsed: we simply do not automatically add IDs to expanded set.

    const toggleExpand = (id: number) => {
        const newSet = new Set(expanded);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpanded(newSet);
    };

    // Filter Visible
    const visibleRows = processedMap.filter(r => {
        if (r.parentId === null) return true; // Always show roots
        // Show if Parent is Expanded.
        // What if Grandparent is collapsed? We need to check recursive or just parent?
        // Usually recursive check.
        // Check lineage.
        let curr = r;
        while (curr.parentId !== null) {
            if (!expanded.has(curr.parentId)) return false;
            curr = processedMap.find((x: any) => x.id === curr.parentId);
            // Optimization: Map access would be faster but array find is OK for small text
            if (!curr) break;
        }
        return true;
    });

    if (loading) {
        return <Box h={300} pos="relative"><LoadingOverlay visible={true} /></Box>;
    }

    if (!data) return <Text>데이터를 불러올 수 없습니다.</Text>;
    if (data.error) return <Alert color="red" title="오류">{data.error}</Alert>;
    if (!data.data || !Array.isArray(data.data)) return <Text>데이터 형식이 올바르지 않습니다.</Text>;

    const renderArrowValue = (val: string) => {
        if (!val) return '';
        let str = String(val);
        let numVal = parseFloat(str.replace('%', ''));

        // If it already has arrows, trust the existing logic or just color it
        if (str.includes('▼') || str.includes('▲')) {
            const hasDown = str.includes('▼');
            const hasUp = str.includes('▲');
            let color = 'inherit';
            if (hasDown) color = '#1c7ed6'; // Blue
            if (hasUp) color = '#f03e3e';  // Red
            return <Text span fw={700} c={color}>{str}</Text>;
        }

        // Auto-format numeric based
        if (!isNaN(numVal)) {
            if (numVal > 0) {
                // Positive -> Red Up
                return <Text span fw={700} c="#f03e3e">{Math.abs(numVal)}% ▲</Text>;
            } else if (numVal < 0) {
                // Negative -> Blue Down
                return <Text span fw={700} c="#1c7ed6">{Math.abs(numVal)}% ▼</Text>;
            }
        }

        return <Text span>{str}</Text>;
    };

    const getRowBgColor = (rowData: any[]) => {
        // Check "구분" column (index 1) which is now row.original[1] or just row[1] if row is the array.
        // Wait, visibleRows contains processed objects with ...row props.
        // The original row array is spread into the object. 
        // So row[1] might work if array props are preserved or we need to use row.original?
        // In the spread: { ...row, ... } where row is the array. 
        // Array spread into object adds index keys: "0": val, "1": val...
        // So row[1] works.

        const category = String(rowData[1] || '');
        if (category.includes('상품1담당(소계)')) return '#e6fcf5'; // Greenish
        if (category.includes('상품2담당(소계)')) return '#fff9db'; // Yellowish
        if (category.includes('상품3담당(소계)')) return '#ebfbee'; // Light Green
        if (category.includes('합계')) return '#f8f9fa';
        if (category.includes('미매핑(소계)')) return '#f1f3f5';
        return 'white';
    };

    const getRowFw = (rowData: any[]) => {
        const category = String(rowData[1] || '');
        if (category.includes('(소계)') || category.includes('합계')) return 700;
        return 400;
    };

    return (
        <Box p="md" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header Info */}
            <Group mb="md" justify="space-between" align="center" style={{ flexShrink: 0, backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <Group>
                    <ThemeIcon variant="light" size="lg" color="blue"><IconCalendar size={20} /></ThemeIcon>
                    <Text fw={600} size="md">{data.info}</Text>
                </Group>
                <Badge variant="dot" size="lg">데이터 기준: 2025/12/22</Badge>
            </Group>

            <Card withBorder radius="md" p={0} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <ScrollArea h="100%" type="auto" offsetScrollbars>
                    <Table withTableBorder withColumnBorders stickyHeader highlightOnHover verticalSpacing="xs">
                        <Table.Thead>
                            <Table.Tr bg="#343a40">
                                <Table.Th rowSpan={2} c="white" ta="center" w={50} bg="#495057">No</Table.Th>
                                <Table.Th rowSpan={2} c="white" ta="center" w={220} bg="#495057">구분</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">당사</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">현대</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">GS</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">롯데</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">CJ</Table.Th>
                            </Table.Tr>
                            <Table.Tr bg="#343a40">
                                {/* 당사 */}
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>당월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월비</Table.Th>
                                {/* 현대 */}
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>당월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월비</Table.Th>
                                {/* GS */}
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>당월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월비</Table.Th>
                                {/* 롯데 */}
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>당월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월비</Table.Th>
                                {/* CJ */}
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>당월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월비</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {visibleRows.map((row: any) => (
                                <Table.Tr key={row.id} bg={getRowBgColor(row)} fw={getRowFw(row)}>
                                    <Table.Td ta="center">{row[0]}</Table.Td>
                                    <Table.Td
                                        style={{ paddingLeft: 10 + (row.level * 20), cursor: row.hasChildren ? 'pointer' : 'default' }}
                                        onClick={() => row.hasChildren && toggleExpand(row.id)}
                                    >
                                        <Group gap={4} wrap="nowrap">
                                            {row.hasChildren && (
                                                expanded.has(row.id) ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />
                                            )}
                                            {!row.hasChildren && <Box w={12} />}
                                            <Text size="sm">{row.nameDisplay}</Text>
                                        </Group>
                                    </Table.Td>
                                    {/* Data Columns */}
                                    {/* Data Columns: indices 2 to 16 */}
                                    {Array.from({ length: 15 }).map((_, i) => {
                                        const originalIndex = i + 2;
                                        const cell = row[originalIndex];
                                        // relative index i corresponds to previous logic's cellIndex 
                                        // (0 -> 2, etc. so diff logic [2,5,8,11,14] remains same for i)
                                        const isDiffCol = [2, 5, 8, 11, 14].includes(i);

                                        return (
                                            <Table.Td key={i} ta="center">
                                                {isDiffCol ? renderArrowValue(cell) : cell}
                                            </Table.Td>
                                        );
                                    })}
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>
            </Card>
        </Box>
    );
}
