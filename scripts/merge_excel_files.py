import pandas as pd
import os

# Define file paths
data_dir = os.path.join(os.getcwd(), 'data')
shinsegae_path = os.path.join(data_dir, '251216_ShinsegaeLiveShopping.xlsx')
competitor_path = os.path.join(data_dir, '251216_Competitor.xlsx')
output_path = os.path.join(data_dir, '251216_Merged_Preview.xlsx')

print(f"Loading files...\nLeft: {shinsegae_path}\nRight: {competitor_path}")

# Load Excel files
df_shinsegae = pd.read_excel(shinsegae_path)
df_competitor = pd.read_excel(competitor_path)

print(f"Shinsegae columns: {list(df_shinsegae.columns)}")
print(f"Competitor columns: {list(df_competitor.columns)}")

# Define join keys
left_on_keys = [
    'OTHER_BTIME',
    'OTHER_PRODUCT_NAME',
    'OTHER_BROAD_NAME',
    'OTHER_BRAND_NAME',
    'OTHER_LGROUPN_NAME',
    'OTHER_MGROUPN_NAME',
    'OTHER_SGROUPN_NAME'
]

right_on_keys = [
    'BD_BTIME',
    'PRODUCT_NAME',
    'COMPANY_NAME',
    'COMPANY_BRAND_NAME',
    'COMPANY_LGROUP_NAME',
    'COMPANY_MGROUP_NAME',
    'COMPANY_SGROUP_NAME'
]

# Ensure keys exist in dataframes
missing_left = [k for k in left_on_keys if k not in df_shinsegae.columns]
missing_right = [k for k in right_on_keys if k not in df_competitor.columns]

if missing_left:
    raise ValueError(f"Missing keys in Shinsegae file: {missing_left}")
if missing_right:
    raise ValueError(f"Missing keys in Competitor file: {missing_right}")

# conversions for consistent merging (merging on object type is usually safest for mixed data)
for col in left_on_keys:
    df_shinsegae[col] = df_shinsegae[col].astype(str).str.strip()

for col in right_on_keys:
    df_competitor[col] = df_competitor[col].astype(str).str.strip()

print("Performing Left Join...")
# Perform Left Join
merged_df = pd.merge(
    df_shinsegae,
    df_competitor,
    left_on=left_on_keys,
    right_on=right_on_keys,
    how='left'
)

print(f"Merged Data Shape: {merged_df.shape}")

# Save to Excel
print(f"Saving to {output_path}...")
merged_df.to_excel(output_path, index=False)
print("Done.")
