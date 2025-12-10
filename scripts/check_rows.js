const xlsx = require('xlsx');
const path = require('path');

const file1 = path.join(__dirname, '../data/dataset.xlsx');
const file2 = path.join(__dirname, '../data/OTHER_ETIME and PRODUCT_SALE_PRICE.xlsx');

function logFirstRow(file) {
    console.log(`--- First Row for ${path.basename(file)} ---`);
    const workbook = xlsx.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    if (data.length > 0) {
        console.log(data[0]);
    }
}

logFirstRow(file1);
logFirstRow(file2);
