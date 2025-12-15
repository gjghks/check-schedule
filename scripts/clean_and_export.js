const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../schedule.db');
const EXPORT_PATH = path.join(__dirname, '../data/updated_dataset.xlsx');

const db = new sqlite3.Database(DB_PATH);

function cleanDuplicates() {
    return new Promise((resolve, reject) => {
        console.log('Starting duplicate cleanup...');

        // Count before
        db.get("SELECT COUNT(*) as c FROM schedules", (err, row) => {
            if (err) return reject(err);
            const countBefore = row.c;
            console.log(`Rows before cleanup: ${countBefore}`);

            // Delete duplicates
            // Assuming uniqueness based on date, time, channel, and product names
            const deleteQuery = `
                DELETE FROM schedules 
                WHERE id NOT IN (
                    SELECT MIN(id) 
                    FROM schedules 
                    GROUP BY bd_date, bd_btime, other_broad_name, g_prog_name, other_product_name, product_sale_price
                )
            `;

            db.run(deleteQuery, function (err) {
                if (err) return reject(err);
                const deleted = this.changes;
                console.log(`Deleted ${deleted} duplicate rows.`);

                // Count after
                db.get("SELECT COUNT(*) as c FROM schedules", (err, row) => {
                    if (err) return reject(err);
                    const countAfter = row.c;
                    console.log(`Rows after cleanup: ${countAfter}`);
                    resolve();
                });
            });
        });
    });
}

function exportToExcel() {
    return new Promise((resolve, reject) => {
        console.log('Starting export to Excel...');

        db.all("SELECT * FROM schedules ORDER BY bd_date, bd_btime", (err, rows) => {
            if (err) return reject(err);

            if (rows.length === 0) {
                console.warn("No data to export.");
                resolve();
                return;
            }

            const wb = xlsx.utils.book_new();
            const ws = xlsx.utils.json_to_sheet(rows);
            xlsx.utils.book_append_sheet(wb, ws, "Schedules");

            // Ensure directory exists
            const dir = path.dirname(EXPORT_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            xlsx.writeFile(wb, EXPORT_PATH);
            console.log(`Exported updated database to: ${EXPORT_PATH}`);
            resolve();
        });
    });
}

// Run
db.serialize(async () => {
    try {
        await cleanDuplicates();
        await exportToExcel();
        console.log('All done.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        db.close();
    }
});
