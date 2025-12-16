import pandas as pd

df = pd.read_excel('data/251216_Joined.xlsx')
print(f"Total rows: {len(df)}")
print(f"Columns: {list(df.columns)}")
print(f"Rows with WEIGHTS_TIME populated: {df['WEIGHTS_TIME'].notnull().sum()}")
print("Sample of added columns:")
print(df[['OTHER_BTIME', 'WEIGHTS_TIME']].head())
