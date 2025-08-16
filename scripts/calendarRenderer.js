/**
 * Calendar Renderer - Handles rendering of all calendar view types
 * Implements Google Calendar-style layout and behavior
 */
import { Utils } from './utils.js';
import { asyncHandler } from './utils.js';

class CalendarRenderer {
    constructor(container, storage_service, machine_name) {
        this.container = container;
        this.storage_service = storage_service;
        this.machine_name = machine_name;
        this.current_date = new Date();
        this.current_view = 'month';
        
        // Bind methods to preserve context
        this.handle_calendar_click = this.handle_calendar_click.bind(this);
        this.load_availability_for_week_view = asyncHandler(
            this._load_availability_for_week_view.bind(this),
            'load_availability_for_week_view',
            { rethrow: false, fallback: null }
        );
    }
    
    init() {
        console.log('🔧 [CalendarRenderer] Initializing...');
        this.setup_event_listeners();
        console.log('🔧 [CalendarRenderer] Event listeners set up');
        this.check_storage_service_ready();
        console.log('🔧 [CalendarRenderer] Initialization complete');
    }

    /**
     * Check if storage service is ready
     */
    check_storage_service_ready() {
        if (!this.storage_service) {
            console.warn('Storage service not ready yet');
            return false;
        }
        
        // Check if required methods exist
        const requiredMethods = [
            'get_events_by_date',
            'get_machine_availability_for_date',
            'set_machine_availability'
        ];
        
        const missingMethods = requiredMethods.filter(method => 
            typeof this.storage_service[method] !== 'function'
        );
        
        if (missingMethods.length > 0) {
            console.warn('Storage service missing methods:', missingMethods);
            return false;
        }
        
        return true;
    }
    
    setup_event_listeners() {
        console.log('🔧 [CalendarRenderer] Setting up click event listener on container:', this.container);
        this.container.addEventListener('click', (e) => this.handle_calendar_click(e));
        console.log('🔧 [CalendarRenderer] Click event listener attached');
    }
    
    /**
     * Main render method - delegates to specific view renderers
     */
    render(view = this.current_view, date = this.current_date) {
        this.current_view = view;
        this.current_date = date;
        
        switch (view) {
            case 'year':
                this.render_year_view(date);
                break;
            case 'month':
                this.render_month_view(date);
                break;
            case 'week':
                this.render_week_view(date);
                break;
            default:
                this.render_month_view(date);
        }
        
        // Update time slots with real data after render
        // Only load data if storage service is ready
        if (this.check_storage_service_ready() && this.machine_name) {
            if (view === 'week') {
                // Load availability data for the week view only when needed
                this.load_availability_for_week_view(date);
                // Don't call update_time_slots_with_data here - it's handled in load_availability_for_week_view
            }
            // Removed month and year view data loading - not needed
        }
    }
    
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
                // For month view, we'll use cached data or empty arrays to avoid async calls during render
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
                            ${events.length > 0 ? `<div class="day-event">${events.length} event(s)</div>` : ""}
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
    
