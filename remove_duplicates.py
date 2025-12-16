import sqlite3
import pandas as pd

db_file = 'schedule.db'
table_name = 'schedules'

def remove_duplicates():
    print(f"Connecting to database: {db_file}...")
    conn = sqlite3.connect(db_file)
    
    # Read all data
    df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
    print(f"Total rows before cleanup: {len(df)}")
    
    # Define columns to consider for duplicate checking (all except 'id')
    cols_to_check = [c for c in df.columns if c != 'id']
    
    # Find duplicates
    duplicates = df[df.duplicated(subset=cols_to_check, keep='first')]
    num_duplicates = len(duplicates)
    
    print(f"Found {num_duplicates} duplicate rows (based on all columns except 'id').")
    
    if num_duplicates > 0:
        print("Removing duplicates...")
        # Keep the first occurrence, drop the rest
        df_cleaned = df.drop_duplicates(subset=cols_to_check, keep='first')
        
        # We need to write this back to the DB.
        # Since we are replacing the table content, we can use to_sql with 'replace'
        # BUT we want to preserve the 'id' if possible, OR re-generate strict IDs.
        # If we just drop duplicates, the 'id's of the remaining rows are fine.
        # But if we use 'replace', pandas might try to recreate the schema.
        # A safer way is to delete the specific IDs that are duplicates.
        
        # Get IDs of rows to delete
        # We can identify them by: find all rows, keep first, discard others.
        # The 'duplicated' method with keep='first' returns distinct rows that are duplicates of an earlier row.
        ids_to_delete = duplicates['id'].tolist()
        
        print(f"Deleting {len(ids_to_delete)} rows...")
        
        # Split into chunks for SQLite limit (just in case, though unlikely to hit limit with simple DELETE IN)
        chunk_size = 900
        cursor = conn.cursor()
        
        for i in range(0, len(ids_to_delete), chunk_size):
            chunk = ids_to_delete[i:i + chunk_size]
            placeholders = ','.join(['?'] * len(chunk))
            sql = f"DELETE FROM {table_name} WHERE id IN ({placeholders})"
            cursor.execute(sql, chunk)
            
        conn.commit()
        print("Duplicates removed.")
        
        # Verify
        remaining_count = pd.read_sql_query(f"SELECT count(*) FROM {table_name}", conn).iloc[0, 0]
        print(f"Total rows after cleanup: {remaining_count}")
        
    else:
        print("No duplicates found.")

    conn.close()

if __name__ == "__main__":
    remove_duplicates()
