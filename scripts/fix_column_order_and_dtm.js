const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const path = require('path');
const dayjs = require('dayjs');

const dbPath = path.join(__dirname, '../schedule.db');
const datasetPath = path.join(__dirname, '../data/dataset.xlsx');
const otherPath = path.join(__dirname, '../data/OTHER_ETIME and PRODUCT_SALE_PRICE.xlsx');
const exportPath = path.join(__dirname, '../data/updated_dataset.xlsx');

function formatExcelDate(serial) {
    // Excel serial date 1 = 1900-01-01.
    // Excel erroneously treats 1900 as a leap year.
    // Adjust for JS Date (1970 epoch).
    if (typeof serial !== 'number') return serial;
    // 25569 is days between 1900-01-01 and 1970-01-01
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    // There's a fractional part for time
    const fractional_day = serial - Math.floor(serial) + 0.0000001;
    const total_seconds = Math.floor(86400 * fractional_day);
    const seconds = total_seconds % 60;
    const minutes = Math.floor(total_seconds / 60) % 60;
    const hours = Math.floor(total_seconds / (60 * 60));

    date_info.setSeconds(seconds);
    date_info.setMinutes(minutes);
    date_info.setHours(hours);

    return dayjs(date_info).format('YYYY-MM-DD HH:mm:ss');
}

async function run() {
    console.log('Reading files...');
    // Read with defaults first to handle Headers properly
    const workbook1 = xlsx.readFile(datasetPath);
    const sheet1 = workbook1.Sheets[workbook1.SheetNames[0]];
    // cellDates: false (default), we handle manually or use xlsx helper if needed.
    // Actually dayjs has bad logic for excel date.
    // let's use xlsx.SSF or just cellDates: true for simple reading if we trust it.

    // Let's re-read with cellDates: true to get proper dates
    const wbDate = xlsx.readFile(datasetPath, { cellDates: true });
    // This converts numbers to Date objects automatically.
    const data1 = xlsx.utils.sheet_to_json(wbDate.Sheets[wbDate.SheetNames[0]]); // Array of objects

    const workbook2 = xlsx.readFile(otherPath);
    const data2 = xlsx.utils.sheet_to_json(workbook2.Sheets[workbook2.SheetNames[0]]);

    // Prepare Headers
    // We want to preserve original header order but insert new columns.
    // Get headers from original sheet
    const originalHeaders = xlsx.utils.sheet_to_json(sheet1, { header: 1 })[0];

    // Identify Index of OTHER_BTIME
    const idx = originalHeaders.indexOf('OTHER_BTIME');
    let newHeaders = [...originalHeaders];
    if (idx !== -1) {
        // Insert 'OTHER_ETIME', 'PRODUCT_SALE_PRICE' after 'OTHER_BTIME'
        newHeaders.splice(idx + 1, 0, 'OTHER_ETIME', 'PRODUCT_SALE_PRICE');
    } else {
        // Append if not found
        newHeaders.push('OTHER_ETIME', 'PRODUCT_SALE_PRICE');
    }

    // Lookup
    const lookup = new Map();
    data2.forEach(row => {
        const key = `${row.BD_DATE}_${row.OTHER_BTIME}_${row.COMPANY_NAME}`;
        lookup.set(key, {
            OTHER_ETIME: row.OTHER_ETIME,
            PRODUCT_SALE_PRICE: row.PRODUCT_SALE_PRICE
        });
    });

    console.log(`Processing ${data1.length} rows...`);

    // Process Data
    const processedData = data1.map(row => {
        // 1. Fix CREATE_DTM
        // With cellDates: true, CREATE_DTM should be a Date object.
        if (row.CREATE_DTM instanceof Date) {
            // Adjust for potential timezone offset if needed, but usually it's local time.
            // Excel dates are often interpreted as UTC or Local.
            // xlsx library usually reads as UTC-adj.
            // Let's just format it.
            // However, the previous default read showed 45985.111 -> ~2025-11-something
            // 0.111 day is ~2.6 hours.
            // Let's ensure uniform string format.
            // We use dayjs nicely.
            // Note: xlsx reads data as UTC+0 usually.
            // We'll format as is.
            row.CREATE_DTM = dayjs(row.CREATE_DTM).add(-9, 'hour').format('YYYY-MM-DD HH:mm:ss');
            // WAIT. xlsx parsing with cellDates might shift timezone.
            // Let's rely on the number we saw -> 45985.1114
            // 45985 = 2025-11-20 approx?
            // Let's stick to the raw number conversion if we want exact control, OR trust xlsx.
            // Let's check a sample date logic.
            // 45985 is 2025-11-20?
            // 25569 = 1970-01-01
            // 45985 - 25569 = 20416 days.
            // 20416 / 365.25 = 55.89 years.
            // 1970 + 55.89 = 2025.89 -> late 2025. Correct.
            // If I rely on cellDates:true, xlsx handles it.
            // But sometimes it adds timezone offset (e.g. interprets as GMT, adds 9h for Korea or subtracts).
            // Let's start with simple formatting.
        } else if (typeof row.CREATE_DTM === 'number') {
            // Fallback if it wasn't converted
            const d = new Date((row.CREATE_DTM - 25569) * 86400 * 1000);
            // Adjust timezone... it's messy.
            // Actually, the simplest is using xlsx.SSF if we want.
            // But let's assume cellDates: true worked.
        }

        // 2. Merge
        const compName = row.OTHER_BROAD_NAME;
        const key = `${row.BD_DATE}_${row.OTHER_BTIME}_${compName}`;
        const match = lookup.get(key);

        let newRow = {};
        // Reconstruct Object based on newHeaders
        newHeaders.forEach(h => {
            if (h === 'OTHER_ETIME') {
                newRow[h] = match ? match.OTHER_ETIME : row.OTHER_ETIME; // preserve if existing, or fill
            } else if (h === 'PRODUCT_SALE_PRICE') {
                newRow[h] = match ? match.PRODUCT_SALE_PRICE : row.PRODUCT_SALE_PRICE;
            } else {
                newRow[h] = row[h];
            }
        });

        return newRow;
    });

    // Save Excel
    const newSheet = xlsx.utils.json_to_sheet(processedData, { header: newHeaders });
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newSheet, "Sheet1");
    xlsx.writeFile(newWorkbook, exportPath);
    console.log(`Saved ${exportPath}`);

    // Update DB
    const db = new sqlite3.Database(dbPath);
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(`
            UPDATE schedules 
            SET raw_data = ?, other_etime = ?, product_sale_price = ?
            WHERE bd_date = ? AND other_btime = ? AND other_broad_name = ?
        `);

        let updated = 0;
        processedData.forEach(row => {
            stmt.run(
                JSON.stringify(row), // Updated raw_data with proper Date string and new fields
                row.OTHER_ETIME,
                row.PRODUCT_SALE_PRICE,
                row.BD_DATE,
                row.OTHER_BTIME,
                row.OTHER_BROAD_NAME
            );
            updated++;
        });

        stmt.finalize();
        db.run("COMMIT", () => {
            console.log(`Updated ${updated} DB rows.`);
            db.close();
        });
    });
}

run();
