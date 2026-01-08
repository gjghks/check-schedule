'use client';

import { useEffect, useState, useMemo } from 'react';
import { Table, ScrollArea, Box, Text, Group, LoadingOverlay, Card, Badge, ThemeIcon, Alert, Stack, Divider, Title, SegmentedControl, Paper, Grid, Tabs } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { IconArrowUp, IconArrowDown, IconCalendar, IconChevronRight, IconChevronDown, IconSparkles, IconChartLine, IconChartBar } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine, ComposedChart, Cell } from 'recharts';
import dayjs from 'dayjs';
import '@mantine/dates/styles.css';

interface RatioData {
    info: string;
    data: any[][];
    topItems?: Record<string, Record<string, string[]>>;
    error?: string;
}

interface YearlyData {
    year: string;
    labels: string[];
    merchandisers: {
        goods1: number[];
        goods2: number[];
        goods3: number[];
        goods1Diff: number[];
        goods2Diff: number[];
        goods3Diff: number[];
    };
    categories: Record<string, { shinsegae: number[], hyundai: number[], gs: number[], lotte: number[], cj: number[] }>;
}

function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', fontSize: '12px', color: 'black' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>{label}</p>
                {payload.map((p: any) => (
                    <p key={p.name} style={{ color: p.color, margin: 0 }}>
                        {p.name}: {p.value !== undefined && typeof p.value === 'number' ? p.value.toFixed(1) : p.value}%
                    </p>
                ))}
            </div>
        );
    }
    return null;
}

