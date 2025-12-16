const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const xlsx = require('xlsx');
const path = require('path');

(async () => {
    try {
        const db = await open({
             filename: path.join(__dirname, 'schedule.db'),
             driver: sqlite3.Database
        });

        console.log('Exporting updated_dataset.xlsx sorted by date and time...');
        // Match the logic used in the app
        const allRows = await db.all(`
            SELECT * FROM schedules 
            ORDER BY bd_date ASC, COALESCE(bd_btime, other_btime) ASC
        `);
        
        const newWs = xlsx.utils.json_to_sheet(allRows);
        const newWb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWb, newWs, 'Schedules');
        xlsx.writeFile(newWb, path.join(__dirname, 'updated_dataset.xlsx'));
        console.log(`Export done. ${allRows.length} rows written.`);

        await db.close();
    } catch (e) {
        console.error(e);
    }
})();
