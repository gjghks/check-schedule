import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';

function getLatestDetailFile(dir: string): string | null {
    try {
        const files = fs.readdirSync(dir).filter(f => f.includes('tb_ai_sche_comp_sml_rslt') && f.endsWith('.xlsx'));
        if (files.length === 0) return null;
        return files.sort().pop() || null;
    } catch (e) {
        console.error("Error finding detail file", e);
        return null;
    }
}

function mapCategory(k: string): string | null {
    if (!k) return null;
    if (k.includes('의류')) return 'cloth';
    if (k.includes('뷰티') || k.includes('이미용')) return 'beauty';
    if (k.includes('건강')) return 'health';
    // Specific match order matters
    if (k.includes('레포츠')) {
        if (k.includes('팀')) return null; // Avoid parent team
        return 'leports';
    }
    if (k.includes('언더웨어') || k.includes('속옷')) {
        if (k.includes('팀')) return null; // Avoid parent team
        return 'under';
    }
    if (k.includes('주방')) return 'kitchen';
    if (k.includes('가전') || k.includes('디지털')) return 'app';
    if (k.includes('리빙') || k.includes('생활')) return 'living';
    if (k.includes('푸드') || k.includes('식품') || k.includes('농수축')) return 'food';
    if (k.includes('잡화')) return 'misc';

    if (k.includes('여행')) return 'travel';
    if (k.includes('보험')) return 'insurance';
    if (k.includes('일반렌탈')) return 'rental_gen';
    if (k.includes('대품렌탈')) return 'rental_big';

    if (k.includes('모바일상품1팀')) return 'mobile1';
    if (k.includes('모바일상품2팀')) return 'mobile2';

    if (k.includes('브랜드패션')) return 'brand';
    if (k.includes('미매핑')) return 'unmapped';

    return 'others';
}

function mapCompetitor(val: string): string | null {
    if (!val) return null;
    if (val.includes('현대')) return 'hyundai';
    if (val.includes('GS') || val.includes('지에스')) return 'gs';
    if (val.includes('롯데')) return 'lotte';
    if (val.includes('CJ') || val.includes('씨제이')) return 'cj';
    return null;
}

// Columns Map based on inspection
const COMP_COLS = { shinsegae: 3, hyundai: 6, gs: 9, lotte: 12, cj: 15 };
const CATEGORIES = [
    { key: 'kitchen', name: '주방' },
    { key: 'app', name: '가전', exclude: '팀' },
    { key: 'living', name: '리빙' },
    { key: 'food', name: '푸드' }, // Matches '푸드팀'
    { key: 'health', name: '건강식품' }, // Matches '건강식품팀'
    { key: 'travel', name: '여행' },
    { key: 'insurance', name: '보험' },
    { key: 'rental_gen', name: '일반렌탈' },
    { key: 'rental_big', name: '대품렌탈' },
    { key: 'mobile1', name: '모바일상품1팀' },
    { key: 'cloth', name: '의류' },
    { key: 'misc', name: '잡화' },
    { key: 'beauty', name: '뷰티' }, // Matches '뷰티팀'
    { key: 'mobile2', name: '모바일상품2팀' },
    { key: 'leports', name: '레포츠', exclude: '팀' }, // Exclude '레포츠언더웨어팀'
    { key: 'under', name: '언더웨어', exclude: '팀' }, // Exclude '레포츠언더웨어팀'
    { key: 'brand', name: '브랜드패션' },
    { key: 'unmapped', name: '미매핑' },
];

function readExcelFile(filePath: string) {
    if (!fs.existsSync(filePath)) return null;

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const infoCell = sheet['A2'];
    let infoText = infoCell ? String(infoCell.v) : '';
    const splitKeyword = '방송사: 전체';
    if (infoText.includes(splitKeyword)) {
        infoText = infoText.split(splitKeyword)[0] + splitKeyword;
    }
    infoText = infoText.trim().replace(/,$/, '');

    const data = [];
    const startRow = 4;
    const endRow = 30;
    const cols = 17;

    for (let r = startRow; r <= endRow; r++) {
        const rowData = [];
        for (let c = 0; c < cols; c++) {
            const cellAddress = XLSX.utils.encode_cell({ r, c });
            const cell = sheet[cellAddress];
            let val = cell ? cell.v : '';
            if (cell && cell.t === 'n' && (c >= 2)) {
                if (cell.w) val = cell.w; // Use formatted string if available (e.g. "12.5%")
            }
            rowData.push(val);
        }
        data.push(rowData);
    }

    // Top Items logic
    const topItems: Record<string, Record<string, string[]>> = {
        hyundai: {}, gs: {}, lotte: {}, cj: {}
    };

    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    // Find header row containing '현대 1위'
    // It might vary slightly, so look for includes
    const headerIndex = jsonData.findIndex(row => row && row.some(cell => String(cell).includes('현대 1위')));

    if (headerIndex !== -1) {
        const headerRow = jsonData[headerIndex];
        const idxMap: any = {
            hyundai: headerRow.findIndex((c: any) => String(c).includes('현대 1위')),
            gs: headerRow.findIndex((c: any) => String(c).includes('GS 1위')),
            lotte: headerRow.findIndex((c: any) => String(c).includes('롯데 1위')),
            cj: headerRow.findIndex((c: any) => String(c).includes('CJ 1위'))
        };

        for (let i = headerIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row) continue;
            const catName = String(row[1] || '');
            const catKey = mapCategory(catName);

            if (catKey && catKey !== 'others') {
                Object.keys(idxMap).forEach(k => {
                    const colIdx = idxMap[k];
                    if (colIdx > -1 && row[colIdx]) {
                        const val = String(row[colIdx]).trim();
                        if (val) {
                            if (!topItems[k][catKey]) topItems[k][catKey] = [];
                            topItems[k][catKey].push(val);
                        }
                    }
                });
            }
        }
    }

    return { info: infoText, data, topItems };
}

