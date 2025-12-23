'use client';

import { useEffect, useState, useMemo } from 'react';
import { Table, ScrollArea, Box, Text, Group, LoadingOverlay, Card, Badge, ThemeIcon, Alert, Stack, Divider, Title } from '@mantine/core';
import { IconArrowUp, IconArrowDown, IconCalendar, IconChevronRight, IconChevronDown, IconSparkles } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';


interface RatioData {
    info: string;
    data: any[][];
    error?: string;
}

function CustomTooltip({ active, payload, label }: any) {
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
        <Box p="md" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header Info */}
            <Group mb="md" justify="space-between" align="center" style={{ flexShrink: 0, backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <Group>
                    <ThemeIcon variant="light" size="lg" color="blue"><IconCalendar size={20} /></ThemeIcon>
                    <Text fw={600} size="md">{data?.info}</Text>
                </Group>
                <Badge variant="dot" size="lg">데이터 기준: 2025/12/22</Badge>
            </Group>

            <Card withBorder radius="md" p={0} mb="md">
                <ScrollArea type="auto" offsetScrollbars>
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

            {/* AI Summary Section */}
            <Box p="md" bg="white" style={{ borderRadius: 8, border: '1px solid #dee2e6' }}>
                <Group mb="sm">
                    <IconSparkles size={20} color="#7950f2" />
                    <Text fw={700} size="lg">생성형 AI 분석 결과</Text>
                </Group>

                <Stack gap="md">
                    <Alert variant="filled" color="violet" title="요약 (Summary)">
                        <Text size="sm" fw={700} mb="xs">
                            주요 데이터: 당사 '레포츠/언더웨어' 16.7% 편성, 롯데 '패션' 30.8% 집중, GS '건강식품' 20.9% 강세
                        </Text>
                        <Stack gap={4}>
                            <Text size="sm">• <b>당사 편성:</b> 상품3담당(레포츠/언더웨어/브랜드) 비중이 <b>24.1%</b>로 전월(25.3%) 대비 <b>1.2%p</b> 감소함.</Text>
                            <Text size="sm">• <b>경쟁사 데이터:</b> CJ(패션/뷰티 49.0%), 롯데(패션 30.8%), GS(건강식품 20.9%), 현대(무형 15.2%).</Text>
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
                                        { name: '상품1담당', prev: 40.2, curr: 33.9 },
                                        { name: '상품2담당', prev: 34.2, curr: 27.2 },
                                        { name: '상품3담당', prev: 25.3, curr: 24.1 },
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
                            <Text size="sm" mb="xs">당사 상품1담당(생활/식품/건강)은 33.9%로 가장 높으며, 전월 대비 6.3%p 감소함.</Text>
                            <Stack gap="sm">
                                <Box>
                                    <Text size="sm" fw={700}>1) 상품1담당 (생활/푸드/건강/무형)</Text>
                                    <Text size="xs" pl="sm">• <b>비중:</b> 33.9% (전월 40.2%, -6.3%p)</Text>
                                    <Text size="xs" pl="sm">• <b>세부 구성:</b> 건강식품 14.7%, 무형(여행/보험) 9.7%, 생활가전 6.4%, 리빙 5.4%</Text>
                                </Box>
                                <Box>
                                    <Text size="sm" fw={700}>2) 상품2담당 (패션/뷰티)</Text>
                                    <Text size="xs" pl="sm">• <b>비중:</b> 27.2% (전월 34.2%, -7.0%p)</Text>
                                    <Text size="xs" pl="sm">• <b>세부 구성:</b> 의류 13.7%, 뷰티 12.9%, 잡화 0.6%</Text>
                                </Box>
                                <Box>
                                    <Text size="sm" fw={700}>3) 상품3담당 (레포츠/언더웨어/브랜드)</Text>
                                    <Text size="xs" pl="sm">• <b>비중:</b> 24.1% (전월 25.3%, -1.2%p)</Text>
                                    <Text size="xs" pl="sm">• <b>세부 구성:</b> 레포츠 12.8%, 브랜드패션 7.4%, 언더웨어 3.9%</Text>
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
                                        { name: '현대', cloth: 16.2, beauty: 14.4, health: 12.7, leports: 4.9, living: 4.8, kitchen: 6.2, app: 1.9, food: 3.9, misc: 5.7, travel: 4.0, ins: 9.2, rental: 1.8, under: 0.4, others: 13.9 },
                                        { name: 'GS', cloth: 13.4, beauty: 19.7, health: 20.9, leports: 3.3, living: 8.5, kitchen: 5.0, app: 2.4, food: 4.0, misc: 4.2, travel: 3.1, ins: 5.8, rental: 1.4, under: 1.1, others: 7.2 },
                                        { name: '롯데', cloth: 20.2, beauty: 16.7, health: 14.3, leports: 6.8, living: 7.5, kitchen: 3.4, app: 2.9, food: 5.8, misc: 10.7, travel: 3.5, ins: 2.4, rental: 4.3, under: 1.1, others: 1.6 },
                                        { name: 'CJ', cloth: 18.9, beauty: 21.3, health: 21.3, leports: 3.3, living: 7.1, kitchen: 3.2, app: 1.5, food: 2.0, misc: 8.8, travel: 2.9, ins: 5.2, rental: 2.4, under: 0.8, others: 1.3 },
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
                                <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품1(44.6%) {'>'} 상품2(36.3%) {'>'} 상품3(5.4%)</Text>
                                <Text size="xs" pl="sm">• <b>주요 데이터:</b> 무형(여행/보험) 15.2%로 타사 대비 압도적.</Text>
                            </Box>
                            <Box>
                                <Text size="sm" fw={700}>2) GS샵</Text>
                                <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품1(51.2%) {'>'} 상품2(37.2%) {'>'} 상품3(4.4%)</Text>
                                <Text size="xs" pl="sm">• <b>주요 데이터:</b> 건강식품 20.9%, 뷰티 19.7% 강세.</Text>
                            </Box>
                            <Box>
                                <Text size="sm" fw={700}>3) 롯데홈쇼핑</Text>
                                <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품2(47.6%) {'>'} 상품1(44.0%) {'>'} 상품3(7.9%)</Text>
                                <Text size="xs" pl="sm">• <b>주요 데이터:</b> 의류 20.2%, 잡화 10.7%로 패션 카테고리 집중.</Text>
                            </Box>
                            <Box>
                                <Text size="sm" fw={700}>4) CJ온스타일</Text>
                                <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품2(49.0%) {'>'} 상품1(45.5%) {'>'} 상품3(4.2%)</Text>
                                <Text size="xs" pl="sm">• <b>주요 데이터:</b> 뷰티 21.3%, 건강식품 21.3% Dual Core 전략.</Text>
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
                                            { name: '주방', shinsegae: 1.0, lotte: 3.4, cj: 3.2, hyundai: 6.2, gs: 5.0 },
                                            { name: '가전', shinsegae: 0.0, lotte: 2.9, cj: 1.5, hyundai: 1.9, gs: 2.4 },
                                            { name: '리빙', shinsegae: 5.4, lotte: 7.5, cj: 7.1, hyundai: 4.8, gs: 8.5 },
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
                        </Box>

                        {/* 3-2 Food/Health */}
                        <Box mb="xl">
                            <Title order={5} mb="xs">2) 푸드 / 건강식품</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: '푸드', shinsegae: 3.1, lotte: 5.8, cj: 2.0, hyundai: 3.9, gs: 4.0 },
                                            { name: '건강식품', shinsegae: 14.7, lotte: 14.3, cj: 21.3, hyundai: 12.7, gs: 20.9 },
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
                        </Box>

                        {/* 3-3 Travel/Ins/Rental */}
                        <Box mb="xl">
                            <Title order={5} mb="xs">3) 여행 / 보험 / 렌탈</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: '여행', shinsegae: 4.7, lotte: 3.5, cj: 2.9, hyundai: 4.0, gs: 3.1 },
                                            { name: '보험', shinsegae: 2.2, lotte: 2.4, cj: 5.2, hyundai: 9.2, gs: 5.8 },
                                            { name: '일반렌탈', shinsegae: 1.1, lotte: 4.3, cj: 2.4, hyundai: 1.8, gs: 1.4 },
                                            { name: '대품렌탈', shinsegae: 1.7, lotte: 0.0, cj: 0.0, hyundai: 0.3, gs: 0.0 },
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
                        </Box>

                        {/* 3-4 Clothing/Beauty */}
                        <Box mb="xl">
                            <Title order={5} mb="xs">4) 의류 / 잡화 / 뷰티</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: '의류', shinsegae: 13.7, lotte: 20.2, cj: 18.9, hyundai: 16.2, gs: 13.4 },
                                            { name: '잡화', shinsegae: 0.6, lotte: 10.7, cj: 8.8, hyundai: 5.7, gs: 4.2 },
                                            { name: '뷰티', shinsegae: 12.9, lotte: 16.7, cj: 21.3, hyundai: 14.4, gs: 19.7 },
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
                        </Box>

                        {/* 3-5 Leports/Under */}
                        <Box mb="xl">
                            <Title order={5} mb="xs">5) 레포츠 / 언더웨어</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: '레포츠', shinsegae: 12.8, lotte: 6.8, cj: 3.3, hyundai: 4.9, gs: 3.3 },
                                            { name: '언더웨어', shinsegae: 3.9, lotte: 1.1, cj: 0.8, hyundai: 0.4, gs: 1.1 },
                                            { name: '브랜드P', shinsegae: 7.4, lotte: 0.0, cj: 0.0, hyundai: 0.0, gs: 0.0 },
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
                        </Box>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
