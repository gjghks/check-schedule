const xlsx = require('xlsx');
const path = require('path');

const file = path.join(__dirname, '../data/WEIGHTS_TIME.xlsx');

function checkFile(file) {
    console.log(`--- Checking ${path.basename(file)} ---`);
    const workbook = xlsx.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const headers = xlsx.utils.sheet_to_json(sheet, { header: 1 })[0];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log('Headers:', headers);
    if (data.length > 0) {
        console.log('Row 0:', data[0]);
    }
}

checkFile(file);
