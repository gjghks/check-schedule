const xlsx = require('xlsx');
const path = require('path');

const file1 = path.join(__dirname, '../data/dataset.xlsx');
const file2 = path.join(__dirname, '../data/updated_dataset.xlsx');

function logCreateDtm(file) {
    console.log(`--- CREATE_DTM Sample for ${path.basename(file)} ---`);
    const workbook = xlsx.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    if (data.length > 0) {
        console.log('Row 0 CREATE_DTM:', data[0].CREATE_DTM, 'Type:', typeof data[0].CREATE_DTM);
        if (data.length > 1) {
            console.log('Row 1 CREATE_DTM:', data[1].CREATE_DTM, 'Type:', typeof data[1].CREATE_DTM);
        }
    }
}

logCreateDtm(file1);
logCreateDtm(file2);
