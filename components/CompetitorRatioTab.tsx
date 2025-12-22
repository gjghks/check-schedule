'use client';

import { useEffect, useState } from 'react';
import { Table, ScrollArea, Box, Text, Group, LoadingOverlay, Card, Badge, ThemeIcon, Alert } from '@mantine/core';
import { IconArrowUp, IconArrowDown, IconCalendar } from '@tabler/icons-react';


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


    if (loading) {
        return <Box h={300} pos="relative"><LoadingOverlay visible={true} /></Box>;
    }

    if (!data) return <Text>데이터를 불러올 수 없습니다.</Text>;
    if (data.error) return <Alert color="red" title="오류">{data.error}</Alert>;
    if (!data.data || !Array.isArray(data.data)) return <Text>데이터 형식이 올바르지 않습니다.</Text>;

    // Info parsing: "편성일자 : 2025/12/01 ~ 2025/12/27 ,  방송사: 전체"
    // Let's display this nicely.

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
        // Check "구분" column (index 1)
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
                                <Table.Th c="white" ta="center" w={50} bg="#495057">No</Table.Th>
                                <Table.Th c="white" ta="center" w={180} bg="#495057">구분</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">당사</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">현대</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">GS</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">롯데</Table.Th>
                                <Table.Th colSpan={3} c="white" ta="center" bg="#495057">CJ</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {data.data.filter(row => row[0]).map((row, rowIndex) => (
                                <Table.Tr key={rowIndex} bg={getRowBgColor(row)} fw={getRowFw(row)}>
                                    <Table.Td ta="center">{row[0]}</Table.Td>
                                    <Table.Td style={{ paddingLeft: row[1].startsWith('ㄴ') ? 20 : (row[1].startsWith('__') ? 30 : 10) }}>
                                        {String(row[1]).replace(/ㄴ/g, '').replace(/_/g, '')}
                                    </Table.Td>
                                    {/* Data Columns */}
                                    {row.slice(2, 17).map((cell: any, cellIndex: number) => {
                                        // Check if column is "전월비" (indices: 4, 7, 10, 13, 16 -- in the slice (2..16) they are 2, 5, 8, 11, 14 relative to 0)
                                        // relative cellIndex 0 -> row[2] (전월)
                                        // relative cellIndex 2 -> row[4] (전월비)
                                        // 2, 5, 8, 11, 14
                                        const isDiffCol = [2, 5, 8, 11, 14].includes(cellIndex);
                                        return (
                                            <Table.Td key={cellIndex} ta="center">
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
