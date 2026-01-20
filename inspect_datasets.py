import pandas as pd
import os

files = ['data/dataset.xlsx', 'data/251216_Competitor.xlsx', 'data/251217_CompetitorSales.xlsx']

for f in files:
    if not os.path.exists(f): continue
    print(f"\nChecking {f}...")
    try:
        df = pd.read_excel(f, nrows=5)
        print("Cols:", df.columns.tolist())
        # Check dates
        df_d = pd.read_excel(f, usecols=lambda x: 'date' in x.lower() or 'day' in x.lower() or '일자' in x)
        if not df_d.empty:
             print("Date Range:", df_d.iloc[:,0].min(), "to", df_d.iloc[:,0].max())
    except Exception as e:
        print("Error:", e)
