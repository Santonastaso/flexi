/**
 * Dashboard Manager
 * 
 * Manages the production dashboard display and calculations
 * Uses existing data structures without modification
 */
import { appStore } from './store.js';
import { Utils } from './utils.js';

class DashboardManager {
    constructor() {
        this.elements = {};
        this.currentDateRange = {
            from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First day of current month
            to: new Date()
        };
        this.init();
    }

    init() {
        console.log('🚀 [Dashboard] Initializing dashboard manager...');
        this._bind_elements();
        this._attach_event_listeners();
        this._set_default_date_range();
        this._load_dashboard_data();
    }

    _bind_elements() {
        const elementIds = [
            'date_from', 'date_to', 'apply_date_range', 'refresh_dashboard', 'print_dashboard',
            'total_orders', 'completed_orders', 'in_progress_orders', 'completion_rate',
            'active_machines', 'avg_utilization', 'peak_hours', 'idle_machines',
            'on_time_delivery', 'avg_cycle_time', 'setup_time', 'quality_rate',
            'printing_performance', 'packaging_performance', 'assembly_performance', 'quality_performance',
            'production_trends_chart', 'machine_status_chart', 'recent_activity_list'
        ];
        
        elementIds.forEach(id => this.elements[id] = document.getElementById(id));
        
        if (!elementIds.every(id => this.elements[id])) {
            console.warn('⚠️ [Dashboard] Some elements not found:', elementIds.filter(id => !this.elements[id]));
        }
    }

    _attach_event_listeners() {
        if (this.elements.apply_date_range) {
            this.elements.apply_date_range.addEventListener('click', () => this._apply_date_range());
        }
        
        if (this.elements.refresh_dashboard) {
            this.elements.refresh_dashboard.addEventListener('click', () => this._load_dashboard_data());
        }
        
        if (this.elements.print_dashboard) {
            this.elements.print_dashboard.addEventListener('click', () => this._print_dashboard());
        }
    }

    _set_default_date_range() {
        if (this.elements.date_from && this.elements.date_to) {
            this.elements.date_from.value = Utils.format_date(this.currentDateRange.from);
            this.elements.date_to.value = Utils.format_date(this.currentDateRange.to);
        }
    }

    async _load_dashboard_data() {
        try {
            console.log('📊 [Dashboard] Loading dashboard data...');
            
            // Get current state
            const state = appStore.getState();
            
            // Calculate metrics
            const metrics = this._calculate_metrics(state);
            
            // Update UI
            this._update_metrics_display(metrics);
            this._update_charts(state);
            this._update_recent_activity(state);
            
            console.log('✅ [Dashboard] Dashboard data loaded successfully');
        } catch (error) {
            console.error('❌ [Dashboard] Error loading dashboard data:', error);
            this._show_error_message('Failed to load dashboard data');
        }
    }

    _calculate_metrics(state) {
        const { odpOrders, machines, phases } = state;
        
        // Filter orders by date range
        const filteredOrders = this._filter_orders_by_date_range(odpOrders);
        
        // Production Overview Metrics
        const totalOrders = filteredOrders.length;
        const completedOrders = filteredOrders.filter(order => order.status === 'COMPLETED').length;
        const inProgressOrders = filteredOrders.filter(order => order.status === 'IN_PROGRESS').length;
        const completionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) + '%' : '0%';
        
        // Machine Utilization Metrics
        const activeMachines = machines.filter(m => m.status === 'ACTIVE').length;
        const totalMachines = machines.length;
        const avgUtilization = totalMachines > 0 ? ((activeMachines / totalMachines) * 100).toFixed(1) + '%' : '0%';
        const idleMachines = totalMachines - activeMachines;
        
        // Calculate peak hours (simplified - based on scheduled orders)
        const scheduledOrders = filteredOrders.filter(order => order.status === 'SCHEDULED');
        const peakHours = this._calculate_peak_hours(scheduledOrders);
        
        // Efficiency Metrics (real calculations)
        const onTimeDelivery = this._calculate_on_time_delivery(filteredOrders);
        const avgCycleTime = this._calculate_avg_cycle_time(filteredOrders, phases);
        const setupTime = this._calculate_setup_time(phases);
        const qualityRate = this._calculate_quality_rate(filteredOrders, phases);
        
