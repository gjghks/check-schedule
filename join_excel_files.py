import pandas as pd
import os

# File paths
left_file_path = 'data/251216_ShinsegaeLiveShopping.xlsx'
right_file_path = 'data/251216_Competitor.xlsx'
output_file_path = 'data/251216_ShinsegaeLiveShopping_Joined.xlsx'

# Load data
print("Loading files...")
df_left = pd.read_excel(left_file_path)
df_right = pd.read_excel(right_file_path)

# Clean column names in df_right (remove leading/trailing spaces)
df_right.columns = df_right.columns.str.strip()

print("Shinsegae columns:", df_left.columns.tolist())
print("Competitor columns:", df_right.columns.tolist())

# definition of keys
left_on_keys = ['BD_DATE', 'OTHER_BTIME', 'OTHER_PRODUCT_NAME', 'OTHER_BROAD_NAME']
right_on_keys = ['BD_DATE', 'BD_BTIME', 'PRODUCT_NAME', 'COMPANY_NAME']

# Columns to add from right table
cols_to_add = [
    'OTHER_BHOUR', 
    'BD_EDATE', 
    'OTHER_ETIME', 
    'WEIGHTS_TIME', 
    'PRODUCT_SALE_PRICE', 
    'PRODUCT_LINK_URL', 
    'PRODUCT_IMAGE_URL'
]

# Ensure requested columns exist in right dataframe
missing_cols = [col for col in cols_to_add if col not in df_right.columns]
if missing_cols:
    print(f"Warning: The following columns were not found in Competitor file: {missing_cols}")
    # Proceeding with available columns only
    cols_to_add = [col for col in cols_to_add if col in df_right.columns]

# Prepare right dataframe for merge: Keys + Cols to Add
# We include right_on_keys to perform the merge
right_subset = df_right[right_on_keys + cols_to_add]

# Perform Left Join
print("Performing Left Join...")
# Use suffixes to identify columns from Right that collide with Left
df_merged = pd.merge(
    df_left, 
    right_subset, 
    left_on=left_on_keys, 
    right_on=right_on_keys, 
    how='left',
    suffixes=('', '_dup_right')
)

print("Columns after join (raw):", df_merged.columns.tolist())

# Identify columns to drop:
# 1. Right keys that are redundant (PRODUCT_NAME, COMPANY_NAME) - unless they are in cols_to_add (they are not)
# 2. Colliding columns from right (ending in _dup_right) - specifically BD_BTIME_dup_right
cols_to_drop = []

# Add redundant non-colliding right keys
for col in right_on_keys:
    if col == 'BD_DATE': continue # Shared key, automatically merged
    if col in cols_to_add: continue # We want to keep it
    
    # Check if this column exists with suffix first (priority to drop the duplicate from right)
    if f"{col}_dup_right" in df_merged.columns:
        cols_to_drop.append(f"{col}_dup_right")
    elif col in df_merged.columns:
        cols_to_drop.append(col)

print(f"Dropping columns: {cols_to_drop}")
df_merged.drop(columns=cols_to_drop, inplace=True)

print("Final columns:", df_merged.columns.tolist())

# Save to Excel
print(f"Saving to {output_file_path}...")
df_merged.to_excel(output_file_path, index=False)
print("Done.")
