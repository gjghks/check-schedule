const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

(async () => {
    const db = await open({
        filename: 'schedule.db',
        driver: sqlite3.Database
    });

    const cols = await db.all('PRAGMA table_info(schedules)');
    cols.forEach(c => console.log(c.name, c.type, 'NotNull:', c.notnull));
})();
