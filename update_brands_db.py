import pandas as pd
import sqlite3
import os
import sys
import shutil
from datetime import datetime

# Configuration
DB_FILE = 'brands.db'
TABLE_NAME = 'shinsegae_brands'

def update_db(excel_file):
    if not os.path.exists(excel_file):
        print(f"Error: {excel_file} not found.")
        return

    # Backup existing DB
    if os.path.exists(DB_FILE):
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        backup_file = f"{DB_FILE}.bak_{timestamp}"
        print(f"Backing up {DB_FILE} to {backup_file}...")
        shutil.copy(DB_FILE, backup_file)

    print(f"Reading {excel_file}...")
    try:
        df = pd.read_excel(excel_file)
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return

    # Clean column names
    df.columns = df.columns.str.strip()
    
    required_cols = ['MD_NAME', 'MGROUPN_NAME', 'SGROUPN_NAME', 'BRAND_NAME', 'BD_DATE', 'BD_BTIME', 'BD_ETIME', 'PROG_NAME']
    
    # Validation (Optional but good)
    missing_cols = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        print(f"Warning: Missing columns: {missing_cols}")
        # Depending on strictness, we might return here. But let's try to proceed if possible.
        
    print(f"Updating {DB_FILE}...")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Drop table
    print(f"Dropping table {TABLE_NAME}...")
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
    
    # Prepare data
    data_to_insert = []
    # Use simpler retrieval with defaults
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
    print(f"Inserting {len(data_to_insert)} rows...")
    cursor.executemany(f"""
    INSERT INTO {TABLE_NAME} (md_name, mgroupn_name, sgroupn_name, brand_name, bd_date, bd_btime, bd_etime, prog_name, goods_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, data_to_insert)
    
    # Indices
    print("Creating indices...")
    cursor.execute(f"CREATE INDEX idx_brand_lookup ON {TABLE_NAME} (md_name, mgroupn_name, sgroupn_name, brand_name)")
    cursor.execute(f"CREATE INDEX idx_brand_name ON {TABLE_NAME} (brand_name)")
    
    conn.commit()
    conn.close()
    print("Update complete.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 update_brands_db.py <excel_file>")
    else:
        update_db(sys.argv[1])
