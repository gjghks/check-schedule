import pandas as pd
import sys

def check_date_range(file_path):
    print(f"Reading {file_path}...")
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return

    if 'BD_DATE' in df.columns:
        dates = pd.to_datetime(df['BD_DATE'], errors='coerce')
        min_date = dates.min()
        max_date = dates.max()
        print(f"Date Range in {file_path}: {min_date} to {max_date}")
        print(f"Unique dates count: {df['BD_DATE'].nunique()}")
    else:
        print("BD_DATE column not found.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        check_date_range(sys.argv[1])
    else:
        print("Usage: python3 check_dates.py <excel_file>")
