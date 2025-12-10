const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../schedule.db');
const dataPath = path.join(__dirname, '../data/dataset.xlsx');

const db = new sqlite3.Database(dbPath);

console.log('Reading Excel file from:', dataPath);

try {
    const workbook = xlsx.readFile(dataPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} records.`);
    if (data.length > 0) {
        console.log('Sample keys:', Object.keys(data[0]));
    }

    db.serialize(() => {
        db.run("DROP TABLE IF EXISTS schedules");

        // Using schema.csv concepts.
        // We store raw_data for flexibility, but indexed columns for querying.
        const createTableQuery = `
      CREATE TABLE schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exec_date TEXT,
        bd_date TEXT,
        bd_btime TEXT,
        bd_etime TEXT,
        other_broad_name TEXT,
        other_btime TEXT,
        other_product_name TEXT,
        other_item_desc TEXT,
        match_score INTEGER,
        sche_sml_score REAL,
        item_sml_score REAL,
        comp_alert TEXT,
        raw_data TEXT
      )
    `;
        db.run(createTableQuery);

        const stmt = db.prepare(`
      INSERT INTO schedules (
        exec_date, bd_date, bd_btime, bd_etime, 
        other_broad_name, other_btime, other_product_name, other_item_desc,
        match_score, sche_sml_score, item_sml_score, comp_alert, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        db.run("BEGIN TRANSACTION");
        data.forEach(row => {
            stmt.run(
                row.EXEC_DATE,
                row.BD_DATE,
                row.BD_BTIME,
                row.BD_ETIME,
                row.OTHER_BROAD_NAME,
                row.OTHER_BTIME,
                row.OTHER_PRODUCT_NAME,
                row.OTHER_ITEM_DESC,
                row.MATCH_SCORE,
                row.SCHE_SML_SCORE,
                row.ITEM_SML_SCORE,
                row.COMP_ALERT,
                JSON.stringify(row)
            );
        });
        db.run("COMMIT");

        stmt.finalize();
    });

    db.close(() => {
        console.log('Database initialized.');
    });

} catch (e) {
    console.error("Error processing Excel:", e);
}
