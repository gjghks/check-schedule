const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const path = require('path');
const dayjs = require('dayjs');

const dbPath = path.join(__dirname, '../schedule.db');
const datasetPath = path.join(__dirname, '../data/dataset.xlsx');
const otherPath = path.join(__dirname, '../data/OTHER_ETIME and PRODUCT_SALE_PRICE.xlsx');
const weightsPath = path.join(__dirname, '../data/WEIGHTS_TIME.xlsx');
const exportPath = path.join(__dirname, '../data/updated_dataset.xlsx');

async function run() {
    console.log('Reading files...');

    // 1. Read Base Dataset (with cellDates for DTM)
    const wbDate = xlsx.readFile(datasetPath, { cellDates: true });
    const data1 = xlsx.utils.sheet_to_json(wbDate.Sheets[wbDate.SheetNames[0]]);

    // Read headers to preserve order
    const wbHeader = xlsx.readFile(datasetPath);
    const originalHeaders = xlsx.utils.sheet_to_json(wbHeader.Sheets[wbHeader.SheetNames[0]], { header: 1 })[0];

    // 2. Read Other Data
    const wbOther = xlsx.readFile(otherPath);
    const dataOther = xlsx.utils.sheet_to_json(wbOther.Sheets[wbOther.SheetNames[0]]);

    // 3. Read Weights Data
    const wbWeights = xlsx.readFile(weightsPath);
    const dataWeights = xlsx.utils.sheet_to_json(wbWeights.Sheets[wbWeights.SheetNames[0]]);

    // Build Lookups
    const lookupOther = new Map();
    dataOther.forEach(row => {
        const key = `${row.BD_DATE}_${row.OTHER_BTIME}_${row.COMPANY_NAME}`;
        lookupOther.set(key, row);
    });

    const lookupWeights = new Map();
    dataWeights.forEach(row => {
        const key = `${row.BD_DATE}_${row.OTHER_BTIME}_${row.COMPANY_NAME}`;
        lookupWeights.set(key, row);
    });

    // Determine New Headers
    // Insert: OTHER_ETIME, PRODUCT_SALE_PRICE, WEIGHTS_TIME after OTHER_BTIME
    const idx = originalHeaders.indexOf('OTHER_BTIME');
    let newHeaders = [...originalHeaders];
    const newCols = ['OTHER_ETIME', 'PRODUCT_SALE_PRICE', 'WEIGHTS_TIME'];

    // Remove if they already exist (just in case)
    newHeaders = newHeaders.filter(h => !newCols.includes(h));

    if (idx !== -1) {
        newHeaders.splice(idx + 1, 0, ...newCols);
    } else {
        newHeaders.push(...newCols);
    }

    console.log(`Processing ${data1.length} rows...`);

    const processedData = data1.map(row => {
        // Fix CREATE_DTM
        if (row.CREATE_DTM instanceof Date) {
            row.CREATE_DTM = dayjs(row.CREATE_DTM).add(-9, 'hour').format('YYYY-MM-DD HH:mm:ss');
        } else if (typeof row.CREATE_DTM === 'number') {
            // approximate conversion if needed, but usually cellDates handles it
            const date_info = new Date((row.CREATE_DTM - 25569) * 86400 * 1000);
            row.CREATE_DTM = dayjs(date_info).format('YYYY-MM-DD HH:mm:ss');
        }

        // Keys
        const compName = row.OTHER_BROAD_NAME;
        const key = `${row.BD_DATE}_${row.OTHER_BTIME}_${compName}`;

        const matchOther = lookupOther.get(key);
        const matchWeights = lookupWeights.get(key);

        let newRow = {};
        newHeaders.forEach(h => {
            if (h === 'OTHER_ETIME') {
                newRow[h] = matchOther ? matchOther.OTHER_ETIME : row.OTHER_ETIME;
            } else if (h === 'PRODUCT_SALE_PRICE') {
                newRow[h] = matchOther ? matchOther.PRODUCT_SALE_PRICE : row.PRODUCT_SALE_PRICE;
            } else if (h === 'WEIGHTS_TIME') {
                newRow[h] = matchWeights ? matchWeights.WEIGHTS_TIME : (row.WEIGHTS_TIME || 0); // Default to 0? Or undefined.
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

    // Promisify helper
    const runQuery = (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(query, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    };

    db.serialize(async () => {
        try {
            // Add column if not exists
            try {
                await runQuery(`ALTER TABLE schedules ADD COLUMN weights_time REAL`);
                console.log("Added column weights_time");
            } catch (e) {
                if (!e.message.includes('duplicate column')) {
                    console.error("Error adding column:", e);
                }
            }

            // Also ensure other columns exist key steps might be skipped if run fresh
            try { await runQuery(`ALTER TABLE schedules ADD COLUMN other_etime TEXT`); } catch (e) { }
            try { await runQuery(`ALTER TABLE schedules ADD COLUMN product_sale_price INTEGER`); } catch (e) { }

            await runQuery("BEGIN TRANSACTION");

            const stmt = db.prepare(`
                UPDATE schedules 
                SET raw_data = ?, other_etime = ?, product_sale_price = ?, weights_time = ?
                WHERE bd_date = ? AND other_btime = ? AND other_broad_name = ?
            `);

            let count = 0;
            processedData.forEach(row => {
                stmt.run(
                    JSON.stringify(row),
                    row.OTHER_ETIME,
                    row.PRODUCT_SALE_PRICE,
                    row.WEIGHTS_TIME,
                    row.BD_DATE,
                    row.OTHER_BTIME,
                    row.OTHER_BROAD_NAME
                );
                count++;
            });

            stmt.finalize();
            await runQuery("COMMIT");
            console.log(`Updated ${count} DB rows.`);

        } catch (err) {
            console.error(err);
            db.run("ROLLBACK");
        } finally {
            db.close();
        }
    });
}

run();
