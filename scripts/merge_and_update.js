const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../schedule.db');
const datasetPath = path.join(__dirname, '../data/dataset.xlsx');
const otherPath = path.join(__dirname, '../data/OTHER_ETIME and PRODUCT_SALE_PRICE.xlsx');
const exportPath = path.join(__dirname, '../data/updated_dataset.xlsx');

async function run() {
    console.log('Reading files...');
    const workbook1 = xlsx.readFile(datasetPath);
    const data1 = xlsx.utils.sheet_to_json(workbook1.Sheets[workbook1.SheetNames[0]]);

    const workbook2 = xlsx.readFile(otherPath);
    const data2 = xlsx.utils.sheet_to_json(workbook2.Sheets[workbook2.SheetNames[0]]);

    // Create lookup map
    // Key: BD_DATE + '_' + OTHER_BTIME + '_' + COMPANY_NAME
    // normalize keys just in case
    const lookup = new Map();
    data2.forEach(row => {
        const key = `${row.BD_DATE}_${row.OTHER_BTIME}_${row.COMPANY_NAME}`;
        lookup.set(key, {
            OTHER_ETIME: row.OTHER_ETIME,
            PRODUCT_SALE_PRICE: row.PRODUCT_SALE_PRICE
        });
    });

    console.log(`Loaded ${data2.length} rows for lookup.`);

    // Merge
    let mergedCount = 0;
    const updatedData = data1.map(row => {
        // dataset uses OTHER_BROAD_NAME for company name
        const key = `${row.BD_DATE}_${row.OTHER_BTIME}_${row.OTHER_BROAD_NAME}`;
        const match = lookup.get(key);
        if (match) {
            mergedCount++;
            return {
                ...row,
                OTHER_ETIME: match.OTHER_ETIME,
                PRODUCT_SALE_PRICE: match.PRODUCT_SALE_PRICE
            };
        }
        return row;
    });

    console.log(`Merged ${mergedCount} rows out of ${data1.length}.`);

    if (mergedCount === 0) {
        console.warn("WARNING: 0 rows merged. Keys might mismatch. Checking sample keys...");
        if (data1.length > 0 && data2.length > 0) {
            const row1 = data1[0];
            const row2 = data2[0];
            console.log("Dataset Key Sample:", `${row1.BD_DATE}_${row1.OTHER_BTIME}_${row1.OTHER_BROAD_NAME}`);
            console.log("Other Key Sample:  ", `${row2.BD_DATE}_${row2.OTHER_BTIME}_${row2.COMPANY_NAME}`);
        }
    }

    // Save to Excel
    const newSheet = xlsx.utils.json_to_sheet(updatedData);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newSheet, "Sheet1");
    xlsx.writeFile(newWorkbook, exportPath);
    console.log(`Saved updated excel to ${exportPath}`);

    // Update DB
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        // Add columns if not exist
        // SQLite doesn't support IF NOT EXISTS for ADD COLUMN easily in old versions, but usually safe to try catch or check pragma
        // We'll just try to add, if error (duplicate column), we ignore.

        const addColumn = (col, type) => {
            return new Promise((resolve, reject) => {
                db.run(`ALTER TABLE schedules ADD COLUMN ${col} ${type}`, (err) => {
                    if (err && err.message.includes('duplicate column')) {
                        console.log(`Column ${col} already exists.`);
                        resolve();
                    } else if (err) {
                        reject(err);
                    } else {
                        console.log(`Added column ${col}.`);
                        resolve();
                    }
                });
            });
        };

        const updateDB = async () => {
            try {
                await addColumn('other_etime', 'TEXT');
                await addColumn('product_sale_price', 'INTEGER');

                db.run("BEGIN TRANSACTION");

                const stmt = db.prepare(`
                    UPDATE schedules 
                    SET other_etime = ?, product_sale_price = ?, raw_data = ?
                    WHERE bd_date = ? AND other_btime = ? AND other_broad_name = ?
                `);

                let updateCount = 0;
                updatedData.forEach(row => {
                    if (row.OTHER_ETIME !== undefined || row.PRODUCT_SALE_PRICE !== undefined) {
                        // raw_data field also needs update with new fields for consistency
                        const newRawData = JSON.stringify(row);

                        stmt.run(
                            row.OTHER_ETIME,
                            row.PRODUCT_SALE_PRICE,
                            newRawData,
                            row.BD_DATE,
                            row.OTHER_BTIME,
                            row.OTHER_BROAD_NAME
                        );
                        updateCount++;
                    }
                });

                stmt.finalize();
                db.run("COMMIT", () => {
                    console.log(`Updated ${updateCount} rows in database.`);
                    db.close();
                });

            } catch (err) {
                console.error("DB Error:", err);
                db.run("ROLLBACK");
                db.close();
            }
        };

        updateDB();
    });
}

run();
