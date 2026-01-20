import pandas as pd
import os

file_path = 'data/2501_competitor_ratio.xlsx'
if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

# Read file, skipping header rows to get to data
# Data starts at row 5 (index 4 in 0-based), so header is row 4?
# Let's read with header=3 (row 4) which is often the column names '구분', '전월', '당월' etc.
df = pd.read_excel(file_path, header=3) 

# Columns: 
# 0: unnamed? (No)
# 1: title (Category)
# 3: Shinsegae Curr
# 6: Hyundai Curr
# 9: GS Curr
# 12: Lotte Curr
# 15: CJ Curr

print("Columns:", df.columns.tolist())

# Indices for 'Current Month' percentages
cols = [3, 6, 9, 12, 15]
names = ['Shinsegae', 'Hyundai', 'GS', 'Lotte', 'CJ']

row_start = 0 
row_end = 26 # Approx based on 30 rows

print(f"\n--- Checking Sums for {file_path} ---")
for i, col_idx in enumerate(cols):
    col_name = df.columns[col_idx]
    # Convert to numeric, usually they are strings with '%'
    # Filter rows that are actual categories (exclude 'Total', 'Subtotal' if mixed?)
    # Based on previous code, we just want to see if the raw numbers sum > 100
    
    total = 0
    print(f"Competitor: {names[i]} (Col {col_idx})")
    
    # Iterate relevant rows (categories often start from index 0 in this slice)
    # Exclude the first few if they are headers? 
    # Let's just iterate all and print non-nulls to see structure
    for idx, row in df.iterrows():
        if idx > 30: break
        cat = row.iloc[1]
        val = row.iloc[col_idx]
        
        # Simple cleanup
        try:
            val_f = float(str(val).replace('%', '').strip())
        except:
            val_f = 0.0
            
        # Only sum if it looks like a leaf category or similar?
        # Actually the graph plots specific rows. 
        # The main issue is likely that the "Total" or "Subtotal" rows are being included in the chart data.
        # Or maybe the raw leaves themselves sum > 100.
        
        # Let's just visualize the data for now
        # print(f"  {cat}: {val_f}")
        pass

    # Re-calculate specific sum if possible later
    
# Better Approach: Just display the specific rows used in the chart
# The frontend code filters for specific keys: 'cloth', 'beauty', etc.
# These correspond to rows where name includes the keyword.

target_cats = ['의류', '뷰티', '건강식품', '푸드', '레포츠', '리빙', '주방', '가전', '잡화', '무형', '언더웨어', '기타']
print(f"\n--- Summing Target Categories for {names[1]} (Hyundai, Col 6) ---")

col_idx = 6 # Hyundai
total_sum = 0
for idx, row in df.iterrows():
    cat = str(row.iloc[1])
    val = row.iloc[col_idx]
    try:
        val_f = float(str(val).replace('%', '').strip())
    except:
        val_f = 0.0
        
    # Check if this row matches one of our targets
    matched = False
    for t in target_cats:
        if t in cat and '소계' not in cat and '합계' not in cat: 
             # Be careful, '의류/잡화' might match both? 
             # The code does specific exact matching or contains.
             # Let's approximate.
             pass
             
    # Just print the rows with significant values to debugging
    if val_f > 0:
        print(f"  {cat}: {val_f}")
        # Identify if this is a leaf or summary
        
