import pandas as pd
import json

def inspect():
    df = pd.read_excel('data/251222_competitor_ratio.xlsx', header=None)
    
    # Header rows: 2 and 3 (0-indexed) which correspond to Excel rows 3 and 4
    header_main = df.iloc[2].tolist()
    header_sub = df.iloc[3].tolist()
    
    # Data starts at row 4 (Excel row 5)
    data_sample = df.iloc[4].tolist()
    
    print("Main Headers:")
    for i, h in enumerate(header_main):
        print(f"{i}: {h}")
        
    print("\nSub Headers:")
    for i, h in enumerate(header_sub):
        print(f"{i}: {h}")

inspect()
