import pandas as pd
import sqlite3
import os

# Configuration
EXCEL_FILE = 'data/260119_tb_ai_brand_broad_products.xlsx'
DB_FILE = 'brands.db'
TABLE_NAME = 'shinsegae_brands'

def create_db():
    print(f"Reading {EXCEL_FILE}...")
    try:
        df = pd.read_excel(EXCEL_FILE)
    except FileNotFoundError:
        print(f"Error: {EXCEL_FILE} not found.")
        return

    # Clean column names (strip whitespace just in case)
    df.columns = df.columns.str.strip()
    
    # Selected columns mapping
    # Excel Col -> DB Col
    # 'MD_NAME' -> 'md_name'
    # 'MGROUPN_NAME' -> 'mgroupn_name'
    # 'SGROUPN_NAME' -> 'sgroupn_name'
    # 'BRAND_NAME' -> 'brand_name'
    # 'BD_DATE' -> 'bd_date'
    # 'BD_BTIME' -> 'bd_btime'
    # 'BD_ETIME' -> 'bd_etime'
    # 'PROG_NAME' -> 'prog_name'
    
    required_cols = ['MD_NAME', 'MGROUPN_NAME', 'SGROUPN_NAME', 'BRAND_NAME', 'BD_DATE', 'BD_BTIME', 'BD_ETIME', 'PROG_NAME']
    
    # Verify columns exist
    for col in required_cols:
        if col not in df.columns:
            print(f"Warning: Column '{col}' not found in Excel. Available: {list(df.columns)}")
            # Proceeding might be dangerous if critical cols are missing, but let's assume they might be named slightly differently if verification fails?
            # Based on previous inspection: ['GATHER_DATE', 'IF_ROW_SEQ', 'BD_DATE', 'BD_BTIME', 'BD_ETIME', 'ORDER_TYPE', 'PROG_CODE', 'PROG_NAME', 'GOODS_CODE', 'GOODS_NAME', 'BRAND_NAME', 'ITEM_CODE', 'ITEM_NAME', 'MD_NAME', 'LGROUPN_NAME', 'MGROUPN_NAME', 'SGROUPN_NAME', 'DGROUPN_NAME', 'TGROUPN_NAME', 'INSERT_DATE', 'INSERT_ID', 'CREATE_DTM']
            # All required cols seem present.
    
    # Connect/Create DB
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Drop table if exists
    cursor.execute(f"DROP TABLE IF EXISTS {TABLE_NAME}")
    
    # Create Table
    create_sql = f"""
    CREATE TABLE {TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        md_name TEXT,
        mgroupn_name TEXT,
        sgroupn_name TEXT,
        brand_name TEXT,
        bd_date TEXT,
        bd_btime TEXT,
        bd_etime TEXT,
        prog_name TEXT,
        goods_name TEXT
    )
    """
    cursor.execute(create_sql)
    
    # Prepare data for insertion
    data_to_insert = []
    for _, row in df.iterrows():
        data_to_insert.append((
            str(row.get('MD_NAME', '')),
            str(row.get('MGROUPN_NAME', '')),
            str(row.get('SGROUPN_NAME', '')),
            str(row.get('BRAND_NAME', '')),
            str(row.get('BD_DATE', '')),
            str(row.get('BD_BTIME', '')),
            str(row.get('BD_ETIME', '')),
            str(row.get('PROG_NAME', '')),
            str(row.get('GOODS_NAME', ''))
        ))
        
    # Batch Insert
    cursor.executemany(f"""
    INSERT INTO {TABLE_NAME} (md_name, mgroupn_name, sgroupn_name, brand_name, bd_date, bd_btime, bd_etime, prog_name, goods_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, data_to_insert)
    
    # Create Indices for fast lookup
    print("Creating indices...")
    cursor.execute(f"CREATE INDEX idx_brand_lookup ON {TABLE_NAME} (md_name, mgroupn_name, sgroupn_name, brand_name)")
    cursor.execute(f"CREATE INDEX idx_brand_name ON {TABLE_NAME} (brand_name)")

    conn.commit()
    print(f"Successfully inserted {len(data_to_insert)} rows into {DB_FILE}.")
    conn.close()

if __name__ == "__main__":
    create_db()
