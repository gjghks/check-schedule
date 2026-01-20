import pandas as pd
import glob

# Check 2512
filename = 'data/2512_competitor_ratio.xlsx'
df = pd.read_excel(filename, header=None)

print(f"--- {filename} Rows 4-35 (Column B) ---")
for i in range(3, 35):
    if i < len(df):
        val = df.iloc[i, 1]
        print(f"Row {i+1}: {val}")

