import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';

export async function GET() {
    try {
        console.log('Current working directory:', process.cwd());
        const filePath = path.join(process.cwd(), 'data', '251222_competitor_ratio.xlsx');
        console.log('Attempting to read file at:', filePath);

        // Use fs to read the file buffer directly
        if (!fs.existsSync(filePath)) {
            console.error('File does not exist at path:', filePath);
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // 1. Get Info text from A2 (Cell "A2")
        const infoCell = sheet['A2'];
        const infoText = infoCell ? infoCell.v : '';

        // 2. Data Range: A5 to Q31 (Rows 4 to 30, Cols 0 to 16)
        // Actually, let's be dynamic about rows if possible, or stick to user request A3-Q31.
        // User said: A3 to Q31.
        // A3 is Header Row 1.
        // A4 is Header Row 2.
        // A5 is Data Start.

        // We will extract data rows manually to ensure we get exactly what we want.
        const data = [];
        const startRow = 4; // Row 5 (0-indexed 4)
        const endRow = 30;  // Row 31 (0-indexed 30)

        // Columns 0 to 16 (A to Q)
        const cols = 17;

        for (let r = startRow; r <= endRow; r++) {
            const rowData = [];
            for (let c = 0; c < cols; c++) {
                const cellAddress = XLSX.utils.encode_cell({ r, c });
                const cell = sheet[cellAddress];
                let val = cell ? cell.v : '';

                // Format percentages if raw number
                if (cell && cell.t === 'n' && (c >= 2)) {
                    // If it's a number, it might be a percentage (0.402) or whole number. 
                    // The excel might store it as 0.402 and format it.
                    // XLSX.readFile usually keeps 'v' as raw value and 'w' as formatted text.
                    // Let's prefer 'w' (formatted text) if available to match Excel display,
                    // but 'w' might not be available if not formatted correctly in parsing.
                    // However, users usually want what they see. '3.1▼' is definitely a string in the cell?
                    // Or is it a number with custom formatting?
                    // If it contains "▼", it's likely a string string or custom format.
                    if (cell.w) val = cell.w;
                }
                rowData.push(val);
            }
            data.push(rowData);
        }

        return NextResponse.json({
            info: infoText,
            data
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to read Excel file' }, { status: 500 });
    }
}
