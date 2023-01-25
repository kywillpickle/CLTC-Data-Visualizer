/* CLTC-Data-Visualizer
   by Kyle Pickle, 1/25/2022
   Created for the CLTC and Frontier Energy project at the AEC

   graphify.js
   A js script inplemented by the front-end html pages to pull data from data.csv
   in csv_output/ and display it using the google charts API
   using settings laid out on the html */

   var arrayData = [];    // The 2D array containing the entire .csv's data
   var pageIndex = 1;     // An integer storing the current index to display the data from
   var dispArr = [];      // A subset of arrayData containg what to display on the table / chart
   var dataRange = [];    // The start and end index of the initial chart
   var stats = [];        // An array containing the maxes of each arrayData column for chart comparisons
   var chartOptions = {}; // A JSON containing the current Google Chart Options
   var numAxes = 0;       // An int keeping track the number of axes on the graph
   
   const HOUR_LENGTH = 3600;             // Length of an hour in seconds (for comparing UTC timestamps)
   const DAY_LENGTH = 24*HOUR_LENGTH;    // Length of a day in seconds
   const WEEK_LENGTH = 7*DAY_LENGTH;     // Length of a week in seconds
   const TIMEZONE_SHIFT = 7*HOUR_LENGTH; // The difference between our time and UTC time (7 hours)
   const UTC_DAY_SHIFT = 3*DAY_LENGTH;   // UTC Time starts on a Thursday, but our week starts on Sunday
   
   const Days = Object.freeze({ // "Enumerator" for selecting the day of the week
      SUN:   0,
      MON:   1,
      TUES:  2,
      WED:   3,
      THURS: 4,
      FRI:   5,
      SAT:   6
   })
   
   /**
    * Iterative binary search runction.
    * 
    * @param {Array<Array>} arr The array to search.
    * @param {number} x The time to search for.
    * @return {number} the index of x, or where it should be inserted.
   */
   function locate(arr, x) {
       let start=1, end=arr.length-1;
       while (start<=end){
           let mid=Math.floor((start + end)/2);
            if (arr[mid][0].v < x)
                start = mid + 1;
           else
                end = mid - 1;
       }
       return start;
   }
   
   /**
    * Loads the data stored in `/csv_output/data.csv`.
    * 
    * @param {Function} funct The function to call after loading.
   */
   async function loadData(funct=drawFromRange, csvString="") {
      document.getElementById("alert_div").innerHTML = "Parsing csv...";
      await new Promise(f => setTimeout(f, 0));
      // Open the data.csv file
      arrayData = $.csv.toArrays(csvString, {onParseValue: $.csv.hooks.castToScalar});
      // Add the headers, and initiate max array with 0s
      let row = ["Timestamp"];
      indexselectstr = "";
      stats = [];
      for(var i = 2; i < arrayData[0].length; i++) {
         row.push(arrayData[0][i]);
         stats.push({mean: 0, max: 0, sum:0, f: "", c: 0});
         indexselectstr += "<option value=\""+(i-1)+"\">"+row[i-1]+"</option>";
      }
      arrayData[0]=row;
      // Add the header options to the index selection dropdown
      document.getElementById("index-select").innerHTML = indexselectstr;
      // Add the data
      for(var i = 1; i < arrayData.length; i++) {
         let row = [{v: arrayData[i][0], f: arrayData[i][1]}];
         for(var j = 2; j < arrayData[i].length; j++) {
            // Assign both values and formatted values for each datapoint
            // This shows units, and doesn't change the shown value when comparing
            if(arrayData[i][j] == null) row.push(null);
            else if(arrayData[0][j-1] == "roomOccupancy" || arrayData[0][j-1] == "afterHours") {
               if(arrayData[i][j] == "true") row.push({v: 1, f: "true"});
               else if(arrayData[i][j] == "false") row.push({v: 0, f: "false"});
               else row.push(null);
            }
            else if(arrayData[0][j-1] == "Load1_level" || arrayData[0][j-1] == "Load2_level" || arrayData[0][j-1] == "Load3_level") row.push({v: arrayData[i][j], f: arrayData[i][j]+" %"})
            else if(arrayData[0][j-1] == "Light_current" || arrayData[0][j-1] == "Tube_current") row.push({v: arrayData[i][j], f: arrayData[i][j]+" A"})
            else if(arrayData[0][j-1] == "levelIn" || arrayData[0][j-1] == "LMLS-600dimmingSetpoint" || arrayData[0][j-1] == "LMLSdown" || arrayData[0][j-1] == "LMLSup") row.push({v: arrayData[i][j], f: arrayData[i][j]+" ftcd"})
            else if(arrayData[0][j-1] == "UPTIME") row.push({v: arrayData[i][j], f: arrayData[i][j]+" h"})
            else row.push(arrayData[i][j]);
            // Add to stats
            if(row[j-1] != null) {stats[j-2] = {mean:stats[j-2].mean, max:Math.max(stats[j-2].max,row[j-1].v), sum:stats[j-2].sum+row[j-1].v, f:row[j-1].f, c:stats[j-2].c+1};}
         }
         arrayData[i] = row;
         document.getElementById("alert_div").innerHTML = "";
      }
      // Calculate stats
      for(var i = 0; i < stats.length; i++) {
         if(arrayData[0][i+1] == "roomOccupancy" || arrayData[0][i+1] == "afterHours") stats[i] = {mean:Number((stats[i].sum/stats[i].c).toFixed(3)), sum:Number(stats[i].sum.toFixed(3)), f:"%", c:stats[i].c}
         else stats[i] = {mean:Number((stats[i].sum/stats[i].c).toFixed(3)), max:stats[i].max, sum:Number(stats[i].sum.toFixed(3)), f:stats[i].f.split(" ")[1], c:stats[i].c}
      }
      // Set the dropdown range
      document.getElementById("from-date").value = new Date((arrayData[1][0].v-TIMEZONE_SHIFT)*1000).toISOString().substring(0,10);
      document.getElementById("from-time").value = new Date((arrayData[1][0].v-TIMEZONE_SHIFT)*1000).toISOString().substring(11,16);
      document.getElementById("to-date").value = new Date((arrayData[arrayData.length-1][0].v-TIMEZONE_SHIFT)*1000).toISOString().substring(0,10);
      document.getElementById("to-time").value = new Date((arrayData[arrayData.length-1][0].v-TIMEZONE_SHIFT)*1000).toISOString().substring(11,16);
      // Run the specified function
      await funct();
   }
   
   /**
    * Updates the page when switching indices
    * 
    * @param {number} index The index (col) of data to switch to.
   */
   async function changePage(index=1, ignorewarn=false) {
      if(ignorewarn || window.confirm("This will reset the display. Are you sure?")) {
         pageIndex = index;
         // Systematically generate a header based on the loaded .csv data
         htmlstr = "<table style=\"width: 100%; height: 100%\"><tr>";
         for (var i = 1; i < arrayData[0].length; i++) {
            // Create a header with a link to each variables interface
            if (i == pageIndex) htmlstr+= "<td style=\"padding-left: 5px; padding-right: 5px\"><button class=\"btn btn-secondary\" style=\"width: 100%; font-size: 18px;\" onclick=\"changePage("+i+");\">" + arrayData[0][i] + "</button></a></td>";
            else htmlstr+= "<td style=\"padding-left: 5px; padding-right: 5px\"><button class=\"btn btn-primary\" style=\"width: 100%; font-size: 18px;\" onclick=\"changePage("+i+");\">" + arrayData[0][i] + "</button></a></td>";
         }
         htmlstr += "</tr></table>";
         document.getElementById("nav").innerHTML = htmlstr;
         document.getElementById("index-select").value = pageIndex.toString();
         await drawFromRange();
      }
   }
   
   /**
    * Clears the charts and draws a new set of data.
    * 
    * @param {number} index The index (col) of data to draw.
   */
   async function drawFromRange(index=pageIndex) {
      document.getElementById("alert_div").innerHTML = "Loading display data...";
      await new Promise(f => setTimeout(f, 0));
      // Create the bounds from date-time inputs
      let lower = locate(arrayData, parseInt(new Date(document.getElementById("from-date").value+"T"+document.getElementById("from-time").value).getTime())/1000)
      let startIndex = lower;
      let upper = locate(arrayData, parseInt(new Date(document.getElementById("to-date").value+"T"+document.getElementById("to-time").value).getTime())/1000)
      let firstVal = lower;
      let lastVal = upper;
      while(firstVal < upper) {
         if(arrayData[firstVal][index] != null) {
            break;
         }
         firstVal++;
      }
      while(lastVal > lower) {
         if(arrayData[lastVal-1][index] != null) {
            break;
         }
         lastVal--;
      }
      // Reset the Display Array
      for(var i = 0 ; i < stats.length; i++) {
         stats[i] = {mean: 0, max:0, sum:0, f: stats[i].f, c: 0};
      }
      // Repopulate the Display Array
      colEmpty = true;
      if(document.getElementById("wrap-setting").value == "normal") {
         // Do not wrap data
         dispArr = [[arrayData[0][0], arrayData[0][index]]];
         for(var i = lower; i < upper; i++) {
            if(arrayData[i][index] != null) {
               dispArr.push(new Array(arrayData[i][0]));
               dispArr[dispArr.length-1].push(arrayData[i][index]);
               colEmpty = false;
               // Update stats
               stats[pageIndex-1].max = Math.max(stats[pageIndex-1].max, arrayData[i][index].v);
               stats[pageIndex-1].sum += arrayData[i][index].v;
               stats[pageIndex-1].c += 1;
            }
         }
      }
      else if(document.getElementById("wrap-setting").value == "daily") {
         // Cut range to only contain non-empty blocks
         lower = Math.max(lower, locate(arrayData, Math.floor((arrayData[firstVal][0].v-TIMEZONE_SHIFT)/DAY_LENGTH)*DAY_LENGTH+TIMEZONE_SHIFT));
         upper = Math.min(upper, locate(arrayData, Math.ceil((arrayData[lastVal-1][0].v-TIMEZONE_SHIFT)/DAY_LENGTH)*DAY_LENGTH+TIMEZONE_SHIFT));
         // Wrap the data daily
         dispArr = [[arrayData[0][0], arrayData[lower][0].f.substring(0,10)]];
         for(var i = lower; i < Math.min(locate(arrayData, (Math.ceil((arrayData[lower][0].v-TIMEZONE_SHIFT+1)/DAY_LENGTH))*DAY_LENGTH+TIMEZONE_SHIFT-1), upper); i++) {
            if(arrayData[i][index] != null) {
               dispArr.push(new Array({v:(arrayData[i][0].v-TIMEZONE_SHIFT)%DAY_LENGTH, f:new Date(arrayData[i][0].v*1000).toLocaleTimeString('en-US')}));
               dispArr[dispArr.length-1].push(arrayData[i][index]);
               colEmpty = false;
               // Update stats
               stats[pageIndex-1].max = Math.max(stats[pageIndex-1].max, arrayData[i][index].v);
               stats[pageIndex-1].sum += arrayData[i][index].v;
               stats[pageIndex-1].c += 1;
            }
         }
      }
      else if(document.getElementById("wrap-setting").value == "weekly") {
         // Cut range to only contain non-empty blocks
         lower = Math.max(lower, locate(arrayData, Math.floor((arrayData[firstVal][0].v-TIMEZONE_SHIFT-UTC_DAY_SHIFT)/WEEK_LENGTH)*WEEK_LENGTH+TIMEZONE_SHIFT+UTC_DAY_SHIFT));
         upper = Math.min(upper, locate(arrayData, Math.ceil((arrayData[lastVal-1][0].v-TIMEZONE_SHIFT-UTC_DAY_SHIFT)/WEEK_LENGTH)*WEEK_LENGTH+TIMEZONE_SHIFT+UTC_DAY_SHIFT));
         // Wrap the data weekly
         dispArr = [[arrayData[0][0], arrayData[lower][0].f.substring(0,10)]];
         for(var i = lower; i < Math.min(locate(arrayData, (Math.ceil((arrayData[lower][0].v-TIMEZONE_SHIFT+1-UTC_DAY_SHIFT)/WEEK_LENGTH))*WEEK_LENGTH+TIMEZONE_SHIFT-1+UTC_DAY_SHIFT), upper); i++) {
            switch(Math.floor(((arrayData[i][0].v-TIMEZONE_SHIFT-UTC_DAY_SHIFT)%WEEK_LENGTH)/DAY_LENGTH)) {
               case Days.SUN:
                  datestr = "Sunday";
                  break;
               case Days.MON:
                  datestr = "Monday";
                  break;
               case Days.TUES:
                  datestr = "Tuesday";
                  break;
               case Days.WED:
                  datestr = "Wednesday";
                  break;
               case Days.THURS:
                  datestr = "Thursday";
                  break;
               case Days.FRI:
                  datestr = "Friday";
                  break;
               case Days.SAT:
                  datestr = "Saturday";
                  break;
            }
            if(arrayData[i][index] != null) {
               dispArr.push(new Array({v:(arrayData[i][0].v-TIMEZONE_SHIFT-UTC_DAY_SHIFT)%WEEK_LENGTH, f:datestr+" "+new Date(arrayData[i][0].v*1000).toLocaleTimeString('en-US')}));
               dispArr[dispArr.length-1].push(arrayData[i][index]);
               colEmpty = false;
               // Update stats
               stats[pageIndex-1].max = Math.max(stats[pageIndex-1].max, arrayData[i][index].v);
               stats[pageIndex-1].sum += arrayData[i][index].v;
               stats[pageIndex-1].c += 1;
            }
         }
      }
      if(colEmpty) {
         for(var i = 0; i < dispArr.length; i++) {
            dispArr[i].pop();
         }
      }
      // Calculate Stats
      stats[pageIndex-1].mean = Number((stats[pageIndex-1].sum/stats[pageIndex-1].c).toFixed(3))
      htmlstr = "mean: " + stats[index-1].mean + " " + stats[index-1].f + "<br>" + "# datapoints: " + stats[index-1].c + "<br>";
      document.getElementById("stats_text").innerHTML = htmlstr;
      // Save the range for future comparison
      dataRange = [lower, upper];
      // Set the steps for the x-axis (time)
      if(document.getElementById("wrap-setting").value == "normal") {
         // Add a step for each day
         var steps = [{v: dispArr[1][0].v, f: dispArr[1][0].f.substring(0,10)}];
         for(var i = 1; i < dispArr.length; i++) {
            if (dispArr[i][0].v-DAY_LENGTH > steps[steps.length-1].v) {
               steps.push({v: dispArr[i][0].v, f: dispArr[i][0].f.substring(0,10)});
            }
         }
         lower = upper;
      }
      else if(document.getElementById("wrap-setting").value == "daily") {
         // Add a step for every 2 hours
         var steps = [{v:              0, f: '12:00 AM'},
                      {v:  2*HOUR_LENGTH, f:  '2:00 AM'},
                      {v:  4*HOUR_LENGTH, f:  '4:00 AM'},
                      {v:  6*HOUR_LENGTH, f:  '6:00 AM'},
                      {v:  8*HOUR_LENGTH, f:  '8:00 AM'},
                      {v: 10*HOUR_LENGTH, f: '10:00 AM'},
                      {v: 12*HOUR_LENGTH, f: '12:00 PM'},
                      {v: 14*HOUR_LENGTH, f:  '2:00 PM'},
                      {v: 16*HOUR_LENGTH, f:  '4:00 PM'},
                      {v: 18*HOUR_LENGTH, f:  '6:00 PM'},
                      {v: 20*HOUR_LENGTH, f:  '8:00 PM'},
                      {v: 22*HOUR_LENGTH, f: '10:00 PM'},
                      {v:     DAY_LENGTH, f: '12:00 AM'}];
         lower = Math.min(locate(arrayData, (Math.ceil((arrayData[lower][0].v-TIMEZONE_SHIFT+1)/DAY_LENGTH))*DAY_LENGTH+TIMEZONE_SHIFT-1), upper);
      }
      else if(document.getElementById("wrap-setting").value == "weekly") {
         // Add a step for every day of the week
         var steps = [{v:               0, f:          ''},
                      {v:  1/2*DAY_LENGTH, f:    'Sunday'},
                      {v:      DAY_LENGTH, f:          ''},
                      {v:  3/2*DAY_LENGTH, f:    'Monday'},
                      {v:    2*DAY_LENGTH, f:          ''},
                      {v:  5/2*DAY_LENGTH, f:   'Tuesday'},
                      {v:    3*DAY_LENGTH, f:          ''},
                      {v:  7/2*DAY_LENGTH, f: 'Wednesday'},
                      {v:    4*DAY_LENGTH, f:          ''},
                      {v:  9/2*DAY_LENGTH, f:  'Thursday'},
                      {v:    5*DAY_LENGTH, f:          ''},
                      {v: 11/2*DAY_LENGTH, f:    'Friday'},
                      {v:    6*DAY_LENGTH, f:          ''},
                      {v: 13/2*DAY_LENGTH, f:  'Saturday'},
                      {v:     WEEK_LENGTH, f:          ''}];
         lower = Math.min(locate(arrayData, (Math.ceil((arrayData[lower][0].v-TIMEZONE_SHIFT+1-UTC_DAY_SHIFT)/WEEK_LENGTH))*WEEK_LENGTH+TIMEZONE_SHIFT-1+UTC_DAY_SHIFT), upper);
      }
      // Set up chart options
      chartOptions = {
         title: document.getElementById("chart-title").value,
         titleTextStyle: {
            fontName: 'Abel',
            fontSize: 30,
            bold: true
         },
         tooltip: {textStyle:  {fontName: 'Abel',fontSize: 18}},
         width: '100%',
         legend: 'none',
         crosshair: { trigger: 'both' },
         explorer: { 
            actions: ['dragToZoom', 'rightClickToReset'],
            axis: 'horizontal',
            keepInBounds: true,
         maxZoomIn: 0},
         hAxis: {
            title: "Time (days)",
            titleTextStyle: {
               fontName: 'Abel',
               italic: false,
               fontSize: 20
            },
            ticks: steps,
            textStyle: {
               fontName: 'Abel',
               italic: false,
               fontSize: 16
            }
          },
          series: {
            0: {
                type: 'area',
                targetAxisIndex: 0
            }
         },
         vAxis: {
            maxValue: stats[pageIndex-1].max*1.05,
            titleTextStyle: {
               fontName: 'Abel',
               italic: false,
               fontSize: 20
            },
            textStyle: {
               fontName: 'Abel',
               italic: false,
               fontSize: 16
            }
         },
         vAxes: {
            0: {
               maxValue: stats[pageIndex-1].max*1.05,
               title: arrayData[0][pageIndex] + " (" + stats[pageIndex-1].f + ")",
               titleTextStyle: {
                  italic: false
               }
            }
         },
         interpolateNulls: true
      };
      // Reset number of axes
      numAxes = 1;
      if(lower < upper) {
         // Data is wrapped and incomplete; need to add next set
         await addFromRange(
            index = pageIndex,
            startIndex = startIndex,
            lower = lower,
            upper = upper
         );
      }
      else await drawCharts();
      document.getElementById("alert_div").innerHTML = "";
   }
   
   /**
    * Adds a new column of data to the charts.
    * 
    * @param {number} index The index (col) of data to add.
    * @param {number} lower The lower bound (row) of data to add.
    * @param {number} upper The upper bound (row) of data to add.
    * @param {number} block Which block of data to add. (nth day, week, etc.)
   */
   async function addFromRange(
         index = document.getElementById("index-select").value,
         startIndex = 1,
         lower = locate(arrayData, parseInt(new Date(document.getElementById("from-date").value+"T"+document.getElementById("from-time").value).getTime())/1000),
         upper = locate(arrayData, parseInt(new Date(document.getElementById("to-date").value+"T"+document.getElementById("to-time").value).getTime())/1000),
         block = 1
         ) {
      console.log(startIndex)
      document.getElementById("alert_div").innerHTML = "Loading display data...";
      await new Promise(f => setTimeout(f, 0));
      // Grab the bounds from date-time inputs
      if(document.getElementById("wrap-setting").value == "daily") {
         dispArr[0].push(arrayData[lower][0].f.substring(0,10));
         // Offset the data to the start of the wrap
         timediff = Math.floor(((arrayData[startIndex][0].v-arrayData[startIndex][0].v%DAY_LENGTH-TIMEZONE_SHIFT)/DAY_LENGTH))*DAY_LENGTH+TIMEZONE_SHIFT+block*DAY_LENGTH;
         timebound = DAY_LENGTH;
      }
      else if(document.getElementById("wrap-setting").value == "weekly") {
         dispArr[0].push(arrayData[lower][0].f.substring(0,10));
         // Offset the data to the start of the wrap
         timediff = Math.floor(((arrayData[startIndex][0].v-arrayData[startIndex][0].v%WEEK_LENGTH-TIMEZONE_SHIFT-UTC_DAY_SHIFT)/WEEK_LENGTH))*WEEK_LENGTH+UTC_DAY_SHIFT+TIMEZONE_SHIFT+block*WEEK_LENGTH;
         timebound = WEEK_LENGTH;
      }
      else {
         dispArr[0].push(arrayData[0][index]);
         // Offset the data to start when the first data range starts
         timediff = 0;
         timebound = arrayData[arrayData.length-1][0].v+1;
      }
      // Merge the new data into the current Display Array
      combinedArr = [dispArr[0]];
      let i = 1;
      lower = Math.max(lower, dataRange[0]);
      colEmpty = true;
      while((i < dispArr.length && (dispArr[i][0].v < timebound)) || (lower < upper && (arrayData[lower][0].v-timediff < timebound))) {
         if((lower >= upper && i < dispArr.length) || (i < dispArr.length && dispArr[i][0].v < arrayData[lower][0].v-timediff)) {
            // Insert from current Display Array with null value and catch up
            combinedArr.push(dispArr[i]);
            combinedArr[combinedArr.length-1].push(null);
            i++;
         }
         else if(i < dispArr.length && dispArr[i][0].v == arrayData[lower][0].v-timediff) {
            // Merge Display Array and adjusted arrayData values and catch up
            combinedArr.push(dispArr[i]);
            if(arrayData[lower][index] == null) combinedArr[combinedArr.length-1].push(null);
            else {
               colEmpty = false;
               combinedArr[combinedArr.length-1].push({v: arrayData[lower][index].v, f: arrayData[lower][index].f});
               stats[pageIndex-1].max = Math.max(stats[pageIndex-1].max, arrayData[lower][index].v);
               stats[index-1].sum += arrayData[lower][index].v;
               stats[index-1].c += 1;
            }
            i++;
            lower++;
         }
         else {
            if(arrayData[lower][index] == null) {
               lower++;
               continue;
            }
            colEmpty = false;
            // Insert from arrayData with null values and catch up
            combinedArr.push([]);
            if(document.getElementById("wrap-setting").value == "daily") {
               // Wrap the new data daily
               combinedArr[combinedArr.length-1].push({v: arrayData[lower][0].v-timediff, f:new Date(arrayData[lower][0].v*1000).toLocaleTimeString('en-US')});
            }
            else if(document.getElementById("wrap-setting").value == "weekly") {
               // Wrap the new data weekly
               datestr = "";
               switch(Math.floor(((arrayData[lower][0].v-TIMEZONE_SHIFT-UTC_DAY_SHIFT)%WEEK_LENGTH)/DAY_LENGTH)) {
                  case Days.SUN:
                     datestr = "Sunday";
                     break;
                  case Days.MON:
                     datestr = "Monday";
                     break;
                  case Days.TUES:
                     datestr = "Tuesday";
                     break;
                  case Days.WED:
                     datestr = "Wednesday";
                     break;
                  case Days.THURS:
                     datestr = "Thursday";
                     break;
                  case Days.FRI:
                     datestr = "Friday";
                     break;
                  case Days.SAT:
                     datestr = "Saturday";
                     break;
               }
               combinedArr[combinedArr.length-1].push({v: arrayData[lower][0].v-timediff, f:datestr+" "+new Date(arrayData[lower][0].v*1000).toLocaleTimeString('en-US')});
            }
            else {
               // Do not wrap the new data
               combinedArr[combinedArr.length-1].push({v: arrayData[lower][0].v-timediff, f: arrayData[lower][0].f});
            }
            // Set all previous values to null and insert new value at index
            for(var j = 1; j < dispArr[0].length-1; j++) {combinedArr[combinedArr.length-1].push(null);}
            combinedArr[combinedArr.length-1].push(arrayData[lower][index]);
            if(arrayData[lower][index] != null) {
               // Update stats
               stats[pageIndex-1].max = Math.max(stats[pageIndex-1].max, arrayData[lower][index].v);
               stats[index-1].sum += arrayData[lower][index].v;
               stats[index-1].c += 1;
            }
            lower++;
         }
      }
      // Clean up Column if Empty
      if(colEmpty) {
         for(var j = 0; j < combinedArr.length; j++) {
            combinedArr[j].pop();
         }
      }
      // Calculate Stats
      for(var j = 0; j < stats.length; j++) stats[j].mean = Number((stats[j].sum/stats[j].c).toFixed(3))
      htmlstr = "mean: " + stats[index-1].mean + " " + stats[index-1].f + "<br>" + "# datapoints: " + stats[index-1].c + "<br>";
      document.getElementById("stats_text").innerHTML = htmlstr;
      // Set new Display Array
      dispArr = combinedArr;
      // Add Chart Options
      if(block != 1) { // Wrapped chart options
            chartOptions["series"][dispArr[0].length-2] = {
            type: 'area',
            targetAxisIndex: numAxes-1
         }
         chartOptions["vAxes"][numAxes-1]["maxValue"] = stats[pageIndex-1].max*1.05;
      }
      else  { // Unwrapped chart options
         if(stats[pageIndex-1].f != stats[index-1].f && !document.getElementById("avg-setting").checked) {
            if(numAxes-1 > 0) {
               chartOptions["vAxes"][numAxes-1].title = null;
               chartOptions["vAxes"][numAxes-1].textStyle = {color: 'white'};
            }
            chartOptions["series"][dispArr[0].length-2] = {
               type: 'area',
               targetAxisIndex: numAxes
            }
            numAxes++;
            chartOptions["vAxes"][numAxes-1] = {
               maxValue: stats[pageIndex-1].max*1.05,
               title: arrayData[0][index] + " (" + stats[index-1].f + ")",
               titleTextStyle: {
                  italic: false
               }
            }
         }
      }
      if(lower < upper) {
         // Data is wrapped and incomplete; need to add next set
         await addFromRange(
            index = index,
            startIndex = startIndex,
            lower = lower,
            upper = upper,
            block = block+1
         );
      }
      else await drawCharts();
      document.getElementById("alert_div").innerHTML = "";
   }
   
   /**
    * Create a new array of averages from the current display array.
    * 
    * @return {Array<Array>} The created array of averages.
   */
   function average() {
      // // Create new array of averages
      // let avgArr = [["Timestamp"]];
      // for(var i = 1; i < dispArr[0].length; i++) {
      //    found = false;
      //    for(var j = 1; j < avgArr[0].length; j++) {
      //       if(avgArr[0][j] == dispArr[0][i].v) found = true;
      //    }
      //    if(found) continue;
      //    avgArr.push(dispArr[0][i].v);
      // }
      // //  Populate new array with averages
      // for(var i = 1; i < dispArr.length; i++) {
      //    avgArr.push([dispArr[i][0]]);
      //    for(var j = 1; j < avgArr[0].length; j++) {
      //       count = 0;
      //       total = 0;
      //       for(var k = 1; k < dispArr[0].length; k++) {
      //          if(dispArr[i][k] != null && avgArr[0][j] == dispArr[0][k].v) {
      //             // Add to count and total for later calculation
      //             count++;
      //             total += dispArr[i][k].v;
      //          }
      //       }
      //       // Calculate and add average
      //       avgArr[avgArr.length-1].push({v:total/count, f:Math.ceil(total/count * 1000)/1000+" "+stats[pageIndex-1].f})
      //    }
      // }
      // return avgArr;
      
      // Create new array of averages
      let avgArr = [["Timestamp",""]];
      for(var i = 1; i < dispArr[0].length; i++) {
         if(avgArr[0][1] == "") avgArr[0][1] = dispArr[0][i];
         else if(avgArr[0][1] != dispArr[0][i]) avgArr[0][1] = "Average";
      }
      //  Populate new array with averages
      for(var i = 1; i < dispArr.length; i++) {
         avgArr.push([dispArr[i][0]]);
         count = 0;
         total = 0;
         for(var j = 1; j < dispArr[i].length; j++) {
            if(dispArr[i][j] != null) {
               // Add to count and total for later calculation
               count++;
               total += dispArr[i][j].v;
            }
         }
         // Calculate and add average
         avgArr[avgArr.length-1].push({v:total/count, f:Math.ceil(total/count * 1000)/1000+" "+stats[pageIndex-1].f})
      }
      return avgArr;
   }
   
   /**
    * Uploads and imports a .csv file.
    */
   async function importTable() {
      document.getElementById("alert_div").innerHTML = "Importing csv...";
      await new Promise(f => setTimeout(f, 0));
      const reader = new FileReader()
      reader.onload = async function(fileLoadedEvent){
         var textFromFileLoaded = fileLoadedEvent.target.result;
         await loadData(changePage, textFromFileLoaded);
      };
      file = document.getElementById("uploaded_file").files[0];
      console.log(file);
      if(file.type != "application/vnd.ms-excel") {
         alert("File must be a .csv!");
         return;
      }
      reader.readAsText(document.getElementById("uploaded_file").files[0], "UTF-8");
      document.getElementById("alert_div").innerHTML = "";
   }
   
   /**
    * Exports and downloads the current array as a `.csv`.
   */
   async function exportTable() {
      document.getElementById("alert_div").innerHTML = "Exporting csv...";
      await new Promise(f => setTimeout(f, 0));
      // Check if we're exporting an average array or not
      if(document.getElementById("avg-setting").checked) var data = average();
      else var data = dispArr;
      // Create a new csv as a string
      csvstr = data[0][0];
      for(var i = 1; i < data[0].length; i++) {
         csvstr += ","+data[0][i]
      }
      // Populate csv with data
      for(var i = 1; i < data.length; i++) {
         csvstr += "\n"+data[i][0].f;
         for(var j = 1; j < data[i].length; j++) {
            if(data[i][j] == null) csvstr += ",";
            else csvstr += ","+data[i][j].f;
         }
      }
      // Create a new html object to download from
      var link = document.createElement("a");
      // Name the file something useful
      if(data[data.length-1][0].v < DAY_LENGTH) {
         // Data is wrapped daily
         link.download = arrayData[0][pageIndex]+"_daily_"+data[0][1]+"_to_"+data[0][data[0].length-1]+".csv";
      }
      else if(data[data.length-1][0].v < WEEK_LENGTH) {
         // Data is wrapped weekly
         link.download = arrayData[0][pageIndex]+"_weekly_"+data[0][1]+"_to_"+data[0][data[0].length-1]+".csv";
      }
      else {
         // Data is not wrapped
         link.download = arrayData[0][pageIndex]+"_"+new Date(data[1][0].v*1000).toLocaleDateString('en-US')+"_to_"+new Date(data[data.length-1][0].v*1000).toLocaleDateString('en-US')+".csv";
      }
      // Add csv to object and start download
      link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csvstr);
      link.click();
      document.getElementById("alert_div").innerHTML = "";
   }
   
   async function exportGraph() { // TODO: Finish
      document.getElementById("alert_div").innerHTML = "Loading display data...";
      await new Promise(f => setTimeout(f, 0));
      let encoded_svg = btoa(decodeURIComponent(encodeURIComponent(document.querySelector("svg").outerHTML)));
      // Create a new html object to download from
      var link = document.createElement("a");
      // Name the file something useful
      if(dispArr[dispArr.length-1][0].v < DAY_LENGTH) {
         // Data is wrapped daily
         link.download = arrayData[0][pageIndex]+"_daily_"+dispArr[0][1]+"_to_"+dispArr[0][dispArr[0].length-1]+".svg";
      }
      else if(dispArr[dispArr.length-1][0].v < WEEK_LENGTH) {
         // Data is wrapped weekly
         link.download = arrayData[0][pageIndex]+"_weekly_"+dispArr[0][1]+"_to_"+dispArr[0][dispArr[0].length-1]+".svg";
      }
      else {
         // Data is not wrapped
         link.download = arrayData[0][pageIndex]+"_"+new Date(dispArr[1][0].v*1000).toLocaleDateString('en-US')+"_to_"+new Date(dispArr[dispArr.length-1][0].v*1000).toLocaleDateString('en-US')+".svg";
      }
      link.href = 'data:text/html;base64,' + encoded_svg;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      document.getElementById("alert_div").innerHTML = "";
   }
   
   /**
    * Draws current data into the table and area charts.
   */
   async function drawCharts() {
      document.getElementById("alert_div").innerHTML = "Drawing data...";
      await new Promise(f => setTimeout(f, 50));
      // Create a datatable object from Display Array
      // Handle if "Average?" is checked
      if(document.getElementById("avg-setting").checked) var data = new google.visualization.arrayToDataTable(average());
      else var data = new google.visualization.arrayToDataTable(dispArr);
   
      // Create a view from the data
      var view = new google.visualization.DataView(data);
   
      // Create the table object and draw it
      document.getElementById("alert_div").innerHTML = "Drawing table...";
      await new Promise(f => setTimeout(f, 50));
      var table = new google.visualization.Table(document.getElementById('table_div'));
      table.draw(view, chartOptions);
      // Create the chart object and draw it
      document.getElementById("alert_div").innerHTML = "Drawing chart...";
      await new Promise(f => setTimeout(f, 50));
      var lineChart = new google.visualization.LineChart(document.getElementById('chart_div'));
      lineChart.draw(view, chartOptions);
      document.getElementById("alert_div").innerHTML = "";
   }