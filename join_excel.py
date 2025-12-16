
import pandas as pd
import os

def clean_column_names(df):
    df.columns = df.columns.str.strip()
    return df

def join_excel_files():
    base_dir = '/home/hheo/src/check-schedule/data'
    shinsegae_path = os.path.join(base_dir, '251216_ShinsegaeLiveShopping.xlsx')
    competitor_path = os.path.join(base_dir, '251216_Competitor.xlsx')
    output_path = os.path.join(base_dir, '251216_Shinsegae_Joined.xlsx')

    print("Loading files...")
    df_shinsegae = pd.read_excel(shinsegae_path)
    df_competitor = pd.read_excel(competitor_path)

    # Clean column names (remove leading/trailing spaces)
    df_shinsegae = clean_column_names(df_shinsegae)
    df_competitor = clean_column_names(df_competitor)

    print("Shinsegae Columns:", df_shinsegae.columns.tolist())
    print("Competitor Columns:", df_competitor.columns.tolist())

    # Define join keys
    left_keys = ['BD_DATE', 'OTHER_BTIME', 'OTHER_PRODUCT_NAME', 'OTHER_BROAD_NAME']
    right_keys = ['BD_DATE', 'BD_BTIME', 'PRODUCT_NAME', 'COMPANY_NAME']

    # Columns to add from Competitor
    cols_to_add = [
        'OTHER_BHOUR', 
        'BD_EDATE', 
        'OTHER_ETIME', 
        'WEIGHTS_TIME', 
        'PRODUCT_SALE_PRICE', 
        'PRODUCT_LINK_URL', 
        'PRODUCT_IMAGE_URL'
    ]

    # Verify if cols_to_add exist in df_competitor
    missing_cols = [col for col in cols_to_add if col not in df_competitor.columns]
    if missing_cols:
        print(f"Warning: The following columns were not found in Competitor file: {missing_cols}")
        # Proceeding with available columns
        cols_to_add = [col for col in cols_to_add if col in df_competitor.columns]

    # Prepare right dataframe for merge
    # We include right keys + cols_to_add
    # Note: If any right key is in cols_to_add (unlikely here), handle duplicates
    right_subset = df_competitor[right_keys + cols_to_add].copy()

    print("Merging data...")
    # Perform Left Join
    merged_df = pd.merge(
        df_shinsegae,
        right_subset,
        left_on=left_keys,
        right_on=right_keys,
        how='left'
    )

    # After merge, we will have duplicate columns for the keys (e.g. BD_DATE_x, BD_DATE_y or just BD_DATE if names match)
    # Since keys might have different names (OTHER_BTIME vs BD_BTIME), pandas keeps both if names differ.
    # If names are same (BD_DATE), pandas suffixes them (_x, _y).
    
    # We want to keep the Shinsegae version of the keys.
    # BD_DATE is in both. So we get BD_DATE_x (Shinsegae) and BD_DATE_y (Competitor).
    # We should drop BD_DATE_y and rename BD_DATE_x back to BD_DATE.
    
    # Identify columns that came from the right side keys which we don't need in the final output 
    # (unless the user wants them, but usually in a join you keep the left keys)
    # The user asked to add specific columns.
    
    # Let's clean up columns.
    # Only Drop the right_keys that are NOT in the requested addition list.
    # requested additions: OTHER_BHOUR, BD_EDATE, OTHER_ETIME, WEIGHTS_TIME, PRODUCT_SALE_PRICE, PRODUCT_LINK_URL, PRODUCT_IMAGE_URL
    # right_keys: BD_DATE, BD_BTIME, PRODUCT_NAME, COMPANY_NAME
    
    # BD_DATE matches left BD_DATE.
    # BD_BTIME maps to OTHER_BTIME.
    # PRODUCT_NAME maps to OTHER_PRODUCT_NAME.
    # COMPANY_NAME maps to OTHER_BROAD_NAME.
    
    # So we can drop the right_keys from the result, EXCEPT if they overlap with cols_to_add (none do).
    
    # However, merge suffix handling:
    # BD_DATE -> BD_DATE_x, BD_DATE_y
    if 'BD_DATE_y' in merged_df.columns:
        merged_df = merged_df.drop(columns=['BD_DATE_y'])
        merged_df = merged_df.rename(columns={'BD_DATE_x': 'BD_DATE'})
        
    # Remove other right keys if they exist in the output (they will, because names are different from left keys)
    for key in ['BD_BTIME', 'PRODUCT_NAME', 'COMPANY_NAME']:
        if key in merged_df.columns:
            merged_df = merged_df.drop(columns=[key])

    print("Saving to Excel...")
    merged_df.to_excel(output_path, index=False)
    print(f"File saved to {output_path}")

if __name__ == "__main__":
    join_excel_files()
