/**
 * Dashboard Components
 * 
 * Reusable components for the dashboard that replace HTML injection
 * with declarative, maintainable component templates.
 */

import { componentSystem } from './componentSystem.js';

// ===== METRIC CARD COMPONENT =====
componentSystem.registerComponent('metric-card', (data) => `
    <div class="metric-card ${data.type || ''}">
        <div class="metric-header">
            <h3>${data.title}</h3>
            <div class="metric-period">${data.period}</div>
        </div>
        <div class="metric-content">
            ${data.metrics.map(metric => `
                <div class="metric-row">
                    <span class="metric-label">${metric.label}:</span>
                    <span class="metric-value">${metric.value}</span>
                </div>
            `).join('')}
        </div>
    </div>
`);

// ===== PRODUCTION TRENDS CHART COMPONENT =====
componentSystem.registerComponent('production-trends-chart', (data) => `
    <div class="chart-container">
        <h3>Production Trends</h3>
        <div class="chart-content">
            <div class="metrics-grid">
                <div class="metric-item completed">
                    <div class="metric-value">${data.ordersByStatus.COMPLETED}</div>
                    <div class="metric-label">Completed</div>
                </div>
                <div class="metric-item in-progress">
                    <div class="metric-value">${data.ordersByStatus.IN_PROGRESS}</div>
                    <div class="metric-label">In Progress</div>
                </div>
                <div class="metric-item scheduled">
                    <div class="metric-value">${data.ordersByStatus.SCHEDULED}</div>
                    <div class="metric-label">Scheduled</div>
                </div>
                <div class="metric-item pending">
                    <div class="metric-value">${data.ordersByStatus.PENDING}</div>
                    <div class="metric-label">Pending</div>
                </div>
            </div>
            <div class="summary-metric">
                <div class="summary-value">Completion Rate: ${data.completionRate}%</div>
                <div class="summary-detail">${data.totalOrders} total orders</div>
            </div>
        </div>
    </div>
`);

// ===== MACHINE STATUS CHART COMPONENT =====
componentSystem.registerComponent('machine-status-chart', (data) => `
    <div class="chart-container">
        <h3>Machine Status Distribution</h3>
        <div class="chart-content">
            <div class="status-grid">
                <div class="status-item active">
                    <div class="status-value">${data.machineStatus.ACTIVE}</div>
                    <div class="status-label">Active</div>
                </div>
                <div class="status-item inactive">
                    <div class="status-value">${data.machineStatus.INACTIVE}</div>
                    <div class="status-label">Inactive</div>
                </div>
                <div class="status-item maintenance">
                    <div class="status-value">${data.machineStatus.MAINTENANCE}</div>
                    <div class="status-label">Maintenance</div>
                </div>
            </div>
            <div class="summary-metric">
                <div class="summary-value">Utilization: ${data.utilizationRate}%</div>
                <div class="summary-detail">${data.totalMachines} total machines</div>
            </div>
        </div>
    </div>
`);

// ===== ACTIVITY ITEM COMPONENT =====
componentSystem.registerComponent('activity-item', (data) => `
    <div class="activity-item">
        <div class="activity-left">
            <div class="activity-order">${data.odp_number || 'N/A'}</div>
            <div class="activity-article">${data.article_code || 'N/A'}</div>
        </div>
        <div class="activity-right">
            <div class="activity-status">${data.status || 'N/A'}</div>
            <div class="activity-date">
                ${data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                }) : 'N/A'}
            </div>
        </div>
    </div>
`);

// ===== RECENT ACTIVITY COMPONENT =====
componentSystem.registerComponent('recent-activity', (data) => `
    <div class="recent-activity">
        <h3>Recent Production Activity</h3>
        <div class="activity-list">
            ${data.activities.length === 0 
                ? '<div class="empty-state">No recent activity</div>'
                : data.activities.map(activity => componentSystem.render('activity-item', activity).outerHTML).join('')
            }
        </div>
    </div>
`);

// ===== EMPTY STATE COMPONENT =====
componentSystem.registerComponent('empty-state', (data) => `
    <div class="empty-state">
        <div class="empty-icon">${data.icon || '📊'}</div>
        <div class="empty-message">${data.message}</div>
        ${data.detail ? `<div class="empty-detail">${data.detail}</div>` : ''}
    </div>
`);

// ===== LOADING STATE COMPONENT =====
componentSystem.registerComponent('loading-state', (data) => `
    <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-message">${data.message || 'Loading...'}</div>
    </div>
`);

// ===== DASHBOARD HEADER COMPONENT =====
componentSystem.registerComponent('dashboard-header', (data) => `
    <div class="dashboard-header">
        <h1>${data.title || 'Production Dashboard'}</h1>
        <div class="dashboard-controls">
            <div class="date-range">
                <label for="date_from">From:</label>
                <input type="date" id="date_from" class="date-input" value="${data.dateFrom || ''}">
                <label for="date_to">To:</label>
                <input type="date" id="date_to" class="date-input" value="${data.dateTo || ''}">
                <button id="apply_date_range" class="btn btn-primary" data-action="applyDateRange">Apply Range</button>
            </div>
            <button id="refresh_dashboard" class="btn btn-secondary" data-action="refreshDashboard" title="Refresh dashboard data">🔄 Refresh</button>
            <button id="print_dashboard" class="btn btn-primary" data-action="printDashboard" title="Print dashboard as PDF">🖨️ Print PDF</button>
        </div>
    </div>
`);

// ===== METRICS GRID COMPONENT =====
componentSystem.registerComponent('metrics-grid', (data) => `
    <div class="metrics-grid">
        ${data.metrics.map(metric => componentSystem.render('metric-card', metric).outerHTML).join('')}
    </div>
`);

// ===== CHARTS SECTION COMPONENT =====
componentSystem.registerComponent('charts-section', (data) => `
    <div class="charts-section">
        ${componentSystem.render('production-trends-chart', data.productionTrends).outerHTML}
        ${componentSystem.render('machine-status-chart', data.machineStatus).outerHTML}
    </div>
`);

// ===== COMPLETE DASHBOARD COMPONENT =====
componentSystem.registerComponent('dashboard', (data) => `
    <div class="dashboard-container">
        ${componentSystem.render('dashboard-header', data.header).outerHTML}
        ${componentSystem.render('metrics-grid', data.metrics).outerHTML}
        ${componentSystem.render('charts-section', data.charts).outerHTML}
        ${componentSystem.render('recent-activity', data.activity).outerHTML}
    </div>
`);

// Export for use in dashboard-manager.js
export { componentSystem as dashboardComponents };
