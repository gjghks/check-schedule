import os
import sys
import shutil
import sqlite3
import pandas as pd
import subprocess
from datetime import datetime

# Configuration
DATE_PREFIX = "260102"
DB_PATH = "schedule.db"
BACKUP_PATH = f"schedule.db.bak_{datetime.now().strftime('%Y%m%d%H%M%S')}"
MERGE_SCRIPT = "automate_schedule_merge.py"
OUTPUT_MERGE_FILE = f"data/{DATE_PREFIX}_ai_sche_comp_sml_rslt_merge.xlsx"
FINAL_XLSX = f"{DATE_PREFIX}_database.xlsx"

def log(msg):
    print(f"[Workflow] {msg}")

def backup_db():
    if os.path.exists(DB_PATH):
        log(f"Backing up {DB_PATH} to {BACKUP_PATH}...")
        shutil.copy(DB_PATH, BACKUP_PATH)
    else:
        log("Database file not found, skipping backup (creating new DB implied).")

def restore_db():
    if os.path.exists(BACKUP_PATH):
        log(f"Restoring {DB_PATH} from {BACKUP_PATH}...")
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
        shutil.copy(BACKUP_PATH, DB_PATH)
    else:
        log("No backup found to restore.")

def run_merge_script():
    log(f"Running {MERGE_SCRIPT} with argument {DATE_PREFIX}...")
    try:
        result = subprocess.run(
            ["python3", MERGE_SCRIPT, DATE_PREFIX], 
            check=True, 
            capture_output=True, 
            text=True
        )
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        log(f"Error running merge script:\n{e.stderr}")
        raise e

def update_database():
    log(f"Reading new data from {FINAL_XLSX}...")
    try:
        df = pd.read_excel(FINAL_XLSX)
    except Exception as e:
        raise ValueError(f"Failed to read Excel file {FINAL_XLSX}: {e}")
    
    if df.empty:
        raise ValueError("Generated Excel file is empty.")
    
    # Normalize columns to lowercase to match DB schema
    df.columns = [c.lower() for c in df.columns]
    
    # Check for required date column
    if 'bd_date' not in df.columns:
        raise ValueError("Column 'bd_date' (case-insensitive) missing in new data.")
    
    # Get unique dates to update
    dates_to_update = df['bd_date'].unique()
    log(f"Target dates to update: {dates_to_update}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Delete existing records for these dates
        for date_val in dates_to_update:
            log(f"Deleting existing records for date: {date_val}")
            cursor.execute("DELETE FROM schedules WHERE bd_date = ?", (date_val,))
            log(f"Deleted {cursor.rowcount} rows.")
            
        # Insert new records
        # Get DB columns
        cursor.execute("PRAGMA table_info(schedules)")
        db_cols = [row[1] for row in cursor.fetchall()]
        
        # Filter DF to only DB columns (to avoid errors with extra calculated cols in local excel)
        valid_cols = [c for c in df.columns if c in db_cols]
        ignored_cols = [c for c in df.columns if c not in db_cols]
        if ignored_cols:
            log(f"Ignoring columns not in DB: {ignored_cols}")
            
        df_to_insert = df[valid_cols]
        
        log(f"Inserting {len(df_to_insert)} rows...")
        df_to_insert.to_sql('schedules', conn, if_exists='append', index=False)
        
        conn.commit()
        log("Database update committed successfully.")
        
    except Exception as e:
        conn.rollback()
        log("Error during database update. Transaction rolled back.")
        raise e
    finally:
        conn.close()

def main():
    try:
        # Check initial file existence
        required_inputs = [
            f"data/{DATE_PREFIX}_tb_ai_sche_comp_sml_rslt.xlsx",
            f"data/{DATE_PREFIX}_od_bo_tcompanybroadsche.xlsx",
            f"data/{DATE_PREFIX}_od_bo_tcompanybroadsche_liveecomm.xlsx"
        ]
        missing = [f for f in required_inputs if not os.path.exists(f)]
        if missing:
             raise FileNotFoundError(f"Missing input files: {missing}")

        # 1. Backup
        backup_db()
        
        # 2. Run Merge
        run_merge_script()
        
        # 3. Rename/Move Output
        if not os.path.exists(OUTPUT_MERGE_FILE):
             raise FileNotFoundError(f"Expected output file {OUTPUT_MERGE_FILE} not found.")
        
        if os.path.exists(FINAL_XLSX):
             os.remove(FINAL_XLSX)
             
        os.rename(OUTPUT_MERGE_FILE, FINAL_XLSX)
        log(f"Renamed output to {FINAL_XLSX}")
        
        # 4. Validated Update
        update_database()
        
        log("Process completed successfully.")
        
    except Exception as e:
        log(f"CRITICAL ERROR: {e}")
        log("Initiating Rollback...")
        restore_db()
        log("Rollback completed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