function parsePercentage(val: any): number {
    if (typeof val === 'number') return val * 100;
    if (!val) return 0;
    const str = String(val).replace(/,/g, '').trim();

    // Check for negative indicators
    const isNegative = str.includes('▼') || str.includes('-');

    // Remove symbols to get pure number
    const cleanStr = str.replace(/[%▲▼]/g, '').trim();
    const num = parseFloat(cleanStr);

    if (isNaN(num)) return 0;

    // Apply sign
    return isNegative ? -Math.abs(num) : num;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode'); // 'monthly' (default) or 'yearly'

        if (mode === 'yearly') {
            const yearParam = searchParams.get('year') || '2025';
            const yy = yearParam.slice(2);

            const months = [];
            for (let m = 1; m <= 12; m++) {
                months.push(String(m).padStart(2, '0'));
            }

            const aggregated = {
                year: yearParam,
                labels: [] as string[],
                merchandisers: {
                    goods1: [] as number[],
                    goods1Diff: [] as number[],
                    goods2: [] as number[],
                    goods2Diff: [] as number[],
                    goods3: [] as number[],
                    goods3Diff: [] as number[],
                },
                categories: {} as Record<string, { shinsegae: number[], hyundai: number[], gs: number[], lotte: number[], cj: number[] }>
            };

            // Initialize categories
            CATEGORIES.forEach(c => {
                aggregated.categories[c.key] = { shinsegae: [], hyundai: [], gs: [], lotte: [], cj: [] };
            });

            for (const mm of months) {
                const standardName = `${yy}${mm}_competitor_ratio.xlsx`;
                let filePath = path.join(process.cwd(), 'data', standardName);

                // Fallback specific for 2025-12 as seen in file list
                if (mm === '12' && yy === '25' && !fs.existsSync(filePath)) {
                    const alt = path.join(process.cwd(), 'data', '251231_competitor_ratio.xlsx');
                    if (fs.existsSync(alt)) filePath = alt;
                }

                let result = readExcelFile(filePath);

                // If not found, try to assume 0 values
                if (!result) {
                    aggregated.labels.push(`${mm}월`);
                    aggregated.merchandisers.goods1.push(0);
                    aggregated.merchandisers.goods1Diff.push(0);
                    aggregated.merchandisers.goods2.push(0);
                    aggregated.merchandisers.goods2Diff.push(0);
                    aggregated.merchandisers.goods3.push(0);
                    aggregated.merchandisers.goods3Diff.push(0);
                    CATEGORIES.forEach(c => {
                        if (aggregated.categories[c.key]) {
                            aggregated.categories[c.key].shinsegae.push(0);
                            aggregated.categories[c.key].hyundai.push(0);
                            aggregated.categories[c.key].gs.push(0);
                            aggregated.categories[c.key].lotte.push(0);
                            aggregated.categories[c.key].cj.push(0);
                        }
                    });
                    continue;
                }

                aggregated.labels.push(`${mm}월`);

                const findRow = (k: string) => result?.data.find(r => String(r[1]).includes(k));
                const p1 = findRow('상품1담당');
                const p2 = findRow('상품2담당');
                const p3 = findRow('상품3담당');

                aggregated.merchandisers.goods1.push(parsePercentage(p1 ? p1[3] : 0));
                aggregated.merchandisers.goods1Diff.push(parsePercentage(p1 ? p1[4] : 0));

                aggregated.merchandisers.goods2.push(parsePercentage(p2 ? p2[3] : 0));
                aggregated.merchandisers.goods2Diff.push(parsePercentage(p2 ? p2[4] : 0));

                aggregated.merchandisers.goods3.push(parsePercentage(p3 ? p3[3] : 0));
                aggregated.merchandisers.goods3Diff.push(parsePercentage(p3 ? p3[4] : 0));

                CATEGORIES.forEach(cat => {
                    const row = result?.data.find(r => {
                        const name = String(r[1] || '');
                        if (!name.includes(cat.name)) return false;
                        if (cat.exclude && name.includes(cat.exclude)) return false;
                        return true;
                    });

                    if (aggregated.categories[cat.key]) {
                        const getV = (idx: number) => parsePercentage(row ? row[idx] : 0);
                        aggregated.categories[cat.key].shinsegae.push(getV(COMP_COLS.shinsegae));
                        aggregated.categories[cat.key].hyundai.push(getV(COMP_COLS.hyundai));
                        aggregated.categories[cat.key].gs.push(getV(COMP_COLS.gs));
                        aggregated.categories[cat.key].lotte.push(getV(COMP_COLS.lotte));
                        aggregated.categories[cat.key].cj.push(getV(COMP_COLS.cj));
                    }
                });
            }

            return NextResponse.json(aggregated);
        }

        // --- Monthly Mode ---
        const monthParam = searchParams.get('month');
        let fileName = '251231_competitor_ratio.xlsx';
        if (monthParam) {
            const [year, month] = monthParam.split('-');
            const yy = year.slice(2);
            fileName = `${yy}${month}_competitor_ratio.xlsx`;
            const p = path.join(process.cwd(), 'data', fileName);
            if (!fs.existsSync(p)) {
                if (yy === '25' && month === '12') fileName = '251231_competitor_ratio.xlsx';
            }
        }

        const filePath = path.join(process.cwd(), 'data', fileName);
        const result = readExcelFile(filePath);

        if (!result) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to read Excel file' }, { status: 500 });
    }
}
