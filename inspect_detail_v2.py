import pandas as pd
import os
import sys

print("Starting inspection...")
target_file = 'data/260105_tb_ai_sche_comp_sml_rslt.xlsx'
if not os.path.exists(target_file):
    print(f"File not found: {target_file}")
    sys.exit(1)

print(f"Reading {target_file}...")
try:
    df = pd.read_excel(target_file, nrows=5) # Read only first 5 rows for speed
    print("Columns:", df.columns.tolist())
    print("First row values:", df.iloc[0].tolist())
except Exception as e:
    print(f"Error: {e}")
