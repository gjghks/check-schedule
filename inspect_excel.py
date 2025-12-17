
import pandas as pd

try:
    df = pd.read_excel('data/251217_CompetitorSales.xlsx')
    print("Columns:", df.columns.tolist())
    print("First row:", df.iloc[0].tolist())
except Exception as e:
    print(e)
