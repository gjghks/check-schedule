import sqlite3
import pandas as pd
import os

# Define output filename
OUTPUT_FILENAME = "data/251222_database.xlsx"

def export_db():
    print("Connecting to database...")
    conn = sqlite3.connect('schedule.db')
    
    print("Reading data...")
    # Read all data
    df = pd.read_sql_query("SELECT * FROM schedules ORDER BY bd_date, bd_btime", conn)
    
    conn.close()
    
    print(f"Exporting {len(df)} rows to {OUTPUT_FILENAME}...")
    
    # Ensure data directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILENAME), exist_ok=True)
    
    # Save to Excel
    df.to_excel(OUTPUT_FILENAME, index=False)
    print("Done.")

if __name__ == "__main__":
    export_db()
