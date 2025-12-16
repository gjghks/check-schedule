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

        console.log('Exporting current DB state to updated_dataset.xlsx...');
        // Standard sort or just dump? 
        // Using a reasonable sort for readability, but respecting the "revert" might imply avoiding the complex COALESCE if that was the issue. 
        // But for Excel, having it sorted is usually good. 
        // I will sort by bd_date, and then by id to keep insertion order if times are mixed, or just bd_btime.
        // Let's stick to a safe sort: bd_date.
        const allRows = await db.all(`SELECT * FROM schedules ORDER BY bd_date ASC`);
        
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
