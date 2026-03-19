import React, { useMemo } from 'react';
import { useMachines, useOrders } from '../hooks';
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
import { calculateHomeMetrics } from '../utils/homePageMetrics';
import { createTasksPerDayChartData, lineChartOptions, pieChartOptions } from '../utils/chartConfigs';

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
  
  const isLoading = machinesLoading || ordersLoading;

  const metrics = useMemo(() => {
    if (isLoading) return {};
    return calculateHomeMetrics(machines, orders);
  }, [machines, orders, isLoading]);

  // Chart data for tasks per day
  const tasksPerDayChartData = useMemo(() => {
    return createTasksPerDayChartData(metrics.tasksPerDay);
  }, [metrics.tasksPerDay]);


  if (isLoading) {
    return (
      <div className="p-1 bg-white rounded shadow-sm border">
        <div className="text-center py-1 text-gray-500 text-xs">Caricamento dashboard...</div>
      </div>
    );
  }

  if (machinesError || ordersError) {
    return (
      <div className="p-1 bg-white rounded shadow-sm border">
        <div className="text-center py-1 text-red-600 text-xs">
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
          <h3 className="text-xs font-medium text-navy-800 mb-1">Macchine Totali</h3>
          <div className="text-base font-bold text-navy-800">{metrics.totalMachines}</div>
          <div className="text-xs text-navy-600">Attive: {metrics.activeMachines}</div>
        </div>
        
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-xs font-medium text-gray-700 mb-1">Ordini Totali</h3>
                          <div className="text-base font-bold text-gray-900">{metrics.totalOrders}</div>
        </div>
        
                <div className="bg-navy-50 p-1 rounded border border-navy-200">
          <h3 className="text-xs font-medium text-navy-800 mb-1">Completati Questa Settimana</h3>
          <div className="text-base font-bold text-navy-800">{metrics.completedThisWeek}</div>
        </div>
        
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-xs font-medium text-gray-700 mb-1">Lavori in Corso</h3>
                          <div className="text-base font-bold text-gray-900">{metrics.tasksInWip}</div>
        </div>
        
        <div className="bg-red-50 p-1 rounded border border-red-200">
          <h3 className="text-xs font-medium text-red-800 mb-1">Lavori Ritardati</h3>
                          <div className="text-base font-bold text-red-900">{metrics.delayedTasks}</div>
        </div>
      </div>

      {/* Weekly Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-xs font-medium text-gray-700 mb-1">Ordini Settimanali</h3>
                          <div className="text-base font-bold text-gray-900">{metrics.weeklyOrdersCount}</div>
          <div className="text-xs text-gray-600">Questa Settimana</div>
        </div>
        
                <div className="bg-navy-50 p-1 rounded border border-navy-200">
          <h3 className="text-xs font-medium text-navy-800 mb-1">Costo Medio</h3>
          <div className="text-base font-bold text-navy-800">€{metrics.avgWeeklyCost.toFixed(2)}</div>
          <div className="text-xs text-navy-600">Per Lavoro Questa Settimana</div>
        </div>
        
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-xs font-medium text-gray-700 mb-1">Durata Media</h3>
                          <div className="text-base font-bold text-gray-900">{metrics.avgWeeklyDuration.toFixed(1)}h</div>
          <div className="text-xs text-gray-600">Per Lavoro Questa Settimana</div>
        </div>
      </div>

      {/* Matrix Tables for Cost and Duration by Work Center and Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Cost Matrix Table */}
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Costo Medio per Centro di Lavoro e Reparto</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1 px-1 text-xs font-medium text-gray-700"></th>
                  <th className="text-left py-1 px-1 text-xs font-medium text-gray-700">ZANICA</th>
                  <th className="text-left py-1 px-1 text-xs font-medium text-gray-700">BUSTO GAROLFO</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-1 px-1 text-xs font-medium text-gray-700">STAMPA</td>
                  <td className="py-1 px-1 text-xs text-gray-900">
                    €{metrics.costMatrix?.stampa?.zanica?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-1 px-1 text-xs text-gray-900">
                    €{metrics.costMatrix?.stampa?.busto_garolfo?.toFixed(2) || '0.00'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-1 text-xs font-medium text-gray-700">CONFEZIONAMENTO</td>
                  <td className="py-1 px-1 text-xs text-gray-900">
                    €{metrics.costMatrix?.confezionamento?.zanica?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-1 px-1 text-xs text-gray-900">
                    €{metrics.costMatrix?.confezionamento?.busto_garolfo?.toFixed(2) || '0.00'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Duration Matrix Table */}
        <div className="bg-gray-50 p-1 rounded border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Durata Media per Centro di Lavoro e Reparto</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1 px-1 text-xs font-medium text-gray-700"></th>
                  <th className="text-left py-1 px-1 text-xs font-medium text-gray-700">ZANICA</th>
                  <th className="text-left py-1 px-1 text-xs font-medium text-gray-700">BUSTO GAROLFO</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-1 px-1 text-xs font-medium text-gray-700">STAMPA</td>
                  <td className="py-1 px-1 text-xs text-gray-900">
                    {metrics.durationMatrix?.stampa?.zanica?.toFixed(1) || '0.0'}h
                  </td>
                  <td className="py-1 px-1 text-xs text-gray-900">
                    {metrics.durationMatrix?.stampa?.busto_garolfo?.toFixed(1) || '0.0'}h
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-1 text-xs font-medium text-gray-700">CONFEZIONAMENTO</td>
                  <td className="py-1 px-1 text-xs text-gray-900">
                    {metrics.durationMatrix?.confezionamento?.zanica?.toFixed(1) || '0.0'}h
                  </td>
                  <td className="py-1 px-1 text-xs text-gray-900">
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
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Lavori Iniziati per Giorno (Ultimi 7 Giorni + Prossimi 7 Giorni)</h3>
          <div className="h-48">
            {tasksPerDayChartData && (
              <Line data={tasksPerDayChartData} options={lineChartOptions} height={200} />
            )}
          </div>
        </div>

        {/* Machines by Work Center - Pie Charts */}
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Macchine per Centro di Lavoro e Stato</h3>
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
                  <h4 className="text-xs font-medium text-gray-700 mb-1">{center}</h4>
                  <div className="h-32">
                    <Pie data={pieData} options={pieChartOptions} height={150} />
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
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
