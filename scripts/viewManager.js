/**
 * View Manager - Handles calendar view switching and navigation
 * Implements Google Calendar-style navigation controls
 */
import { Utils } from './utils.js';
import { appStore } from './store.js';

class ViewManager {
    constructor(calendar_renderer, controls_container) {
        this.calendar_renderer = calendar_renderer;
        this.controls_container = controls_container;
        this.current_view = 'month';
        this.current_date = new Date();
        
        this.init();
    }
    
    async init() {
        try {
            this.render_controls();
            this.setup_event_listeners();
            await this.check_machine_availability_status();
        } catch (error) {
            console.error('Error initializing ViewManager:', error);
            // Don't fail initialization for availability status check
        }
    }
    
    render_controls() {
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
                    <h2 class="current-period" id="current-period">${this.get_current_period_text()}</h2>
                </div>
                
                <div class="view-controls">
                    <div class="view-dropdown-container">
                        <button class="view-dropdown-btn" id="view-dropdown-btn">
                            ${this.get_view_display_name(this.current_view)}
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
                    <div id="off-time-status" class="off-time-status" style="display: none;"></div>
                    <div class="date-range-inputs">
                        <div class="input-group">
                            <label for="start-date">Start Date:</label>
                            <input type="text" id="start-date" placeholder="dd/mm/yyyy" class="date-input">
                        </div>
                        <div class="input-group">
                            <label for="start-time">Start Time:</label>
                            <input type="time" id="start-time" class="time-input">
                        </div>
                        <div class="input-group">
                            <label for="end-date">End Date:</label>
                            <input type="text" id="end-date" placeholder="dd/mm/yyyy" class="date-input">
                        </div>
                        <div class="input-group">
                            <label for="end-time">End Time:</label>
                            <input type="time" id="end-time" class="time-input">
                        </div>
                        <button class="set-off-time-btn" id="set-off-time-btn">Set Off-Time</button>
                    </div>
                </div>
            </div>
        `;
        
        this.controls_container.innerHTML = html;
    }
    
    setup_event_listeners() {
        // Navigation buttons
        document.getElementById('today-btn').addEventListener('click', () => this.go_to_today());
        document.getElementById('prev-btn').addEventListener('click', () => this.navigate_previous());
        document.getElementById('next-btn').addEventListener('click', () => this.navigate_next());
        
        // View dropdown
        const dropdown_btn = document.getElementById('view-dropdown-btn');
        const dropdown_menu = document.getElementById('view-dropdown-menu');
        
        dropdown_btn.addEventListener('click', () => {
            dropdown_menu.classList.toggle('show');
        });
        
        dropdown_menu.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-option')) {
                const view = e.target.dataset.view;
                this.set_view(view);
                dropdown_menu.classList.remove('show');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.view-dropdown-container')) {
                dropdown_menu.classList.remove('show');
            }
        });
        
        // Off-time controls
        document.getElementById('set-off-time-btn').addEventListener('click', () => this.handle_set_off_time());
        
        // Date input formatting
        const date_inputs = document.querySelectorAll('.date-input');
        date_inputs.forEach(input => {
            input.addEventListener('input', (e) => this.format_date_input(e.target));
            input.addEventListener('blur', (e) => this.validate_date_input(e.target));
        });
    }
    
    set_view(view, date = this.current_date) {
        this.current_view = view;
        this.current_date = date;
        
        // Update dropdown button text
        document.getElementById('view-dropdown-btn').innerHTML = `
            ${this.get_view_display_name(view)}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
        `;
        
        // Update period text
        document.getElementById('current-period').textContent = this.get_current_period_text();
        
        // Render the calendar
        this.calendar_renderer.render(view, date);
    }
    
    go_to_today() {
        this.set_view(this.current_view, new Date());
    }
    
    navigate_previous() {
        const new_date = this.get_navigation_date(-1);
        this.set_view(this.current_view, new_date);
    }
    
    navigate_next() {
        const new_date = this.get_navigation_date(1);
        this.set_view(this.current_view, new_date);
    }
    
    get_navigation_date(direction) {
        const new_date = new Date(this.current_date);
        
        switch (this.current_view) {
            case 'year':
                new_date.setFullYear(new_date.getFullYear() + direction);
                break;
            case 'month':
                new_date.setMonth(new_date.getMonth() + direction);
                break;
            case 'week':
                new_date.setDate(new_date.getDate() + (direction * 7));
                break;
        }
        
        return new_date;
    }
    
    get_current_period_text() {
        switch (this.current_view) {
            case 'year':
                return this.current_date.getFullYear().toString();
            case 'month':
                return this.current_date.toLocaleString('default', { month: 'long', year: 'numeric' });
            case 'week':
                const start_of_week = this.get_start_of_week(this.current_date);
                const end_of_week = new Date(start_of_week);
                end_of_week.setDate(end_of_week.getDate() + 6);
                
                if (start_of_week.getMonth() === end_of_week.getMonth()) {
                    return `${start_of_week.toLocaleString('default', { month: 'long' })} ${start_of_week.getDate()} – ${end_of_week.getDate()}, ${start_of_week.getFullYear()}`;
                } else {
                    return `${start_of_week.toLocaleString('default', { month: 'short' })} ${start_of_week.getDate()} – ${end_of_week.toLocaleString('default', { month: 'short' })} ${end_of_week.getDate()}, ${start_of_week.getFullYear()}`;
                }
            default:
                return '';
        }
    }
    
    get_view_display_name(view) {
        const names = {
            'year': 'Year',
            'month': 'Month',
            'week': 'Week'
        };
        return names[view] || 'Month';
    }
    


    /**
     * Handle setting off-time period
     */
    async handle_set_off_time() {
        try {
            const startDate = document.getElementById('start-date').value;
            const startTime = document.getElementById('start-time').value;
            const endDate = document.getElementById('end-date').value;
            const endTime = document.getElementById('end-time').value;

            // Validate inputs
            if (!startDate || !startTime || !endDate || !endTime) {
                alert('Please fill in all date and time fields.');
                return;
            }

            // Get machine name from the calendar renderer
            const machineName = this.calendar_renderer.machine_name;
            if (!machineName) {
                alert('Machine name not found. Please refresh the page.');
                return;
            }

            // Check if machine availability table is accessible
            const status = await appStore.getMachineAvailabilityStatus();
            if (!status.accessible) {
                alert(`Cannot set off-time: ${status.message}`);
                return;
            }

            // Call the store action to set machine unavailability
            await appStore.setMachineUnavailability(machineName, startDate, endDate, startTime, endTime);

            // Clear the form
            document.getElementById('start-date').value = '';
            document.getElementById('start-time').value = '';
            document.getElementById('end-date').value = '';
            document.getElementById('end-time').value = '';

            // Show success message
            alert('Off-time period set successfully!');

        } catch (error) {
            console.error('Error setting off-time period:', error);
            alert(`Error setting off-time period: ${error.message}`);
        }
    }

    /**
     * Check and display machine availability table status
     */
    async check_machine_availability_status() {
        try {
            const status = await appStore.getMachineAvailabilityStatus();
            const statusDiv = document.getElementById('off-time-status');
            
            if (statusDiv) {
                if (status.accessible) {
                    statusDiv.style.display = 'none';
                } else {
                    statusDiv.style.display = 'block';
                    statusDiv.innerHTML = `
                        <div class="status-warning">
                            <strong>⚠️ Machine Availability Table Not Accessible</strong><br>
                            ${status.message}<br>
                            <small>Please contact your administrator to create the required database table.</small>
                        </div>
                    `;
                    statusDiv.className = 'off-time-status warning';
                }
            }
        } catch (error) {
            console.error('Error checking machine availability status:', error);
        }
    }

    /**
     * Set a specific hour as unavailable (legacy method - now handled by store)
     */
    async set_hour_unavailable(machine_name, date_str, hour) {
        try {
            const currentHours = await appStore.getMachineAvailabilityForDate(machine_name, date_str);
            const newHours = currentHours.includes(hour) 
                ? currentHours 
                : [...currentHours, hour].sort((a, b) => a - b);
            
            await appStore.setMachineAvailability(machine_name, date_str, newHours);
        } catch (error) {
            console.error('Error setting hour unavailable:', error);
            throw error;
        }
    }
    
    format_date_input(input) {
        let value = input.value.replace(/\D/g, ''); // Remove non-digits
        
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2);
        }
        if (value.length >= 5) {
            value = value.substring(0, 5) + '/' + value.substring(5, 9);
        }
        
        input.value = value;
    }
    
    validate_date_input(input) {
        const date = this.parse_date_input(input.value);
        if (input.value && !date) {
            input.classList.add('invalid');
            input.title = 'Invalid date format. Please use dd/mm/yyyy';
        } else {
            input.classList.remove('invalid');
            input.title = '';
        }
    }
    
    parse_date_input(date_str) {
        const parts = date_str.split('/');
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
    

    
    format_display_date(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    
    get_start_of_week(date) {
        return Utils.get_week_start_date(date);
    }
}

// Export for ES6 modules
export { ViewManager };