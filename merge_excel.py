
import pandas as pd
import os

# Define file paths
left_file = 'data/251216_ShinsegaeLiveShopping.xlsx'
right_file = 'data/251216_Competitor.xlsx'
output_file = 'data/Merged_251216.xlsx'

# Check if files exist
if not os.path.exists(left_file):
    print(f"Error: {left_file} not found.")
    exit(1)
if not os.path.exists(right_file):
    print(f"Error: {right_file} not found.")
    exit(1)

print("Loading Excel files...")
try:
    df_left = pd.read_excel(left_file)
    df_right = pd.read_excel(right_file)
except Exception as e:
    print(f"Error reading Excel files: {e}")
    exit(1)

print("Files loaded successfully.")
print(f"Left file shape: {df_left.shape}")
print(f"Right file shape: {df_right.shape}")

# Define join keys
left_keys = [
    'OTHER_BTIME', 'OTHER_PRODUCT_NAME', 'OTHER_BROAD_NAME', 
    'OTHER_BRAND_NAME', 'OTHER_LGROUPN_NAME', 'OTHER_MGROUPN_NAME', 
    'OTHER_SGROUPN_NAME'
]

right_keys = [
    'BD_BTIME', 'PRODUCT_NAME', 'COMPANY_NAME', 
    'COMPANY_BRAND_NAME', 'COMPANY_LGROUP_NAME', 'COMPANY_MGROUP_NAME', 
    'COMPANY_SGROUP_NAME'
]

# Columns to add from right table
cols_to_add = [
    'BD_EDATE', 'WEIGHTS_TIME', 'PRODUCT_SALE_PRICE', 
    'PRODUCT_LINK_URL', 'PRODUCT_IMAGE_URL'
]

# Ensure the columns exist in the right dataframe
missing_cols = [col for col in cols_to_add if col not in df_right.columns]
if missing_cols:
    print(f"Warning: The following columns to add are missing in the right file: {missing_cols}")
    # Proceeding with available columns
    cols_to_add = [col for col in cols_to_add if col in df_right.columns]

# Ensure join keys exist
for col in left_keys:
    if col not in df_left.columns:
        print(f"Error: Join key '{col}' not found in left file.")
        exit(1)

for col in right_keys:
    if col not in df_right.columns:
        print(f"Error: Join key '{col}' not found in right file.")
        exit(1)

# Preprocessing: Convert join keys to string and strip whitespace to ensure better matching
# This is optional but often necessary for Excel data merges
print("Preprocessing join keys...")
for l_k, r_k in zip(left_keys, right_keys):
    df_left[l_k] = df_left[l_k].astype(str).str.strip()
    df_right[r_k] = df_right[r_k].astype(str).str.strip()

# Create a subset of the right dataframe with keys + columns to add
right_subset = df_right[right_keys + cols_to_add].copy()

# Rename right keys to avoid collisions and easily drop them later
right_key_map = {k: f"RIGHT_JOIN_{k}" for k in right_keys}
right_subset.rename(columns=right_key_map, inplace=True)
renamed_right_keys = list(right_key_map.values())

# Perform the merge
print("Performing Left Join...")
merged_df = pd.merge(
    df_left, 
    right_subset, 
    left_on=left_keys, 
    right_on=renamed_right_keys, 
    how='left'
)

# Drop the temporary right keys
print("Cleaning up merged columns...")
merged_df.drop(columns=renamed_right_keys, inplace=True)

# Save the result
print(f"Saving merged data to {output_file}...")
merged_df.to_excel(output_file, index=False)

print("Done.")
