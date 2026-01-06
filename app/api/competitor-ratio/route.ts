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
    if (k.includes('레포츠')) return 'leports';
    if (k.includes('주방')) return 'kitchen';
    if (k.includes('가전') || k.includes('디지털')) return 'app';
    if (k.includes('리빙') || k.includes('생활')) return 'living'; // '생활용품'? '침구'?
    if (k.includes('푸드') || k.includes('식품') || k.includes('농수축')) return 'food';
    if (k.includes('잡화')) return 'misc';
    if (k.includes('무형') || k.includes('여행') || k.includes('렌탈') || k.includes('보험')) return 'intangible';
    if (k.includes('속옷') || k.includes('언더웨어')) return 'under';
    if (k.includes('패션')) return 'brand'; // Ambiguous? '브랜드패션'?
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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get('month'); // "2025-01"

        let fileName = '251231_competitor_ratio.xlsx'; // Fallback

        // 1. Determine Competitor Ratio File
        if (monthParam) {
            const [year, month] = monthParam.split('-');
            const yy = year.slice(2);
            // Default logic: YYMM_competitor_ratio.xlsx
            // But check if exists, maybe 251230 exists but 2512 doesn't.
            // Simplified: Try 251230 first if requested Dec 2025?
            // Actually the pattern seems to be [YY][MM]_competitor_ratio.xlsx from user prompt?
            // "2501_competitor_ratio.xlsx" exists.
            fileName = `${yy}${month}_competitor_ratio.xlsx`;

            // Fallback for Dec 2025 specific case if standard name fails?
            // Users file list showed 251230_competitor_ratio.xlsx and 2501_competitor_ratio.xlsx.
            // If user asks for 2025-12, constructing 2512_competitor_ratio.xlsx might fail.
            // Let's check existence and fallback to 251230 if 2512 missing.
            const p = path.join(process.cwd(), 'data', fileName);
            if (!fs.existsSync(p)) {
                if (yy === '25' && month === '12') fileName = '251230_competitor_ratio.xlsx';
            }
        }

        const filePath = path.join(process.cwd(), 'data', fileName);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

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
                    if (cell.w) val = cell.w;
                }
                rowData.push(val);
            }
            data.push(rowData);
        }

        // --- 2. Extract Top Items from Ratio File ---
        const topItems: Record<string, Record<string, string[]>> = {
            hyundai: {}, gs: {}, lotte: {}, cj: {}
        };

        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        // Find header row containing '현대 1위'
        const headerIndex = jsonData.findIndex(row => row && row.includes('현대 1위'));

        if (headerIndex !== -1) {
            const headerRow = jsonData[headerIndex];
            const idxMap: any = {
                hyundai: headerRow.indexOf('현대 1위'),
                gs: headerRow.indexOf('GS 1위'),
                lotte: headerRow.indexOf('롯데 1위'),
                cj: headerRow.indexOf('CJ 1위')
            };

            for (let i = headerIndex + 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row) continue;

                // Assuming Name is at index 1 (Col B)
                // Need to match 100% with 'mapCategory' logic used elsewhere or 'cats' logic
                // The helper mapCategory matches substrings provided in 'row[1]'
                const catName = String(row[1] || '');
                const catKey = mapCategory(catName);

                if (catKey && catKey !== 'others') {
                    Object.keys(idxMap).forEach(k => {
                        const colIdx = idxMap[k];
                        if (colIdx > -1 && row[colIdx]) {
                            const val = String(row[colIdx]).trim();
                            if (val) {
                                if (!topItems[k][catKey]) topItems[k][catKey] = [];
                                // Avoid duplicates if row appears multiple times or similar logic?
                                // Just push 
                                topItems[k][catKey].push(val);
                            }
                        }
                    });
                }
            }
        }

        return NextResponse.json({
            info: infoText,
            data,
            topItems
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to read Excel file' }, { status: 500 });
    }
}
