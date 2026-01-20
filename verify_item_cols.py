import pandas as pd
import os

f = 'data/2512_competitor_ratio.xlsx'
print(f"Inspecting {f}")

# Read with header=2 to match previous output
df = pd.read_excel(f, header=2)

# Find columns
cols = df.columns.tolist()
# Filter for 1st place columns
target_cols = ['현대 1위', 'GS 1위', '롯데 1위', 'CJ 1위']
actual_cols = [c for c in cols if c in target_cols] # Match exact names
print("Found Target Cols:", actual_cols)

# Let's print rows 3 to 10 for these columns along with '구분' (Category)
result_cols = ['구분'] + actual_cols
print(df[result_cols].iloc[3:15])

