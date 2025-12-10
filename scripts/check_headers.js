const xlsx = require('xlsx');
const path = require('path');

const file1 = path.join(__dirname, '../data/dataset.xlsx');
const file2 = path.join(__dirname, '../data/OTHER_ETIME and PRODUCT_SALE_PRICE.xlsx');

function logHeaders(file) {
    console.log(`--- Headers for ${path.basename(file)} ---`);
    const workbook = xlsx.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length > 0) {
        console.log(data[0]);
    } else {
        console.log('Empty file');
    }
}

logHeaders(file1);
logHeaders(file2);
