/**
 * Calendar Renderer - Handles rendering of all calendar view types
 * Implements Google Calendar-style layout and behavior
 */
class CalendarRenderer {
    constructor(container, viewManager, storageService) {
        this.container = container;
        this.viewManager = viewManager;
        this.storageService = storageService;
        this.currentView = 'month';
        this.currentDate = new Date();
        this.machineName = null;
        
        // Time range for week view
        this.startHour = 7;
        this.endHour = 19;
        
        this.init();
    }
    
    init() {
        this.getMachineFromURL();
        this.setupEventListeners();
    }
    
    getMachineFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        this.machineName = urlParams.get('machine');
    }
    
    setupEventListeners() {
        this.container.addEventListener('click', (e) => this.handleCalendarClick(e));
    }
    
    /**
     * Main render method - delegates to specific view renderers
     */
    render(view = this.currentView, date = this.currentDate) {
        this.currentView = view;
        this.currentDate = date;
        
        switch (view) {
            case 'year':
                this.renderYearView(date);
                break;
            case 'month':
                this.renderMonthView(date);
                break;
            case 'week':
                this.renderWeekView(date);
                break;
            default:
                this.renderMonthView(date);
        }
    }
    
    /**
     * Year View - Grid of 12 months (3x4)
     */
    renderYearView(date) {
        const year = date.getFullYear();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let html = `
            <div class="calendar-year-grid">
        `;
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        for (let month = 0; month < 12; month++) {
            const isCurrentMonth = year === currentYear && month === currentMonth;
            const monthEvents = this.getMonthEventCount(year, month);
            
            html += `
                <div class="month-cell ${isCurrentMonth ? 'current-month' : ''}" 
                     data-year="${year}" data-month="${month}">
                    <div class="month-header">${monthNames[month]}</div>
                    <div class="month-mini-calendar">
                        ${this.renderMiniMonth(year, month)}
                    </div>
                    ${monthEvents > 0 ? `<div class="event-indicator">${monthEvents} events</div>` : ''}
                </div>
            `;
        }
        
        html += `</div>`;
        this.container.innerHTML = html;
    }
    
    /**
     * Month View - Traditional calendar grid
     */
    renderMonthView(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
        
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
        
        const current = new Date(startDate);
        const today = new Date();
        
        for (let week = 0; week < 6; week++) {
            html += `<div class="week-row" data-week="${week}">`;
            
            for (let day = 0; day < 7; day++) {
                const isCurrentMonth = current.getMonth() === month;
                const isToday = current.toDateString() === today.toDateString();
                const dateStr = this.formatDate(current);
                const events = this.storageService.getEventsByDate(dateStr).filter(e => e.machine === this.machineName);
                
                html += `
                    <div class="day-cell ${isCurrentMonth ? 'current-month' : 'other-month'} ${isToday ? 'today' : ''}"
                         data-date="${dateStr}">
                        <div class="day-number">${current.getDate()}</div>
                        <div class="day-events">
                            ${this.renderDayEvents(events)}
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
    renderWeekView(date) {
        const startOfWeek = this.getStartOfWeek(date);
        const days = [];
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(day.getDate() + i);
            days.push(day);
        }
        
        let html = `
            <div class="calendar-week-grid">
                <div class="week-header">
                    <div class="time-column-header"></div>
                    ${days.map(day => `
                        <div class="day-column-header">
                            <div class="day-name">${this.getDayName(day.getDay(), true)}</div>
                            <div class="day-number ${this.isToday(day) ? 'today' : ''}">${day.getDate()}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="week-body">
                    ${this.renderWeekTimeSlots(days)}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
    }
    
    renderWeekTimeSlots(days) {
        let html = '';
        
        for (let hour = this.startHour; hour < this.endHour; hour++) {
            html += `
                <div class="time-row" data-hour="${hour}">
                    <div class="time-label">${this.formatHour(hour)}</div>
                    ${days.map(day => {
                        const dateStr = this.formatDate(day);
                        const events = this.storageService.getEventsByDate(dateStr).filter(e => 
                            e.machine === this.machineName && hour >= e.startHour && hour < e.endHour);
                        const unavailableHours = this.storageService.getMachineAvailabilityForDate(this.machineName, dateStr);
                        const isUnavailable = unavailableHours.includes(hour);
                        
                        return `
                            <div class="time-slot ${isUnavailable ? 'unavailable' : ''} ${events.length > 0 ? 'has-events' : ''}"
                                 data-date="${dateStr}" data-hour="${hour}">
                                ${this.renderTimeSlotEvents(events)}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        return html;
    }
    
    renderMiniMonth(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        let html = '<div class="mini-month-grid">';
        const current = new Date(startDate);
        
        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 7; day++) {
                const isCurrentMonth = current.getMonth() === month;
                const hasEvents = this.storageService.getEventsByDate(this.formatDate(current))
                    .filter(e => e.machine === this.machineName).length > 0;
                
                html += `
                    <div class="mini-day ${isCurrentMonth ? 'current-month' : ''} ${hasEvents ? 'has-events' : ''}">
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
    
    renderDayEvents(events) {
        return events.slice(0, 3).map(event => `
            <div class="day-event ${event.type}" title="${event.title}">
                ${event.title}
            </div>
        `).join('') + (events.length > 3 ? `<div class="more-events">+${events.length - 3} more</div>` : '');
    }
    
    renderTimeSlotEvents(events) {
        return events.map(event => `
            <div class="time-slot-event ${event.type}" title="${event.title}">
                ${event.title}
            </div>
        `).join('');
    }
    
    handleCalendarClick(e) {
        const target = e.target.closest('[data-year][data-month]') || 
                      e.target.closest('[data-week]') ||
                      e.target.closest('[data-date]');
        
        if (!target) return;
        
        if (target.dataset.year && target.dataset.month) {
            // Year view - zoom to month
            const year = parseInt(target.dataset.year);
            const month = parseInt(target.dataset.month);
            this.viewManager.setView('month', new Date(year, month, 1));
        } else if (target.dataset.week && this.currentView === 'month') {
            // Month view - zoom to week
            const weekElement = target.closest('.week-row');
            const firstDay = weekElement.querySelector('.day-cell[data-date]');
            if (firstDay) {
                const date = new Date(firstDay.dataset.date);
                this.viewManager.setView('week', date);
            }
        } else if (target.dataset.date && target.dataset.hour) {
            // Time slot click - toggle availability
            this.handleTimeSlotClick(target.dataset.date, parseInt(target.dataset.hour));
        }
    }
    
    handleTimeSlotClick(dateStr, hour) {
        if (!this.machineName) return;
        
        const scheduledEvents = this.storageService.getEventsByDate(dateStr)
            .filter(e => e.machine === this.machineName && hour >= e.startHour && hour < e.endHour);
        const hasScheduledEvents = scheduledEvents.length > 0;
            
        if (hasScheduledEvents) {
            alert('This slot is occupied by a scheduled task. You cannot mark it as unavailable.');
            return;
        }
        
        this.storageService.toggleMachineHourAvailability(this.machineName, dateStr, hour);
        this.render(); // Re-render current view
    }
    
    // Utility methods
    getStartOfWeek(date) {
        return Utils.getStartOfWeek(date);
    }
    
    getMonthEventCount(year, month) {
        if (!this.machineName) return 0;
        return this.storageService.getEventsByMachine(this.machineName)
            .filter(e => {
                const eventDate = new Date(e.date);
                return eventDate.getFullYear() === year && eventDate.getMonth() === month;
            }).length;
    }
    
    formatDate(date) {
        return Utils.formatDate(date);
    }
    
    formatHour(hour) {
        return Utils.formatHour(hour);
    }
    
    getDayName(dayIndex, short = false) {
        return Utils.getDayName(dayIndex, short);
    }
    
    isToday(date) {
        return Utils.isToday(date);
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalendarRenderer;
}