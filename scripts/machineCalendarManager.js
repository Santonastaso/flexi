/**
 * Machine Calendar Manager - Main orchestrator for the Google Calendar replica
 * Integrates all modular components and handles initialization
 */
class MachineCalendarManager {
    constructor() {
        this.machineName = null;
        this.eventStorage = null;
        this.calendarRenderer = null;
        this.viewManager = null;
        this.elements = {};
        this.init();
    }
    /**
     * Initialize the calendar system
     */
    init() {
        if (!this.get_machine_from_url()) {
            this.show_error('No machine specified in URL. Please select a machine first.');
            return;
        }
        if (!this.bind_elements()) {
            this.show_error('Failed to initialize calendar components.');
            return;
        }
        this.initialize_components();
        this.setup_page_title();

    }
    /**
     * Get machine name from URL parameters
     */
    get_machine_from_url() {
        const urlParams = new URLSearchParams(window.location.search);
        this.machineName = urlParams.get('machine');
        if (!this.machineName) {
            console.error('No machine specified in URL');
            return false;
        }
        return true;
    }
    /**
     * Bind DOM elements
     */
    bind_elements() {
        this.elements = {
            machine_title: document.getElementById('machine_title'),
            controls_container: document.getElementById('calendar_controls_container'),
            calendar_container: document.getElementById('calendar_container')
        };
        // Validate required elements
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);
        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            return false;
        }
        return true;
    }
    /**
     * Initialize all components
     */
    initialize_components() {
        try {
            // Use storage service directly instead of eventStorage wrapper
            this.storageService = window.storageService;
            // Initialize calendar renderer
            this.calendarRenderer = new CalendarRenderer(
                this.elements.calendar_container,
                null, // ViewManager will be set later
                this.storageService
            );
            // Initialize view manager
            this.viewManager = new ViewManager(
                this.calendarRenderer,
                this.elements.controls_container
            );
            // Set up circular reference
            this.calendarRenderer.view_manager = this.viewManager;
            // Set machine name in renderer
            this.calendarRenderer.machine_name = this.machineName;
            // Initial render
            this.viewManager.set_view('month', new Date());
        } catch (error) {
            console.error('Error initializing calendar components:', error);
            this.show_error('Failed to initialize calendar. Please refresh the page.');
        }
    }
    /**
     * Set up page title
     */
    setup_page_title() {
        if (this.elements.machine_title) {
            this.elements.machine_title.textContent = `Availability for: ${this.machineName}`;
        }
        // Update browser title
        document.title = `Flexi - ${this.machineName} Availability`;
    }

    /**
     * Show error message
     */
    show_error(message) {
        if (this.elements.machine_title) {
            this.elements.machine_title.textContent = 'Error';
        }
        if (this.elements.calendar_container) {
            this.elements.calendar_container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--gc-text-secondary);">
                    <h3>Unable to Load Calendar</h3>
                    <p>${message}</p>
                    <p><a href="machinery.html" style="color: var(--gc-blue);">← Back to Machinery List</a></p>
                </div>
            `;
        }
    }
    /**
     * Public method to refresh the calendar
     */
    refresh() {
        if (this.viewManager && this.calendarRenderer) {
            this.calendarRenderer.render();
        }
    }

    /**
     * Public method to get machine availability summary
     */
    get_machine_summary(start_date, end_date) {
        if (this.storageService && this.machineName) {
            // Calculate summary directly from storage service data
            const summary = {
                totalDays: 0,
                offTimeDays: 0,
                scheduledDays: 0,
                availableDays: 0,
                totalOffTimeHours: 0,
                totalScheduledHours: 0
            };
            const current = new Date(start_date);
            while (current <= end_date) {
                const dateStr = Utils.format_date(current);
                const unavailableHours = this.storageService.get_machine_availability_for_date(this.machineName, dateStr);
                const events = this.storageService.get_events_by_date(dateStr).filter(e => e.machine === this.machineName);
                summary.totalDays++;
                summary.totalOffTimeHours += unavailableHours.length;
                summary.totalScheduledHours += events.reduce((total, e) => total + (e.endHour - e.startHour), 0);
                if (unavailableHours.length > 0) summary.offTimeDays++;
                if (events.length > 0) summary.scheduledDays++;
                if (unavailableHours.length === 0 && events.length === 0) summary.availableDays++;
                current.setDate(current.getDate() + 1);
            }
            return summary;
        }
        return null;
    }
    /**
     * Public method to set off-time for a date range
     */
    setOffTimeRange(start_date, end_date) {
        if (this.storageService && this.machineName) {
            // Set hours as unavailable directly using storage service
            const current = new Date(start_date);
            while (current <= end_date) {
                const dateStr = Utils.format_date(current);
                for (let hour = 7; hour < 19; hour++) {
                    this.storageService.setMachineAvailability(this.machineName, dateStr, [hour]);
                }
                current.setDate(current.getDate() + 1);
            }
            this.refresh();
        }
    }
    /**
     * Public method to remove off-time for a date range
     */
    removeOffTimeRange(start_date, end_date) {
        if (this.storageService && this.machineName) {
            // Clear unavailable hours directly using storage service
            const current = new Date(start_date);
            while (current <= end_date) {
                const dateStr = Utils.format_date(current);
                this.storageService.setMachineAvailability(this.machineName, dateStr, []);
                current.setDate(current.getDate() + 1);
            }
            this.refresh();
        }
    }


}
// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the machine calendar page
            if (document.getElementById('calendar_container')) {
        window.machineCalendarManager = new MachineCalendarManager();
        // Add global keyboard shortcuts (Google Calendar style)
        document.addEventListener('keydown', (e) => {
            const manager = window.machineCalendarManager;
            if (!manager || !manager.viewManager) return;
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.key) {
                case 't':
                case 'T':
                    // Go to today
                    manager.viewManager.go_to_today();
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    // Previous period
                    manager.viewManager.navigate_previous();
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    // Next period
                    manager.viewManager.navigate_next();
                    e.preventDefault();
                    break;
                case 'm':
                case 'M':
                    // Month view
                    manager.viewManager.set_view('month');
                    e.preventDefault();
                    break;
                case 'w':
                case 'W':
                    // Week view
                    manager.viewManager.set_view('week');
                    e.preventDefault();
                    break;
                case 'y':
                case 'Y':
                    // Year view
                    manager.viewManager.set_view('year');
                    e.preventDefault();
                    break;
            }
        });
    }
});