    /**
     * Week View - Vertical timeline with 7 day columns
     */
    render_week_view(date) {
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
                                     data-machine="${this.machine_name}">
                                    <div class="time-slot-content"></div>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        this.container.innerHTML = weekHTML;
        
        // Load availability for this week
        this.load_availability_for_week_view(date);
    }
    

    
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
    

    

    
    handle_calendar_click(e) {
        // Find the closest clickable element
        const target = e.target.closest('[data-date], [data-hour], [data-year], [data-month]') || e.target;
        
        console.log('🔍 Calendar click detected:', { target, dataset: target?.dataset, currentView: this.current_view });
        
        // Handle month cell clicks (year view)
        if (target.classList.contains('month-cell') && target.dataset.year && target.dataset.month) {
            const year = parseInt(target.dataset.year);
            const month = parseInt(target.dataset.month);
            
            console.log('🔍 Month cell clicked:', { year, month });
            
            // Navigate to month view for the clicked month
            if (this.view_manager) {
            this.view_manager.set_view('month', new Date(year, month, 1));
            } else {
                // Fallback: render month view directly
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
            
            // Navigate to month view for the clicked month
            if (this.view_manager) {
                this.view_manager.set_view('month', new Date(year, month, day));
            } else {
                // Fallback: render month view directly
                this.render('month', new Date(year, month, day));
            }
            return;
        }
        
        // Handle day cell clicks (month view)
        if (target.classList.contains('day-cell') && target.dataset.date && this.current_view === 'month') {
            const dateStr = target.dataset.date;
            const clickedDate = new Date(dateStr);
            
            console.log('🔍 Day cell clicked:', { dateStr, clickedDate, currentView: this.current_view });
            
            // Navigate to week view for the week containing the clicked date
            if (this.view_manager) {
                this.view_manager.set_view('week', clickedDate);
            } else {
                // Fallback: render week view directly
                this.render('week', clickedDate);
            }
            return;
        }
        
        // Handle time slot clicks (week view)
        if (target.dataset.date && target.dataset.hour) {
            const date = target.dataset.date;
            const hour = parseInt(target.dataset.hour);
            
            console.log('🔍 Time slot clicked:', { date, hour, currentView: this.current_view });
            
            // Handle time slot click for week view
            if (this.current_view === 'week') {
                console.log('🔍 Calling handle_time_slot_click for week view');
                this.handle_time_slot_click(date, hour);
            }
            return;
        }
        
        // Log unhandled clicks for debugging
        console.log('🔍 Click target missing data or not handled:', { target, dataset: target?.dataset });
    }
    
    /**
     * Load availability data for the week view only when needed
     */
    async _load_availability_for_week_view(date = this.current_date) {
        const weekStart = this.get_start_of_week(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        // Convert dates to YYYY-MM-DD format for Supabase
        const weekStartStr = Utils.format_date(weekStart);
        const weekEndStr = Utils.format_date(weekEnd);
        
        const availabilityData = await this.storage_service.get_machine_availability_for_week_range(
            this.machine_name,
            weekStartStr,
            weekEndStr
        );
        
        // Update the week view with the loaded data
        this.update_week_view_with_data(availabilityData);
    }

    /**
     * Update week view with availability data - simple X placement
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
            if (row.machine_name === this.machine_name && row.unavailable_hours) {
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

    /**
     * Update time slots with real data from the store
     */
    async update_time_slots_with_data() {
        if (!this.machine_name || !this.storage_service || this.current_view !== 'week') return;
        
        const timeSlots = this.container.querySelectorAll('.time-slot');
        
        for (const slot of timeSlots) {
            const dateStr = slot.dataset.date;
            const hour = parseInt(slot.dataset.hour);
            
            // Get events and availability data
            const [events, unavailableHours] = await Promise.all([
                this.storage_service.get_events_by_date(dateStr),
                this.storage_service.get_machine_availability_for_date(this.machine_name, dateStr)
            ]);
            
            const machineEvents = events.filter(e => 
                e.machine === this.machine_name && hour >= e.startHour && hour < e.endHour
            );
            const isUnavailable = unavailableHours.includes(hour);
            
            // Update slot content
            const contentDiv = slot.querySelector('.time-slot-content');
            if (contentDiv) {
                let html = '';
                
                if (isUnavailable) {
                    html += '<span class="unavailable-indicator">✕</span>';
                }
                
                if (machineEvents.length > 0) {
                    html += `<div class="time-slot-event">${machineEvents.length} event(s)</div>`;
                }
                
                contentDiv.innerHTML = html;
            }
            
            // Update slot classes
            slot.className = `time-slot ${isUnavailable ? 'unavailable' : ''} ${machineEvents.length > 0 ? 'has-events' : ''}`;
        }
    }

    async handle_time_slot_click(date_str, hour) {
        console.log('🔍 handle_time_slot_click called:', { date_str, hour, machine_name: this.machine_name, storage_service: !!this.storage_service });
        
        if (!this.machine_name || !this.storage_service) {
            console.error('❌ Missing required data:', { machine_name: this.machine_name, storage_service: !!this.storage_service });
            return;
        }
        
        try {
            // Ensure we have week availability data loaded
            console.log('🔍 Loading week availability data...');
            await this.load_availability_for_week_view(new Date(date_str));
            
            // Get current availability for this date
            console.log('🔍 Getting current availability for date:', date_str);
            const currentAvailability = await this.storage_service.get_machine_availability_for_date(this.machine_name, date_str);
            const unavailableHours = currentAvailability || [];
            
            console.log('🔍 Current availability:', { date_str, hour, unavailableHours, isCurrentlyUnavailable: unavailableHours.includes(hour) });
            
            // Check if this hour is currently unavailable
            const isCurrentlyUnavailable = unavailableHours.includes(hour);
            
            if (isCurrentlyUnavailable) {
                // Remove this hour from unavailable hours
                const newUnavailableHours = unavailableHours.filter(h => h !== hour);
                console.log('🔍 Making hour available:', { hour, newUnavailableHours });
                await this.storage_service.set_machine_availability(this.machine_name, date_str, newUnavailableHours);
            } else {
                // Add this hour to unavailable hours
                const newUnavailableHours = [...unavailableHours, hour];
                console.log('🔍 Making hour unavailable:', { hour, newUnavailableHours });
                await this.storage_service.set_machine_availability(this.machine_name, date_str, newUnavailableHours);
            }
            
            // Refresh the week view to show updated availability
            console.log('🔍 Refreshing week view...');
            await this.load_availability_for_week_view(new Date(date_str));
            
            console.log('✅ Time slot click handled successfully');
        } catch (error) {
            console.error('❌ Error in handle_time_slot_click:', error);
        }
    }
    
    // Utility methods
    get_start_of_week(date) {
        return Utils.get_start_of_week(date);
    }
}

// Export for ES6 modules
export { CalendarRenderer };