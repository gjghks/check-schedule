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
    exec_date?: string;
    bd_date: string;
    bd_btime?: string;
    bd_etime?: string;
    bd_bhour?: string;

    g_prog_code?: string;
    g_prog_name?: string;
    md_man_name?: string;
    md_code?: string;
    md_name?: string;
    brand_code?: string;
    brand_name?: string;
    lgroupn?: string;
    lgroupn_name?: string;
    mgroupn?: string;
    mgroupn_name?: string;
    sgroupn?: string;
    sgroupn_name?: string;

    other_broad_name?: string;
    other_btime?: string;
    other_etime?: string;
    other_product_name?: string;
    product_sale_price?: number;
    weights_time?: number;
    other_brand_name?: string;
    other_md_name_1?: string;
    other_md_name_2?: string;
    other_md_name_3?: string;
    other_lgroupn_name?: string;
    other_mgroupn_name?: string;
    other_sgroupn_name?: string;
    other_item_desc?: string;
    other_item_tag?: string;

    match_score?: number;
    sche_sml_score?: number;
    item_sml_score?: number;
    comp_alert?: string;
    sml_rsn?: string;
    create_dtm?: string;
    create_name?: string;
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
