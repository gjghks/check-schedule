import pandas as pd
import os

files = ['data/260105_tb_ai_sche_comp_sml_rslt.xlsx', 'data/2512_competitor_ratio.xlsx']

for f in files:
    if not os.path.exists(f):
        print(f"File not found: {f}")
        continue
        
    print(f"\nScanning {f}...")
    try:
        # Read header to infer structure
        df_head = pd.read_excel(f, nrows=5)
        print("Columns:", df_head.columns.tolist())
        
        if 'tb_ai_sche' in f:
            # Detailed file
            # Read just dates to check range
            df = pd.read_excel(f, usecols=['BD_DATE'])
            print("Row count:", len(df))
            print("Min Date:", df['BD_DATE'].min())
            print("Max Date:", df['BD_DATE'].max())
        else:
            # Competitor ratio file
            # Check if there are any sheets that might contain details
            xl = pd.ExcelFile(f)
            print("Sheets:", xl.sheet_names)
            # Maybe reading the main sheet to see if there are hidden columns or rows with item names?
             
    except Exception as e:
        print(f"Error: {e}")
