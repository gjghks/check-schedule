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
                <Badge variant="dot" size="lg">데이터 기준: 2025/12/31</Badge>
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
                            주요 데이터: 당사 '레포츠/건강식품' 강세, CJ '뷰티/건강' 46.5% 집중 (뷰티 24.6%, 건강 21.9%), GS '건강/뷰티' 38.8% 집중
                        </Text>
                        <Stack gap={4}>
                            <Text size="sm">• <b>당사 편성:</b> 상품1담당(생활/푸드/건강/무형) 비중이 <b>39.5%</b>로 가장 높으나 전월(40.2%) 대비 소폭 감소.</Text>
                            <Text size="sm">• <b>경쟁사 데이터:</b> CJ(뷰티 24.6%, 건강 21.9%), GS(건강 20.0%, 뷰티 18.8%).</Text>
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
                                        { name: '상품1담당', prev: 40.2, curr: 39.5 },
                                        { name: '상품2담당', prev: 34.2, curr: 32.2 },
                                        { name: '상품3담당', prev: 25.3, curr: 28.0 },
                                    ]}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis label={{ value: '(%)', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 12 }} />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend
                                        wrapperStyle={{ fontSize: '12px' }}
                                    />
                                    <Bar dataKey="prev" name="전월" fill="#8884d8" barSize={40} />
                                    <Bar dataKey="curr" name="당월" fill="#82ca9d" barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                        <Box mt="md">
                            <Text size="sm" mb="xs">당사 상품1담당(생활/식품/건강/무형)은 39.5%로 가장 높으며, 전월 대비 0.7%p 감소함.</Text>
                            <Stack gap="sm">
                                <Box>
                                    <Text size="sm" fw={700}>1) 상품1담당 (생활/푸드/건강/무형)</Text>
                                    <Text size="xs" pl="sm">• <b>비중:</b> 39.5% (전월 40.2%, -0.7%p)</Text>
                                    <Text size="xs" pl="sm">• <b>세부 구성:</b> 건강식품 19.2%, 무형 9.4%, 리빙 6.0%, 푸드 4.0%</Text>
                                </Box>
                                <Box>
                                    <Text size="sm" fw={700}>2) 상품2담당 (패션/뷰티)</Text>
                                    <Text size="xs" pl="sm">• <b>비중:</b> 32.2% (전월 34.2%, -2.0%p)</Text>
                                    <Text size="xs" pl="sm">• <b>세부 구성:</b> 뷰티 16.1%, 의류 15.6%, 잡화 0.5%</Text>
                                </Box>
                                <Box>
                                    <Text size="sm" fw={700}>3) 상품3담당 (레포츠/언더웨어/브랜드)</Text>
                                    <Text size="xs" pl="sm">• <b>비중:</b> 28.0% (전월 25.3%, +2.7%p)</Text>
                                    <Text size="xs" pl="sm">• <b>세부 구성:</b> 레포츠 15.0%, 브랜드패션 8.6%, 언더웨어 4.5%</Text>
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
                                        { name: '현대', cloth: 17.7, beauty: 13.6, health: 12.8, leports: 4.7, living: 4.8, kitchen: 7.6, app: 2.4, food: 3.6, misc: 4.7, intangible: 14.1, under: 0.4, others: 13.6 },
                                        { name: 'GS', cloth: 14.7, beauty: 18.8, health: 20.0, leports: 3.1, living: 7.9, kitchen: 5.3, app: 2.3, food: 4.2, misc: 4.2, intangible: 11.0, under: 1.1, others: 7.4 },
                                        { name: '롯데', cloth: 20.6, beauty: 17.3, health: 14.5, leports: 6.6, living: 7.4, kitchen: 3.6, app: 2.7, food: 5.5, misc: 10.3, intangible: 10.1, under: 1.1, others: 0.3 },
                                        { name: 'CJ', cloth: 17.5, beauty: 24.6, health: 21.9, leports: 3.1, living: 6.6, kitchen: 3.4, app: 1.4, food: 2.3, misc: 7.8, intangible: 10.5, under: 0.8, others: 0.1 },
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
                                    <Bar dataKey="intangible" name="무형" stackId="a" fill="#8dd1e1" />
                                    <Bar dataKey="under" name="언더웨어" stackId="a" fill="#d35400" />
                                    <Bar dataKey="others" name="기타" stackId="a" fill="#e0e0e0" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                        <Stack gap="md" mt="md">
                            <Box>
                                <Text size="sm" fw={700}>1) 현대홈쇼핑</Text>
                                <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품1(45.3%) {'>'} 상품2(35.9%) {'>'} 상품3(5.1%)</Text>
                                <Text size="xs" pl="sm">• <b>주요 데이터:</b> 무형(여행/보험/렌탈) 14.1%.</Text>
                            </Box>
                            <Box>
                                <Text size="sm" fw={700}>2) GS샵</Text>
                                <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품1(50.7%) {'>'} 상품2(37.6%) {'>'} 상품3(4.2%)</Text>
                                <Text size="xs" pl="sm">• <b>주요 데이터:</b> 건강 20.0%, 뷰티 18.8% 강세.</Text>
                            </Box>
                            <Box>
                                <Text size="sm" fw={700}>3) 롯데홈쇼핑</Text>
                                <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품2(48.2%) {'>'} 상품1(43.8%) {'>'} 상품3(7.7%)</Text>
                                <Text size="xs" pl="sm">• <b>주요 데이터:</b> 의류 20.6%, 뷰티 17.3%로 패션/뷰티 집중.</Text>
                            </Box>
                            <Box>
                                <Text size="sm" fw={700}>4) CJ온스타일</Text>
                                <Text size="xs" pl="sm">• <b>편성 비중:</b> 상품2(49.8%) {'>'} 상품1(46.1%) {'>'} 상품3(3.9%)</Text>
                                <Text size="xs" pl="sm">• <b>주요 데이터:</b> 뷰티 24.6%, 건강 21.9%로 Dual Core 전략.</Text>
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
                                            { name: '주방', shinsegae: 0.9, lotte: 3.6, cj: 3.4, hyundai: 7.6, gs: 5.3 },
                                            { name: '가전', shinsegae: 0.0, lotte: 2.7, cj: 1.4, hyundai: 2.4, gs: 2.3 },
                                            { name: '리빙', shinsegae: 6.0, lotte: 7.4, cj: 6.6, hyundai: 4.8, gs: 7.9 },
                                        ]}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                        barGap={4}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend
                                            wrapperStyle={{ fontSize: '11px' }}
                                        />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={2} mt="xs">
                                <Text size="xs"><b>주방:</b> 현대(7.6%) {'>'} GS(5.3%) {'>'} 롯데(3.6%) {'>'} CJ(3.4%) {'>'} 당사(0.9%)</Text>
                                <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 휘슬러(현대), 테팔(GS).</Text>
                                <Text size="xs"><b>가전:</b> 롯데(2.7%) {'>'} 현대(2.4%) {'>'} GS(2.3%) {'>'} CJ(1.4%) {'>'} 당사(0.0%)</Text>
                                <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 로보락(현대).</Text>
                                <Text size="xs"><b>리빙:</b> GS(7.9%) {'>'} 롯데(7.4%) {'>'} CJ(6.6%) {'>'} 당사(6.0%) {'>'} 현대(4.8%)</Text>
                                <Text size="xs" c="dimmed" pl="sm">주요 아이템: 일월(GS), 조선호텔(현대).</Text>
                            </Stack>
                        </Box>

                        {/* 3-2 Food/Health */}
                        <Box mb="xl">
                            <Title order={5} mb="xs">2) 푸드 / 건강식품</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: '푸드', shinsegae: 4.0, lotte: 5.5, cj: 2.3, hyundai: 3.6, gs: 4.2 },
                                            { name: '건강식품', shinsegae: 19.2, lotte: 14.5, cj: 21.9, hyundai: 12.8, gs: 20.0 },
                                        ]}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                        barGap={4}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend
                                            wrapperStyle={{ fontSize: '11px' }}
                                        />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={2} mt="xs">
                                <Text size="xs"><b>푸드:</b> 롯데(5.5%) {'>'} GS(4.2%) {'>'} 당사(4.0%) {'>'} 현대(3.6%) {'>'} CJ(2.3%)</Text>
                                <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 김나운더키친(롯데).</Text>
                                <Text size="xs"><b>건강식품:</b> CJ(21.9%) {'>'} GS(20.0%) {'>'} 당사(19.2%) {'>'} 롯데(14.5%) {'>'} 현대(12.8%)</Text>
                                <Text size="xs" c="dimmed" pl="sm">주요 아이템: 비에날씬(당사/GS), 에버콜라겐(CJ).</Text>
                            </Stack>
                        </Box>

                        {/* 3-3 Travel/Ins/Rental */}
                        <Box mb="xl">
                            <Title order={5} mb="xs">3) 무형 (여행 / 보험 / 렌탈 등)</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: '무형', shinsegae: 9.4, lotte: 10.1, cj: 10.5, hyundai: 14.1, gs: 11.0 },
                                        ]}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                        barGap={4}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend
                                            wrapperStyle={{ fontSize: '11px' }}
                                        />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={2} mt="xs">
                                <Text size="xs"><b>무형:</b> 현대(14.1%) {'>'} GS(11.0%) {'>'} CJ(10.5%) {'>'} 롯데(10.1%) {'>'} 당사(9.4%)</Text>
                                <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 롯데관광(당사), 모두투어(현대).</Text>
                            </Stack>
                        </Box>

                        {/* 3-4 Clothing/Beauty */}
                        <Box mb="xl">
                            <Title order={5} mb="xs">4) 의류 / 잡화 / 뷰티</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: '의류', shinsegae: 15.6, lotte: 20.6, cj: 17.5, hyundai: 17.7, gs: 14.7 },
                                            { name: '잡화', shinsegae: 0.5, lotte: 10.3, cj: 7.8, hyundai: 4.7, gs: 4.2 },
                                            { name: '뷰티', shinsegae: 16.1, lotte: 17.3, cj: 24.6, hyundai: 13.6, gs: 18.8 },
                                        ]}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                        barGap={4}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend
                                            wrapperStyle={{ fontSize: '11px' }}
                                        />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={2} mt="xs">
                                <Text size="xs"><b>의류:</b> 롯데(20.6%) {'>'} 현대(17.7%) {'>'} CJ(17.5%) {'>'} 당사(15.6%) {'>'} GS(14.7%)</Text>
                                <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: LBL(롯데), 더엣지(CJ), 라씨엔토(현대).</Text>
                                <Text size="xs"><b>잡화:</b> 롯데(10.3%) {'>'} CJ(7.8%) {'>'} 현대(4.7%) {'>'} GS(4.2%) {'>'} 당사(0.5%)</Text>
                                <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 구찌(롯데), 아메리칸투어리스터(CJ).</Text>
                                <Text size="xs"><b>뷰티:</b> CJ(24.6%) {'>'} GS(18.8%) {'>'} 롯데(17.3%) {'>'} 당사(16.1%) {'>'} 현대(13.6%)</Text>
                                <Text size="xs" c="dimmed" pl="sm">주요 아이템: 다이슨(CJ), 에이지투웨니스(GS).</Text>
                            </Stack>
                        </Box>

                        {/* 3-5 Leports/Under */}
                        <Box mb="xl">
                            <Title order={5} mb="xs">5) 레포츠 / 언더웨어</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: '레포츠', shinsegae: 15.0, lotte: 6.6, cj: 3.1, hyundai: 4.7, gs: 3.1 },
                                            { name: '언더웨어', shinsegae: 4.5, lotte: 1.1, cj: 0.8, hyundai: 0.4, gs: 1.1 },
                                            { name: '브랜드P', shinsegae: 8.6, lotte: 0.0, cj: 0.0, hyundai: 0.0, gs: 0.0 },
                                        ]}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                        barGap={4}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend
                                            wrapperStyle={{ fontSize: '11px' }}
                                        />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={2} mt="xs">
                                <Text size="xs"><b>레포츠:</b> 당사(15.0%) {'>'} 롯데(6.6%) {'>'} 현대(4.7%) {'>'} CJ(3.1%) {'>'} GS(3.1%)</Text>
                                <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 내셔널지오그래픽(당사), 캘러웨이(롯데).</Text>
                                <Text size="xs"><b>언더웨어:</b> 당사(4.5%) {'>'} 롯데(1.1%) {'>'} GS(1.1%) {'>'} CJ(0.8%) {'>'} 현대(0.4%)</Text>
                                <Text size="xs" c="dimmed" pl="sm" mb={4}>주요 아이템: 푸마 바디웨어(당사).</Text>
                                <Text size="xs"><b>브랜드패션:</b> 당사(8.6%) {'>'} 타사(0%)</Text>
                                <Text size="xs" c="dimmed" pl="sm">특이사항: 당사 단독 편성 카테고리.</Text>
                            </Stack>
                        </Box>
                    </Box >
                </Stack >
            </Box >
        </Box >
    );
}
