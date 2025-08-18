import React, { useState, useEffect, useMemo } from 'react';
import { appStore } from '../scripts/store';

function HomePage() {
  const [machines, setMachines] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!appStore.isInitialized()) {
        await appStore.init();
      }
      const state = appStore.getState();
      setMachines(state.machines);
      setOrders(state.odpOrders);
      setIsLoading(false);

      const unsubscribe = appStore.subscribe((newState) => {
        setMachines(newState.machines);
        setOrders(newState.odpOrders);
      });

      return () => unsubscribe();
    }
    fetchData();
  }, []);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (isLoading) return {};

    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    // Machines by work center and status
    const machinesByWorkCenter = machines.reduce((acc, machine) => {
      const center = machine.work_center || 'Unknown';
      if (!acc[center]) acc[center] = {};
      const status = machine.status || 'UNKNOWN';
      acc[center][status] = (acc[center][status] || 0) + 1;
      return acc;
    }, {});

    // Tasks completed this week
    const completedThisWeek = orders.filter(order => {
      if (!order.quantity_completed || !order.updated_at) return false;
      const updatedDate = new Date(order.updated_at);
      return updatedDate >= weekStart && updatedDate <= weekEnd && 
             order.quantity_completed >= order.quantity;
    }).length;

    // Tasks in WIP
    const tasksInWip = orders.filter(order => 
      order.quantity_completed > 0 && order.quantity_completed < order.quantity
    ).length;

    // Delayed tasks (past due date)
    const delayedTasks = orders.filter(order => {
      if (!order.due_date) return false;
      const dueDate = new Date(order.due_date);
      return dueDate < now && order.quantity_completed < order.quantity;
    }).length;

    // Total active machines
    const activeMachines = machines.filter(m => m.status === 'ACTIVE').length;

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
      <h2>Production Dashboard</h2>
      
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
