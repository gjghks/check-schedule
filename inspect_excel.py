import pandas as pd
import os

files = [f for f in os.listdir('data') if f.endswith('_competitor_ratio.xlsx') and f.startswith('25')]
files.sort()

# Focus on 2512 first as example
target_file = 'data/2512_competitor_ratio.xlsx'

df = pd.read_excel(target_file)
# Adjust for header. Route.ts assumes data starts at row 4 (0-indexed 3? or row 4 meaning index 3?)
# Route.ts: startRow = 4. Sheet loop r=4 to 30.
# Excel rows are 1-based usually in description, but xlsx library 0-based?
# XLSX utils sheet_to_json usually handles headers.
# But straight reading:
print("--- File:", target_file, "---")
# Read without header to see raw rows
df_raw = pd.read_excel(target_file, header=None)
# Print rows 0 to 40 to see structure
print(df_raw.iloc[0:40, 0:3].to_string())

