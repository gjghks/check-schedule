const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../schedule.db'));

db.all("SELECT bd_date, other_btime, other_broad_name FROM schedules WHERE bd_date='2025/11/14' AND other_btime LIKE '01:%'", (err, rows) => {
    console.log("Rows on 2025/11/14 around 01:00:", rows);
});

db.close();
