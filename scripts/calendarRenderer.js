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
                this.update_time_slots_with_data();
            } else if (view === 'month') {
                // Load availability data for the month view
                this.load_availability_for_month_view(date);
                this.update_month_view_with_data();
            } else if (view === 'year') {
                // Load availability data for the year view
                this.load_availability_for_year_view(date);
                this.update_year_view_with_data();
            }
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
    }
    
    render_week_time_slots(days) {
        let html = '';
        
        for (let hour = this.start_hour; hour < this.end_hour; hour++) {
            html += `
                <div class="time-row" data-hour="${hour}">
                    <div class="time-label">${this.format_hour(hour)}</div>
                    ${days.map(day => {
                        const date_str = Utils.format_date(day);
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
        const target = e.target.closest('[data-year][data-month]') || 
                      e.target.closest('[data-week]') ||
                      e.target.closest('[data-date]');
        
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
            this.handle_time_slot_click(target.dataset.date, parseInt(target.dataset.hour));
        }
    }
    
    /**
     * Load availability data for the week view only when needed
     */
    async load_availability_for_week_view(date) {
        if (!this.machine_name || !this.storage_service) return;
        
        try {
            // Calculate the week range
            const weekStart = Utils.get_start_of_week(date);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            // Load availability data for this specific week
            await this.storage_service.load_machine_availability_for_week?.(this.machine_name, weekStart, weekEnd);
        } catch (error) {
            console.warn('Could not load availability for week view:', error);
        }
    }

    /**
     * Load availability data for the month view only when needed
     */
    async load_availability_for_month_view(date) {
        if (!this.machine_name || !this.storage_service) return;
        
        try {
            // Calculate the month range
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            // Load availability data for this specific month
            await this.storage_service.load_machine_availability_for_month?.(this.machine_name, monthStart, monthEnd);
        } catch (error) {
            console.warn('Could not load availability for month view:', error);
        }
    }

    /**
     * Load availability data for the year view only when needed
     */
    async load_availability_for_year_view(date) {
        if (!this.machine_name || !this.storage_service) return;
        
        try {
            // Calculate the year range
            const yearStart = new Date(date.getFullYear(), 0, 1);
            const yearEnd = new Date(date.getFullYear(), 11, 31);
            
            // Load availability data for this specific year
            await this.storage_service.load_machine_availability_for_year?.(this.machine_name, yearStart, yearEnd);
        } catch (error) {
            console.warn('Could not load availability for year view:', error);
        }
    }

    /**
     * Update year view with real data from the store
     */
    async update_year_view_with_data() {
        if (!this.machine_name || !this.storage_service || this.current_view !== 'year') return;
        
        try {
            // For year view, we'll update event counts for each month
            const monthCells = this.container.querySelectorAll('.month-cell');
            
            for (const cell of monthCells) {
                const year = parseInt(cell.dataset.year);
                const month = parseInt(cell.dataset.month);
                
                // Get events for this month
                const events = await this.storage_service.getEventsByMachine(this.machine_name);
                const monthEvents = events.filter(e => {
                    const event_date = new Date(e.date);
                    return event_date.getFullYear() === year && event_date.getMonth() === month;
                });
                
                // Update event indicator
                const eventIndicator = cell.querySelector('.event-indicator');
                if (eventIndicator) {
                    if (monthEvents.length > 0) {
                        eventIndicator.textContent = `${monthEvents.length} events`;
                        eventIndicator.style.display = 'block';
                    } else {
                        eventIndicator.style.display = 'none';
                    }
                }

                // Update mini month grid with event indicators
                const miniMonthGrid = cell.querySelector('.mini-month-grid');
                if (miniMonthGrid) {
                    await this.update_mini_month_with_data(miniMonthGrid, year, month);
                }
            }
        } catch (error) {
            console.error('Error updating year view with data:', error);
        }
    }

    /**
     * Update mini month grid with real data
     */
    async update_mini_month_with_data(miniMonthGrid, year, month) {
        if (!this.machine_name || !this.storage_service) return;
        
        try {
            const miniDays = miniMonthGrid.querySelectorAll('.mini-day');
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0);
            const startDate = new Date(monthStart);
            startDate.setDate(startDate.getDate() - monthStart.getDay()); // Start from Sunday
            
            for (let i = 0; i < miniDays.length; i++) {
                const day = new Date(startDate);
                day.setDate(startDate.getDate() + i);
                
                if (day.getMonth() === month) {
                    const dateStr = Utils.format_date(day);
                    
                    // Get events for this day
                    const events = await this.storage_service.get_events_by_date(dateStr);
                    const hasEvents = events.some(e => e.machine === this.machine_name);
                    
                    // Update the mini day
                    const miniDay = miniDays[i];
                    miniDay.className = `mini-day current-month ${hasEvents ? 'has-events' : ''}`;
                }
                
                if (day.getMonth() > month) break;
            }
        } catch (error) {
            console.error('Error updating mini month with data:', error);
        }
    }

    /**
     * Update month view with real data from the store
     */
    async update_month_view_with_data() {
        if (!this.machine_name || !this.storage_service || this.current_view !== 'month') return;
        
        try {
            const dayCells = this.container.querySelectorAll('.day-cell');
            
            for (const cell of dayCells) {
                const dateStr = cell.dataset.date;
                if (!dateStr) continue;
                
                // Get events and availability data
                const [events, unavailableHours] = await Promise.all([
                    this.storage_service.get_events_by_date(dateStr),
                    this.storage_service.get_machine_availability_for_date(this.machine_name, dateStr)
                ]);
                
                const machineEvents = events.filter(e => e.machine === this.machine_name);
                const isUnavailable = unavailableHours.length >= 24; // Full day unavailable
                const isPartiallyUnavailable = unavailableHours.length > 0 && unavailableHours.length < 24;
                
                // Update cell classes
                cell.className = `day-cell ${cell.classList.contains('current-month') ? 'current-month' : 'other-month'} ${cell.classList.contains('today') ? 'today' : ''} ${isUnavailable ? 'unavailable' : ''} ${isPartiallyUnavailable ? 'partially-unavailable' : ''}`;
                
                // Update indicators
                const dayNumber = cell.querySelector('.day-number');
                if (dayNumber) {
                    let html = dayNumber.innerHTML.replace(/<span[^>]*>.*?<\/span>/g, ''); // Remove existing indicators
                    
                    if (isUnavailable) {
                        html += '<span class="unavailable-indicator">✕</span>';
                    } else if (isPartiallyUnavailable) {
                        html += '<span class="partially-unavailable-indicator">⚠</span>';
                    }
                    
                    dayNumber.innerHTML = html;
                }
                
                // Update events
                const dayEvents = cell.querySelector('.day-events');
                if (dayEvents) {
                    dayEvents.innerHTML = this.render_day_events(machineEvents);
                }
            }
        } catch (error) {
            console.error('Error updating month view with data:', error);
        }
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
            // Check if this time slot is already unavailable
            const unavailableHours = await this.storage_service.get_machine_availability_for_date(this.machine_name, date_str);
            const isCurrentlyUnavailable = unavailableHours.includes(hour);
            
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
            
            // The calendar will automatically re-render due to store subscription
            // No need to call this.render() manually
            
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
        // This will be updated when we implement year view data loading
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