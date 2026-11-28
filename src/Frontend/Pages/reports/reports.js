// import '../../main.js';

import { getById, getFromBackend } from '../../main.js';

/*For Today's Consumed vs. Burned Calories */
const label_for_Today = ["Today's Consumed","Burned Calories"];
const data_for_today = [2000, 500];
/*Daily Burned Calories */
const label_for_Days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const data_for_Burned_Calories = [330,567,190,622,98,492,349];
/*For the Steps */
const data_steps =[30,70]
/*For Weight Change Over Time*/
const weightLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
const weightData = [82, 81.2, 80.5, 79.8, 79];




Chart.defaults.font.family = "'Helvetica Neue', 'Arial', sans-serif";

// chart text and grid colors that follow the theme (dark / light)
function applyChartTheme(charts = []) {
    const isDark = document.body.classList.contains("darkmode");
    const text = isDark ? "#ffffff" : "#000000";
    const grid = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)";

    Chart.defaults.color = text;
    Chart.defaults.borderColor = grid;

    for (const chart of charts) {
        for (const scale of Object.values(chart.options.scales || {})) {
            scale.ticks.color = text;
            scale.grid.color = grid;
        }
        chart.update();
    }
}
applyChartTheme();


/*Chart for Today's Consumed vs. Burned Calories */
const TodayChart = new Chart('todayCaloriesCanvas',{
    type: 'bar',
    data: {
        labels: label_for_Today,
        datasets: [{
            data: data_for_today,
            backgroundColor: ['#ff7722', 'green'], 
            borderWidth: 0

        }]
    },
    options: {
        datasets:{
            bar:{
                borderRadius:10
            }
        },
        indexAxis: 'y',
        responsive: true,
        scales: {
            x: {
                beginAtZero: true 
            },
            y:{
                grid:{
                    display:false
                }
            }
        },
        plugins: {
            legend: { display: false }
            
        }
    }
});

/*chart for Daily Burned Calories*/

const Burned_Calories_Chart = new Chart('dailyBurnedCanvas',{
    type: 'bar',
    data: {
    labels: label_for_Days,
    datasets:[{
        data: data_for_Burned_Calories,
        backgroundColor: ['#ff7722']
    }]
    },
    options:{
        datasets:{
            bar:{
                borderRadius:10
            }
        },
        scales:{
            x:{
                grid:{
                    display:false
                }
            }
        },
        plugins: {
            legend: { display: false }
        }
    }
});


const Steps_Chart = new Chart('stepsCanvas',{
    type: 'doughnut',
  data: {
    datasets: [{ 
      data: data_steps, 
      backgroundColor: ['#ff7722', '#f7d7c4'],
      borderWidth: 0,
      borderRadius: [50, 50], 
      cutout: '65%'
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    }
  }
});

const Weight_Chart = new Chart('weightCanvas', {
  type: 'line',
  data: {
    labels: weightLabels, 
    datasets: [{
      label: 'Weight (kg)',
      data: weightData,
      borderColor: '#ff7722', 
      backgroundColor: 'rgba(255, 119, 34, 0.15)',
      borderWidth: 3, 
      fill: true, 
      pointBackgroundColor: '#ffffff', 
      pointBorderColor: '#ff7722',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio:false,
    plugins: {
      legend: { display: false } 
    },
    scales: {
      y: {
        beginAtZero: false, 
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  }
});


// redraw the charts when the theme is switched
new MutationObserver(() => {
    applyChartTheme([TodayChart, Burned_Calories_Chart, Steps_Chart, Weight_Chart]);
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });

// ! reports page data (from the backend)
 

const REPORTS_API = "../../../Backend/Reports/[reports.php]"; //! [Backend]

//! get the report of the logged-in user from the backend
async function fetchReportData(range) {
    let query = `range=${range}`;

    // the custom period needs both dates, wait until they are chosen
    if (range === "custom") {
        const from = getById("fromDate").value;
        const to = getById("toDate").value;

        if (!from || !to) {
            return null;
        }

        query += `&from=${from}&to=${to}`;
    }

    //! getFromBackend() is in main.js
    return getFromBackend(`${REPORTS_API}?${query}`);

}
 
// ////////////////////////////
 
//! to fill the charts
function renderCharts(data) {
    const today = data.today || {};
    const steps = data.steps || {};
    const daily = data.daily || [];
 
    // today's consumed vs burned
    TodayChart.data.datasets[0].data = [today.consumed || 0, today.burned || 0];
    TodayChart.update();
 
    // daily burned calories
    Burned_Calories_Chart.data.labels = daily.map(day => day.date);
    Burned_Calories_Chart.data.datasets[0].data = daily.map(day => day.burned);
    Burned_Calories_Chart.update();
 
    // steps (done part and the remaining part of the goal)
    const doneSteps = steps.today || 0;
    const goalSteps = steps.goal || 0;
    Steps_Chart.data.datasets[0].data = [doneSteps, Math.max(goalSteps - doneSteps, 0)];
    Steps_Chart.update();
 
    // weight
    Weight_Chart.data.labels = daily.map(day => day.date);
    Weight_Chart.data.datasets[0].data = daily.map(day => day.weight);
    Weight_Chart.update();
}
 
//! to fill the records table
function renderTable(daily = []) {
    const tbody = getById("reportsTableBody");
 
    tbody.innerHTML = "";
 
    // no records
    if (daily.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
 
        cell.colSpan = 5;
        cell.textContent = "No records for this period";
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }
 
    for (const day of daily) {
        const row = document.createElement("tr");
 
        for (const text of [day.date, day.weight, day.consumed, day.burned, day.steps]) {
            const cell = document.createElement("td");
            cell.textContent = text;
            row.appendChild(cell);
        }
 
        tbody.appendChild(row);
    }
}
 

// ////////////////////////////
 

//! to fill the current status card (weight, height, BMI, SMM, PBF, BFM)
function renderStatus(status = {}) {
    const values = {
        statusWeight: status.weight,
        statusHeight: status.height,
        statusBmi: status.bmi,
        statusSmm: status.smm,
        statusPbf: status.pbf,
        statusBfm: status.bfm,
    };

    for (const [id, value] of Object.entries(values)) {
        // "--" if there is no value
        getById(id).textContent = (value === undefined || value === null) ? "--" : value;
    }
}

// ////////////////////////////


async function loadReport() {
    try {
        const data = await fetchReportData(getById("timeframeSelect").value);
 
        // go back to the login page
        if (!data) {
            return;
        }

        renderStatus(data.status);

        renderCharts(data);
        renderTable(data.daily);
    } catch (error) {
        // the backend is not ready or failed, so the page stay as it is
        console.warn("Could not load the reports data:", error);
    }
}
 
// load again when the timeframe is changed

getById("timeframeSelect").addEventListener("change", loadReport);

getById("timeframeSelect").addEventListener("change", () => {
    // show the dates only for the custom period
    getById("customRange").hidden = getById("timeframeSelect").value !== "custom";
    loadReport();
});
getById("fromDate").addEventListener("change", loadReport);
getById("toDate").addEventListener("change", loadReport);

 
loadReport();

