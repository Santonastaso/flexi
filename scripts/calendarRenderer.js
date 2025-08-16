/**
 * Calendar Renderer - Handles rendering of all calendar view types
 * Implements Google Calendar-style layout and behavior
 */
import { Utils } from './utils.js';

class CalendarRenderer {
    constructor(container, view_manager, storage_service) {
        this.container = container;
        this.view_manager = view_manager;
        this.storage_service = storage_service;
        this.current_view = 'month';
        this.current_date = new Date();
        this.machine_name = null;
        
        // Time range for week view
        this.start_hour = 0;
        this.end_hour = 24;
        
        this.init();
    }
    
    init() {
        this.setup_event_listeners();
        this.check_storage_service_ready();
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
        this.container.addEventListener('click', (e) => this.handle_calendar_click(e));
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
            const month_events = this.get_month_event_count(year, month);
            
            html += `
                <div class="month-cell ${is_current_month ? 'current-month' : ''}" 
                     data-year="${year}" data-month="${month}">
                    <div class="month-header">${month_names[month]}</div>
                    <div class="month-mini-calendar">
                        ${this.render_mini_month(year, month)}
                    </div>
                    ${month_events > 0 ? `<div class="event-indicator">${month_events} events</div>` : ''}
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
                            ${this.render_day_events(events)}
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
        const start_of_week = this.get_start_of_week(date);
        const days = [];
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(start_of_week);
            day.setDate(day.getDate() + i);
            days.push(day);
        }
        
        let html = `
            <div class="calendar-week-grid">
                <div class="week-header">
                    <div class="time-column-header"></div>
                    ${days.map(day => `
                        <div class="day-column-header">
                            <div class="day-name">${this.get_day_name(day.getDay(), true)}</div>
                            <div class="day-number ${this.is_today(day) ? 'today' : ''}">${day.getDate()}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="week-body">
                    ${this.render_week_time_slots(days)}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // Debug: Log the actual HTML structure
        console.log('🔍 Rendered week view HTML:', this.container.innerHTML);
        console.log('🔍 Time slots found:', this.container.querySelectorAll('.time-slot').length);
        console.log('🔍 Day headers found:', this.container.querySelectorAll('.day-column-header').length);
        
        // Debug: Check grid layout
        const header = this.container.querySelector('.week-header');
        const firstRow = this.container.querySelector('.time-row');
        if (header && firstRow) {
            console.log('🔍 Header grid columns:', getComputedStyle(header).gridTemplateColumns);
            console.log('🔍 Time row grid columns:', getComputedStyle(firstRow).gridTemplateColumns);
        }
    }
    
    render_week_time_slots(days) {
        let html = '';
        
        for (let hour = this.start_hour; hour < this.end_hour; hour++) {
            html += `
                <div class="time-row" data-hour="${hour}">
                    <div class="time-label">${this.format_hour(hour)}</div>
                    ${days.map(day => {
                        const date_str = Utils.format_date(day);
                        console.log(`🔍 Rendering time slot for ${date_str} at hour ${hour}`);
                        return `
                            <div class="time-slot" data-date="${date_str}" data-hour="${hour}">
                                <div class="time-slot-content"></div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        return html;
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
                // For mini month, we'll use placeholder data to avoid async calls during render
                const has_events = false; // Will be updated when data loads
                
                html += `
                    <div class="mini-day ${is_current_month ? 'current-month' : ''} ${has_events ? 'has-events' : ''}">
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
    
    render_day_events(events) {
        return events.slice(0, 3).map(event => `
            <div class="day-event ${event.type}" title="${event.title}">
                ${event.title}
            </div>
        `).join('') + (events.length > 3 ? `<div class="more-events">+${events.length - 3} more</div>` : '');
    }
    
    render_time_slot_events(events) {
        return events.map(event => `
            <div class="time-slot-event ${event.type}" title="${event.title}">
                ${event.title}
            </div>
        `).join('');
    }
    
    handle_calendar_click(e) {
        console.log('🔍 Calendar click detected:', e.target);
        console.log('🔍 Target dataset:', e.target.dataset);
        console.log('🔍 Closest data-date:', e.target.closest('[data-date]'));
        console.log('🔍 Closest data-hour:', e.target.closest('[data-hour]'));
        
        const target = e.target.closest('[data-year][data-month]') || 
                      e.target.closest('[data-week]') ||
                      e.target.closest('[data-date]');
        
        console.log('🔍 Final target:', target);
        console.log('🔍 Target dataset:', target?.dataset);
        
        if (!target) return;
        
        if (target.dataset.year && target.dataset.month) {
            // Year view - zoom to month
            const year = parseInt(target.dataset.year);
            const month = parseInt(target.dataset.month);
            this.view_manager.set_view('month', new Date(year, month, 1));
        } else if (target.dataset.week && this.current_view === 'month') {
            // Month view - zoom to week
            const week_element = target.closest('.week-row');
            const first_day = week_element.querySelector('.day-cell[data-date]');
            if (first_day) {
                const date = new Date(first_day.dataset.date);
                this.view_manager.set_view('week', date);
            }
        } else if (target.dataset.date && target.dataset.hour) {
            // Time slot click - toggle availability
            console.log('🔍 Time slot clicked:', target.dataset.date, target.dataset.hour);
            this.handle_time_slot_click(target.dataset.date, parseInt(target.dataset.hour));
        }
    }
    
    /**
     * Load availability data for the week view only when needed
     */
    async load_availability_for_week_view(date) {
        if (!this.machine_name || !this.storage_service) return;
        
        try {
            console.log('🔍 Loading availability for week view, date:', date);
            
            // Calculate the week range
            const weekStart = Utils.get_start_of_week(date);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            console.log('🔍 Week range:', weekStart.toDateString(), 'to', weekEnd.toDateString());
            
            // Make ONE database call to get all availability for the week
            const weekStartStr = weekStart.toISOString().split('T')[0];
            const weekEndStr = weekEnd.toISOString().split('T')[0];
            
            // Get all machine availability for this week in one query
            const availabilityData = await this.storage_service.get_machine_availability_for_week_range(
                this.machine_name, 
                weekStartStr, 
                weekEndStr
            );
            
            console.log('🔍 Week availability loaded in one query:', availabilityData);
            
            // Update the UI with the loaded data
            this.update_week_view_with_data(availabilityData);
            
        } catch (error) {
            console.warn('Could not load availability for week view:', error);
        }
    }

    /**
     * Update week view with availability data - simple X placement
     */
    update_week_view_with_data(availabilityData) {
        if (!availabilityData || !Array.isArray(availabilityData)) return;
        
        console.log('🔍 Updating week view with availability data');
        
        // First, clear all unavailable indicators from the current week
        const allTimeSlots = this.container.querySelectorAll('.time-slot');
        allTimeSlots.forEach(slot => {
            slot.classList.remove('unavailable');
            slot.dataset.unavailable = 'false';
            const content = slot.querySelector('.time-slot-content');
            if (content) {
                content.innerHTML = '';
            }
        });
        
        // Then, mark the currently unavailable slots
        availabilityData.forEach(record => {
            const { date, unavailable_hours } = record;
            
            if (unavailable_hours && Array.isArray(unavailable_hours)) {
                unavailable_hours.forEach(hour => {
                    // Find the time slot for this date and hour
                    const timeSlot = this.container.querySelector(`[data-date="${date}"][data-hour="${hour}"]`);
                    if (timeSlot) {
                        // Mark as unavailable
                        timeSlot.classList.add('unavailable');
                        timeSlot.dataset.unavailable = 'true';
                        
                        // Add X indicator
                        const content = timeSlot.querySelector('.time-slot-content');
                        if (content) {
                            content.innerHTML = '<span class="unavailable-indicator">X</span>';
                        }
                        
                        console.log(`🔍 Marked ${date} hour ${hour} as unavailable`);
                    }
                });
            }
        });
        
        console.log('🔍 Week view updated with availability data');
    }

    /**
     * Update time slots with real data from the store
     */
    async update_time_slots_with_data() {
        if (!this.machine_name || !this.storage_service || this.current_view !== 'week') return;
        
        try {
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
                        html += this.render_time_slot_events(machineEvents);
                    }
                    
                    contentDiv.innerHTML = html;
                }
                
                // Update slot classes
                slot.className = `time-slot ${isUnavailable ? 'unavailable' : ''} ${machineEvents.length > 0 ? 'has-events' : ''}`;
            }
        } catch (error) {
            console.error('Error updating time slots with data:', error);
        }
    }

    async handle_time_slot_click(date_str, hour) {
        if (!this.machine_name || !this.storage_service) return;
        
        try {
            console.log('🔍 Time slot clicked:', date_str, 'hour:', hour);
            
            // Ensure availability data is loaded for this date
            const dateObj = new Date(date_str);
            const weekStart = Utils.get_start_of_week(dateObj);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            // Load availability for the entire week if not already loaded
            await this.storage_service.load_machine_availability_for_week?.(this.machine_name, weekStart, weekEnd);
            
            // Check if this time slot is already unavailable
            const unavailableHours = await this.storage_service.get_machine_availability_for_date(this.machine_name, date_str);
            const isCurrentlyUnavailable = unavailableHours.includes(hour);
            
            console.log('🔍 Current unavailable hours:', unavailableHours);
            console.log('🔍 Hour', hour, 'is currently unavailable:', isCurrentlyUnavailable);
            
            if (isCurrentlyUnavailable) {
                // Remove the hour from unavailable hours
                const newHours = unavailableHours.filter(h => h !== hour);
                await this.storage_service.set_machine_availability(this.machine_name, date_str, newHours);
                console.log(`✅ Hour ${hour} marked as available for ${date_str}`);
            } else {
                // Check if this slot is occupied by scheduled events
                const scheduled_events = await this.storage_service.get_events_by_date(date_str);
                const has_scheduled_events = scheduled_events.some(e => 
                    e.machine === this.machine_name && hour >= e.startHour && hour < e.endHour
                );
                
                if (has_scheduled_events) {
                    alert('This slot is occupied by a scheduled task. You cannot mark it as unavailable.');
                    return;
                }
                
                // Add the hour to unavailable hours
                const newHours = [...unavailableHours, hour].sort((a, b) => a - b);
                await this.storage_service.set_machine_availability(this.machine_name, date_str, newHours);
                console.log(`✅ Hour ${hour} marked as unavailable for ${date_str}`);
            }
            
            // Manually refresh the week view to show the change
            if (this.current_view === 'week') {
                this.load_availability_for_week_view(this.current_date);
            }
            
        } catch (error) {
            console.error('Error toggling time slot availability:', error);
            alert(`Error updating availability: ${error.message}`);
        }
    }
    
    // Utility methods
    get_start_of_week(date) {
        return Utils.get_start_of_week(date);
    }
    
    get_month_event_count(year, month) {
        if (!this.machine_name) return 0;
        // For now, return 0 to avoid async calls during render
        return 0;
    }
    
    format_hour(hour) {
        return Utils.format_hour(hour);
    }
    
    get_day_name(day_index, short = false) {
        return Utils.get_day_of_week_name(day_index, short);
    }
    
    is_today(date) {
        return Utils.is_date_today(date);
    }
}

// Export for ES6 modules
export { CalendarRenderer };