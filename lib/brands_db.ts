import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getBrandsDb() {
    if (!db) {
        db = await open({
            filename: path.join(process.cwd(), 'brands.db'),
            driver: sqlite3.Database,
        });
    }
    return db;
}

export interface BrandBroadcastRow {
    id: number;
    md_name: string;
    mgroupn_name: string;
    sgroupn_name: string;
    brand_name: string;
    bd_date: string;
    bd_btime: string;
    bd_etime: string;
    prog_name: string;
    goods_name: string;
}

export async function searchBrand(
    md: string,
    mid: string,
    small: string,
    brand: string
): Promise<BrandBroadcastRow[]> {
    const db = await getBrandsDb();
    // Use brand_name and md_name for matching
    // Relaxing Mid/Small category checks as they often differ between properities
    const query = `
        SELECT * FROM shinsegae_brands 
        WHERE md_name = ? 
        AND brand_name = ?
        ORDER BY bd_date DESC, bd_btime DESC
    `;
    return db.all<BrandBroadcastRow[]>(query, [md, brand]);
}

