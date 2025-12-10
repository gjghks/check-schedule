import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getDb() {
    if (!db) {
        db = await open({
            filename: path.join(process.cwd(), 'schedule.db'),
            driver: sqlite3.Database,
        });
    }
    return db;
}

export interface ScheduleRow {
    id: number;
    exec_date: string;
    bd_date: string;
    bd_btime: string;
    bd_etime: string;
    other_broad_name: string;
    other_btime: string;
    other_product_name: string;
    other_item_desc: string;
    match_score: number;
    sche_sml_score: number;
    item_sml_score: number;
    comp_alert: string;
    raw_data: string;
    other_etime?: string;
    product_sale_price?: number;
    weights_time?: number;
}

export async function getSchedulesByDate(dateStr: string): Promise<ScheduleRow[]> {
    const db = await getDb();
    return db.all<ScheduleRow[]>('SELECT * FROM schedules WHERE bd_date = ? ORDER BY bd_btime ASC', [dateStr]);
}

export async function getSchedulesRange(startDate: string, endDate: string): Promise<ScheduleRow[]> {
    const db = await getDb();
    // String comparison works for YYYY/MM/DD
    return db.all<ScheduleRow[]>('SELECT * FROM schedules WHERE bd_date >= ? AND bd_date <= ? ORDER BY bd_date ASC, bd_btime ASC', [startDate, endDate]);
}

export async function getAvailableDates(): Promise<string[]> {
    const db = await getDb();
    const rows = await db.all<{ bd_date: string }[]>('SELECT DISTINCT bd_date FROM schedules ORDER BY bd_date ASC');
    return rows.map(r => r.bd_date);
}
