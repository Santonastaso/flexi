/**
 * Calendar Renderer - Handles rendering of all calendar view types
 * Implements Google Calendar-style layout and behavior
 */
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
                const events = this.storage_service.get_events_by_date(date_str).filter(e => e.machine === this.machine_name);
                
                // Check if day is unavailable
                const unavailable_hours = this.storage_service.get_machine_availability_for_date(this.machine_name, date_str);
                const is_unavailable = unavailable_hours.length >= 24; // Full day unavailable
                const is_partially_unavailable = unavailable_hours.length > 0 && unavailable_hours.length < 24;
                
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
                        const events = this.storage_service.get_events_by_date(date_str).filter(e => 
                            e.machine === this.machine_name && hour >= e.startHour && hour < e.endHour);
                        const unavailable_hours = this.storage_service.get_machine_availability_for_date(this.machine_name, date_str);
                        const is_unavailable = unavailable_hours.includes(hour);
                        
                        return `
                            <div class="time-slot ${is_unavailable ? 'unavailable' : ''} ${events.length > 0 ? 'has-events' : ''}"
                                 data-date="${date_str}" data-hour="${hour}">
                                ${is_unavailable ? '<span class="unavailable-indicator">✕</span>' : ''}
                                ${this.render_time_slot_events(events)}
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
                const has_events = this.storage_service.get_events_by_date(Utils.format_date(current))
                    .filter(e => e.machine === this.machine_name).length > 0;
                
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
    
    handle_time_slot_click(date_str, hour) {
        if (!this.machine_name) return;
        
        const scheduled_events = this.storage_service.get_events_by_date(date_str)
            .filter(e => e.machine === this.machine_name && hour >= e.startHour && hour < e.endHour);
        const has_scheduled_events = scheduled_events.length > 0;
            
        if (has_scheduled_events) {
            alert('This slot is occupied by a scheduled task. You cannot mark it as unavailable.');
            return;
        }
        
        this.storage_service.toggle_machine_hour_availability(this.machine_name, date_str, hour);
        this.render(); // Re-render current view
    }
    
    // Utility methods
    get_start_of_week(date) {
        return Utils.get_week_start_date(date);
    }
    
    get_month_event_count(year, month) {
        if (!this.machine_name) return 0;
        return this.storage_service.getEventsByMachine(this.machine_name)
            .filter(e => {
                const event_date = new Date(e.date);
                return event_date.getFullYear() === year && event_date.getMonth() === month;
            }).length;
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

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalendarRenderer;
}