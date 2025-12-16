const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../schedule.db'));

db.serialize(() => {
    db.get("SELECT count(*) as count, max(weights_time) as maxVal, min(weights_time) as minVal FROM schedules", (err, row) => {
        if (err) console.error(err);
        else console.log(row);
    });

    // Check specific match
    // Example from WEIGHTS_TIME.xlsx: 2025/11/14 | 01:00:00 | 현대홈쇼핑 | 22
    db.get("SELECT weights_time FROM schedules WHERE bd_date='2025/11/14' AND other_btime='01:00:00' AND other_broad_name='현대홈쇼핑'", (err, row) => {
        console.log("Check Match for Hyundai 2025/11/14 01:00:00:", row);
    });
});

db.close();
