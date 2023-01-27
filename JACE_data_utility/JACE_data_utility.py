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

def import_from_outlook(email, folder):
    ''' Import a batch of emails from Outlook.
        The fuction downloads all attachments within the input email's folder that contain "from SegMan_2_4_003" in the subject line.

        :param email: A str representing the user's email
        :param folder: A str representing the folder within the inbox (if any) to check
        '''
    # Create output folder
    output_dir = Path.cwd() / "JACE_data_utility/csv_input"
    output_dir.mkdir(parents=True, exist_ok=True)
    # Connect to outlook
    outlook = win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")
    # Connect to folder
    inbox = outlook.Folders(email).Folders("Inbox")
    if(folder != ""):
        inbox = outlook.Folders(email).Folders("Inbox").Folders(folder)
    # Get messages
    messages = inbox.Items
    for message in messages:
        subject = message.Subject
        if("from SegMan_2_4_003" in subject):
            attachments = message.Attachments
            # Save attachments
            for attachment in attachments:
                print("saving "+str(subject).replace(':','-').replace("FW- ",'')+".csv...")
                attachment.SaveAsFile(output_dir / (str(subject).replace(':','-').replace("FW- ",'')+".csv"))

def compile_input():
    ''' Compiles the data stored from multiple input files in the `csv_input/`
        
        :return: a 2D array of timestamps vs collected values
    '''
    input_dir = Path.cwd() / "JACE_data_utility/csv_input"
    rows = [["Timestamp"]]   # List of [UTC-Times, Timestamp, A, B, C... D]s
    # Figure out how many unique values there are
    for i in os.listdir(input_dir):
        with open(str(input_dir)+"\\"+i, 'r') as csvfile:
            csvreader = csv.reader(csvfile)
            header = ""
            lineCount = 0
            for line in csvreader:
                if lineCount == 0: header = line[0].split("/")[1]
                elif line and line[0] == "Timestamp":
                    if len(line[3].split(" ")) > 1: header=header+" "+line[3].split(" ")[1]
                    else: header=header+" (%)"
                    break
                lineCount+=1
            if header not in rows[0]:
                rows[0].append(header) # Add them to the first row
    rows.sort() # Alphabetize
    # Open each .csv file
    numFile = 0
    for i in os.listdir(input_dir):
        numFile += 1
        header = ""
        with open(str(input_dir)+"\\"+i, 'r') as csvfile:
            csvreader = csv.reader(csvfile)
            lineCount = 0
            for line in csvreader:
                if lineCount == 0: header = line[0].split("/")[1]
                elif line and line[0] == "Timestamp":
                    if len(line[3].split(" ")) > 1: header=header+" "+line[3].split(" ")[1]
                    else: header=header+" (%)"
                    break
                lineCount+=1
        csvindex = rows[0].index(header) # The column to put these values in
        subRows = []
        with open(str(input_dir)+"\\"+i, 'r') as csvfile:
            print("["+str(numFile)+"/"+str(len(os.listdir(input_dir)))+"] Reading "+csvfile.name+"...")
            csvreader = csv.reader(csvfile)
            # extract data
            for subRow in csvreader:
                subRows.append(subRow)
            rowindex = 1
            dataStartIndex = 0
            while not subRows[dataStartIndex] or not subRows[dataStartIndex][0] == "Timestamp":
                dataStartIndex += 1
            dataStartIndex += 1
            for subRow in subRows[dataStartIndex:]:
                # Calculate time and value, converting the timestamp to a float so it can be sorted
                time = datetime.timestamp(datetime.strptime(str(subRow[0]).replace("Jan","01").replace("Feb","02").replace("Mar","03").replace("Apr","04").replace("May","05").replace("Jun","06").replace("Jul","07").replace("Aug","08").replace("Sep","09").replace("Oct","10").replace("Nov","11").replace("Dec","12").replace("PST","UTC-0800").replace("PDT","UTC-0700"), "%d-%m-%y %I:%M:%S %p %Z%z"))
                value = subRow[3]
                if value == "Occupied" or value == "After Hours":
                    value = "true"
                elif value == "Unoccupied" or value == "Normal Hours":
                    value = "false"
                else:
                    value = str(subRow[3]).split(" ")[0]
                # Parse through the output and insert values
                while rowindex < len(rows) and float(rows[rowindex][0]) < time:
                    rowindex += 1
                # Insert a new empty row if necessary
                if rowindex == len(rows) or rows[rowindex][0] > time:
                    rows.insert(rowindex, ['']*(len(rows[0])))
                # Insert time, timestamp and value
                rows[rowindex][0] = time
                rows[rowindex][csvindex] = value
        # Change time back into a timestamp
    for row in rows[1:]:
        # Format it back to the Timestamps in the input files
        strtime = datetime.strftime(datetime.fromtimestamp(int(row[0])), "%d-%m-%y %I:%M:%S %p PDT")
        if(strtime[strtime.index(':')-2] == "0"):
            strtime = strtime[:strtime.index(':')-2]+strtime[strtime.index(':')-1:]
        row[0] = strtime[:strtime.index('-')+1]+strtime[strtime.index('-')+1:strtime[strtime.index('-')+1:].index('-')+strtime.index('-')+1].replace("01","Jan").replace("02","Feb").replace("03","Mar").replace("04","Apr").replace("05","May").replace("06","Jun").replace("07","Jul").replace("08","Aug").replace("09","Sep").replace("10","Oct").replace("11","Nov").replace("12","Dec")+strtime[strtime[strtime.index('-')+1:].index('-')+strtime.index('-')+1:]
    return rows

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
    print("What would you like to do?")
    print('''\t(1) Import new .csv files from Outlook Desktop\n\t(2) Compile .csv files in csv_input/\n\t(3) Both (1) and (2)''')
    choice = input("Choice: ")
    if(choice == "1" or choice.lower() == "import" or choice == "3" or choice.lower() == "both"):
        print("Please specify an email address:")
        email = input()
        print("What folder in the inbox should be checked? Leave blank for entire inbox (not recommended):")
        folder = input()
        import_from_outlook(email, folder)
        print("Import successful!")
    if(choice == "2" or choice.lower() == "compile" or choice == "3" or choice.lower() == "both"):
        table = compile_input()
        generate_csv(table, Path.cwd() / "JACE_data_utility/csv_output/data.csv")
        # generate_db(table, "database_output/data.db")
        print("Compilation successful!")

if __name__=="__main__":
    main()