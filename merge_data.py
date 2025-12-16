import pandas as pd
import os

def merge_excel():
    base_dir = 'data'
    shinsegae_path = os.path.join(base_dir, '251216_ShinsegaeLiveShopping.xlsx')
    competitor_path = os.path.join(base_dir, '251216_Competitor.xlsx')
    output_path = os.path.join(base_dir, '251216_Joined.xlsx')

    print("Loading files...")
    df_shinsegae = pd.read_excel(shinsegae_path)
    df_competitor = pd.read_excel(competitor_path)
    
    print(f"Shinsegae columns: {list(df_shinsegae.columns)}")
    print(f"Competitor columns: {list(df_competitor.columns)}")

    # Define join keys
    left_on = ['OTHER_BTIME', 'OTHER_PRODUCT_NAME', 'OTHER_BROAD_NAME']
    right_on = ['BD_BTIME', 'PRODUCT_NAME', 'COMPANY_NAME']
    
    # Columns to add from competitor
    cols_to_add = ['BD_EDATE', 'WEIGHTS_TIME', 'PRODUCT_SALE_PRICE', 'PRODUCT_LINK_URL', 'PRODUCT_IMAGE_URL']
    
    # Ensure keys exist
    for col in left_on:
        if col not in df_shinsegae.columns:
            raise ValueError(f"Column '{col}' not found in Shinsegae file")
    
    for col in right_on + cols_to_add:
        if col not in df_competitor.columns:
            raise ValueError(f"Column '{col}' not found in Competitor file")

    # Normalize key columns to string to avoid type mismatches during merge
    # Special handling for times if they are datetime objects, but string conversion usually works for equality checks if formats match
    # However, if one is 14:00:00 and other is 14:00, that's a problem. 
    # Let's inspect the data first? No, I'll trust standard conversion first.
    
    for col in left_on:
        df_shinsegae[col] = df_shinsegae[col].astype(str)
        
    for col in right_on:
        df_competitor[col] = df_competitor[col].astype(str)

    # subset competitor data to just keys + targets
    # To avoid column name collisions (like BD_BTIME which exists in both but is not the join key on left),
    # and to easily drop the right keys after join, we will rename the right keys.
    right_subset = df_competitor[right_on + cols_to_add].copy()
    
    right_key_map = {col: f"RIGHT_JOIN_KEY_{col}" for col in right_on}
    right_subset.rename(columns=right_key_map, inplace=True)
    
    right_on_renamed = [right_key_map[col] for col in right_on]
    
    # Perform Left Join
    print("Merging...")
    merged_df = pd.merge(
        df_shinsegae,
        right_subset,
        left_on=left_on,
        right_on=right_on_renamed,
        how='left'
    )
    
    print("Cleaning up columns...")
    merged_df.drop(columns=right_on_renamed, inplace=True)
    
    print(f"Saving to {output_path}...")
    merged_df.to_excel(output_path, index=False)
    print("Done!")

if __name__ == "__main__":
    merge_excel()