function parsePercentage(val: any): number {
    if (typeof val === 'number') return val * 100;
    if (!val) return 0;
    const str = String(val).replace('%', '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

// Custom Label for Line Chart Diffs
const CustomLineLabel = (props: any) => {
    const { x, y, index, data, dataKey } = props;

    // Safety checks
    if (!data || index === undefined || !data[index]) return null;

    // Calculate Ranks for positioning
    const record = data[index];
    const keys = ['goods1', 'goods2', 'goods3'];
    // Sort keys by value descending
    const sortedKeys = [...keys].sort((a, b) => (record[b] || 0) - (record[a] || 0));
    const rank = sortedKeys.indexOf(dataKey);

    // Dynamic positioning
    let dy = -15;
    if (rank === 1) dy = 15; // 2nd highest -> Below
    if (rank === 2) dy = 30; // Lowest -> Further Below or customized

    // Determine color and text
    const diffKey = `${dataKey}Diff`;
    const diff = record[diffKey];

    if (diff === undefined || diff === null) return null;

    const isPositive = diff >= 0;
    const color = isPositive ? '#f03e3e' : '#1c7ed6';
    const text = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;

    return (
        <g>
            {/* Halo effect for readability */}
            <text x={x} y={y} dy={dy} fill="none" stroke="white" strokeWidth={3} fontSize={11} textAnchor="middle" fontWeight={700} style={{ opacity: 0.8 }}>
                {text}
            </text>
            <text x={x} y={y} dy={dy} fill={color} fontSize={11} textAnchor="middle" fontWeight={700}>
                {text}
            </text>
        </g>
    );
};


export default function CompetitorRatioTab() {
    const [viewMode, setViewMode] = useState<string>('monthly'); // 'monthly' | 'yearly'
    const [data, setData] = useState<RatioData | null>(null);
    const [yearlyData, setYearlyData] = useState<YearlyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date(2025, 11, 1)); // Default Dec 2025
    const [gapTarget, setGapTarget] = useState<string>('avg');

    useEffect(() => {
        if (!selectedDate && viewMode === 'monthly') return;

        setLoading(true);

        if (viewMode === 'monthly') {
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
        } else {
            // Yearly Fetch
            fetch(`/api/competitor-ratio?mode=yearly&year=2025`)
                .then((res) => res.json())
                .then((res) => {
                    console.log('Yearly Data:', res);
                    setYearlyData(res);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [selectedDate, viewMode]);

    // Hierarchy Processing (Monthly)
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

    // --- Dynamic Data Extraction for Charts & Analysis (Monthly) ---
    const { chart1Data, chart2Data, chart3_1, chart3_2, chart3_3, chart3_4, chart3_5, chart3_6, analysisText } = useMemo(() => {
        if (!processedMap || processedMap.length === 0) return {
            chart1Data: [], chart2Data: [],
            chart3_1: [], chart3_2: [], chart3_3: [], chart3_4: [], chart3_5: [], chart3_6: [],
            analysisText: { summary: '', section1: [], section2: [], section3: [] }
        };

        const findRow = (keyword: string) => processedMap.find(r => r.nameDisplay.includes(keyword));
        const getVal = (row: any, colIdx: number) => parsePercentage(row ? row[colIdx] : 0);

        const compCols = { shinsegae: 3, hyundai: 6, gs: 9, lotte: 12, cj: 15 };
        const comps = ['hyundai', 'gs', 'lotte', 'cj'];
        const compNames: Record<string, string> = { shinsegae: '당사', hyundai: '현대', gs: 'GS', lotte: '롯데', cj: 'CJ' };

        const p1 = findRow('상품1담당');
        const p2 = findRow('상품2담당');
        const p3 = findRow('상품3담당');

        const cats = [
            { key: 'kitchen', name: '주방' },
            { key: 'app', name: '가전', exclude: '팀' },
            { key: 'living', name: '리빙' },
            { key: 'food', name: '푸드' },
            { key: 'health', name: '건강식품' },
            { key: 'travel', name: '여행' },
            { key: 'insurance', name: '보험' },
            { key: 'rental_gen', name: '일반렌탈' },
            { key: 'rental_big', name: '대품렌탈' },
            { key: 'mobile1', name: '모바일상품1팀' },
            { key: 'cloth', name: '의류' },
            { key: 'misc', name: '잡화' },
            { key: 'beauty', name: '뷰티' },
            { key: 'mobile2', name: '모바일상품2팀' },
            { key: 'leports', name: '레포츠', exclude: '팀' },
            { key: 'under', name: '언더웨어', exclude: '팀' },
            { key: 'brand', name: '브랜드패션' },
            { key: 'unmapped', name: '미매핑' },
        ];

        const rowMap: Record<string, any> = {};
        cats.forEach(c => {
            let r = processedMap.find(row => {
                if (!row.nameDisplay.includes(c.name)) return false;
                if (c.exclude && row.nameDisplay.includes(c.exclude)) return false;
                return true;
            });
            if (r) rowMap[c.key] = r;
        });

        const chart1Data = [
            { name: '상품1담당', prev: getVal(p1, 2), curr: getVal(p1, 3) },
            { name: '상품2담당', prev: getVal(p2, 2), curr: getVal(p2, 3) },
            { name: '상품3담당', prev: getVal(p3, 2), curr: getVal(p3, 3) },
        ];

        const chart2Data = comps.map(cName => {
            const obj: any = { name: compNames[cName] };
            const colIdx = compCols[cName as keyof typeof compCols];
            cats.forEach(cat => {
                // simple check for all relevant keys
                obj[cat.key] = getVal(rowMap[cat.key], colIdx);
            });
            return obj;
        });

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
        const chart3_3 = buildChart3(['travel', 'insurance', 'rental_gen', 'rental_big']);
        const chart3_4 = buildChart3(['cloth', 'misc', 'beauty']);
        const chart3_5 = buildChart3(['leports', 'under', 'brand']);
        const chart3_6 = buildChart3(['unmapped']);

        const getRankingStr = (items: { name: string, val: number }[]) => {
            return items
                .sort((a, b) => b.val - a.val)
                .map(i => `${i.name}(${i.val.toFixed(1)}%)`)
                .join(' > ');
        };

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

        // Summary Summary Logic
        const ourRanks = [
            { name: '상품1', val: getVal(p1, 3) },
            { name: '상품2', val: getVal(p2, 3) },
            { name: '상품3', val: getVal(p3, 3) }
        ].sort((a, b) => b.val - a.val);

        const compFocus = comps.map(c => {
            const colIdx = compCols[c as keyof typeof compCols];
            let top = { name: '', val: 0 };
            cats.forEach(cat => {
                const v = getVal(rowMap[cat.key], colIdx);
                if (v > top.val) top = { name: cat.name, val: v };
            });
            const cName = compNames[c as keyof typeof compNames];
            return `${cName}(${top.name})`;
        }).join(', ');

        const summary = (
            <Stack gap={4}>
                <Group align="flex-start" gap={4}>
                    <Text size="sm" fw={700} style={{ minWidth: '130px' }}>1. 당사 현황:</Text>
                    <Text size="sm">{ourRanks.map(r => `${r.name}(${r.val.toFixed(1)}%)`).join(' > ')} 순 편성.</Text>
                </Group>
                <Group align="flex-start" gap={4}>
                    <Text size="sm" fw={700} style={{ minWidth: '130px' }}>2. 경쟁사 현황:</Text>
                    <Text size="sm">{compFocus} 주력.</Text>
                </Group>
                <Group align="flex-start" gap={4}>
                    <Text size="sm" fw={700} style={{ minWidth: '130px' }}>3. 카테고리 비교:</Text>
                    <Text size="sm">당사 '{sgMax.name}' 강세 ({sgMax.val.toFixed(1)}%), 경쟁사 대비 우위/열위 확인 필요.</Text>
                </Group>
            </Stack>
        );

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

        const section2 = comps.map((c, i) => {
            const colIdx = compCols[c as keyof typeof compCols];
            const cName = compNames[c as keyof typeof compNames];
            const t1Val = getVal(p1, colIdx);
            const t2Val = getVal(p2, colIdx);
            const t3Val = getVal(p3, colIdx);

            const teamRanks = [
                { name: '상품1', val: t1Val },
                { name: '상품2', val: t2Val },
                { name: '상품3', val: t3Val }
            ];
            const rankStr = getRankingStr(teamRanks);

            let topCat = { name: '', val: 0 };
            cats.forEach(cat => {
                if (['mobile1', 'mobile2'].includes(cat.key)) return;
                const v = getVal(rowMap[cat.key], colIdx);
                if (v > topCat.val) topCat = { name: cat.name, val: v };
            });

            return {
                title: `${i + 1}) ${cName}${cName.endsWith('홈쇼핑') || cName.endsWith('샵') || cName == 'CJ' ? '' : '홈쇼핑'}`,
                main: `• 편성 비중: ${rankStr}`,
                sub: `• 주요 데이터: ${topCat.name} ${topCat.val.toFixed(1)}% 집중.`
            };
        });

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
            generateCompSection('3) 여행 / 보험 / 렌탈', ['travel', 'insurance', 'rental_gen', 'rental_big']),
            generateCompSection('4) 의류 / 잡화 / 뷰티', ['cloth', 'misc', 'beauty']),
            generateCompSection('5) 레포츠 / 언더웨어 / 브랜드', ['leports', 'under', 'brand']),
            generateCompSection('6) 미매핑', ['unmapped'])
        ];

        return { chart1Data, chart2Data, chart3_1, chart3_2, chart3_3, chart3_4, chart3_5, chart3_6, analysisText: { summary, section1, section2, section3 } };

    }, [processedMap, data]);




    // --- Yearly Data Processing ---
    const yearlyCharts = useMemo(() => {
        if (!yearlyData) return null;

        // 1. Merchandiser Trend
        const merchData = yearlyData.labels.map((label, i) => {
            const g1 = yearlyData.merchandisers.goods1[i];
            const g2 = yearlyData.merchandisers.goods2[i];
            const g3 = yearlyData.merchandisers.goods3[i];

            // Use backend provided diffs which come directly from Excel (index 4)
            const g1Diff = yearlyData.merchandisers.goods1Diff ? yearlyData.merchandisers.goods1Diff[i] : (i > 0 ? g1 - yearlyData.merchandisers.goods1[i - 1] : 0);
            const g2Diff = yearlyData.merchandisers.goods2Diff ? yearlyData.merchandisers.goods2Diff[i] : (i > 0 ? g2 - yearlyData.merchandisers.goods2[i - 1] : 0);
            const g3Diff = yearlyData.merchandisers.goods3Diff ? yearlyData.merchandisers.goods3Diff[i] : (i > 0 ? g3 - yearlyData.merchandisers.goods3[i - 1] : 0);

            return {
                name: label,
                goods1: g1, goods1Diff: g1Diff,
                goods2: g2, goods2Diff: g2Diff,
                goods3: g3, goods3Diff: g3Diff,
            };
        });

        // 2. Category Trend & Gap
        // Helper to get Gap = Us - Avg(Competitors)
        const getGapData = (keys: string[]) => {
            return yearlyData.labels.map((label, i) => {
                let usSum = 0;
                let compAvgSum = 0;
                let count = 0;

                keys.forEach(k => {
                    const cat = yearlyData.categories[k];
                    if (cat) {
                        const us = cat.shinsegae[i];
                        const hy = cat.hyundai[i];
                        const gs = cat.gs[i];
                        const lo = cat.lotte[i];
                        const cj = cat.cj[i];

                        const compAvg = (hy + gs + lo + cj) / 4;

                        usSum = us; // This is simplistic, assuming we graph one category at a time or sum them? 
                        // For groups, we should probably average the Gaps? 
                        // Let's just create individual data points for each category in the group
                    }
                });
                return null;
            });
        };

        // Let's structure it so we can iterate efficiently in render

        return { merchData };
    }, [yearlyData]);

    // Render Helpers (Monthly)
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

    // --- Main Render ---

    return (
        <Box p="md" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header Info & Controls */}
            <Group mb="md" justify="space-between" align="center" style={{ flexShrink: 0, backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <Group>
                    <ThemeIcon variant="light" size="lg" color="blue"><IconCalendar size={20} /></ThemeIcon>
                    <Text fw={600} size="md">편성 비중 분석</Text>
                </Group>

                <Group>
                    <SegmentedControl
                        value={viewMode}
                        onChange={setViewMode}
                        data={[
                            { label: '월별 데이터 (Monthly)', value: 'monthly' },
                            { label: '2025 연간 추이 (Yearly)', value: 'yearly' },
                        ]}
                    />
                    {viewMode === 'monthly' && (
                        <MonthPickerInput
                            placeholder="Pick date"
                            value={selectedDate}
                            onChange={(date: any) => setSelectedDate(date)}
                            minDate={new Date(2025, 0, 1)}
                            maxDate={new Date(2025, 11, 1)}
                            style={{ width: 150 }}
                        />
                    )}
                    <Badge variant="dot" size="lg">
                        {viewMode === 'monthly'
                            ? `데이터 기준: ${selectedDate ? dayjs(selectedDate).format('YYYY년 M월') : '선택 안됨'}`
                            : '데이터 기준: 2025년 1월 ~ 12월'
                        }
                    </Badge>
                </Group>
            </Group>

            {loading && <Box h={300} pos="relative"><LoadingOverlay visible={true} /></Box>}

            {/* View 1: Monthly */}
            {!loading && viewMode === 'monthly' && data && (
                <>
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

                    {/* Monthly Analysis */}
                    <Box p="md" bg="white" style={{ borderRadius: 8, border: '1px solid #dee2e6' }}>
                        <Group mb="sm">
                            <IconSparkles size={20} color="#7950f2" />
                            <Text fw={700} size="lg">생성형 AI 분석 결과</Text>
                        </Group>

                        <Stack gap="md">
                            <Alert variant="filled" color="violet" title="요약 (Summary)">
                                <Box mb="xs">{analysisText.summary}</Box>
                            </Alert>
                            <Divider />
                            <Box>
                                <Title order={4} mb="sm" c="violet">1. 당사 상품 담당별 편성 현황</Title>
                                <Box h={250}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chart1Data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                                        <BarChart layout="vertical" data={chart2Data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} allowDecimals={false} />
                                            <YAxis dataKey="name" type="category" width={40} tick={{ fontSize: 12 }} />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                                            <Bar dataKey="kitchen" name="주방" stackId="a" fill="#00c49f" />
                                            <Bar dataKey="app" name="가전" stackId="a" fill="#005f87" />
                                            <Bar dataKey="living" name="리빙" stackId="a" fill="#0088fe" />
                                            <Bar dataKey="food" name="푸드" stackId="a" fill="#d0ed57" />
                                            <Bar dataKey="health" name="건강식품" stackId="a" fill="#ffc658" />
                                            <Bar dataKey="travel" name="여행" stackId="a" fill="#8dd1e1" />
                                            <Bar dataKey="insurance" name="보험" stackId="a" fill="#83aac2" />
                                            <Bar dataKey="rental_gen" name="일반렌탈" stackId="a" fill="#82ca9d" />
                                            <Bar dataKey="rental_big" name="대품렌탈" stackId="a" fill="#a4de6c" />
                                            <Bar dataKey="cloth" name="의류" stackId="a" fill="#8884d8" />
                                            <Bar dataKey="misc" name="잡화" stackId="a" fill="#a4de6c" />
                                            <Bar dataKey="beauty" name="뷰티" stackId="a" fill="#82ca9d" />
                                            <Bar dataKey="leports" name="레포츠" stackId="a" fill="#ff8042" />
                                            <Bar dataKey="under" name="언더웨어" stackId="a" fill="#d35400" />
                                            <Bar dataKey="brand" name="브랜드패션" stackId="a" fill="#6a00a6" />
                                            <Bar dataKey="unmapped" name="미매핑" stackId="a" fill="#000000" />
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
                                {/* Monthly Category Charts */}
                                <Stack gap="xl">
                                    <Box>
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
                                    {/* Add remaining monthly sections */}
                                    {[chart3_2, chart3_3, chart3_4, chart3_5, chart3_6].map((cData, cIdx) => (
                                        <Box key={cIdx}>
                                            <Title order={5} mb="xs">{[
                                                '2) 푸드 / 건강식품',
                                                '3) 여행 / 보험 / 렌탈',
                                                '4) 의류 / 잡화 / 뷰티',
                                                '5) 레포츠 / 언더웨어 / 브랜드',
                                                '6) 미매핑'
                                            ][cIdx]}</Title>
                                            <Box h={200}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={cData} barGap={4}>
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
                                                {analysisText.section3[cIdx + 1]?.lines?.map((line: any, i: number) => (
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
                                    ))}
                                </Stack>
                            </Box>
                        </Stack>
                    </Box>
                </>
            )}

            {/* View 2: Yearly */}
            {!loading && viewMode === 'yearly' && yearlyData && yearlyCharts && (
                <Box>
                    <Grid>
                        {/* Section 1: Merchandiser Trend */}
                        <Grid.Col span={12}>
                            <Paper p="md" withBorder radius="md">
                                <Group mb="md">
                                    <IconChartLine size={24} color="#228be6" />
                                    <Text size="lg" fw={700} c="blue">1. 당사 상품 담당별 월별 추이 (2025년)</Text>
                                </Group>
                                <Box h={300}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={yearlyCharts.merchData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Line type="monotone" dataKey="goods1" name="상품1담당" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 8 }} label={(props) => <CustomLineLabel {...props} data={yearlyCharts.merchData} dataKey="goods1" />} />
                                            <Line type="monotone" dataKey="goods2" name="상품2담당" stroke="#82ca9d" strokeWidth={2} label={(props) => <CustomLineLabel {...props} data={yearlyCharts.merchData} dataKey="goods2" />} />
                                            <Line type="monotone" dataKey="goods3" name="상품3담당" stroke="#ffc658" strokeWidth={2} label={(props) => <CustomLineLabel {...props} data={yearlyCharts.merchData} dataKey="goods3" />} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Box>
                                <Alert variant="light" color="blue" mt="sm">
                                    <Text size="sm">
                                        상품 담당별 월별 편성 비중 흐름을 보여줍니다.
                                    </Text>
                                </Alert>
                            </Paper>
                        </Grid.Col>

                        {/* Section 2 & 3: Category Trend & Gap */}
                        <Grid.Col span={12}>
                            <Paper p="md" withBorder radius="md">
                                <Group mb="md" justify="space-between">
                                    <Group>
                                        <IconChartBar size={24} color="#fa5252" />
                                        <Text size="lg" fw={700} c="red">2. 카테고리별 경쟁사 대비</Text>
                                    </Group>
                                    <SegmentedControl
                                        value={gapTarget}
                                        onChange={setGapTarget}
                                        data={[
                                            { label: '경쟁사 평균', value: 'avg' },
                                            { label: '현대', value: 'hyundai' },
                                            { label: 'GS', value: 'gs' },
                                            { label: '롯데', value: 'lotte' },
                                            { label: 'CJ', value: 'cj' },
                                        ]}
                                        size="xs"
                                    />
                                </Group>

                                <Tabs defaultValue="kitchen">
                                    <Tabs.List>
                                        <Tabs.Tab value="kitchen">주방/가전/리빙</Tabs.Tab>
                                        <Tabs.Tab value="food">푸드/건강</Tabs.Tab>
                                        <Tabs.Tab value="fashion">패션/뷰티/잡화</Tabs.Tab>
                                        <Tabs.Tab value="leports">레포츠/언더웨어</Tabs.Tab>
                                        <Tabs.Tab value="intangible">무형</Tabs.Tab>
                                    </Tabs.List>

                                    {[
                                        { key: 'kitchen', items: ['kitchen', 'app', 'living'] },
                                        { key: 'food', items: ['food', 'health'] },
                                        { key: 'fashion', items: ['cloth', 'beauty', 'misc'] },
                                        { key: 'leports', items: ['leports', 'under'] },
                                        { key: 'intangible', items: ['travel', 'insurance', 'rental_gen', 'rental_big'] }
                                    ].map(group => (
                                        <Tabs.Panel key={group.key} value={group.key} pt="xs">
                                            <Grid>
                                                {group.items.map(catKey => {
                                                    const catData = yearlyData.categories[catKey];
                                                    if (!catData) return null;

                                                    const chartData = yearlyData.labels.map((lbl, i) => {
                                                        const us = catData.shinsegae[i];
                                                        let targetVal = 0;
                                                        if (gapTarget === 'avg') {
                                                            targetVal = (catData.hyundai[i] + catData.gs[i] + catData.lotte[i] + catData.cj[i]) / 4;
                                                        } else {
                                                            // @ts-ignore
                                                            targetVal = catData[gapTarget]?.[i] || 0;
                                                        }

                                                        return {
                                                            name: lbl,
                                                            us,
                                                            targetVal,
                                                            gap: us - targetVal
                                                        };
                                                    });

                                                    // Category Name
                                                    const catName = {
                                                        kitchen: '주방', app: '가전', living: '리빙',
                                                        food: '푸드', health: '건강식품',
                                                        cloth: '의류', beauty: '뷰티', misc: '잡화',
                                                        leports: '레포츠', under: '언더웨어',
                                                        travel: '여행', insurance: '보험',
                                                        rental_gen: '일반렌탈', rental_big: '대품렌탈'
                                                    }[catKey] || catKey;

                                                    const targetName = gapTarget === 'avg' ? '경쟁사평균' : { hyundai: '현대', gs: 'GS', lotte: '롯데', cj: 'CJ' }[gapTarget];

                                                    return (
                                                        <Grid.Col span={4} key={catKey}>
                                                            <Card withBorder radius="sm" padding="sm">
                                                                <Text fw={700} size="sm" mb="xs" ta="center">{catName} 격차 (당사 - {targetName})</Text>
                                                                <Box h={150}>
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <ComposedChart data={chartData}>
                                                                            <CartesianGrid stroke="#f5f5f5" />
                                                                            <XAxis dataKey="name" fontSize={10} interval={1} />
                                                                            <YAxis fontSize={10} hide />
                                                                            <RechartsTooltip
                                                                                formatter={(val: number) => val.toFixed(1) + '%'}
                                                                                labelStyle={{ fontSize: 12 }}
                                                                                itemStyle={{ fontSize: 12 }}
                                                                            />
                                                                            <ReferenceLine y={0} stroke="#000" />
                                                                            <Bar dataKey="gap" name="격차">
                                                                                {chartData.map((entry, index) => (
                                                                                    <Cell key={`cell-${index}`} fill={entry.gap > 0 ? '#f03e3e' : '#1c7ed6'} />
                                                                                ))}
                                                                            </Bar>
                                                                            <Line type="monotone" dataKey="us" name="당사 비중" stroke="#ff8787" dot={false} strokeWidth={1} />
                                                                            <Line type="monotone" dataKey="targetVal" name={`${targetName} 비중`} stroke="#adb5bd" dot={false} strokeWidth={1} strokeDasharray="3 3" />
                                                                        </ComposedChart>
                                                                    </ResponsiveContainer>
                                                                </Box>
                                                            </Card>
                                                        </Grid.Col>
                                                    );
                                                })}
                                            </Grid>
                                        </Tabs.Panel>
                                    ))}
                                </Tabs>
                                <Alert variant="light" color="red" mt="md">
                                    <Text size="sm">
                                        * <Text span fw={700} c="red">빨간 막대</Text>: {gapTarget === 'avg' ? '경쟁사 평균' : { hyundai: '현대', gs: 'GS', lotte: '롯데', cj: 'CJ' }[gapTarget]}보다 많이 편성함 (Gap {'>'} 0) <br />
                                        * <Text span fw={700} c="blue">파란 막대</Text>: {gapTarget === 'avg' ? '경쟁사 평균' : { hyundai: '현대', gs: 'GS', lotte: '롯데', cj: 'CJ' }[gapTarget]}보다 적게 편성함 (Gap {'<'} 0) <br />
                                        * 점선은 {gapTarget === 'avg' ? '경쟁사 평균' : { hyundai: '현대', gs: 'GS', lotte: '롯데', cj: 'CJ' }[gapTarget]} 비중, 실선은 당사 비중입니다.
                                    </Text>
                                </Alert>
                            </Paper>
                        </Grid.Col>

                    </Grid>
                </Box>
            )}
        </Box>
    );
}
