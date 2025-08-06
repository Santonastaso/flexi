/**
 * View Manager - Handles calendar view switching and navigation
 * Implements Google Calendar-style navigation controls
 */
class ViewManager {
    constructor(calendarRenderer, controlsContainer) {
        this.calendarRenderer = calendarRenderer;
        this.controlsContainer = controlsContainer;
        this.currentView = 'month';
        this.currentDate = new Date();
        
        this.init();
    }
    
    init() {
        this.renderControls();
        this.setupEventListeners();
    }
    
    renderControls() {
        const html = `
            <div class="calendar-controls-container">
                <div class="calendar-navigation">
                    <button class="nav-btn today-btn" id="today-btn">Today</button>
                    <button class="nav-btn arrow-btn" id="prev-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15,18 9,12 15,6"></polyline>
                        </svg>
                    </button>
                    <button class="nav-btn arrow-btn" id="next-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9,18 15,12 9,6"></polyline>
                        </svg>
                    </button>
                    <h2 class="current-period" id="current-period">${this.getCurrentPeriodText()}</h2>
                </div>
                
                <div class="view-controls">
                    <div class="view-dropdown-container">
                        <button class="view-dropdown-btn" id="view-dropdown-btn">
                            ${this.getViewDisplayName(this.currentView)}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6,9 12,15 18,9"></polyline>
                            </svg>
                        </button>
                        <div class="view-dropdown-menu" id="view-dropdown-menu">
                            <div class="view-option" data-view="year">Year</div>
                            <div class="view-option" data-view="month">Month</div>
                            <div class="view-option" data-view="week">Week</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="off-time-controls">
                <div class="off-time-section">
                    <h3>Set Off-Time Period</h3>
                    <div class="date-range-inputs">
                        <div class="input-group">
                            <label for="start-date">Start Date:</label>
                            <input type="text" id="start-date" placeholder="dd/mm/yyyy" class="date-input">
                        </div>
                        <div class="input-group">
                            <label for="end-date">End Date:</label>
                            <input type="text" id="end-date" placeholder="dd/mm/yyyy" class="date-input">
                        </div>
                        <button class="set-off-time-btn" id="set-off-time-btn">Set Off-Time</button>
                    </div>
                </div>
            </div>
        `;
        
        this.controlsContainer.innerHTML = html;
    }
    
