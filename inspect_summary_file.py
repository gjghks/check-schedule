import pandas as pd
import os

f = 'data/2512_competitor_ratio.xlsx'
if not os.path.exists(f): 
    # Try 251230... if 2512 doesn't exist
    f = 'data/251230_competitor_ratio.xlsx'

print(f"Inspecting {f}")
xl = pd.ExcelFile(f)
print("Sheets:", xl.sheet_names)

df = pd.read_excel(f, sheet_name=0, header=None)
# Print first 40 rows of column A and B
print("\nFirst 40 rows (Col 0, 1):")
for i in range(40):
    if i >= len(df): break
    print(f"{i}: {df.iloc[i, 0]} | {df.iloc[i, 1]}")

