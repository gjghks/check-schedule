import pandas as pd
import sqlite3
import os

# Configuration
excel_file = 'data/251216_ShinsegaeLiveShopping_Joined.xlsx'
db_file = 'schedule.db'
table_name = 'schedules'

def replace_database():
    print(f"Reading Excel file: {excel_file}...")
    if not os.path.exists(excel_file):
        print(f"Error: File {excel_file} not found.")
        return

    df = pd.read_excel(excel_file)
    
    # Normalize column names to lowercase to match the application's expectation (lib/db.ts)
    df.columns = [c.lower() for c in df.columns]
    
    # Clean up column names if needed (e.g. trim whitespace)
    df.columns = [c.strip() for c in df.columns]

    print(f"Columns: {df.columns.tolist()}")
    
    # Add 'id' column if missing, as the application interface likely expects it
    if 'id' not in df.columns:
        print("Adding 'id' column...")
        df.insert(0, 'id', range(1, len(df) + 1))
        
    print(f"Rows: {len(df)}")

    # Connect to SQLite database
    print(f"Connecting to database: {db_file}...")
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    # Drop existing table
    print(f"Dropping table {table_name} if exists...")
    cursor.execute(f"DROP TABLE IF EXISTS {table_name}")

    # Create table and insert data using pandas to_sql
    # we use 'replace' just in case, though we dropped it.
    # index=False means don't save the pandas index as a column
    print(f"Creating table {table_name} and inserting data...")
    df.to_sql(table_name, conn, if_exists='replace', index=False)

    # Create indices for performance (based on usage in lib/db.ts)
    print("Creating indices...")
    # existing code uses: WHERE bd_date = ? ORDER BY bd_btime
    cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_bd_date ON {table_name} (bd_date)")
    # existing code uses: ORDER BY bd_btime
    cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_bd_btime ON {table_name} (bd_btime)")

    conn.commit()
    conn.close()
    print("Database replacement complete.")

if __name__ == "__main__":
    replace_database()