    setupEventListeners() {
        // Navigation buttons
        document.getElementById('today-btn').addEventListener('click', () => this.goToToday());
        document.getElementById('prev-btn').addEventListener('click', () => this.navigatePrevious());
        document.getElementById('next-btn').addEventListener('click', () => this.navigateNext());
        
        // View dropdown
        const dropdownBtn = document.getElementById('view-dropdown-btn');
        const dropdownMenu = document.getElementById('view-dropdown-menu');
        
        dropdownBtn.addEventListener('click', () => {
            dropdownMenu.classList.toggle('show');
        });
        
        dropdownMenu.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-option')) {
                const view = e.target.dataset.view;
                this.setView(view);
                dropdownMenu.classList.remove('show');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.view-dropdown-container')) {
                dropdownMenu.classList.remove('show');
            }
        });
        
        // Off-time controls
        document.getElementById('set-off-time-btn').addEventListener('click', () => this.handleSetOffTime());
        
        // Date input formatting
        const dateInputs = document.querySelectorAll('.date-input');
        dateInputs.forEach(input => {
            input.addEventListener('input', (e) => this.formatDateInput(e.target));
            input.addEventListener('blur', (e) => this.validateDateInput(e.target));
        });
    }
    
    setView(view, date = this.currentDate) {
        this.currentView = view;
        this.currentDate = date;
        
        // Update dropdown button text
        document.getElementById('view-dropdown-btn').innerHTML = `
            ${this.getViewDisplayName(view)}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
        `;
        
        // Update period text
        document.getElementById('current-period').textContent = this.getCurrentPeriodText();
        
        // Render the calendar
        this.calendarRenderer.render(view, date);
    }
    
    goToToday() {
        this.setView(this.currentView, new Date());
    }
    
    navigatePrevious() {
        const newDate = this.getNavigationDate(-1);
        this.setView(this.currentView, newDate);
    }
    
    navigateNext() {
        const newDate = this.getNavigationDate(1);
        this.setView(this.currentView, newDate);
    }
    
    getNavigationDate(direction) {
        const newDate = new Date(this.currentDate);
        
        switch (this.currentView) {
            case 'year':
                newDate.setFullYear(newDate.getFullYear() + direction);
                break;
            case 'month':
                newDate.setMonth(newDate.getMonth() + direction);
                break;
            case 'week':
                newDate.setDate(newDate.getDate() + (direction * 7));
                break;
        }
        
        return newDate;
    }
    
    getCurrentPeriodText() {
        switch (this.currentView) {
            case 'year':
                return this.currentDate.getFullYear().toString();
            case 'month':
                return this.currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
            case 'week':
                const startOfWeek = this.getStartOfWeek(this.currentDate);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6);
                
                if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
                    return `${startOfWeek.toLocaleString('default', { month: 'long' })} ${startOfWeek.getDate()} – ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
                } else {
                    return `${startOfWeek.toLocaleString('default', { month: 'short' })} ${startOfWeek.getDate()} – ${endOfWeek.toLocaleString('default', { month: 'short' })} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
                }
            default:
                return '';
        }
    }
    
    getViewDisplayName(view) {
        const names = {
            'year': 'Year',
            'month': 'Month',
            'week': 'Week'
        };
        return names[view] || 'Month';
    }
    
    handleSetOffTime() {
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        
        const startDate = this.parseDateInput(startDateInput.value);
        const endDate = this.parseDateInput(endDateInput.value);
        
        if (!startDate || !endDate) {
            alert('Please enter valid dates in dd/mm/yyyy format.');
            return;
        }
        
        if (startDate > endDate) {
            alert('Start date must be before or equal to end date.');
            return;
        }
        
        // Set off-time for the date range
        this.setOffTimeRange(startDate, endDate);
        
        // Clear inputs
        startDateInput.value = '';
        endDateInput.value = '';
        
        // Refresh calendar
        this.calendarRenderer.render();
        
        alert(`Off-time period set from ${this.formatDisplayDate(startDate)} to ${this.formatDisplayDate(endDate)}`);
    }
    
    setOffTimeRange(startDate, endDate) {
        const machineName = this.calendarRenderer.machineName;
        if (!machineName) return;
        
        const current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = this.formatDate(current);
            
            // Set entire day as off-time (7 AM to 7 PM)
            for (let hour = 7; hour < 19; hour++) {
                // Set hour as unavailable using storage service
                const unavailableHours = window.storageService.getMachineAvailabilityForDate(machineName, dateStr);
                if (!unavailableHours.includes(hour)) {
                    unavailableHours.push(hour);
                    window.storageService.setMachineAvailability(machineName, dateStr, unavailableHours);
                }
            }
            
            current.setDate(current.getDate() + 1);
        }
    }
    
    formatDateInput(input) {
        let value = input.value.replace(/\D/g, ''); // Remove non-digits
        
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2);
        }
        if (value.length >= 5) {
            value = value.substring(0, 5) + '/' + value.substring(5, 9);
        }
        
        input.value = value;
    }
    
    validateDateInput(input) {
        const date = this.parseDateInput(input.value);
        if (input.value && !date) {
            input.classList.add('invalid');
            input.title = 'Invalid date format. Please use dd/mm/yyyy';
        } else {
            input.classList.remove('invalid');
            input.title = '';
        }
    }
    
    parseDateInput(dateStr) {
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const year = parseInt(parts[2], 10);
        
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        if (day < 1 || day > 31) return null;
        if (month < 0 || month > 11) return null;
        if (year < 1900 || year > 2100) return null;
        
        const date = new Date(year, month, day);
        
        // Check if date is valid (handles invalid dates like 31/02/2024)
        if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
            return null;
        }
        
        return date;
    }
    
    formatDate(date) {
        return Utils.formatDate(date);
    }
    
    formatDisplayDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    
    getStartOfWeek(date) {
        return Utils.getStartOfWeek(date);
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewManager;
}