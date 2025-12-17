
import sqlite3
import pandas as pd
import os

# Paths
db_path = 'schedule.db'
excel_path = 'data/251217_CompetitorSales.xlsx'
output_excel_path = 'data/251217_Joined_CheckSchedule_DB.xlsx'

def join_and_update():
    print("Connecting to database...")
    conn = sqlite3.connect(db_path)
    
    print("Reading existing data from database...")
    db_df = pd.read_sql_query("SELECT * FROM schedules", conn)
    print(f"Existing DB rows: {len(db_df)}")
    
    print(f"Reading Excel file: {excel_path}...")
    excel_df = pd.read_excel(excel_path)
    print(f"Excel rows: {len(excel_df)}")
    
    # Prepare Excel data for merge
    # Select only necessary columns plus join keys
    # Join keys: BD_DATE, BD_BDATE, PROG_NAME
    # Target columns: GOODS_QTY, SALES_QTY, SALES_AMT
    
    cols_to_use = ['BD_DATE', 'BD_BDATE', 'PROG_NAME', 'GOODS_QTY', 'SALES_QTY', 'SALES_AMT']
    
    # Check if columns exist
    missing_cols = [c for c in cols_to_use if c not in excel_df.columns]
    if missing_cols:
        print(f"Error: Missing columns in Excel: {missing_cols}")
        return

    excel_subset = excel_df[cols_to_use].copy()
    
    # Ensure join keys are strings/consistent types if needed
    # DB types: bd_date (TEXT), other_btime (TEXT), other_product_name (TEXT)
    # Excel types usually inferred. converting to string to be safe for keys might be good, 
    # but exact match is required.
    
    # Perform Left Join
    # db: bd_date, other_btime, other_product_name
    # excel: BD_DATE, BD_BDATE, PROG_NAME
    
    print("Merging data...")
    merged_df = pd.merge(
        db_df,
        excel_subset,
        left_on=['bd_date', 'other_btime', 'other_product_name'],
        right_on=['BD_DATE', 'BD_BDATE', 'PROG_NAME'],
        how='left'
    )
    
    print(f"Merged rows: {len(merged_df)}")
    
    # Drop the extra join key columns from the right side
    merged_df.drop(columns=['BD_DATE', 'BD_BDATE', 'PROG_NAME'], inplace=True)
    
    # Rename new columns to lowercase for consistency with DB schema
    merged_df.rename(columns={
        'GOODS_QTY': 'goods_qty',
        'SALES_QTY': 'sales_qty',
        'SALES_AMT': 'sales_amt'
    }, inplace=True)
    
    # Save back to Database
    print("Updating database table 'schedules'...")
    merged_df.to_sql('schedules', conn, if_exists='replace', index=False)
    
    conn.close()
    print("Database updated.")
    
    # Save to Excel
    print(f"Saving to Excel: {output_excel_path}...")
    merged_df.to_excel(output_excel_path, index=False)
    print("Excel saved.")

if __name__ == "__main__":
    join_and_update()
