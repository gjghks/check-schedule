const xlsx = require('xlsx');
const wb = xlsx.readFile('updated_dataset.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws);

const kt = rows.filter(r => r.OTHER_BROAD_NAME === 'KT알파' || r.OTHER_BROAD_NAME === 'SK스토아');
console.log('KT/SK count in updated_dataset:', kt.length);
