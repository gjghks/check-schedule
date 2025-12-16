const xlsx = require('xlsx');
const path = require('path');

const wb = xlsx.readFile('updated_dataset.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const headers = xlsx.utils.sheet_to_json(ws, { header: 1 })[0];
console.log('updated_dataset.xlsx Headers:', headers);

const wb2 = xlsx.readFile('data/SK_KT.xlsx');
const ws2 = wb2.Sheets[wb2.SheetNames[0]];
const headers2 = xlsx.utils.sheet_to_json(ws2, { header: 1 })[0];
console.log('SK_KT.xlsx Headers:', headers2);
