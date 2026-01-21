import { format } from 'date-fns';

/**
 * Create line chart configuration for tasks per day
 * @param {Object} tasksPerDay - Object with date strings as keys and task counts as values
 * @returns {Object} Chart.js configuration object
 */
export const createTasksPerDayChartData = (tasksPerDay) => {
  if (!tasksPerDay) return null;

  // Generate all 14 days (7 days ago to 7 days from now)
  const allDates = [];
  const now = new Date();
  
  for (let i = -7; i <= 7; i++) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    allDates.push(dateStr);
  }

  return {
    labels: allDates.map(date => {
      const d = new Date(date);
      return format(new Date(d), 'dd/MM');
    }),
    datasets: [
      {
        label: 'Lavori Iniziati',
        data: allDates.map(date => tasksPerDay[date] || 0),
        borderColor: 'rgb(30, 58, 138)',
        backgroundColor: 'rgba(30, 58, 138, 0.1)',
        tension: 0.4,
      },
    ],
  };
};

/**
 * Chart options for line charts
 */
export const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: {
          size: 10
        }
      }
    },
    title: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
        font: {
          size: 10
        }
      },
    },
    x: {
      ticks: {
        font: {
          size: 10
        }
      }
    }
  },
};

/**
 * Chart options for pie charts
 */
export const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 10,
        usePointStyle: true,
        font: {
          size: 10
        }
      },
    },
  },
};
