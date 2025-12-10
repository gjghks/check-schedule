const xlsx = require('xlsx');
const path = require('path');

const file = path.join(__dirname, '../data/updated_dataset.xlsx');

function checkFirstRow(file) {
    console.log(`--- Checking First Row of ${path.basename(file)} ---`);
    const workbook = xlsx.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Check Headers order
    const headers = xlsx.utils.sheet_to_json(sheet, { header: 1 })[0];
    console.log('Headers Look:', headers.slice(0, 10)); // sample

    // Check Index of OTHER_BTIME, OTHER_ETIME
    const btimeIdx = headers.indexOf('OTHER_BTIME');
    const etimeIdx = headers.indexOf('OTHER_ETIME');
    const priceIdx = headers.indexOf('PRODUCT_SALE_PRICE');

    console.log(`OTHER_BTIME Index: ${btimeIdx}`);
    console.log(`OTHER_ETIME Index: ${etimeIdx}`);
    console.log(`PRODUCT_SALE_PRICE Index: ${priceIdx}`);

    const data = xlsx.utils.sheet_to_json(sheet);
    if (data.length > 0) {
        console.log('Row 0 CREATE_DTM:', data[0].CREATE_DTM);
    }
}

checkFirstRow(file);
