/**
 * Unified Calendar Renderer - Handles all calendar view types and use cases
 * Supports both machine settings and scheduler modes with configuration-based behavior
 * Consolidates logic from calendarRenderer.js, sharedCalendarRenderer.js, and machineCalendarManager.js
 */
import { Utils } from './utils.js';
import { asyncHandler } from './utils.js';

class CalendarRenderer {
    constructor(container, config = {}) {
        this.container = container;
        
        // Configuration with sensible defaults
        this.config = {
            // Core functionality
            mode: config.mode || 'machine-settings', // 'machine-settings' | 'scheduler'
            views: config.views || ['year', 'month', 'week'], // Available views
            
            // Display options
            startHour: config.startHour || 0,
            endHour: config.endHour || 24,
            slotHeight: config.slotHeight || 48,
            labelWidth: config.labelWidth || 150,
            
            // Feature toggles
            showMachines: config.showMachines !== undefined ? config.showMachines : true,
            interactive: config.interactive !== undefined ? config.interactive : true,
            enableDragDrop: config.enableDragDrop || false,
            
            // Data sources
            storageService: config.storageService || null,
            machineName: config.machineName || null,
            machines: config.machines || [],
            
            // Event handlers
            onSlotClick: config.onSlotClick || null,
            onSlotDrop: config.onSlotDrop || null,
            onSlotHover: config.onSlotHover || null,
            onViewChange: config.onViewChange || null
        };
        
        // Internal state
        this.current_view = 'month';
        this.current_date = new Date();
        this.view_manager = null;
        
        // Bind methods to preserve context
        this.handle_calendar_click = this.handle_calendar_click.bind(this);
        this.handle_drag_drop = this.handle_drag_drop.bind(this);
        
        // Initialize
        this.setup_event_listeners();
        this.check_storage_service_ready();
    }
    
    /**
     * Initialize the calendar renderer
     */
    init() {
        console.log('🔧 [CalendarRenderer] Initializing in', this.config.mode, 'mode...');
        this.setup_event_listeners();
        console.log('🔧 [CalendarRenderer] Event listeners set up');
        this.check_storage_service_ready();
        console.log('🔧 [CalendarRenderer] Initialization complete');
    }

    /**
     * Set the view manager reference (for navigation)
     */
    set_view_manager(viewManager) {
        this.view_manager = viewManager;
    }

    /**
     * Check if storage service is ready
     */
    check_storage_service_ready() {
        if (!this.config.storageService) {
            console.warn('Storage service not ready yet');
            return false;
        }
        
        // Check if required methods exist based on mode
        const requiredMethods = this.config.mode === 'scheduler' 
            ? ['get_events_by_date', 'get_machine_availability_for_date']
            : ['get_events_by_date', 'get_machine_availability_for_date', 'set_machine_availability'];
        
        const missingMethods = requiredMethods.filter(method => 
            typeof this.config.storageService[method] !== 'function'
        );
        
        if (missingMethods.length > 0) {
            console.warn('Storage service missing methods:', missingMethods);
            return false;
        }
        
        return true;
    }
    
    /**
     * Setup event listeners based on configuration
     */
    setup_event_listeners() {
        console.log('🔧 [CalendarRenderer] Setting up event listeners for', this.config.mode, 'mode');
        
        // Always attach click handler
        this.container.addEventListener('click', (e) => this.handle_calendar_click(e));
        
        // Attach drag & drop if enabled
        if (this.config.enableDragDrop) {
            this.container.addEventListener('dragover', (e) => this.handle_drag_over(e));
            this.container.addEventListener('drop', (e) => this.handle_drag_drop(e));
        }
        
        // Attach hover handlers if provided
        if (this.config.onSlotHover) {
            this.container.addEventListener('mouseenter', (e) => this.handle_slot_hover(e, 'enter'));
            this.container.addEventListener('mouseleave', (e) => this.handle_slot_hover(e, 'leave'));
        }
        
        console.log('🔧 [CalendarRenderer] Event listeners attached');
    }
    
