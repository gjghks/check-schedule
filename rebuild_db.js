const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const xlsx = require('xlsx');
const path = require('path');

(async () => {
    try {
        const dbPath = path.join(__dirname, 'schedule.db');
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // 1. Read updated_dataset.xlsx Schema & Data
        console.log('Reading updated_dataset.xlsx...');
        const wb = xlsx.readFile('updated_dataset.xlsx');
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(ws); // Array of objects
        
        if (data.length === 0) {
            console.error('updated_dataset.xlsx is empty!');
            return;
        }

        // Get headers from the first row keys (or from sheet_to_json with header:1 if we want strict order)
        // Using object keys is fine if consistent.
        // But some rows might miss keys. Better use keys from clean run.
        // Let's rely on the Keys provided in user prompt or just union of all keys?
        // Step 712 logs showed the headers. I will use those to define schema.
        const headers = [
            'ID', 'EXEC_DATE', 'BD_DATE', 'BD_BTIME', 'BD_ETIME', 'G_PROG_CODE', 'OTHER_BROAD_NAME', 
            'OTHER_BTIME', 'OTHER_ETIME', 'PRODUCT_SALE_PRICE', 'WEIGHTS_TIME', 'OTHER_PRODUCT_NAME', 
            'BD_BHOUR', 'G_PROG_NAME', 'MD_MAN_NAME', 'MD_CODE', 'MD_NAME', 'BRAND_CODE', 'BRAND_NAME', 
            'LGROUPN', 'LGROUPN_NAME', 'MGROUPN', 'MGROUPN_NAME', 'SGROUPN', 'SGROUPN_NAME', 
            'OTHER_BRAND_NAME', 'OTHER_MD_NAME_1', 'OTHER_MD_NAME_2', 'OTHER_MD_NAME_3', 
            'OTHER_LGROUPN_NAME', 'OTHER_MGROUPN_NAME', 'OTHER_SGROUPN_NAME', 'OTHER_ITEM_DESC', 
            'OTHER_ITEM_TAG', 'MATCH_SCORE', 'ITEM_SML_SCORE', 'SCHE_SML_SCORE', 'COMP_ALERT', 
            'SML_RSN', 'CREATE_DTM', 'CREATE_NAME'
        ];

        // 2. Re-create Table
        console.log('Re-creating table...');
        await db.run('DROP TABLE IF EXISTS schedules');
        
        // Construct CREATE TABLE
        // All columns TEXT except maybe ID, numbers.
        // I will default to TEXT/NUMERIC based on simplistic guess or just schema-less flexibility of SQLite.
        // But explicit is better.
        // ID -> INTEGER PRIMARY KEY AUTOINCREMENT
        // MATCH_SCORE, ... -> REAL/INTEGER
        // Let's map everything to TEXT except known numbers for safety, or just let SQLite handle affinity.
        
        let schemaParts = [];
        headers.forEach(h => {
            const colName = h.toLowerCase(); // Use lowercase for DB columns
            if (colName === 'id') {
                schemaParts.push('id INTEGER PRIMARY KEY AUTOINCREMENT');
            } else {
                schemaParts.push(`${colName} TEXT`); // Default to TEXT
            }
        });
        
        // Fix types for specific columns if needed for sorting/math
        // bd_date -> TEXT
        // match_score -> REAL
        // weights_time -> REAL
        // product_sale_price -> REAL
        
        // I'll manually adjust the schema string construction for known numeric types
        const numericCols = new Set(['match_score', 'item_sml_score', 'sche_sml_score', 'product_sale_price', 'weights_time']);
        
        schemaParts = headers.map(h => {
            const colName = h.toLowerCase();
            if (colName === 'id') return 'id INTEGER PRIMARY KEY AUTOINCREMENT';
            if (numericCols.has(colName)) return `${colName} REAL`;
            return `${colName} TEXT`;
        });

        // Add 'raw_data' just in case code depends on it, but user didn't list it.
        // User said: "updated_dataset.xlsx를 기준으로... 동일하게"
        // If updated_dataset doesn't have raw_data, I shouldn't add it?
        // But previous code uses row.raw_data. I might need to patch code if I remove it.
        // Wait, 'raw_data' was NOT in the headers list in Step 712.
        // So I should NOT include 'raw_data' if I strictly follow instructions.
        // I will Check later if I need to fix TS code.
        
        const createSql = `CREATE TABLE schedules (${schemaParts.join(', ')})`;
        await db.run(createSql);

        // 3. Insert updated_dataset.xlsx Data
        console.log('Inserting base data...');
        await db.run('BEGIN TRANSACTION');
        
        // Prepare statement
        const placeholders = headers.map(h => h.toLowerCase() === 'id' ? 'NULL' : '?').join(',');
        // Note: We skip inserting ID if we want autoincrement to regenerate, OR we explicitly insert it.
        // If we duplicate IDs, it fails.
        // If we want to keep IDs from Excel:
        const insertSql = `INSERT INTO schedules (${headers.map(h => h.toLowerCase()).join(',')}) VALUES (${headers.map(() => '?').join(',')})`;
        const insertStmt = await db.prepare(insertSql);

        for (const row of data) {
            const values = headers.map(h => {
                const val = row[h];
                return val === undefined ? null : val;
            });
            await insertStmt.run(values);
        }
        
        // 4. Insert SK_KT.xlsx Data
        console.log('Reading SK_KT.xlsx...');
        const wb2 = xlsx.readFile(path.join('data', 'SK_KT.xlsx'));
        const ws2 = wb2.Sheets[wb2.SheetNames[0]];
        const dataSK = xlsx.utils.sheet_to_json(ws2);
        
        console.log(`Inserting ${dataSK.length} SK/KT rows...`);
        
        // Map SK_KT cols to DB cols (lowercase)
        // 'BD_DATE': 'bd_date'
        // 'OTHER_BTIME': 'other_btime'
        // 'OTHER_ETIME': 'other_etime'
        // 'OTHER_HH': 'bd_bhour' 
        // 'COMPANY_NAME': 'other_broad_name'
        // 'COMPANY_BRAND_NAME': 'other_brand_name'
        // 'PRODUCT_NAME': 'other_product_name'
        // 'PRODUCT_SALE_PRICE': 'product_sale_price'
        // 'WEIGHTS_TIME': 'weights_time'
        
        // We use the SAME insertStmt? No, different columns mapping.
        // We construct values array matching the 'headers' order.
        
        for (const row of dataSK) {
            // Filter if needed? "Add KT Alpha, SK Stoa data".
            const company = row['COMPANY_NAME'];
            if (company !== 'KT알파' && company !== 'SK스토아') continue; // Safety check

            const values = headers.map(h => {
                const col = h.toLowerCase();
                
                // ID -> null (let autoincrement handle it? But we're explicitly inserting. Schema is AUTOINCREMENT.)
                // If we pass NULL to INTEGER PRIMARY KEY, it autoincrements.
                if (col === 'id') return null;
                
                // Mappings
                if (col === 'bd_date') return row['BD_DATE'];
                if (col === 'other_btime') return row['OTHER_BTIME'];
                if (col === 'other_etime') return row['OTHER_ETIME'];
                if (col === 'bd_bhour') return row['OTHER_HH'];
                if (col === 'other_broad_name') return row['COMPANY_NAME'];
                if (col === 'other_brand_name') return row['COMPANY_BRAND_NAME'];
                if (col === 'other_product_name') return row['PRODUCT_NAME'];
                if (col === 'product_sale_price') return row['PRODUCT_SALE_PRICE'];
                if (col === 'weights_time') return row['WEIGHTS_TIME'];
                
                // Default 0 or null
                // User said "0 or null so no errors".
                // For numeric columns, maybe 0?
                if (col === 'match_score' || col === 'item_sml_score' || col === 'sche_sml_score') return 0;
                
                return null;
            });
            await insertStmt.run(values);
        }

        await insertStmt.finalize();
        await db.run('COMMIT');
        
        // 5. Export Updated DB
        console.log('Exporting final updated_dataset.xlsx...');
        // Sort by BD_DATE, and time
        // Since we have bd_btime (Shinsegae) and other_btime (Competitor), we need Coalesce logic again for sorting?
        // "updated_dataset.xlsx를 기준으로... 동일하게"
        // I will export effectively .
        
        const finalRows = await db.all(`SELECT * FROM schedules ORDER BY bd_date ASC, COALESCE(bd_btime, other_btime) ASC`);
        
        // Convert headers back to UpperCase for Excel?
        // User said  has Uppercase headers in Step 712.
        // So I should map keys back to uppercase?
        //  result ->  might keep lowercase if keys are lowercase.
        // I should map keys to Uppercase.
        
        const upperData = finalRows.map(r => {
            const newObj = {};
            for (const k in r) {
                newObj[k.toUpperCase()] = r[k];
            }
            return newObj;
        });

        const newWs = xlsx.utils.json_to_sheet(upperData);
        // Ensure header order? 
        const newWb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWb, newWs, 'Schedules');
        xlsx.writeFile(newWb, 'updated_dataset.xlsx');

        console.log('Done.');
        await db.close();

    } catch (e) {
        console.error(e);
    }
})();
