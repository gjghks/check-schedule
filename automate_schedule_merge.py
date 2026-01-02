
import pandas as pd
import os
import sys
import glob

def automate_merge(date_prefix):
    # Define file patterns
    # Expected files:
    # 1. {date}_tb_ai_sche_comp_sml_rslt.xlsx
    # 2. {date}_od_bo_tcompanybroadsche.xlsx
    # 3. {date}_od_bo_tcompanybroadsche_liveecomm.xlsx
    
    base_dir = './data'
    
    file_ai = os.path.join(base_dir, f"{date_prefix}_tb_ai_sche_comp_sml_rslt.xlsx")
    file_broad = os.path.join(base_dir, f"{date_prefix}_od_bo_tcompanybroadsche.xlsx")
    file_ecomm = os.path.join(base_dir, f"{date_prefix}_od_bo_tcompanybroadsche_liveecomm.xlsx")
    
    output_file = os.path.join(base_dir, f"{date_prefix}_ai_sche_comp_sml_rslt_merge.xlsx")
    
    # Validation
    missing_files = []
    for f in [file_ai, file_broad, file_ecomm]:
        if not os.path.exists(f):
            missing_files.append(f)
    
    if missing_files:
        print(f"Error: The following required files check failed:")
        for mf in missing_files:
            print(f" - {mf}")
        return

    print(f"Processing for date prefix: {date_prefix}")
    
    # ---------------------------------------------------------
    # STEP 1: Merge Broad + LiveEcomm -> BroadMerged (In-Memory)
    # ---------------------------------------------------------
    print(f"Loading {os.path.basename(file_broad)}...")
    df_broad = pd.read_excel(file_broad, dtype=str)
    
    print(f"Loading {os.path.basename(file_ecomm)}...")
    df_ecomm = pd.read_excel(file_ecomm, dtype=str)
    
    # Pre-process Ecomm (Right side of Step 1)
    # Rename 'KT알파쇼핑' to 'KT알파' in PLATFORM_NAME
    if 'PLATFORM_NAME' in df_ecomm.columns:
        df_ecomm['PLATFORM_NAME'] = df_ecomm['PLATFORM_NAME'].replace('KT알파쇼핑', 'KT알파')
    
    # Select columns to add to Broad
    # Keys: BD_DATE, BD_BDATE, PLATFORM_NAME
    # Values: GOODS_QTY, SALES_QTY, SALES_AMT
    step1_keys_left = ['BD_DATE', 'BD_BTIME', 'COMPANY_NAME']
    step1_keys_right = ['BD_DATE', 'BD_BDATE', 'PLATFORM_NAME']
    step1_values = ['GOODS_QTY', 'SALES_QTY', 'SALES_AMT']
    
    # Clean keys
    for col in step1_keys_left:
        if col in df_broad.columns:
            df_broad[col] = df_broad[col].str.strip()
            
    for col in step1_keys_right:
        if col in df_ecomm.columns:
            df_ecomm[col] = df_ecomm[col].str.strip()

    # Subset Right
    ecomm_cols = step1_keys_right + step1_values
    df_ecomm_subset = df_ecomm[ecomm_cols].copy()
    
    print("Executing Step 1 Merge (Broad + Ecomm)...")
    df_broad_merged = pd.merge(
        df_broad,
        df_ecomm_subset,
        how='left',
        left_on=step1_keys_left,
        right_on=step1_keys_right
    )
    
    # Drop redundant right keys from Step 1
    df_broad_merged.drop(columns=['BD_BDATE', 'PLATFORM_NAME'], inplace=True, errors='ignore')
    
    # ---------------------------------------------------------
    # STEP 2: Merge AI Result + BroadMerged -> Final
    # ---------------------------------------------------------
    print(f"Loading {os.path.basename(file_ai)}...")
    df_ai = pd.read_excel(file_ai, dtype=str)
    ai_original_cols = df_ai.columns.tolist()
    
    # Keys for Step 2
    # Left: BD_DATE, OTHER_BTIME, OTHER_BROAD_NAME
    # Right: BD_DATE, BD_BTIME, COMPANY_NAME
    step2_keys_left = ['BD_DATE', 'OTHER_BTIME', 'OTHER_BROAD_NAME']
    step2_keys_right = ['BD_DATE', 'BD_BTIME', 'COMPANY_NAME']
    
    # Clean keys
    for col in step2_keys_left:
        if col in df_ai.columns:
            df_ai[col] = df_ai[col].str.strip()
    
    for col in step2_keys_right:
        if col in df_broad_merged.columns:
            df_broad_merged[col] = df_broad_merged[col].str.strip()

    # Columns to Add (with Mapping)
    # (SourceInBroad, TargetInFinal)
    columns_mapping = [
        ('COMPANY_BRAND_NAME', 'COMPANY_BRAND_NAME'),
        ('BD_HH', 'OTHER_BHOUR'),
        ('BD_EDATE', 'OTHER_EDATE'),
        ('BD_ETIME', 'OTHER_ETIME'),
        ('WEIGHTS_TIME', 'WEIGHTS_TIME'),
        ('GOODS_QTY', 'GOODS_QTY'),
        ('SALES_QTY', 'SALES_QTY'),
        ('SALES_AMT', 'SALES_AMT'),
        ('PRODUCT_SALE_PRICE', 'PRODUCT_SALE_PRICE'),
        ('PRODUCT_LINK_URL', 'PRODUCT_LINK_URL'),
        ('PRODUCT_IMAGE_URL', 'PRODUCT_IMAGE_URL')
    ]
    
    # Prepare Right Subset for Step 2
    step2_value_sources = [src for src, tgt in columns_mapping]
    step2_cols_needed = list(set(step2_keys_right + step2_value_sources))
    
    # Ensure all needed columns exist in BroadMerged
    missing_intermediate = [c for c in step2_cols_needed if c not in df_broad_merged.columns]
    if missing_intermediate:
        print(f"Warning: Missing columns in intermediate merge: {missing_intermediate}")
    
    df_broad_subset = df_broad_merged[[c for c in step2_cols_needed if c in df_broad_merged.columns]].copy()
    
    print("Executing Step 2 Merge (AI + BroadMerged)...")
    df_final = pd.merge(
        df_ai,
        df_broad_subset,
        how='left',
        left_on=step2_keys_left,
        right_on=step2_keys_right,
        suffixes=('', '_DROP')
    )
    
    # Rename mapped columns
    # Logic: Identify column source (handling suffix if collision) -> Rename to Target
    rename_map = {}
    for src, tgt in columns_mapping:
        if src not in df_broad_merged.columns:
             continue
             
        # Check collision with AI columns
        if src in df_ai.columns:
            actual_col_name = f"{src}_DROP"
        else:
            actual_col_name = src
            
        if actual_col_name in df_final.columns:
            rename_map[actual_col_name] = tgt
    
    df_final.rename(columns=rename_map, inplace=True)
    
    # Clean up Redundant Columns
    # 1. Drop Step 2 Right Keys that are not Targets
    for k in step2_keys_right:
        # Check suffixes
        k_drop = f"{k}_DROP"
        if k_drop in df_final.columns:
            df_final.drop(columns=[k_drop], inplace=True)
        elif k in df_final.columns and k not in ai_original_cols:
             # If it persists and wasn't in original AI, it's a residual right key
             # BUT check if it was one of our mapped columns?
             # step2_keys_right = ['BD_DATE', 'BD_BTIME', 'COMPANY_NAME']
             # none of these are in columns_mapping
             df_final.drop(columns=[k], inplace=True)

    # 2. Organize Final Columns (Append Mode)
    # Start with AI Cols
    final_cols_order = list(ai_original_cols)
    added_targets = [tgt for src, tgt in columns_mapping]
    
    # If added targets collide with AI cols, remove AI cols to prioritize new ones (replace)
    # or keep them? User pattern suggested appending.
    # Logic: If 'OTHER_BHOUR' is in added list, and was in AI, we remove from AI list part.
    for tgt in added_targets:
        if tgt in final_cols_order:
            final_cols_order.remove(tgt)
            
    # Append added block
    final_cols_order.extend(added_targets)
    
    # Verify columns exist
    valid_cols = [c for c in final_cols_order if c in df_final.columns]
    df_final = df_final[valid_cols]
    
    # Numeric Conversion
    numeric_fields = ['GOODS_QTY', 'SALES_QTY', 'SALES_AMT', 'PRODUCT_SALE_PRICE', 'OTHER_BHOUR', 'WEIGHTS_TIME']
    for col in numeric_fields:
        if col in df_final.columns:
            df_final[col] = pd.to_numeric(df_final[col], errors='coerce')

    print(f"Saving final output to {output_file}...")
    df_final.to_excel(output_file, index=False)
    print("Automation Complete.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 automate_schedule_merge.py <date_prefix>")
        print("Example: python3 automate_schedule_merge.py 251222")
    else:
        automate_merge(sys.argv[1])
