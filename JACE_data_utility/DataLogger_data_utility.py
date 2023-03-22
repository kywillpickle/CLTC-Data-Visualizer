''' CLTC-AEC-Data-Collection-Utility
    by Kyle Pickle, 9/20/2022
    created for the CLTC and Frontier Energy project at the AEC

    JACE_data_utility.py
    A a python script designed to automatically combine JACE-formatted logs
    into a single table, with built-in tools for packing and unpacking .csv,
    .db, and .html files for furthe visualization / ease of access
'''
import csv
from datetime import datetime
import math
import os
from pathlib import Path
import sqlite3
import win32com.client

os.chdir("../")

# Iterative binary search
def locate(arr, x):
    start = 1
    end = len(arr)-1
    while start <= end:
        mid=math.floor((start+end)/2)
        if arr[mid][0] < x:start = mid+1
        else: end = mid-1

def compile_input():
    ''' Compiles the data stored from multiple input files in the `csv_input/`
        
        :return: a 2D array of timestamps vs collected values
    '''
    input_dir = Path.cwd() / "JACE_data_utility/csv_input"
    rows = [[]]   # List of [UTC-Times, Timestamp, A, B, C... D]s
    # Figure out how many unique values there are
    for i in os.listdir(input_dir):
        with open(str(input_dir)+"\\"+i, 'r') as csvfile:
            csvreader = csv.reader(csvfile)
            header = ""
            lineCount = 0
            for line in csvreader:
                if lineCount == 1:
                    for j in range(len(line)):
                        rows[0].append(line[j].strip())
                    break
                lineCount+=1
        break
    rows.sort() # Alphabetize
    # Open each .csv file
    numFile = 0
    subRows = []
    for i in os.listdir(input_dir):
        numFile += 1
        with open(str(input_dir)+"\\"+i, 'r') as csvfile:
            csvreader = csv.reader(csvfile)
            lineCount = 0
            for line in csvreader:
                if lineCount == 4:
                    subRows.append([])
                    for j in range(len(line)):
                        subRows[numFile-1].append(line[j].strip())
                    subRows[numFile-1][0] = datetime.timestamp(datetime.strptime(str(subRows[numFile-1][0]), "%Y-%m-%d %H:%M:%S"))
                    break
                lineCount+=1
    def get_TS(arr): return arr[0]
    subRows.sort(key=get_TS)
    # Format it back to the Timestamps in the input files
    for subRow in subRows:
        # Format it back to the Timestamps in the input files
        strtime = datetime.strftime(datetime.fromtimestamp(int(subRow[0])), "%d-%m-%y %I:%M:%S %p PDT")
        if(strtime[strtime.index(':')-2] == "0"):
            strtime = strtime[:strtime.index(':')-2]+strtime[strtime.index(':')-1:]
        subRow[0] = strtime[:strtime.index('-')+1]+strtime[strtime.index('-')+1:strtime[strtime.index('-')+1:].index('-')+strtime.index('-')+1].replace("01","Jan").replace("02","Feb").replace("03","Mar").replace("04","Apr").replace("05","May").replace("06","Jun").replace("07","Jul").replace("08","Aug").replace("09","Sep").replace("10","Oct").replace("11","Nov").replace("12","Dec")+strtime[strtime[strtime.index('-')+1:].index('-')+strtime.index('-')+1:]
    return rows + subRows

def generate_csv(table, dir):
    ''' Writes a 2D array into a .csv file

        :param table: A 2D array with which to generate the .csv from
        :param dir: A str path to store the csv in
    '''
    # Write to CSV
    with open(dir, 'w', newline='') as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerows(table)

def generate_db(table, dir):
    ''' Writes a 2D array into a .db file

        :param table: A 2D array with which to generate the .db from
        :param dir: A str path to store the db in
    '''
    conn = sqlite3.connect(dir)
    cur = conn.cursor()
    coltypestr = "Timestamp TEXT PRIMARY KEY NOT NULL"
    colstr = "Timestamp"
    questionstr = "?"
    for col in table[0][1:]:
        coltypestr += ", "+str(col).replace("-","_")+" TEXT"
        colstr += ", "+str(col).replace("-","_")
        questionstr += ", ?"
    cur.execute("CREATE TABLE IF NOT EXISTS Data ("+coltypestr+")")
    data = []
    for row in table[1:]:
        data.append(row)
    cur.executemany("REPLACE INTO Data ("+colstr+") VALUES("+questionstr+")", data)
    conn.commit()

def main():
    print("CLTC-AEC-Data-Collection-Utility\nby Kyle Pickle, 9/20/2022\ncreated for the CLTC and Frontier Energy project at the AEC\n")
    table = compile_input()
    generate_csv(table, Path.cwd() / "JACE_data_utility/csv_output/data.csv")
    # generate_db(table, "database_output/data.db")
    print("Compilation successful!")

if __name__=="__main__":
    main()