    /**
     * Main render method - delegates to specific view renderers
     */
    render(view = this.current_view, date = this.current_date) {
        this.current_view = view;
        this.current_date = date;
        
        console.log('🔧 [CalendarRenderer] Rendering', view, 'view in', this.config.mode, 'mode');
        
        switch (view) {
            case 'year':
                this.render_year_view(date);
                break;
            case 'month':
                this.render_month_view(date);
                break;
            case 'week':
                if (this.config.mode === 'scheduler') {
                    this.render_scheduler_week_view(date);
                } else {
                    this.render_machine_week_view(date);
                }
                break;
            default:
                this.render_month_view(date);
        }
        
        // Load data for the current view
        this.load_data_for_view(view, date);
    }
    
    /**
     * Load data based on view and mode
     */
    async load_data_for_view(view, date) {
        if (!this.check_storage_service_ready()) return;
        
        if (view === 'week') {
            if (this.config.mode === 'scheduler') {
                // Scheduler mode loads machine availability for the week
                await this.load_machine_availability_for_week(date);
            } else {
                // Machine settings mode loads availability for specific machine
                await this.load_availability_for_week_view(date);
            }
        }
    }

    // ===== YEAR VIEW =====
    
    /**
     * Year View - Grid of 12 months (3x4)
     */
    render_year_view(date) {
        const year = date.getFullYear();
        const current_month = new Date().getMonth();
        const current_year = new Date().getFullYear();
        
        let html = `
            <div class="calendar-year-grid">
        `;
        
        const month_names = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        for (let month = 0; month < 12; month++) {
            const is_current_month = year === current_year && month === current_month;
            
            html += `
                <div class="month-cell ${is_current_month ? 'current-month' : ''}" 
                     data-year="${year}" data-month="${month}">
                    <div class="month-header">${month_names[month]}</div>
                    <div class="month-mini-calendar">
                        ${this.render_mini_month(year, month)}
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        this.container.innerHTML = html;
    }

    // ===== MONTH VIEW =====
    
    /**
     * Month View - Traditional calendar grid
     */
    render_month_view(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const first_day = new Date(year, month, 1);
        const last_day = new Date(year, month + 1, 0);
        const start_date = new Date(first_day);
        start_date.setDate(start_date.getDate() - first_day.getDay()); // Start from Sunday
        
        let html = `
            <div class="calendar-month-grid">
                <div class="weekday-headers">
                    <div class="weekday-header">Sun</div>
                    <div class="weekday-header">Mon</div>
                    <div class="weekday-header">Tue</div>
                    <div class="weekday-header">Wed</div>
                    <div class="weekday-header">Thu</div>
                    <div class="weekday-header">Fri</div>
                    <div class="weekday-header">Sat</div>
                </div>
                <div class="month-days">
        `;
        
        const current = new Date(start_date);
        const today = new Date();
        
        for (let week = 0; week < 6; week++) {
            html += `<div class="week-row" data-week="${week}">`;
            
            for (let day = 0; day < 7; day++) {
                const is_current_month = current.getMonth() === month;
                const is_today = current.toDateString() === today.toDateString();
                const date_str = Utils.format_date(current);
                const events = []; // Will be populated by async data loading
                const unavailable_hours = []; // Will be populated by async data loading
                const is_unavailable = false; // Will be updated after data loads
                const is_partially_unavailable = false; // Will be updated after data loads
                
                html += `
                    <div class="day-cell ${is_current_month ? 'current-month' : 'other-month'} ${is_today ? 'today' : ''} ${is_unavailable ? 'unavailable' : ''} ${is_partially_unavailable ? 'partially-unavailable' : ''}"
                         data-date="${date_str}">
                        <div class="day-number">
                            ${current.getDate()}
                            ${is_unavailable ? '<span class="unavailable-indicator">✕</span>' : ''}
                            ${is_partially_unavailable ? '<span class="partially-unavailable-indicator">⚠</span>' : ''}
                        </div>
                        <div class="day-events">
                            ${events.length > 0 ? `<div class="day-event">${events.length} event(s)</div>` : ''}
                        </div>
                    </div>
                `;
                
                current.setDate(current.getDate() + 1);
            }
            
            html += `</div>`;
            
            // Break if we've filled the month and are past it
            if (current.getMonth() > month) break;
        }
        
        html += `
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
    }

    // ===== WEEK VIEWS =====
    
    /**
     * Scheduler Week View - Machine grid with time slots
     */
    render_scheduler_week_view(date) {
        const weekStart = this.get_start_of_week(date);
        const weekDays = this.generate_week_days(weekStart);
        
        const html = `
            <div class="calendar-grid scheduler-mode">
                <div class="calendar-header-row">
                    <div class="machine-label-header">Machines</div>
                    ${this.render_time_header()}
                </div>
                <div class="calendar-body">
                    ${this.render_machine_rows(weekDays)}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.attach_scheduler_event_listeners();
    }
    
    /**
     * Machine Settings Week View - Single machine availability
     */
    render_machine_week_view(date) {
        const weekStart = this.get_start_of_week(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(day.getDate() + i);
            weekDays.push(day);
        }
        
        const timeSlots = [];
        for (let hour = 0; hour < 24; hour++) {
            timeSlots.push(hour);
        }
        
        const weekHTML = `
            <div class="calendar-week-grid">
                <div class="week-header">
                    <div class="time-column-header">Time</div>
                    ${weekDays.map(day => `
                        <div class="day-column-header">
                            <div class="day-name">${day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            <div class="day-number ${Utils.is_date_today(day) ? 'today' : ''}">${day.getDate()}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="week-body">
                    ${timeSlots.map(hour => `
                        <div class="time-row">
                            <div class="time-label">${hour.toString().padStart(2, '0')}:00</div>
                            ${weekDays.map(day => `
                                <div class="time-slot" 
                                     data-date="${Utils.format_date(day)}" 
                                     data-hour="${hour}"
                                     data-machine="${this.config.machineName}">
                                    <div class="time-slot-content"></div>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        this.container.innerHTML = weekHTML;
    }

    // ===== SCHEDULER-SPECIFIC METHODS =====
    
    /**
     * Render time header for scheduler mode
     */
    render_time_header() {
        let html = '';
        for (let hour = this.config.startHour; hour < this.config.endHour; hour++) {
            html += `
                <div class="time-slot-header" data-hour="${hour}">
                    ${this.format_hour(hour)}
                </div>
            `;
        }
        return html;
    }
    
    /**
     * Render machine rows for scheduler mode
     */
    render_machine_rows(weekDays) {
        if (!this.config.machines || this.config.machines.length === 0) {
            return '<div class="empty-state">No machines available</div>';
        }
        
        return this.config.machines.map(machine => `
            <div class="machine-row" data-machine-id="${machine.id}">
                <div class="machine-label">
                    <div class="machine-name">${machine.name}</div>
                    <div class="machine-city">${machine.city || ''}</div>
                </div>
                <div class="machine-slots">
                    ${this.render_machine_time_slots(machine, weekDays)}
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Render time slots for a specific machine
     */
    render_machine_time_slots(machine, weekDays) {
        let html = '';
        for (let hour = this.config.startHour; hour < this.config.endHour; hour++) {
            html += `
                <div class="time-slot" 
                     data-hour="${hour}" 
                     data-machine="${machine.id}"
                     data-date="${Utils.format_date(weekDays[0])}">
                </div>
            `;
        }
        return html;
    }

    // ===== MINI MONTH RENDERING =====
    
    /**
     * Render mini month for year view
     */
    render_mini_month(year, month) {
        const first_day = new Date(year, month, 1);
        const last_day = new Date(year, month + 1, 0);
        const start_date = new Date(first_day);
        start_date.setDate(start_date.getDate() - first_day.getDay());
        
        let html = '<div class="mini-month-grid">';
        const current = new Date(start_date);
        
        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 7; day++) {
                const is_current_month = current.getMonth() === month;
                
                html += `
                    <div class="mini-day ${is_current_month ? 'current-month' : ''}"
                         data-year="${year}" 
                         data-month="${month}" 
                         data-day="${current.getDate()}"
                         data-date="${Utils.format_date(current)}">
                        ${current.getDate()}
                    </div>
                `;
                
                current.setDate(current.getDate() + 1);
            }
            if (current.getMonth() > month) break;
        }
        
        html += '</div>';
        return html;
    }

    // ===== EVENT HANDLING =====
    
    /**
     * Handle calendar clicks based on mode
     */
    handle_calendar_click(e) {
        const target = e.target.closest('[data-date], [data-hour], [data-year], [data-month]') || e.target;
        
        console.log('🔍 Calendar click detected:', { target, dataset: target?.dataset, currentView: this.current_view, mode: this.config.mode });
        
        if (this.config.mode === 'scheduler') {
            this.handle_scheduler_click(target, e);
        } else {
            this.handle_machine_click(target, e);
        }
    }
    
    /**
     * Handle clicks in scheduler mode
     */
    handle_scheduler_click(target, e) {
        if (target.classList.contains('time-slot')) {
            const hour = parseInt(target.dataset.hour);
            const machineId = target.dataset.machine;
            const date = target.dataset.date;
            
            if (this.config.onSlotClick) {
                this.config.onSlotClick({ hour, machineId, date, target, event: e });
            }
        }
    }
    
    /**
     * Handle clicks in machine settings mode
     */
    handle_machine_click(target, e) {
        // Handle month cell clicks (year view)
        if (target.classList.contains('month-cell') && target.dataset.year && target.dataset.month) {
            const year = parseInt(target.dataset.year);
            const month = parseInt(target.dataset.month);
            
            console.log('🔍 Month cell clicked:', { year, month });
            
            if (this.view_manager) {
                this.view_manager.set_view('month', new Date(year, month, 1));
            } else {
                this.render('month', new Date(year, month, 1));
            }
            return;
        }
        
        // Handle mini month day clicks (year view)
        if (target.classList.contains('mini-day') && target.dataset.year && target.dataset.month) {
            const year = parseInt(target.dataset.year);
            const month = parseInt(target.dataset.month);
            const day = parseInt(target.dataset.day);
            
            console.log('🔍 Mini month day clicked:', { year, month, day });
            
            if (this.view_manager) {
                this.view_manager.set_view('month', new Date(year, month, day));
            } else {
                this.render('month', new Date(year, month, day));
            }
            return;
        }
        
        // Handle day cell clicks (month view)
        if (target.classList.contains('day-cell') && target.dataset.date && this.current_view === 'month') {
            const dateStr = target.dataset.date;
            const clickedDate = new Date(dateStr);
            
            console.log('🔍 Day cell clicked:', { dateStr, clickedDate, currentView: this.current_view });
            
            if (this.view_manager) {
                this.view_manager.set_view('week', clickedDate);
            } else {
                this.render('week', clickedDate);
            }
            return;
        }
        
        // Handle time slot clicks (week view)
        if (target.dataset.date && target.dataset.hour) {
            const date = target.dataset.date;
            const hour = parseInt(target.dataset.hour);
            
            console.log('🔍 Time slot clicked:', { date, hour, currentView: this.current_view });
            
            if (this.current_view === 'week') {
                this.handle_time_slot_click(date, hour);
            }
            return;
        }
        
        console.log('🔍 Click target missing data or not handled:', { target, dataset: target?.dataset });
    }
    
    /**
     * Handle drag and drop events
     */
    handle_drag_over(e) {
        e.preventDefault();
        const target = e.target.closest('.time-slot');
        if (target) {
            target.classList.add('drag-over');
        }
    }
    
    handle_drag_drop(e) {
        e.preventDefault();
        const target = e.target.closest('.time-slot');
        if (target && this.config.onSlotDrop) {
            const hour = parseInt(target.dataset.hour);
            const machineId = target.dataset.machine;
            const date = target.dataset.date;
            
            this.config.onSlotDrop({ hour, machineId, date, target, event: e });
        }
        
        // Remove drag-over styling
        this.container.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }
    
    /**
     * Handle slot hover events
     */
    handle_slot_hover(e, type) {
        if (this.config.onSlotHover) {
            const target = e.target.closest('.time-slot');
            if (target) {
                this.config.onSlotHover({ target, type, event: e });
            }
        }
    }

    // ===== MACHINE SETTINGS SPECIFIC METHODS =====
    
    /**
     * Handle time slot click for machine availability
     */
    async handle_time_slot_click(date_str, hour) {
        // Prevent multiple rapid clicks
        if (this._clickProcessing) {
            console.log('🔍 Click already processing, ignoring...');
            return;
        }
        
        this._clickProcessing = true;
        
        console.log('🔍 handle_time_slot_click called:', { date_str, hour, machine_name: this.config.machineName, storage_service: !!this.config.storageService });
        
        if (!this.config.machineName || !this.config.storageService) {
            console.error('❌ Missing required data:', { machine_name: this.config.machineName, storage_service: !!this.config.storageService });
            this._clickProcessing = false;
            return;
        }
        
        try {
            // Get current availability for this date first
            console.log('🔍 Getting current availability for date:', date_str);
            let currentAvailability;
            
            try {
                currentAvailability = await this.config.storageService.get_machine_availability_for_date(this.config.machineName, date_str);
            } catch (dbError) {
                console.warn('⚠️ Database read failed, using empty availability:', dbError);
                currentAvailability = [];
            }
            
            const unavailableHours = currentAvailability || [];
            
            console.log('🔍 Current availability:', { date_str, hour, unavailableHours, isCurrentlyUnavailable: unavailableHours.includes(hour) });
            
            // Check if this hour is currently unavailable
            const isCurrentlyUnavailable = unavailableHours.includes(hour);
            
            if (isCurrentlyUnavailable) {
                // Remove this hour from unavailable hours
                const newUnavailableHours = unavailableHours.filter(h => h !== hour);
                console.log('🔍 Making hour available:', { hour, newUnavailableHours });
                
                try {
                    await this.config.storageService.set_machine_availability(this.config.machineName, date_str, newUnavailableHours);
                    console.log('✅ Hour made available successfully');
                } catch (setError) {
                    console.error('❌ Failed to set availability:', setError);
                    // Continue anyway to update UI
                }
            } else {
                // Add this hour to unavailable hours
                const newUnavailableHours = [...unavailableHours, hour];
                console.log('🔍 Making hour unavailable:', { hour, newUnavailableHours });
                
                try {
                    await this.config.storageService.set_machine_availability(this.config.machineName, date_str, newUnavailableHours);
                    console.log('✅ Hour made unavailable successfully');
                } catch (setError) {
                    console.error('❌ Failed to set availability:', setError);
                    // Continue anyway to update UI
                }
            }
            
            // Refresh the week view to show updated availability
            console.log('🔍 Refreshing week view...');
            try {
                await this.load_availability_for_week_view(new Date(date_str));
            } catch (refreshError) {
                console.warn('⚠️ Failed to refresh week view:', refreshError);
                // Try to update the current slot directly
                this._update_single_slot_availability(date_str, hour, !isCurrentlyUnavailable);
            }
            
            console.log('✅ Time slot click handled successfully');
        } catch (error) {
            console.error('❌ Error in handle_time_slot_click:', error);
            
            // Show user-friendly error message
            if (error.code === 'PGRST204') {
                console.error('❌ Database schema error - table or column not found');
            } else if (error.code === '406') {
                console.error('❌ Database access error - check permissions or table structure');
            }
        } finally {
            // Always reset the processing flag
            this._clickProcessing = false;
        }
    }
    
    /**
     * Load availability for week view
     */
    load_availability_for_week_view = asyncHandler(
        async (date = this.current_date) => {
            if (!this.config.storageService || !this.config.machineName) return;
            
            const weekStart = this.get_start_of_week(date);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            const weekStartStr = Utils.format_date(weekStart);
            const weekEndStr = Utils.format_date(weekEnd);
            
            const availabilityData = await this.config.storageService.get_machine_availability_for_week_range(
                this.config.machineName,
                weekStartStr,
                weekEndStr
            );
            
            this.update_week_view_with_data(availabilityData);
        },
        'load_availability_for_week_view',
        { rethrow: false, fallback: null }
    );
    
    /**
     * Load machine availability for scheduler week view
     */
    async load_machine_availability_for_week(date) {
        if (!this.config.storageService) return;
        
        // Load availability for all machines for the week
        const weekStart = this.get_start_of_week(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        const weekStartStr = Utils.format_date(weekStart);
        const weekEndStr = Utils.format_date(weekEnd);
        
        // This would need to be implemented in the storage service
        // For now, we'll just log that we're loading data
        console.log('🔍 Loading machine availability for week:', weekStartStr, 'to', weekEndStr);
    }
    
    /**
     * Update week view with availability data
     */
    update_week_view_with_data(availabilityData) {
        if (!availabilityData || !Array.isArray(availabilityData)) return;
        
        // First, clear all existing unavailable indicators from the week
        const allTimeSlots = this.container.querySelectorAll('.time-slot');
        allTimeSlots.forEach(slot => {
            slot.classList.remove('unavailable');
            slot.removeAttribute('data-unavailable');
            slot.innerHTML = '<div class="time-slot-content"></div>';
        });
        
        // Now apply the current availability data
        availabilityData.forEach(row => {
            if (row.machine_name === this.config.machineName && row.unavailable_hours) {
                const dateStr = row.date;
                const unavailableHours = row.unavailable_hours;
                
                unavailableHours.forEach(hour => {
                    const slot = this.container.querySelector(`[data-date="${dateStr}"][data-hour="${hour}"]`);
                    if (slot) {
                        slot.classList.add('unavailable');
                        slot.setAttribute('data-unavailable', 'true');
                        slot.innerHTML = '<div class="time-slot-content"><span class="unavailable-indicator">X</span></div>';
                        slot.title = `Machine unavailable from ${hour}:00 to ${hour + 1}:00`;
                    }
                });
            }
        });
    }

    // ===== UTILITY METHODS =====
    
    /**
     * Get start of week for a given date
     */
    get_start_of_week(date) {
        return Utils.get_start_of_week(date);
    }
    
    /**
     * Generate week days array
     */
    generate_week_days(weekStart) {
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(day.getDate() + i);
            weekDays.push(day);
        }
        return weekDays;
    }
    
    /**
     * Format hour for display
     */
    format_hour(hour) {
        return Utils.format_hour(hour);
    }
    
    /**
     * Attach scheduler-specific event listeners
     */
    attach_scheduler_event_listeners() {
        // Additional event listeners specific to scheduler mode
        if (this.config.enableDragDrop) {
            console.log('🔧 [CalendarRenderer] Scheduler drag & drop listeners attached');
        }
    }

    /**
     * Update a single slot's availability status (fallback method)
     */
    _update_single_slot_availability(dateStr, hour, isUnavailable) {
        const slot = this.container.querySelector(`[data-date="${dateStr}"][data-hour="${hour}"]`);
        if (!slot) {
            console.warn('⚠️ Slot not found for update:', { dateStr, hour });
            return;
        }

        if (isUnavailable) {
            slot.classList.add('unavailable');
            slot.setAttribute('data-unavailable', 'true');
            slot.innerHTML = '<div class="time-slot-content"><span class="unavailable-indicator">X</span></div>';
            slot.title = `Machine unavailable from ${hour}:00 to ${hour + 1}:00`;
        } else {
            slot.classList.remove('unavailable');
            slot.removeAttribute('data-unavailable');
            slot.innerHTML = '<div class="time-slot-content"></div>';
            slot.title = '';
        }
        
        console.log('🔧 [CalendarRenderer] Single slot updated:', { dateStr, hour, isUnavailable });
    }
}

// Export for ES6 modules
export { CalendarRenderer };