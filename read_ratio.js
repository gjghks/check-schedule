const XLSX = require('xlsx');
const fs = require('fs');

try {
    const buf = fs.readFileSync('data/251230_competitor_ratio.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(JSON.stringify(data, null, 2));
} catch (e) {
    console.error(e);
}
