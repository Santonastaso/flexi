import React, { useEffect, useMemo } from 'react';
import { useMachineStore, useOrderStore, useUIStore, useMainStore } from '../store';
import { useMachines, useOrders } from '../hooks';
import { format } from 'date-fns';
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
  // Use React Query for data fetching
  const { data: machines = [], isLoading: machinesLoading, error: machinesError } = useMachines();
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useOrders();
  
  // Use Zustand store for client state
  const { isInitialized } = useUIStore();
  const { init, cleanup } = useMainStore();
  
  // Combined loading state
  const isLoading = machinesLoading || ordersLoading;

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

    // Calculate completed tasks this week (Monday as first day)
    const now = new Date();
    const startOfWeek = new Date(now);
    // Adjust for Monday as first day: if today is Sunday (0), go back 6 days; otherwise go back (day - 1) days
    const dayOfWeek = now.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setUTCDate(now.getUTCDate() - daysToSubtract);
    startOfWeek.setUTCHours(0, 0, 0, 0);

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

    // Tasks per day (start date) for the last 7 days and next 7 days (14 days total)
    const tasksPerDay = {};
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setUTCDate(now.getUTCDate() + 7);
    
    orders.forEach(order => {
      if (order.scheduled_start_time) {
        const startDate = new Date(order.scheduled_start_time);
        if (startDate >= sevenDaysAgo && startDate <= sevenDaysFromNow) {
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
                    data: allDates.map(date => metrics.tasksPerDay[date] || 0),
                    borderColor: 'rgb(30, 58, 138)',
                    backgroundColor: 'rgba(30, 58, 138, 0.1)',
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

  // Chart options for pie charts
  const pieChartOptions = {
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

  if (isLoading) {
    return (
      <div className="p-1 bg-white rounded shadow-sm border">
        <div className="text-center py-1 text-gray-500 text-[10px]">Caricamento dashboard...</div>
      </div>
    );
  }

  if (machinesError || ordersError) {
    return (
      <div className="p-1 bg-white rounded shadow-sm border">
        <div className="text-center py-1 text-red-600 text-[10px]">
          Errore nel caricamento dei dati: {machinesError?.message || ordersError?.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 bg-white rounded shadow-sm border">
      {/* Main Title */}
      <StickyHeader title="Dashboard Produzione" />
      
      {/* Key Metrics - Horizontal Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 mb-2">
                <div className="bg-navy-50 p-1 rounded border border-navy-200">
          <h3 className="text-[10px] font-medium text-navy-800 mb-1">Macchine Totali</h3>
          <div className="text-[10px] font-bold text-navy-800">{metrics.totalMachines}</div>
          <div className="text-[10px] text-navy-600">Attive: {metrics.activeMachines}</div>
        </div>
        
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-[10px] font-medium text-gray-700 mb-1">Ordini Totali</h3>
                          <div className="text-[10px] font-bold text-gray-900">{metrics.totalOrders}</div>
        </div>
        
                <div className="bg-navy-50 p-1 rounded border border-navy-200">
          <h3 className="text-[10px] font-medium text-navy-800 mb-1">Completati Questa Settimana</h3>
          <div className="text-[10px] font-bold text-navy-800">{metrics.completedThisWeek}</div>
        </div>
        
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-[10px] font-medium text-gray-700 mb-1">Lavori in Corso</h3>
                          <div className="text-[10px] font-bold text-gray-900">{metrics.tasksInWip}</div>
        </div>
        
        <div className="bg-red-50 p-1 rounded border border-red-200">
          <h3 className="text-[10px] font-medium text-red-800 mb-1">Lavori Ritardati</h3>
                          <div className="text-[10px] font-bold text-red-900">{metrics.delayedTasks}</div>
        </div>
      </div>

      {/* Weekly Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-[10px] font-medium text-gray-700 mb-1">Ordini Settimanali</h3>
                          <div className="text-[10px] font-bold text-gray-900">{metrics.weeklyOrdersCount}</div>
          <div className="text-[10px] text-gray-600">Questa Settimana</div>
        </div>
        
                <div className="bg-navy-50 p-1 rounded border border-navy-200">
          <h3 className="text-[10px] font-medium text-navy-800 mb-1">Costo Medio</h3>
          <div className="text-[10px] font-bold text-navy-800">€{metrics.avgWeeklyCost.toFixed(2)}</div>
          <div className="text-[10px] text-navy-600">Per Lavoro Questa Settimana</div>
        </div>
        
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-[10px] font-medium text-gray-700 mb-1">Durata Media</h3>
                          <div className="text-[10px] font-bold text-gray-900">{metrics.avgWeeklyDuration.toFixed(1)}h</div>
          <div className="text-[10px] text-gray-600">Per Lavoro Questa Settimana</div>
        </div>
      </div>

      {/* Matrix Tables for Cost and Duration by Work Center and Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Cost Matrix Table */}
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-[10px] font-semibold text-gray-900 mb-1">Costo Medio per Centro di Lavoro e Reparto</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1 px-1 text-[10px] font-medium text-gray-700"></th>
                  <th className="text-left py-1 px-1 text-[10px] font-medium text-gray-700">ZANICA</th>
                  <th className="text-left py-1 px-1 text-[10px] font-medium text-gray-700">BUSTO GAROLFO</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-1 px-1 text-[10px] font-medium text-gray-700">STAMPA</td>
                  <td className="py-1 px-1 text-[10px] text-gray-900">
                    €{metrics.costMatrix?.stampa?.zanica?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-1 px-1 text-[10px] text-gray-900">
                    €{metrics.costMatrix?.stampa?.busto_garolfo?.toFixed(2) || '0.00'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-1 text-[10px] font-medium text-gray-700">CONFEZIONAMENTO</td>
                  <td className="py-1 px-1 text-[10px] text-gray-900">
                    €{metrics.costMatrix?.confezionamento?.zanica?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-1 px-1 text-[10px] text-gray-900">
                    €{metrics.costMatrix?.confezionamento?.busto_garolfo?.toFixed(2) || '0.00'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Duration Matrix Table */}
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-[10px] font-semibold text-gray-900 mb-1">Durata Media per Centro di Lavoro e Reparto</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1 px-1 text-[10px] font-medium text-gray-700"></th>
                  <th className="text-left py-1 px-1 text-[10px] font-medium text-gray-700">ZANICA</th>
                  <th className="text-left py-1 px-1 text-[10px] font-medium text-gray-700">BUSTO GAROLFO</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-1 px-1 text-[10px] font-medium text-gray-700">STAMPA</td>
                  <td className="py-1 px-1 text-[10px] text-gray-900">
                    {metrics.durationMatrix?.stampa?.zanica?.toFixed(1) || '0.0'}h
                  </td>
                  <td className="py-1 px-1 text-[10px] text-gray-900">
                    {metrics.durationMatrix?.stampa?.busto_garolfo?.toFixed(1) || '0.0'}h
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-1 text-[10px] font-medium text-gray-700">CONFEZIONAMENTO</td>
                  <td className="py-1 px-1 text-[10px] text-gray-900">
                    {metrics.durationMatrix?.confezionamento?.zanica?.toFixed(1) || '0.0'}h
                  </td>
                  <td className="py-1 px-1 text-[10px] text-gray-900">
                    {metrics.durationMatrix?.confezionamento?.busto_garolfo?.toFixed(1) || '0.0'}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="space-y-4 mt-4">
        {/* Tasks per Day Line Chart */}
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <h3 className="text-[10px] font-semibold text-gray-900 mb-1">Lavori Iniziati per Giorno (Ultimi 7 Giorni + Prossimi 7 Giorni)</h3>
          <div className="h-48">
            {tasksPerDayChartData && (
              <Line data={tasksPerDayChartData} options={lineChartOptions} height={200} />
            )}
          </div>
        </div>

        {/* Machines by Work Center - Pie Charts */}
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <h3 className="text-[10px] font-semibold text-gray-900 mb-1">Macchine per Centro di Lavoro e Stato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(metrics.machinesByWorkCenter || {}).map(([center, statuses]) => {
              const pieData = {
                labels: Object.keys(statuses).map(status => 
                  status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
                ),
                datasets: [
                  {
                    data: Object.values(statuses),
                    backgroundColor: [
                      'rgba(30, 58, 138, 0.8)',   // Navy blue for Active
                      'rgba(107, 114, 128, 0.8)', // Grey for Inactive
                      'rgba(156, 163, 175, 0.8)', // Light grey for Maintenance
                    ],
                    borderColor: [
                      'rgba(30, 58, 138, 1)',
                      'rgba(107, 114, 128, 1)',
                      'rgba(156, 163, 175, 1)',
                    ],
                    borderWidth: 2,
                  },
                ],
              };

              return (
                <div key={center} className="text-center">
                  <h4 className="text-[10px] font-medium text-gray-700 mb-1">{center}</h4>
                  <div className="h-32">
                    <Pie data={pieData} options={pieChartOptions} height={150} />
                  </div>
                  <div className="text-[10px] text-gray-600 mt-2">
                    {Object.entries(statuses).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-center gap-1 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{
                          backgroundColor: status === 'ACTIVE' ? 'rgba(30, 58, 138, 0.8)' :
                                         status === 'INACTIVE' ? 'rgba(107, 114, 128, 0.8)' :
                                         'rgba(156, 163, 175, 0.8)'
                        }}></span>
                        <span>{status}: {count}</span>
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
