import pandas as pd
import os

files = [f for f in os.listdir('data') if 'tb_ai_sche_comp_sml_rslt' in f]
files.sort()
if not files:
    print("No tb_ai_sche_comp_sml_rslt files found.")
    exit(0)

target_file = os.path.join('data', files[-1]) # Use latest
print(f"Inspecting {target_file}")

df = pd.read_excel(target_file)
print("Columns:", df.columns.tolist())
print(df.head(3))

# Check for Item Name, Competitor, Category
# Possible cols: 'PRD_NM' (Product Name), 'CP_NM' (Company?), 'CATE_NM'
