import React, { useEffect, useMemo } from 'react';
import { useMachineStore, useOrderStore, useUIStore, useMainStore } from '../store';
import { MACHINE_STATUSES } from '../constants';
import StickyHeader from '../components/StickyHeader';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

function HomePage() {
  const { machines } = useMachineStore();
  const { odpOrders: orders } = useOrderStore();
  const { isLoading, isInitialized } = useUIStore();
  const { init, cleanup } = useMainStore();

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
    
    // Cleanup function for component unmount
    return () => {
      cleanup();
    };
  }, [init, isInitialized, cleanup]);

  const metrics = useMemo(() => {
    if (isLoading) return {};

    // Group machines by work center and status
    const machinesByWorkCenter = machines.reduce((acc, machine) => {
      const center = machine.work_center || 'Unknown';
      if (!acc[center]) {
        acc[center] = {
          [MACHINE_STATUSES.ACTIVE]: 0,
          [MACHINE_STATUSES.INACTIVE]: 0,
          [MACHINE_STATUSES.MAINTENANCE]: 0
        };
      }
      acc[center][machine.status] = (acc[center][machine.status] || 0) + 1;
      return acc;
    }, {});

    // Calculate completed tasks this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const completedThisWeek = orders.filter(order => {
      if (!order.completion_date) return false;
      const completionDate = new Date(order.completion_date);
      return completionDate >= startOfWeek;
    }).length;

    // Tasks currently in work in progress
    const tasksInWip = orders.filter(order => 
      order.status === 'IN PROGRESS' || order.status === 'SCHEDULED'
    ).length;

    // Delayed tasks (past delivery_date and not completed)
    const delayedTasks = orders.filter(order => {
      if (!order.delivery_date) return false;
      const dueDate = new Date(order.delivery_date);
      return dueDate < now && (order.quantity_completed || 0) < (order.quantity || 0);
    }).length;

    // Total active machines
    const activeMachines = machines.filter(m => m.status === MACHINE_STATUSES.ACTIVE).length;

    // Tasks per day (start date) for the last 30 days
    const tasksPerDay = {};
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    orders.forEach(order => {
      if (order.scheduled_start_time) {
        const startDate = new Date(order.scheduled_start_time);
        if (startDate >= thirtyDaysAgo) {
          const dateStr = startDate.toISOString().split('T')[0];
          tasksPerDay[dateStr] = (tasksPerDay[dateStr] || 0) + 1;
        }
      }
    });

    // Weekly cost and duration metrics
    const weeklyOrders = orders.filter(order => {
      if (!order.scheduled_start_time) return false;
      const startDate = new Date(order.scheduled_start_time);
      return startDate >= startOfWeek;
    });

    const weeklyCosts = weeklyOrders
      .filter(order => order.cost && order.cost > 0)
      .map(order => order.cost);
    
    const weeklyDurations = weeklyOrders
      .filter(order => order.duration && order.duration > 0)
      .map(order => order.duration);

    const avgWeeklyCost = weeklyCosts.length > 0 
      ? weeklyCosts.reduce((sum, cost) => sum + cost, 0) / weeklyCosts.length 
      : 0;
    
    const avgWeeklyDuration = weeklyDurations.length > 0 
      ? weeklyDurations.reduce((sum, duration) => sum + duration, 0) / weeklyDurations.length 
      : 0;

    // Calculate cost and duration matrices by work center and department
    const costMatrix = {};
    const durationMatrix = {};
    
    // Initialize matrices with department-first structure to match UI expectations
    const departments = ['STAMPA', 'CONFEZIONAMENTO'];
    const workCenters = ['ZANICA', 'BUSTO_GAROLFO'];
    
    departments.forEach(dept => {
      const deptLower = dept.toLowerCase();
      costMatrix[deptLower] = {};
      durationMatrix[deptLower] = {};
      
      workCenters.forEach(center => {
        // Create consistent keys for the matrix
        const centerKey = center === 'BUSTO_GAROLFO' ? 'busto_garolfo' : center.toLowerCase();
        
        // Filter orders by work center and department
        const deptOrders = orders.filter(order => {
          if (!order.work_center || !order.department) return false;
          return order.work_center === center && order.department === dept;
        });
        
        // Calculate average cost for this combination
        const validCosts = deptOrders
          .filter(order => order.cost && order.cost > 0)
          .map(order => order.cost);
        
        const avgCost = validCosts.length > 0 
          ? validCosts.reduce((sum, cost) => sum + cost, 0) / validCosts.length 
          : 0;
        
        // Calculate average duration for this combination
        const validDurations = deptOrders
          .filter(order => order.duration && order.duration > 0)
          .map(order => order.duration);
        
        const avgDuration = validDurations.length > 0 
          ? validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length 
          : 0;
        
        // Store in matrices with department-first structure
        costMatrix[deptLower][centerKey] = avgCost;
        durationMatrix[deptLower][centerKey] = avgDuration;
      });
    });

    return {
      machinesByWorkCenter,
      completedThisWeek,
      tasksInWip,
      delayedTasks,
      activeMachines,
      totalMachines: machines.length,
      totalOrders: orders.length,
      tasksPerDay,
      avgWeeklyCost,
      avgWeeklyDuration,
      weeklyOrdersCount: weeklyOrders.length,
      costMatrix,
      durationMatrix
    };
  }, [machines, orders, isLoading]);

  // Chart data for tasks per day
  const tasksPerDayChartData = useMemo(() => {
    if (!metrics.tasksPerDay) return null;

    const sortedDates = Object.keys(metrics.tasksPerDay).sort();
    const last7Days = sortedDates.slice(-7);

    return {
      labels: last7Days.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      }),
      datasets: [
        {
          label: 'Lavori Iniziati',
          data: last7Days.map(date => metrics.tasksPerDay[date] || 0),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
        },
      ],
    };
  }, [metrics.tasksPerDay]);

  // Chart options for line chart
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
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
        },
      },
    },
  };

  // Chart options for pie charts
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true,
        },
      },
    },
  };

  if (isLoading) {
    return (
      <div className="content-section">
        <div className="loading">Caricamento dashboard...</div>
      </div>
    );
  }

  return (
    <div className="content-section">
      {/* Main Title */}
      <StickyHeader title="Dashboard Produzione" />
      
      {/* Key Metrics - Horizontal Layout */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Macchine Totali</h3>
          <div className="metric-value">{metrics.totalMachines}</div>
          <div className="metric-subtitle">Attive: {metrics.activeMachines}</div>
        </div>
        
        <div className="metric-card">
          <h3>Ordini Totali</h3>
          <div className="metric-value">{metrics.totalOrders}</div>
        </div>
        
        <div className="metric-card">
          <h3>Completati Questa Settimana</h3>
          <div className="metric-value">{metrics.completedThisWeek}</div>
        </div>
        
        <div className="metric-card">
          <h3>Lavori in Corso</h3>
          <div className="metric-value">{metrics.tasksInWip}</div>
        </div>
        
        <div className="metric-card">
          <h3>Lavori Ritardati</h3>
          <div className="metric-value delayed">{metrics.delayedTasks}</div>
        </div>
      </div>

      {/* Weekly Metrics Row */}
      <div className="weekly-metrics-row">
        <div className="weekly-metric-card">
          <h3>Ordini Settimanali</h3>
          <div className="metric-value">{metrics.weeklyOrdersCount}</div>
          <div className="metric-subtitle">Questa Settimana</div>
        </div>
        
        <div className="weekly-metric-card">
          <h3>Costo Medio</h3>
          <div className="metric-value">€{metrics.avgWeeklyCost.toFixed(2)}</div>
          <div className="metric-subtitle">Per Lavoro Questa Settimana</div>
        </div>
        
        <div className="metric-card">
          <h3>Durata Media</h3>
          <div className="metric-value">{metrics.avgWeeklyDuration.toFixed(1)}h</div>
          <div className="metric-subtitle">Per Lavoro Questa Settimana</div>
        </div>
      </div>

      {/* Matrix Tables for Cost and Duration by Work Center and Department */}
      <div className="matrix-tables-container">
        {/* Cost Matrix Table */}
        <div className="matrix-table-section">
          <h3>Costo Medio per Centro di Lavoro e Reparto</h3>
          <div className="matrix-table">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>ZANICA</th>
                  <th>BUSTO GAROLFO</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="department-label">STAMPA</td>
                  <td className="metric-cell">
                    €{metrics.costMatrix?.stampa?.zanica?.toFixed(2) || '0.00'}
                  </td>
                  <td className="metric-cell">
                    €{metrics.costMatrix?.stampa?.busto_garolfo?.toFixed(2) || '0.00'}
                  </td>
                </tr>
                <tr>
                  <td className="department-label">CONFEZIONAMENTO</td>
                  <td className="metric-cell">
                    €{metrics.costMatrix?.confezionamento?.zanica?.toFixed(2) || '0.00'}
                  </td>
                  <td className="metric-cell">
                    €{metrics.costMatrix?.confezionamento?.busto_garolfo?.toFixed(2) || '0.00'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Duration Matrix Table */}
        <div className="matrix-table-section">
          <h3>Durata Media per Centro di Lavoro e Reparto</h3>
          <div className="matrix-table">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>ZANICA</th>
                  <th>BUSTO GAROLFO</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="department-label">STAMPA</td>
                  <td className="metric-cell">
                    {metrics.durationMatrix?.stampa?.zanica?.toFixed(1) || '0.0'}h
                  </td>
                  <td className="metric-cell">
                    {metrics.durationMatrix?.stampa?.busto_garolfo?.toFixed(1) || '0.0'}h
                  </td>
                </tr>
                <tr>
                  <td className="department-label">CONFEZIONAMENTO</td>
                  <td className="metric-cell">
                    {metrics.durationMatrix?.confezionamento?.zanica?.toFixed(1) || '0.0'}h
                  </td>
                  <td className="metric-cell">
                    {metrics.durationMatrix?.confezionamento?.busto_garolfo?.toFixed(1) || '0.0'}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-container">
        {/* Tasks per Day Line Chart */}
        <div className="chart-section line-chart-section">
          <h3>Lavori Iniziati per Giorno (Ultimi 7 Giorni)</h3>
          <div className="chart-container">
            {tasksPerDayChartData && (
              <Line data={tasksPerDayChartData} options={lineChartOptions} height={300} />
            )}
          </div>
        </div>

        {/* Machines by Work Center - Pie Charts */}
        <div className="chart-section pie-charts-section">
          <h3>Macchine per Centro di Lavoro e Stato</h3>
          <div className="pie-charts-grid">
            {Object.entries(metrics.machinesByWorkCenter || {}).map(([center, statuses]) => {
              const pieData = {
                labels: Object.keys(statuses).map(status => 
                  status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
                ),
                datasets: [
                  {
                    data: Object.values(statuses),
                    backgroundColor: [
                      'rgba(34, 197, 94, 0.8)',   // Green for Active
                      'rgba(239, 68, 68, 0.8)',   // Red for Inactive
                      'rgba(245, 158, 11, 0.8)',  // Orange for Maintenance
                    ],
                    borderColor: [
                      'rgba(34, 197, 94, 1)',
                      'rgba(239, 68, 68, 1)',
                      'rgba(245, 158, 11, 1)',
                    ],
                    borderWidth: 2,
                  },
                ],
              };

              return (
                <div key={center} className="pie-chart-item">
                  <h4>{center}</h4>
                  <div className="pie-chart-container">
                    <Pie data={pieData} options={pieChartOptions} height={200} />
                  </div>
                  <div className="pie-chart-legend">
                    {Object.entries(statuses).map(([status, count]) => (
                      <div key={status} className="legend-item">
                        <span className="legend-color" style={{
                          backgroundColor: status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.8)' :
                                         status === 'INACTIVE' ? 'rgba(239, 68, 68, 0.8)' :
                                         'rgba(245, 158, 11, 0.8)'
                        }}></span>
                        <span className="legend-label">{status}: {count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
