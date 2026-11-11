import '../../main.js';

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