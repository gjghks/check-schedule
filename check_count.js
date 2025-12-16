const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

(async () => {
    const db = await open({ filename: 'schedule.db', driver: sqlite3.Database });
    const row = await db.get('SELECT COUNT(*) as c FROM schedules');
    console.log('Total rows:', row.c);
    
    // Check distribution
    const dist = await db.all('SELECT IFNULL(other_broad_name, "Shinsegae") as nm, COUNT(*) as c FROM schedules GROUP BY other_broad_name');
    console.log(dist);
})();
