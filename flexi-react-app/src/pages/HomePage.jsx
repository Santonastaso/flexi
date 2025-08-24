import React, { useEffect, useMemo } from 'react';
import { useMachineStore, useOrderStore, useUIStore, useMainStore } from '../store';
import { MACHINE_STATUSES } from '../constants';
import StickyHeader from '../components/StickyHeader';

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

    // Delayed tasks (past due date and not completed)
    const delayedTasks = orders.filter(order => {
      if (!order.due_date) return false;
      const dueDate = new Date(order.due_date);
      return dueDate < now && order.quantity_completed < order.quantity;
    }).length;

    // Total active machines
    const activeMachines = machines.filter(m => m.status === MACHINE_STATUSES.ACTIVE).length;

    return {
      machinesByWorkCenter,
      completedThisWeek,
      tasksInWip,
      delayedTasks,
      activeMachines,
      totalMachines: machines.length,
      totalOrders: orders.length
    };
  }, [machines, orders, isLoading]);

  if (isLoading) {
    return (
      <div className="content-section">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="content-section">
      {/* Main Title */}
      <StickyHeader title="Production Dashboard" />
      
      {/* Key Metrics - Horizontal Layout */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Machines</h3>
          <div className="metric-value">{metrics.totalMachines}</div>
          <div className="metric-subtitle">Active: {metrics.activeMachines}</div>
        </div>
        
        <div className="metric-card">
          <h3>Total Orders</h3>
          <div className="metric-value">{metrics.totalOrders}</div>
        </div>
        
        <div className="metric-card">
          <h3>Completed This Week</h3>
          <div className="metric-value">{metrics.completedThisWeek}</div>
        </div>
        
        <div className="metric-card">
          <h3>Tasks in WIP</h3>
          <div className="metric-value">{metrics.tasksInWip}</div>
        </div>
        
        <div className="metric-card">
          <h3>Delayed Tasks</h3>
          <div className="metric-value delayed">{metrics.delayedTasks}</div>
        </div>
      </div>

      {/* Charts Section - Horizontal Layout */}
      <div className="charts-container">
        {/* Machines by Work Center */}
        <div className="chart-section">
          <h3>Machines by Work Center</h3>
          <div className="work-center-chart">
            {Object.entries(metrics.machinesByWorkCenter || {}).map(([center, statuses]) => (
              <div key={center} className="work-center-group">
                <h4>{center}</h4>
                <div className="status-bars">
                  {Object.entries(statuses).map(([status, count]) => (
                    <div key={status} className="status-bar">
                      <span className="status-label">{status}</span>
                      <div className="status-bar-fill" style={{ width: `${(count / Math.max(...Object.values(statuses))) * 100}%` }}>
                        {count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Completion Chart */}
        <div className="chart-section">
          <h3>Weekly Task Completion</h3>
          <div className="simple-chart">
            <div className="chart-bar" style={{ height: `${(metrics.completedThisWeek / Math.max(metrics.totalOrders, 1)) * 200}px` }}>
              <span className="chart-label">{metrics.completedThisWeek}</span>
            </div>
            <div className="chart-x-axis">This Week</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