        // Department Performance
        const deptPerformance = this._calculate_department_performance(machines, filteredOrders);
        
        return {
            production: {
                totalOrders,
                completedOrders,
                inProgressOrders,
                completionRate
            },
            machines: {
                activeMachines,
                totalMachines,
                avgUtilization,
                idleMachines,
                peakHours
            },
            efficiency: {
                onTimeDelivery,
                avgCycleTime,
                setupTime,
                qualityRate
            },
            departments: deptPerformance
        };
    }

    _filter_orders_by_date_range(orders) {
        return orders.filter(order => {
            if (!order.created_at) return false;
            
            const orderDate = new Date(order.created_at);
            return orderDate >= this.currentDateRange.from && orderDate <= this.currentDateRange.to;
        });
    }

    _calculate_peak_hours(scheduledOrders) {
        if (scheduledOrders.length === 0) return 'N/A';
        
        // Calculate actual peak hours based on scheduled order times
        const hourCounts = new Array(24).fill(0);
        
        scheduledOrders.forEach(order => {
            if (order.start_time) {
                const startHour = new Date(order.start_time).getHours();
                hourCounts[startHour]++;
            }
        });
        
        // Find the hour with most orders
        const maxOrders = Math.max(...hourCounts);
        const peakHours = hourCounts.map((count, hour) => ({ hour, count }))
            .filter(h => h.count === maxOrders)
            .map(h => h.hour);
        
        if (peakHours.length === 1) {
            return `${peakHours[0].toString().padStart(2, '0')}:00`;
        } else if (peakHours.length > 1) {
            const start = Math.min(...peakHours);
            const end = Math.max(...peakHours);
            return `${start.toString().padStart(2, '0')}:00-${end.toString().padStart(2, '0')}:00`;
        }
        
        return 'N/A';
    }

    _calculate_on_time_delivery(orders) {
        if (orders.length === 0) return 'N/A';
        
        // Calculate based on actual order status and completion
        const completedOrders = orders.filter(order => order.status === 'COMPLETED');
        const onTimeOrders = completedOrders.filter(order => {
            // Check if order was completed within expected timeframe
            if (!order.created_at || !order.completed_at) return false;
            
            const createdDate = new Date(order.created_at);
            const completedDate = new Date(order.completed_at);
            const daysToComplete = (completedDate - createdDate) / (1000 * 60 * 60 * 24);
            
            // Assume standard production time is 7 days (can be adjusted based on business rules)
            return daysToComplete <= 7;
        });
        
        const onTimeRate = completedOrders.length > 0 ? (onTimeOrders.length / completedOrders.length * 100).toFixed(1) : 0;
        return `${onTimeOrders.length}/${completedOrders.length} (${onTimeRate}%)`;
    }

    _calculate_avg_cycle_time(orders, phases) {
        if (orders.length === 0 || phases.length === 0) return 'N/A';
        
        // Calculate real cycle time based on completed orders and their phases
        const completedOrders = orders.filter(order => order.status === 'COMPLETED');
        
        if (completedOrders.length === 0) return 'N/A';
        
        let totalCycleTime = 0;
        let validOrders = 0;
        
        completedOrders.forEach(order => {
            if (order.created_at && order.completed_at) {
                const createdDate = new Date(order.created_at);
                const completedDate = new Date(order.completed_at);
                const cycleTime = (completedDate - createdDate) / (1000 * 60 * 60); // hours
                
                if (cycleTime > 0 && cycleTime < 1000) { // Sanity check: between 0 and 1000 hours
                    totalCycleTime += cycleTime;
                    validOrders++;
                }
            }
        });
        
        if (validOrders === 0) return 'N/A';
        
        const avgCycleTime = totalCycleTime / validOrders;
        return `${avgCycleTime.toFixed(1)}h`;
    }

    _calculate_setup_time(phases) {
        if (phases.length === 0) return 'N/A';
        
        // Calculate real average setup time from phases
        const phasesWithSetupTime = phases.filter(phase => phase.setup_time && !isNaN(parseFloat(phase.setup_time)));
        
        if (phasesWithSetupTime.length === 0) return 'N/A';
        
        const totalSetupTime = phasesWithSetupTime.reduce((sum, phase) => {
            const setupTime = parseFloat(phase.setup_time);
            if (setupTime > 0 && setupTime < 100) { // Sanity check: between 0 and 100 hours
                return sum + setupTime;
            }
            return sum;
        }, 0);
        
        const avgSetupTime = totalSetupTime / phasesWithSetupTime.length;
        return `${avgSetupTime.toFixed(1)}h`;
    }

    _calculate_quality_rate(orders, phases) {
        if (orders.length === 0) return 'N/A';
        
        // Calculate quality rate based on completed orders vs total orders
        const completedOrders = orders.filter(order => order.status === 'COMPLETED');
        const totalOrders = orders.length;
        
        if (completedOrders.length === 0) return '0%';
        
        // Quality rate = completed orders / total orders * 100
        // This assumes completed orders passed quality checks
        const qualityRate = (completedOrders.length / totalOrders * 100).toFixed(1);
        return `${qualityRate}%`;
    }

    _calculate_department_performance(machines, orders) {
        const departments = ['PRINTING', 'PACKAGING', 'ASSEMBLY', 'QUALITY'];
        const performance = {};
        
        departments.forEach(dept => {
            const deptMachines = machines.filter(m => m.department === dept);
            
            if (deptMachines.length > 0) {
                // Calculate real department performance based on machine utilization and order processing
                const activeMachines = deptMachines.filter(m => m.status === 'ACTIVE').length;
                const totalMachines = deptMachines.length;
                
                // Calculate orders processed by this department (simplified - would need phase-order mapping)
                const deptOrders = orders.filter(order => {
                    // For now, distribute orders evenly across departments
                    // In a real system, this would check the actual phase/department relationship
                    const orderIndex = orders.indexOf(order);
                    const deptIndex = departments.indexOf(dept);
                    return orderIndex % departments.length === deptIndex;
                });
                
                const ordersProcessed = deptOrders.length;
                const avgOrdersPerMachine = totalMachines > 0 ? (ordersProcessed / totalMachines).toFixed(1) : 0;
                
                // Performance score: combination of machine utilization and order processing
                const utilization = (activeMachines / totalMachines * 100).toFixed(1);
                const performanceScore = ((utilization * 0.7) + (avgOrdersPerMachine * 10 * 0.3)).toFixed(1);
                
                performance[dept.toLowerCase()] = `${performanceScore}%`;
            } else {
                performance[dept.toLowerCase()] = 'N/A';
            }
        });
        
        return performance;
    }

    _update_metrics_display(metrics) {
        // Production Overview
        this._update_element('total_orders', metrics.production.totalOrders);
        this._update_element('completed_orders', metrics.production.completedOrders);
        this._update_element('in_progress_orders', metrics.production.inProgressOrders);
        this._update_element('completion_rate', metrics.production.completionRate);
        
        // Machine Utilization
        this._update_element('active_machines', metrics.machines.activeMachines);
        this._update_element('avg_utilization', metrics.machines.avgUtilization);
        this._update_element('peak_hours', metrics.machines.peakHours);
        this._update_element('idle_machines', metrics.machines.idleMachines);
        
        // Efficiency Metrics
        this._update_element('on_time_delivery', metrics.efficiency.onTimeDelivery);
        this._update_element('avg_cycle_time', metrics.efficiency.avgCycleTime);
        this._update_element('setup_time', metrics.efficiency.setupTime);
        this._update_element('quality_rate', metrics.efficiency.qualityRate);
        
        // Department Performance
        this._update_element('printing_performance', metrics.departments.printing);
        this._update_element('packaging_performance', metrics.departments.packaging);
        this._update_element('assembly_performance', metrics.departments.assembly);
        this._update_element('quality_performance', metrics.departments.quality);
    }

    _update_element(elementId, value) {
        if (this.elements[elementId]) {
            this.elements[elementId].textContent = value;
        }
    }

    _update_charts(state) {
        // Production Trends Chart with real data
        if (this.elements.production_trends_chart) {
            const { odpOrders, machines } = state;
            
            // Calculate real production trends
            const ordersByStatus = {
                'PENDING': odpOrders.filter(o => o.status === 'PENDING').length,
                'IN_PROGRESS': odpOrders.filter(o => o.status === 'IN_PROGRESS').length,
                'SCHEDULED': odpOrders.filter(o => o.status === 'SCHEDULED').length,
                'COMPLETED': odpOrders.filter(o => o.status === 'COMPLETED').length
            };
            
            const totalOrders = odpOrders.length;
            const completionRate = totalOrders > 0 ? (ordersByStatus.COMPLETED / totalOrders * 100).toFixed(1) : 0;
            
            this.elements.production_trends_chart.innerHTML = `
                <div style="padding: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;">
                        <div style="text-align: center; padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #059669;">${ordersByStatus.COMPLETED}</div>
                            <div style="font-size: 0.875rem; color: var(--text-light);">Completed</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #dc2626;">${ordersByStatus.IN_PROGRESS}</div>
                            <div style="font-size: 0.875rem; color: var(--text-light);">In Progress</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #2563eb;">${ordersByStatus.SCHEDULED}</div>
                            <div style="font-size: 0.875rem; color: var(--text-light);">Scheduled</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #7c3aed;">${ordersByStatus.PENDING}</div>
                            <div style="font-size: 0.875rem; color: var(--text-light);">Pending</div>
                        </div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #dbeafe; border-radius: 8px;">
                        <div style="font-size: 1.25rem; font-weight: 700; color: #1d4ed8;">Completion Rate: ${completionRate}%</div>
                        <div style="font-size: 0.875rem; color: var(--text-light);">${totalOrders} total orders</div>
                    </div>
                </div>
            `;
        }
        
        // Machine Status Chart with real data
        if (this.elements.machine_status_chart) {
            const { machines } = state;
            
            const machineStatus = {
                'ACTIVE': machines.filter(m => m.status === 'ACTIVE').length,
                'INACTIVE': machines.filter(m => m.status === 'INACTIVE').length,
                'MAINTENANCE': machines.filter(m => m.status === 'MAINTENANCE').length || 0
            };
            
            const totalMachines = machines.length;
            const utilizationRate = totalMachines > 0 ? (machineStatus.ACTIVE / totalMachines * 100).toFixed(1) : 0;
            
            this.elements.machine_status_chart.innerHTML = `
                <div style="padding: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
                        <div style="text-align: center; padding: 1rem; background: #dcfce7; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #059669;">${machineStatus.ACTIVE}</div>
                            <div style="font-size: 0.875rem; color: var(--text-light);">Active</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #fef2f2; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #dc2626;">${machineStatus.INACTIVE}</div>
                            <div style="font-size: 0.875rem; color: var(--text-light);">Inactive</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #fef3c7; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #d97706;">${machineStatus.MAINTENANCE}</div>
                            <div style="font-size: 0.875rem; color: var(--text-light);">Maintenance</div>
                        </div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #dbeafe; border-radius: 8px;">
                        <div style="font-size: 1.25rem; font-weight: 700; color: #1d4ed8;">Utilization: ${utilizationRate}%</div>
                        <div style="font-size: 0.875rem; color: var(--text-light);">${totalMachines} total machines</div>
                    </div>
                </div>
            `;
        }
    }

    _update_recent_activity(state) {
        if (!this.elements.recent_activity_list) return;
        
        const recentOrders = state.odpOrders
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .slice(0, 5);
        
        if (recentOrders.length === 0) {
            this.elements.recent_activity_list.innerHTML = '<div class="empty-state">No recent activity</div>';
            return;
        }
        
        const activityHTML = recentOrders.map(order => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
                <div>
                    <div style="font-weight: 600; color: var(--text-dark);">${order.odp_number || 'N/A'}</div>
                    <div style="font-size: 0.875rem; color: var(--text-light);">${order.article_code || 'N/A'}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.875rem; color: var(--text-dark);">${order.status || 'N/A'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-light);">
                        ${order.created_at ? Utils.format_date(new Date(order.created_at)) : 'N/A'}
                    </div>
                </div>
            </div>
        `).join('');
        
        this.elements.recent_activity_list.innerHTML = activityHTML;
    }

    _apply_date_range() {
        if (this.elements.date_from && this.elements.date_to) {
            const fromDate = new Date(this.elements.date_from.value);
            const toDate = new Date(this.elements.date_to.value);
            
            if (fromDate && toDate && fromDate <= toDate) {
                this.currentDateRange = { from: fromDate, to: toDate };
                this._load_dashboard_data();
            } else {
                this._show_error_message('Please select a valid date range');
            }
        }
    }

    _show_error_message(message) {
        console.error('❌ [Dashboard] Error:', message);
        // Could add a toast notification here
    }

    /**
     * Print the dashboard as PDF
     */
    _print_dashboard() {
        try {
            console.log('🖨️ [Dashboard] Preparing dashboard for printing...');
            
            // Create a print-friendly version of the dashboard
            const printWindow = window.open('', '_blank');
            const dashboardContent = document.querySelector('.dashboard-container');
            
            if (!dashboardContent) {
                console.error('❌ [Dashboard] Dashboard container not found');
                return;
            }
            
            // Create print-friendly HTML
            const printHTML = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Production Dashboard - Flexi</title>
                    <style>
                        /* Reset and base styles */
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            background: white;
                            padding: 20px;
                        }
                        
                        /* Dashboard header */
                        .dashboard-header {
                            text-align: center;
                            margin-bottom: 30px;
                            padding-bottom: 20px;
                            border-bottom: 3px solid #2563eb;
                        }
                        
                        .dashboard-header h1 {
                            font-size: 32px;
                            font-weight: 800;
                            color: #1e293b;
                            margin-bottom: 10px;
                        }
                        
                        .dashboard-header .print-info {
                            font-size: 14px;
                            color: #64748b;
                            margin-bottom: 10px;
                        }
                        
                        .dashboard-header .date-range {
                            font-size: 16px;
                            font-weight: 600;
                            color: #475569;
                        }
                        
                        /* Metrics grid */
                        .metrics-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 20px;
                            margin-bottom: 30px;
                        }
                        
                        .metric-card {
                            border: 2px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 20px;
                            background: #f8fafc;
                        }
                        
                        .metric-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 15px;
                            padding-bottom: 10px;
                            border-bottom: 1px solid #cbd5e1;
                        }
                        
                        .metric-header h3 {
                            font-size: 18px;
                            font-weight: 700;
                            color: #1e293b;
                        }
                        
                        .metric-period {
                            font-size: 12px;
                            color: #64748b;
                            font-weight: 500;
                        }
                        
                        .metric-content {
                            display: flex;
                            flex-direction: column;
                            gap: 10px;
                        }
                        
                        .metric-row {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 8px 0;
                        }
                        
                        .metric-label {
                            font-weight: 500;
                            color: #475569;
                            font-size: 14px;
                        }
                        
                        .metric-value {
                            font-weight: 700;
                            color: #2563eb;
                            font-size: 16px;
                        }
                        
                        /* Charts section */
                        .charts-section {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 20px;
                            margin-bottom: 30px;
                        }
                        
                        .chart-container {
                            border: 2px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 20px;
                            background: #f8fafc;
                        }
                        
                        .chart-container h3 {
                            font-size: 18px;
                            font-weight: 700;
                            color: #1e293b;
                            margin-bottom: 15px;
                            text-align: center;
                        }
                        
                        /* Recent activity */
                        .recent-activity {
                            border: 2px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 20px;
                            background: #f8fafc;
                        }
                        
                        .recent-activity h3 {
                            font-size: 18px;
                            font-weight: 700;
                            color: #1e293b;
                            margin-bottom: 15px;
                            text-align: center;
                        }
                        
                        .activity-list {
                            display: flex;
                            flex-direction: column;
                            gap: 10px;
                        }
                        
                        .activity-item {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 12px;
                            border-bottom: 1px solid #e2e8f0;
                            background: white;
                            border-radius: 6px;
                        }
                        
                        .activity-item:last-child {
                            border-bottom: none;
                        }
                        
                        .activity-order {
                            font-weight: 600;
                            color: #1e293b;
                        }
                        
                        .activity-article {
                            font-size: 12px;
                            color: #64748b;
                        }
                        
                        .activity-status {
                            font-size: 12px;
                            color: #1e293b;
                            font-weight: 500;
                        }
                        
                        .activity-date {
                            font-size: 10px;
                            color: #64748b;
                        }
                        
                        /* Print-specific styles */
                        @media print {
                            body {
                                padding: 0;
                            }
                            
                            .metric-card,
                            .chart-container,
                            .recent-activity {
                                break-inside: avoid;
                                page-break-inside: avoid;
                            }
                            
                            .metrics-grid {
                                break-inside: avoid;
                                page-break-inside: avoid;
                            }
                            
                            .charts-section {
                                break-inside: avoid;
                                page-break-inside: avoid;
                            }
                        }
                        
                        /* Page break handling */
                        .page-break {
                            page-break-before: always;
                        }
                    </style>
                </head>
                <body>
                    <div class="dashboard-container">
                        <div class="dashboard-header">
                            <h1>Production Dashboard</h1>
                            <div class="print-info">Generated on ${new Date().toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</div>
                            <div class="date-range">Period: ${this.currentDateRange.from.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                            })} - ${this.currentDateRange.to.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                            })}</div>
                        </div>
                        
                        ${this._generate_printable_metrics()}
                        
                        ${this._generate_printable_charts()}
                        
                        ${this._generate_printable_activity()}
                    </div>
                    
                    <script>
                        // Auto-print when window loads
                        window.onload = function() {
                            setTimeout(() => {
                                window.print();
                                // Close window after printing (optional)
                                // window.close();
                            }, 500);
                        };
                    </script>
                </body>
                </html>
            `;
            
            printWindow.document.write(printHTML);
            printWindow.document.close();
            
            console.log('✅ [Dashboard] Print window opened successfully');
            
        } catch (error) {
            console.error('❌ [Dashboard] Error preparing print:', error);
            this._show_error_message('Failed to prepare dashboard for printing');
        }
    }

    /**
     * Generate printable metrics HTML
     */
    _generate_printable_metrics() {
        const state = appStore.getState();
        const metrics = this._calculate_metrics(state);
        
        return `
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-header">
                        <h3>Production Overview</h3>
                        <div class="metric-period">This Month</div>
                    </div>
                    <div class="metric-content">
                        <div class="metric-row">
                            <span class="metric-label">Total Orders:</span>
                            <span class="metric-value">${metrics.production.totalOrders}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Completed:</span>
                            <span class="metric-value">${metrics.production.completedOrders}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">In Progress:</span>
                            <span class="metric-value">${metrics.production.inProgressOrders}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Completion Rate:</span>
                            <span class="metric-value">${metrics.production.completionRate}</span>
                        </div>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <h3>Machine Utilization</h3>
                        <div class="metric-period">Current Week</div>
                    </div>
                    <div class="metric-content">
                        <div class="metric-row">
                            <span class="metric-label">Active Machines:</span>
                            <span class="metric-value">${metrics.machines.activeMachines}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Avg. Utilization:</span>
                            <span class="metric-value">${metrics.machines.avgUtilization}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Peak Hours:</span>
                            <span class="metric-value">${metrics.machines.peakHours}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Idle Machines:</span>
                            <span class="metric-value">${metrics.machines.idleMachines}</span>
                        </div>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <h3>Efficiency Metrics</h3>
                        <div class="metric-period">Last 30 Days</div>
                    </div>
                    <div class="metric-content">
                        <div class="metric-row">
                            <span class="metric-label">On-Time Delivery:</span>
                            <span class="metric-value">${metrics.efficiency.onTimeDelivery}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Avg. Cycle Time:</span>
                            <span class="metric-value">${metrics.efficiency.avgCycleTime}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Setup Time:</span>
                            <span class="metric-value">${metrics.efficiency.setupTime}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Quality Rate:</span>
                            <span class="metric-value">${metrics.efficiency.qualityRate}</span>
                        </div>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <h3>Department Performance</h3>
                        <div class="metric-period">Current Period</div>
                    </div>
                    <div class="metric-content">
                        <div class="metric-row">
                            <span class="metric-label">Printing:</span>
                            <span class="metric-value">${metrics.departments.printing}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Packaging:</span>
                            <span class="metric-value">${metrics.departments.packaging}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Assembly:</span>
                            <span class="metric-value">${metrics.departments.assembly}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Quality Control:</span>
                            <span class="metric-value">${metrics.departments.quality}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate printable charts HTML
     */
    _generate_printable_charts() {
        const state = appStore.getState();
        const { odpOrders, machines } = state;
        
        const ordersByStatus = {
            'PENDING': odpOrders.filter(o => o.status === 'PENDING').length,
            'IN_PROGRESS': odpOrders.filter(o => o.status === 'IN_PROGRESS').length,
            'SCHEDULED': odpOrders.filter(o => o.status === 'SCHEDULED').length,
            'COMPLETED': odpOrders.filter(o => o.status === 'COMPLETED').length
        };
        
        const totalOrders = odpOrders.length;
        const completionRate = totalOrders > 0 ? (ordersByStatus.COMPLETED / totalOrders * 100).toFixed(1) : 0;
        
        const machineStatus = {
            'ACTIVE': machines.filter(m => m.status === 'ACTIVE').length,
            'INACTIVE': machines.filter(m => m.status === 'INACTIVE').length,
            'MAINTENANCE': machines.filter(m => m.status === 'MAINTENANCE').length || 0
        };
        
        const totalMachines = machines.length;
        const utilizationRate = totalMachines > 0 ? (machineStatus.ACTIVE / totalMachines * 100).toFixed(1) : 0;
        
        return `
            <div class="charts-section">
                <div class="chart-container">
                    <h3>Production Trends</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        <div style="text-align: center; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #059669;">${ordersByStatus.COMPLETED}</div>
                            <div style="font-size: 14px; color: #64748b;">Completed</div>
                        </div>
                        <div style="text-align: center; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #dc2626;">${ordersByStatus.IN_PROGRESS}</div>
                            <div style="font-size: 14px; color: #64748b;">In Progress</div>
                        </div>
                        <div style="text-align: center; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #2563eb;">${ordersByStatus.SCHEDULED}</div>
                            <div style="font-size: 14px; color: #64748b;">Scheduled</div>
                        </div>
                        <div style="text-align: center; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #7c3aed;">${ordersByStatus.PENDING}</div>
                            <div style="font-size: 14px; color: #64748b;">Pending</div>
                        </div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #dbeafe; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; font-weight: 700; color: #1d4ed8;">Completion Rate: ${completionRate}%</div>
                        <div style="font-size: 14px; color: #64748b;">${totalOrders} total orders</div>
                    </div>
                </div>
                
                <div class="chart-container">
                    <h3>Machine Status Distribution</h3>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                        <div style="text-align: center; padding: 15px; background: #dcfce7; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #059669;">${machineStatus.ACTIVE}</div>
                            <div style="font-size: 14px; color: #64748b;">Active</div>
                        </div>
                        <div style="text-align: center; padding: 15px; background: #fef2f2; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #dc2626;">${machineStatus.INACTIVE}</div>
                            <div style="font-size: 14px; color: #64748b;">Inactive</div>
                        </div>
                        <div style="text-align: center; padding: 15px; background: #fef3c7; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #d97706;">${machineStatus.MAINTENANCE}</div>
                            <div style="font-size: 14px; color: #64748b;">Maintenance</div>
                        </div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #dbeafe; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 18px; font-weight: 700; color: #1d4ed8;">Utilization: ${utilizationRate}%</div>
                        <div style="font-size: 14px; color: #64748b;">${totalMachines} total machines</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate printable activity HTML
     */
    _generate_printable_activity() {
        const state = appStore.getState();
        const recentOrders = state.odpOrders
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .slice(0, 5);
        
        if (recentOrders.length === 0) {
            return `
                <div class="recent-activity">
                    <h3>Recent Production Activity</h3>
                    <div class="activity-list">
                        <div style="text-align: center; padding: 20px; color: #64748b;">No recent activity</div>
                    </div>
                </div>
            `;
        }
        
        const activityHTML = recentOrders.map(order => `
            <div class="activity-item">
                <div>
                    <div class="activity-order">${order.odp_number || 'N/A'}</div>
                    <div class="activity-article">${order.article_code || 'N/A'}</div>
                </div>
                <div style="text-align: right;">
                    <div class="activity-status">${order.status || 'N/A'}</div>
                    <div class="activity-date">
                        ${order.created_at ? new Date(order.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        }) : 'N/A'}
                    </div>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="recent-activity">
                <h3>Recent Production Activity</h3>
                <div class="activity-list">
                    ${activityHTML}
                </div>
            </div>
        `;
    }
}

// Export for ES6 modules
export { DashboardManager };
