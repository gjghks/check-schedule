import pandas as pd
import os

files = ['data/2512_competitor_ratio.xlsx', 'data/2501_competitor_ratio.xlsx']

for f in files:
    if not os.path.exists(f): continue
    print(f"\nInspecting {f}")
    try:
        xl = pd.ExcelFile(f)
        print("Sheets:", xl.sheet_names)
        
        # Read the first sheet (usually the main one)
        # Read with header=1 (row 2) or header=0 depending on structure we saw earlier
        # Earlier inspection showed row 0: Title, Row 1: Date info, Row 2: No | 구분 ...
        # Let's read header=2 to get 'No', '구분' as headers
        df = pd.read_excel(f, header=2) 
        print("Columns (Header Row 2):", df.columns.tolist())
        
        # Check if there are columns related to rankings
        # Maybe far to the right?
        cols = [c for c in df.columns if isinstance(c, str)]
        print("String Columns:", cols)
        
        # If there's another sheet, check that too
        if len(xl.sheet_names) > 1:
            for s in xl.sheet_names[1:]:
                 print(f"Sheet '{s}':")
                 df_s = pd.read_excel(f, sheet_name=s)
                 print("Cols:", df_s.columns.tolist())

    except Exception as e:
        print("Error:", e)
