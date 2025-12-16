const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const xlsx = require('xlsx');
const path = require('path');

// Mappings based on user request
// DB Column : Excel Column
// BD_DATE : BD_DATE
// OTHER_BTIME : OTHER_BTIME
// OTHER_ETIME : OTHER_ETIME
// raw_data.OTHER_HH : OTHER_HH (Since DB has no BD_BHOUR)
// other_broad_name : COMPANY_NAME
// raw_data.OTHER_BRAND_NAME : COMPANY_BRAND_NAME
// other_product_name : PRODUCT_NAME
// product_sale_price : PRODUCT_SALE_PRICE
// weights_time : WEIGHTS_TIME

(async () => {
    try {
        // 1. Load Excel
        const excelPath = path.join(__dirname, 'data', 'SK_KT.xlsx');
        console.log(`Loading Excel from ${excelPath}...`);
        const workbook = xlsx.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log(`Loaded ${rows.length} rows.`);

        // 2. Connect DB
        const dbPath = path.join(__dirname, 'schedule.db');
        const db = await open({
             filename: dbPath,
             driver: sqlite3.Database
        });
        console.log('Connected to DB.');

        // 3. Insert Data
        console.log('Starting insertion...');
        await db.run('BEGIN TRANSACTION');

        let insertedCount = 0;
        const insertStmt = await db.prepare(`
            INSERT INTO schedules (
                bd_date, other_broad_name, other_btime, other_etime, other_product_name, product_sale_price, weights_time, raw_data,
                exec_date, bd_btime, bd_etime, match_score, sche_sml_score, item_sml_score, comp_alert
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of rows) {
            // Filter target companies just in case
            const company = row['COMPANY_NAME'];
            if (company !== 'KT알파' && company !== 'SK스토아') {
                continue; // Or should we include all? Request said "UPDATE based on KT, SK data". Assuming Excel only has them or we filter.
                // Request said: "Add data for 'KT Alpha', 'SK Stoa' only from COMPANY_NAME column"
            }

            const rawDataObj = {
                OTHER_BRAND_NAME: row['COMPANY_BRAND_NAME'],
                OTHER_HH: row['OTHER_HH'] || row['BD_BHOUR'], // Handle possible header name
                // Add useful fields for debugging/display
                OTHER_PRODUCT_NAME: row['PRODUCT_NAME'],
                COMPANY_NAME: company,
                PRODUCT_SALE_PRICE: row['PRODUCT_SALE_PRICE'],
                WEIGHTS_TIME: row['WEIGHTS_TIME']
            };

            const bdDate = row['BD_DATE']; // Format check needed? Assumed YYYY/MM/DD or compatible
            const otherBtime = row['OTHER_BTIME'];
            const otherEtime = row['OTHER_ETIME'];
            const otherProductName = row['PRODUCT_NAME'];
            const price = row['PRODUCT_SALE_PRICE'];
            const weights = row['WEIGHTS_TIME'];

            await insertStmt.run(
                bdDate,
                company,
                otherBtime,
                otherEtime,
                otherProductName,
                price,
                weights,
                JSON.stringify(rawDataObj),
                // Nulls/Defaults for Shinsegae fields
                null, // exec_date
                null, // bd_btime (Important: must be NULL)
                null, // bd_etime
                0, // match_score
                0, // sche_sml_score
                0, // item_sml_score
                '' // comp_alert
            );
            insertedCount++;
        }

        await insertStmt.finalize();
        await db.run('COMMIT');
        console.log(`Inserted ${insertedCount} rows.`);

        // 4. Export Updated DB to Excel
        console.log('Exporting updated DB to schedule_updated.xlsx...');
        const allRows = await db.all('SELECT * FROM schedules');
        const newWs = xlsx.utils.json_to_sheet(allRows);
        const newWb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWb, newWs, 'Schedules');
        xlsx.writeFile(newWb, path.join(__dirname, 'schedule_updated.xlsx'));
        console.log('Export done.');

        await db.close();

    } catch (e) {
        console.error('Error:', e);
    }
})();
