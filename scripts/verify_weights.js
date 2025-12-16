const xlsx = require('xlsx');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const file = path.join(__dirname, '../data/updated_dataset.xlsx');
const dbPath = path.join(__dirname, '../schedule.db');

function checkExcel() {
    console.log(`--- Checking ${path.basename(file)} ---`);
    const workbook = xlsx.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const headers = xlsx.utils.sheet_to_json(sheet, { header: 1 })[0];

    const btimeIdx = headers.indexOf('OTHER_BTIME');
    const etimeIdx = headers.indexOf('OTHER_ETIME');
    const priceIdx = headers.indexOf('PRODUCT_SALE_PRICE');
    const weightsIdx = headers.indexOf('WEIGHTS_TIME');

    console.log('Headers Sample:', headers.slice(0, 15));
    console.log(`Indices: BTIME=${btimeIdx}, ETIME=${etimeIdx}, PRICE=${priceIdx}, WEIGHTS=${weightsIdx}`);

    // Check order
    if (weightsIdx === priceIdx + 1) {
        console.log("SUCCESS: WEIGHTS_TIME is after PRODUCT_SALE_PRICE");
    } else {
        console.log("FAIL: Column order mismatch");
    }
}

function checkDB() {
    console.log(`--- Checking DB ---`);
    const db = new sqlite3.Database(dbPath);
    db.get("SELECT * FROM schedules WHERE weights_time IS NOT NULL LIMIT 1", (err, row) => {
        if (err) console.error(err);
        else console.log("Sample DB Row with weights_time:", row ? row.weights_time : 'None');
        db.close();
    });
}

checkExcel();
checkDB();
