import sqlite3
import pandas as pd
import os

# 1. DB Schema Inspection
print("=== DB Inspection ===")
db_path = 'schedule.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(schedules);")
        columns = cursor.fetchall()
        print("Table 'schedules' columns:")
        for col in columns:
            print(col)
        
        # Sample data
        print("\nSample Data (first 1 row):")
        df_db = pd.read_sql_query("SELECT * FROM schedules LIMIT 1", conn)
        print(df_db.to_string())
    except Exception as e:
        print(f"Error reading DB: {e}")
    finally:
        conn.close()
else:
    print(f"DB not found at {db_path}")

# 2. Excel Inspection
print("\n=== Excel Inspection ===")
xlsx_path = 'data/SK_KT.xlsx'
if os.path.exists(xlsx_path):
    try:
        df_ex = pd.read_excel(xlsx_path, nrows=3)
        print("Excel Columns:")
        print(df_ex.columns.tolist())
        print("\nSample Data:")
        print(df_ex.to_string())
    except Exception as e:
        print(f"Error reading Excel: {e}")
else:
    print(f"Excel not found at {xlsx_path}")
