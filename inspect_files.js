const XLSX = require('xlsx');
const fs = require('fs');

const files = ['data/dataset.xlsx', 'data/251230_od_bo_tcompanybroadsche.xlsx'];

files.forEach(f => {
    try {
        if (!fs.existsSync(f)) {
             console.log("Missing:", f);
             return;
        }
        console.log("\nChecking", f);
        const wb = XLSX.readFile(f, { sheetRows: 5 });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length > 0) console.log("Header:", data[0]);
    } catch(e) {
        console.log("Error:", e.message);
    }
});
