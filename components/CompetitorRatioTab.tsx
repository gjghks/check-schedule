'use client';

import { useEffect, useState, useMemo } from 'react';
import { Table, ScrollArea, Box, Text, Group, LoadingOverlay, Card, Badge, ThemeIcon, Alert, Stack, Divider, Title } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { IconArrowUp, IconArrowDown, IconCalendar, IconChevronRight, IconChevronDown, IconSparkles } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import '@mantine/dates/styles.css';

interface RatioData {
    info: string;
    data: any[][];
    topItems?: Record<string, Record<string, string[]>>;
    error?: string;
}

function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', fontSize: '12px', color: 'black' }}>
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

function parsePercentage(val: any): number {
    if (typeof val === 'number') return val * 100; // Assume 0.xxx if number
    if (!val) return 0;
    const str = String(val).replace('%', '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

export default function CompetitorRatioTab() {
    const [data, setData] = useState<RatioData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date(2025, 11, 1)); // Default Dec 2025

    useEffect(() => {
        if (!selectedDate) return;
        setLoading(true);
        const monthStr = dayjs(selectedDate).format('YYYY-MM');
        fetch(`/api/competitor-ratio?month=${monthStr}`)
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
    }, [selectedDate]);

    // Hierarchy Processing
    const processedMap = useMemo(() => {
        if (!data || !data.data) return [];

        const rows: any[] = [];
        const parentStack: number[] = [];
        const validData = data.data.filter(r => r[0]);

        validData.forEach((row, index) => {
            const rawName = String(row[1] || '');
            const nameClean = rawName.replace(/ㄴ/g, '').replace(/_/g, '').trim().replace(/^└─\s*/, '');

            let level = 0;
            if (rawName.includes('└─')) {
                if (rawName.match(/^\s{5,}/) || rawName.includes('        └─')) {
                    level = 2;
                } else {
                    level = 1;
                }
            } else {
                level = 0;
            }

            const id = index;
            if (level === 0) {
                parentStack.length = 0;
                parentStack[0] = id;
            } else if (level === 1) {
                parentStack.length = 1;
                parentStack[1] = id;
            } else {
                parentStack.length = 2;
            }

            const parentId = level > 0 ? parentStack[level - 1] : null;

            rows.push({
                ...row,
                id,
                level,
                parentId,
                nameDisplay: nameClean,
                hasChildren: false
            });
        });

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

    const toggleExpand = (id: number) => {
        const newSet = new Set(expanded);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpanded(newSet);
    };

    const visibleRows = processedMap.filter(r => {
        if (r.parentId === null) return true;
        let curr = r;
        while (curr.parentId !== null) {
            if (!expanded.has(curr.parentId)) return false;
            curr = processedMap.find((x: any) => x.id === curr.parentId);
            if (!curr) break;
        }
        return true;
    });

    // --- Dynamic Data Extraction for Charts & Analysis ---
    const { chart1Data, chart2Data, chart3_1, chart3_2, chart3_3, chart3_4, chart3_5, analysisText } = useMemo(() => {
        if (!processedMap || processedMap.length === 0) return {
            chart1Data: [], chart2Data: [],
            chart3_1: [], chart3_2: [], chart3_3: [], chart3_4: [], chart3_5: [],
            analysisText: { summary: '', section1: [], section2: [], section3: [] }
        };

        const findRow = (keyword: string) => processedMap.find(r => r.nameDisplay.includes(keyword));

        // Helper to get % value from row/col
        const getVal = (row: any, colIdx: number) => parsePercentage(row ? row[colIdx] : 0);

        // Competitor col indices (Current Month)
        // Shinsegae: 3, Hyundai: 6, GS: 9, Lotte: 12, CJ: 15
        const compCols = { shinsegae: 3, hyundai: 6, gs: 9, lotte: 12, cj: 15 };
        const comps = ['hyundai', 'gs', 'lotte', 'cj'];
        const compNames: Record<string, string> = { shinsegae: '당사', hyundai: '현대', gs: 'GS', lotte: '롯데', cj: 'CJ' };

        // --- 1. Identify Teams and Categories ---
        // Team Rows
        const p1 = findRow('상품1담당');
        const p2 = findRow('상품2담당');
        const p3 = findRow('상품3담당');

        // Map Categories to Keys
        const cats = [
            { key: 'cloth', name: '의류' }, { key: 'beauty', name: '뷰티' }, { key: 'health', name: '건강식품' },
            { key: 'leports', name: '레포츠' }, { key: 'living', name: '리빙' }, { key: 'kitchen', name: '주방' },
            { key: 'app', name: '가전', exclude: '팀' }, // Exclude '생활가전팀'
            { key: 'food', name: '푸드' }, { key: 'misc', name: '잡화' },
            { key: 'intangible', name: '무형' }, { key: 'under', name: '언더웨어' }, { key: 'others', name: '기타' },
            { key: 'brand', name: '브랜드패션' }, { key: 'travel', name: '여행' }, { key: 'ins', name: '보험' }, { key: 'rental', name: '렌탈' }
        ];

        // Create row lookup
        const rowMap: Record<string, any> = {};
        cats.forEach(c => {
            // Find row that includes name, but check exclusions
            let r = processedMap.find(row => {
                if (!row.nameDisplay.includes(c.name)) return false;
                if (c.exclude && row.nameDisplay.includes(c.exclude)) return false;
                return true;
            });
            if (r) rowMap[c.key] = r;
        });

        // --- Chart 1 Data (Our Company) ---
        const chart1Data = [
            { name: '상품1담당', prev: getVal(p1, 2), curr: getVal(p1, 3) },
            { name: '상품2담당', prev: getVal(p2, 2), curr: getVal(p2, 3) },
            { name: '상품3담당', prev: getVal(p3, 2), curr: getVal(p3, 3) },
        ];

        // --- Chart 2 Data (Competitor Breakdown) ---
        const chart2Data = comps.map(cName => {
            const obj: any = { name: compNames[cName] };
            const colIdx = compCols[cName as keyof typeof compCols];
            cats.forEach(cat => {
                if (['cloth', 'beauty', 'health', 'food', 'leports', 'living', 'kitchen', 'app', 'misc', 'intangible', 'under', 'others'].includes(cat.key)) {
                    obj[cat.key] = getVal(rowMap[cat.key], colIdx);
                }
            });
            return obj;
        });

        // --- Chart 3 Data (Grouped) ---
        const buildChart3 = (keys: string[]) => {
            return keys.map(k => {
                const r = rowMap[k];
                const catDef = cats.find(c => c.key === k);
                return {
                    name: catDef ? catDef.name : k,
                    shinsegae: getVal(r, compCols.shinsegae),
                    hyundai: getVal(r, compCols.hyundai),
                    gs: getVal(r, compCols.gs),
                    lotte: getVal(r, compCols.lotte),
                    cj: getVal(r, compCols.cj),
                };
            });
        };

        const chart3_1 = buildChart3(['kitchen', 'app', 'living']);
        const chart3_2 = buildChart3(['food', 'health']);
        const chart3_3 = buildChart3(['intangible']);
        const chart3_4 = buildChart3(['cloth', 'misc', 'beauty']);
        const chart3_5 = buildChart3(['leports', 'under', 'brand']);

        // --- Analysis Text Generation ---
        const getRankingStr = (items: { name: string, val: number }[]) => {
            return items
                .sort((a, b) => b.val - a.val)
                .map(i => `${i.name}(${i.val.toFixed(1)}%)`)
                .join(' > ');
        };

        // 1. Summary
        const sgMax = cats.reduce((max, c) => {
            const v = getVal(rowMap[c.key], compCols.shinsegae);
            return v > max.val ? { name: c.name, val: v } : max;
        }, { name: '', val: 0 });

        const cjMax = cats.reduce((max, c) => {
            const v = getVal(rowMap[c.key], compCols.cj);
            return v > max.val ? { name: c.name, val: v } : max;
        }, { name: '', val: 0 });

        const gsMax = cats.reduce((max, c) => {
            const v = getVal(rowMap[c.key], compCols.gs);
            return v > max.val ? { name: c.name, val: v } : max;
        }, { name: '', val: 0 });

        const summary = `주요 데이터: 당사 '${sgMax.name}' 강세 (${sgMax.val.toFixed(1)}%), CJ '${cjMax.name}' (${cjMax.val.toFixed(1)}%), GS '${gsMax.name}' (${gsMax.val.toFixed(1)}%) 집중.`;


        // 2. Section 1 Extended (Our Company)
        const p1Id = p1?.id;
        const p2Id = p2?.id;
        const p3Id = p3?.id;

        const getTeamChildren = (teamId: number | undefined) => {
            if (teamId === undefined) return [];
            return processedMap
                .filter(r => r.parentId === teamId)
                .map(r => ({ name: r.nameDisplay, val: getVal(r, compCols.shinsegae) }))
                .sort((a, b) => b.val - a.val);
        };

        const generateTeamText = (teamName: string, teamRow: any, children: { name: string, val: number }[]) => {
            const teamVal = getVal(teamRow, 3);
            const teamPrev = getVal(teamRow, 2);
            const diff = teamVal - teamPrev;
            const diffStr = diff >= 0 ? `+${diff.toFixed(1)}%p` : `${diff.toFixed(1)}%p`;
            const color = diff >= 0 ? '#f03e3e' : '#1c7ed6';

            const subText = children
                .filter(c => c.val > 0)
                .map(c => `${c.name} ${c.val.toFixed(1)}%`)
                .join(', ');

            return {
                title: `${teamName}`,
                main: (
                    <>
                        • 비중: {teamVal.toFixed(1)}% (전월 {teamPrev.toFixed(1)}%, <Text span c={color} fw={700}>{diffStr}</Text>)
                    </>
                ),
                sub: `• 세부 구성: ${subText}`
            };
        };

        const section1 = [
            generateTeamText('1) 상품1담당', p1, getTeamChildren(p1Id)),
            generateTeamText('2) 상품2담당', p2, getTeamChildren(p2Id)),
            generateTeamText('3) 상품3담당', p3, getTeamChildren(p3Id)),
        ];


        // 3. Section 2 Extended (Competitors)
        const section2 = comps.map((c, i) => {
            const colIdx = compCols[c as keyof typeof compCols];
            const cName = compNames[c as keyof typeof compNames];

            const getTeamVal = (row: any, tId: number | undefined) => {
                let v = getVal(row, colIdx);
                if (v === 0 && tId !== undefined) {
                    const children = processedMap.filter(r => r.parentId === tId);
                    v = children.reduce((sum, child) => sum + getVal(child, colIdx), 0);
                }
                return v;
            };

            const t1Val = getTeamVal(p1, p1Id);
            const t2Val = getTeamVal(p2, p2Id);
            const t3Val = getTeamVal(p3, p3Id);

            const teamRanks = [
                { name: '상품1', val: t1Val },
                { name: '상품2', val: t2Val },
                { name: '상품3', val: t3Val }
            ];
            const rankStr = getRankingStr(teamRanks);

            let topCat = { name: '', val: 0 };
            cats.forEach(cat => {
                const v = getVal(rowMap[cat.key], colIdx);
                if (v > topCat.val) topCat = { name: cat.name, val: v };
            });

            return {
                title: `${i + 1}) ${cName}${cName.endsWith('홈쇼핑') || cName.endsWith('샵') || cName == 'CJ' ? '' : '홈쇼핑'}`,
                main: `• 편성 비중: ${rankStr}`,
                sub: `• 주요 데이터: ${topCat.name} ${topCat.val.toFixed(1)}% 집중.`
            };
        });


        // 4. Section 3 Extended (Category Comparison)
        const generateCompSection = (title: string, catKeys: string[]) => {
            const lines = catKeys.map(k => {
                const catName = cats.find(c => c.key === k)?.name || k;
                const r = rowMap[k];
                if (!r) return null;

                const ranks = [
                    { name: '당사', val: getVal(r, compCols.shinsegae) },
                    { name: '현대', val: getVal(r, compCols.hyundai) },
                    { name: 'GS', val: getVal(r, compCols.gs) },
                    { name: '롯데', val: getVal(r, compCols.lotte) },
                    { name: 'CJ', val: getVal(r, compCols.cj) }
                ];

                // Always compare Us vs Top Competitor
                const us = ranks.find(r => r.name === '당사')!;
                const competitors = ranks.filter(r => r.name !== '당사');
                const topCompetitor = competitors.reduce((prev, curr) => (prev.val > curr.val ? prev : curr));

                const diffVal = us.val - topCompetitor.val;
                const formattedDiff = diffVal >= 0 ? `+${diffVal.toFixed(1)}` : diffVal.toFixed(1);
                const color = diffVal >= 0 ? '#f03e3e' : '#1c7ed6';

                let insight: React.ReactNode = '';
                if (us.val === 0 && topCompetitor.val === 0) {
                    insight = '해당 카테고리 편성 없음.';
                } else {
                    insight = (
                        <>
                            주요 특징: 당사 vs {topCompetitor.name} (<Text span c={color} fw={700}>{formattedDiff}%p</Text> 차이).
                        </>
                    );
                }

                const topItemsList: { label: string, item: string, color: string }[] = [];
                const compConfig = [
                    { key: 'hyundai', name: '현대', color: '#119586' },
                    { key: 'gs', name: 'GS', color: '#6CC218' },
                    { key: 'lotte', name: '롯데', color: '#EE3124' },
                    { key: 'cj', name: 'CJ', color: '#6A00A6' }
                ];

                if (data?.topItems) {
                    compConfig.forEach(cfg => {
                        const items = data.topItems?.[cfg.key]?.[k];
                        if (items && items.length > 0) {
                            // Clean item name
                            const clean = items[0].replace(/^\[.*?\]\s*/, '');
                            topItemsList.push({
                                label: cfg.name,
                                item: clean,
                                color: cfg.color
                            });
                        }
                    });
                }

                return {
                    main: `• ${catName}: ${getRankingStr(ranks)}`,
                    sub: insight,
                    itemsList: topItemsList
                };
            }).filter(Boolean);

            return { title, lines };
        };

        const section3 = [
            generateCompSection('1) 주방 / 가전 / 리빙', ['kitchen', 'app', 'living']),
            generateCompSection('2) 푸드 / 건강식품', ['food', 'health']),
            generateCompSection('3) 무형', ['intangible']),
            generateCompSection('4) 의류 / 잡화 / 뷰티', ['cloth', 'misc', 'beauty']),
            generateCompSection('5) 레포츠 / 언더웨어 / 브랜드패션', ['leports', 'under', 'brand'])
        ];

        return { chart1Data, chart2Data, chart3_1, chart3_2, chart3_3, chart3_4, chart3_5, analysisText: { summary, section1, section2, section3 } };

    }, [processedMap, data]);


    if (loading) {
        return <Box h={300} pos="relative"><LoadingOverlay visible={true} /></Box>;
    }

    if (!data) return <Text>데이터를 불러올 수 없습니다.</Text>;
    if (data.error) return <Alert color="red" title="오류">{data.error}</Alert>;

    const renderArrowValue = (val: string) => {
        if (!val) return '';
        let str = String(val);
        let numVal = parseFloat(str.replace('%', '').trim());

        if (str.includes('▼') || str.includes('▲')) {
            const hasDown = str.includes('▼');
            const hasUp = str.includes('▲');
            let color = 'inherit';
            if (hasDown) color = '#1c7ed6';
            if (hasUp) color = '#f03e3e';
            return <Text span fw={700} c={color}>{str}</Text>;
        }

        if (!isNaN(numVal) && str.trim() !== '') {
            if (numVal > 0) return <Text span fw={700} c="#f03e3e">{Math.abs(numVal).toFixed(1)}% ▲</Text>;
            if (numVal < 0) return <Text span fw={700} c="#1c7ed6">{Math.abs(numVal).toFixed(1)}% ▼</Text>;
            if (numVal === 0) return <Text span>{str}</Text>;
        }

        return <Text span>{str}</Text>;
    };

    const getRowBgColor = (rowData: any[]) => {
        const category = String(rowData[1] || '');
        if (category.includes('상품1담당(소계)')) return '#e6fcf5';
        if (category.includes('상품2담당(소계)')) return '#fff9db';
        if (category.includes('상품3담당(소계)')) return '#ebfbee';
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
                <Group>
                    <MonthPickerInput
                        placeholder="Pick date"
                        value={selectedDate}
                        onChange={(date: any) => setSelectedDate(date)}
                        minDate={new Date(2025, 0, 1)}
                        maxDate={new Date(2025, 11, 1)}
                        style={{ width: 150 }}
                    />
                    <Badge variant="dot" size="lg">데이터 기준: {selectedDate ? dayjs(selectedDate).format('YYYY년 M월') : '선택 안됨'}</Badge>
                </Group>
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
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>당월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월비</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>당월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월비</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>당월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월비</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>당월</Table.Th>
                                <Table.Th c="white" ta="center" w={70} bg="#495057" style={{ borderTop: '1px solid #707070' }}>전월비</Table.Th>
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
                                    {Array.from({ length: 15 }).map((_, i) => {
                                        const originalIndex = i + 2;
                                        const cell = row[originalIndex];
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
                        <Text size="sm" fw={700} mb="xs">{analysisText.summary}</Text>
                    </Alert>

                    <Divider />

                    <Box>
                        <Title order={4} mb="sm" c="violet">1. 당사 상품 담당별 편성 현황</Title>
                        <Box h={250}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chart1Data}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis label={{ value: '(%)', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 12 }} />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Bar dataKey="prev" name="전월" fill="#8884d8" barSize={40} />
                                    <Bar dataKey="curr" name="당월" fill="#82ca9d" barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                        <Box mt="md">
                            <Stack gap="sm">
                                {analysisText.section1.map((item: any, idx) => (
                                    <Box key={idx}>
                                        <Text size="sm" fw={700}>{item.title}</Text>
                                        <Text size="sm" pl="sm">{item.main}</Text>
                                        <Text size="sm" pl="sm">{item.sub}</Text>
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                    </Box>

                    <Divider />

                    <Box>
                        <Title order={4} mb="sm" c="violet">2. 경쟁사별 현황</Title>
                        <Box h={380}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={chart2Data}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} allowDecimals={false} />
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
                        <Stack gap="sm" mt="md">
                            {analysisText.section2.map((item: any, idx) => (
                                <Box key={idx}>
                                    <Text size="sm" fw={700}>{item.title}</Text>
                                    <Text size="sm" pl="sm">{item.main}</Text>
                                    <Text size="sm" pl="sm">{item.sub}</Text>
                                </Box>
                            ))}
                        </Stack>
                    </Box>

                    <Divider />

                    <Box>
                        <Title order={4} mb="lg" c="violet">3. 카테고리별 비교 (당사 vs 경쟁사)</Title>

                        <Box mb="xl">
                            <Title order={5} mb="xs">1) 주방 / 가전 / 리빙</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chart3_1} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={4} mt="xs">
                                {analysisText.section3[0]?.lines?.map((line: any, i: number) => (
                                    <Box key={i}>
                                        <Text size="sm">{line.main}</Text>
                                        <Text size="sm" c="dimmed" pl="sm" mb={4}>{line.sub}</Text>
                                        {line.itemsList && line.itemsList.length > 0 && (
                                            <Group gap={6} pl="sm">
                                                <Text size="sm" fw={700} c="dimmed">주요 아이템:</Text>
                                                {line.itemsList.map((itm: any, idx: number) => (
                                                    <Text key={idx} size="sm" c={itm.color}>
                                                        [{itm.label}] {itm.item}{idx < line.itemsList.length - 1 ? ',' : ''}
                                                    </Text>
                                                ))}
                                            </Group>
                                        )}
                                    </Box>
                                ))}
                            </Stack>
                        </Box>

                        <Box mb="xl">
                            <Title order={5} mb="xs">2) 푸드 / 건강식품</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chart3_2} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={4} mt="xs">
                                {analysisText.section3[1]?.lines?.map((line: any, i: number) => (
                                    <Box key={i}>
                                        <Text size="sm">{line.main}</Text>
                                        <Text size="sm" c="dimmed" pl="sm" mb={4}>{line.sub}</Text>
                                        {line.itemsList && line.itemsList.length > 0 && (
                                            <Group gap={6} pl="sm">
                                                <Text size="sm" fw={700} c="dimmed">주요 아이템:</Text>
                                                {line.itemsList.map((itm: any, idx: number) => (
                                                    <Text key={idx} size="sm" c={itm.color}>
                                                        [{itm.label}] {itm.item}{idx < line.itemsList.length - 1 ? ',' : ''}
                                                    </Text>
                                                ))}
                                            </Group>
                                        )}
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                        <Box mb="xl">
                            <Title order={5} mb="xs">3) 무형</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chart3_3} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={4} mt="xs">
                                {analysisText.section3[2]?.lines?.map((line: any, i: number) => (
                                    <Box key={i}>
                                        <Text size="sm">{line.main}</Text>
                                        <Text size="sm" c="dimmed" pl="sm" mb={4}>{line.sub}</Text>
                                        {line.itemsList && line.itemsList.length > 0 && (
                                            <Group gap={6} pl="sm">
                                                <Text size="sm" fw={700} c="dimmed">주요 아이템:</Text>
                                                {line.itemsList.map((itm: any, idx: number) => (
                                                    <Text key={idx} size="sm" c={itm.color}>
                                                        [{itm.label}] {itm.item}{idx < line.itemsList.length - 1 ? ',' : ''}
                                                    </Text>
                                                ))}
                                            </Group>
                                        )}
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                        <Box mb="xl">
                            <Title order={5} mb="xs">4) 의류/잡화/뷰티</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chart3_4} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={4} mt="xs">
                                {analysisText.section3[3]?.lines?.map((line: any, i: number) => (
                                    <Box key={i}>
                                        <Text size="sm">{line.main}</Text>
                                        <Text size="sm" c="dimmed" pl="sm" mb={4}>{line.sub}</Text>
                                        {line.itemsList && line.itemsList.length > 0 && (
                                            <Group gap={6} pl="sm">
                                                <Text size="sm" fw={700} c="dimmed">주요 아이템:</Text>
                                                {line.itemsList.map((itm: any, idx: number) => (
                                                    <Text key={idx} size="sm" c={itm.color}>
                                                        [{itm.label}] {itm.item}{idx < line.itemsList.length - 1 ? ',' : ''}
                                                    </Text>
                                                ))}
                                            </Group>
                                        )}
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                        <Box mb="xl">
                            <Title order={5} mb="xs">5) 레포츠/언더웨어</Title>
                            <Box h={200}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chart3_5} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar dataKey="shinsegae" name="당사" fill="#333333" />
                                        <Bar dataKey="hyundai" name="현대" fill="#119586" />
                                        <Bar dataKey="gs" name="GS" fill="#6CC218" />
                                        <Bar dataKey="lotte" name="롯데" fill="#EE3124" />
                                        <Bar dataKey="cj" name="CJ" fill="#6A00A6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack gap={4} mt="xs">
                                {analysisText.section3[4]?.lines?.map((line: any, i: number) => (
                                    <Box key={i}>
                                        <Text size="sm">{line.main}</Text>
                                        <Text size="sm" c="dimmed" pl="sm" mb={4}>{line.sub}</Text>
                                        {line.itemsList && line.itemsList.length > 0 && (
                                            <Group gap={6} pl="sm">
                                                <Text size="sm" fw={700} c="dimmed">주요 아이템:</Text>
                                                {line.itemsList.map((itm: any, idx: number) => (
                                                    <Text key={idx} size="sm" c={itm.color}>
                                                        [{itm.label}] {itm.item}{idx < line.itemsList.length - 1 ? ',' : ''}
                                                    </Text>
                                                ))}
                                            </Group>
                                        )}
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
