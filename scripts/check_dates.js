const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../schedule.db'));

db.all("SELECT DISTINCT bd_date FROM schedules LIMIT 5", (err, rows) => {
    console.log("Distinct Dates:", rows);
});

db.close();
