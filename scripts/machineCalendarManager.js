/**
 * Machine Calendar Manager - Main orchestrator for the Google Calendar replica
 * Integrates all modular components and handles initialization
 */
import { appStore } from './store.js';
import { CalendarRenderer } from './calendarRenderer.js';
import { ViewManager } from './viewManager.js';
import { Utils } from './utils.js';

class MachineCalendarManager {
    constructor() {
        this.machineName = null;
        this.eventStorage = null;
        this.calendarRenderer = null;
        this.viewManager = null;
        this.elements = {};
        this.init().catch(error => {
            console.error('Error initializing MachineCalendarManager:', error);
        });
    }
    /**
     * Initialize the calendar system
     */
    async init() {
        if (!this.get_machine_from_url()) {
            this.show_error('No machine specified in URL. Please select a machine first.');
            return;
        }
        if (!this.bind_elements()) {
            this.show_error('Failed to initialize calendar components.');
            return;
        }
        await this.initialize_components();
        this.setup_page_title();
        this.setup_keyboard_shortcuts();
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
    async initialize_components() {
        try {
            // Subscribe to store changes to automatically refresh the calendar
            this.unsubscribe = appStore.subscribe((state) => {
                if (this.calendarRenderer) {
                    this.calendarRenderer.render();
                }
            });
            
            // Create a wrapper that provides storage service methods through the store
            const storageWrapper = {
                get_events_by_date: async (dateStr) => {
                    try {
                        return await appStore.getEventsByDate(dateStr);
                    } catch (error) {
                        console.error('Error getting events by date:', error);
                        return [];
                    }
                },
                get_machine_availability_for_date: async (machineName, dateStr) => {
                    try {
                        // Use the store's machine availability data
                        return appStore.getMachineAvailability(machineName, dateStr);
                    } catch (error) {
                        console.error('Error getting machine availability:', error);
                        return [];
                    }
                },
                toggle_machine_hour_availability: async (machineName, dateStr, hour) => {
                    try {
                        // Get current availability and toggle the specific hour
                        const currentHours = await appStore.getMachineAvailabilityForDate(machineName, dateStr);
                        const newHours = currentHours.includes(hour) 
                            ? currentHours.filter(h => h !== hour)
                            : [...currentHours, hour].sort((a, b) => a - b);
                        
                        await appStore.setMachineAvailability(machineName, dateStr, newHours);
                        
                        // Refresh the store's machine availability data for this specific date
                        const dateObj = new Date(dateStr);
                        await appStore.loadMachineAvailabilityForMachine(machineName, dateObj, dateObj);
                        
                        return newHours;
                    } catch (error) {
                        console.error('Error toggling machine hour availability:', error);
                        throw error;
                    }
                },
                getEventsByMachine: async (machineName) => {
                    try {
                        const events = await appStore.getEventsByDate(Utils.format_date(new Date()));
                        return events.filter(e => e.machine === machineName) || [];
                    } catch (error) {
                        console.error('Error getting events by machine:', error);
                        return [];
                    }
                },

                load_machine_availability_for_week: async (machineName, startDate, endDate) => {
                    try {
                        await appStore.loadMachineAvailabilityForMachine(machineName, startDate, endDate);
                    } catch (error) {
                        console.error('Error loading machine availability for week:', error);
                    }
                },

                load_machine_availability_for_month: async (machineName, startDate, endDate) => {
                    try {
                        await appStore.loadMachineAvailabilityForMachine(machineName, startDate, endDate);
                    } catch (error) {
                        console.error('Error loading machine availability for month:', error);
                    }
                },

                load_machine_availability_for_year: async (machineName, startDate, endDate) => {
                    try {
                        await appStore.loadMachineAvailabilityForMachine(machineName, startDate, endDate);
                    } catch (error) {
                        console.error('Error loading machine availability for year:', error);
                    }
                },

                set_machine_availability: async (machineName, dateStr, hours) => {
                    try {
                        await appStore.setMachineAvailability(machineName, dateStr, hours);
                    } catch (error) {
                        console.error('Error setting machine availability:', error);
                        throw error;
                    }
                }
            };
            
            // Initialize calendar renderer
            this.calendarRenderer = new CalendarRenderer(
                this.elements.calendar_container,
                null, // ViewManager will be set later
                storageWrapper
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
            
            // Defer initial render to avoid initialization errors
            setTimeout(() => {
                try {
                    this.viewManager.set_view('month', new Date());
                } catch (error) {
                    console.error('Error in deferred initial render:', error);
                    this.show_error('Failed to render initial calendar view. Please refresh the page.');
                }
            }, 100);
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
     * Cleanup method to unsubscribe from store
     */
    cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    /**
     * Public method to get machine availability summary
     */
    async get_machine_summary(start_date, end_date) {
        try {
            if (this.machineName) {
                // Calculate summary directly from store actions
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
                    const unavailableHours = await appStore.getMachineAvailabilityForDate(this.machineName, dateStr);
                    const events = await appStore.getEventsByDate(dateStr);
                    const machineEvents = events.filter(e => e.machine === this.machineName);
                    summary.totalDays++;
                    summary.totalOffTimeHours += unavailableHours.length;
                    summary.totalScheduledHours += machineEvents.reduce((total, e) => total + (e.endHour - e.startHour), 0);
                    if (unavailableHours.length > 0) summary.offTimeDays++;
                    if (machineEvents.length > 0) summary.scheduledDays++;
                    if (unavailableHours.length === 0 && machineEvents.length === 0) summary.availableDays++;
                    current.setDate(current.getDate() + 1);
                }
                return summary;
            }
        } catch (error) {
            console.error('Error getting machine summary:', error);
        }
        return null;
    }
    /**
     * Public method to set off-time for a date range
     */
    async setOffTimeRange(start_date, end_date) {
        try {
            if (this.machineName) {
                // Set hours as unavailable using store actions
                const current = new Date(start_date);
                while (current <= end_date) {
                    const dateStr = Utils.format_date(current);
                    for (let hour = 7; hour < 19; hour++) {
                        await appStore.setMachineAvailability(this.machineName, dateStr, [hour]);
                    }
                    current.setDate(current.getDate() + 1);
                }
                this.refresh();
            }
        } catch (error) {
            console.error('Error setting off time range:', error);
        }
    }
    /**
     * Public method to remove off-time for a date range
     */
    async removeOffTimeRange(start_date, end_date) {
        try {
            if (this.machineName) {
                // Clear unavailable hours using store actions
                const current = new Date(start_date);
                while (current <= end_date) {
                    const dateStr = Utils.format_date(current);
                    await appStore.setMachineAvailability(this.machineName, dateStr, []);
                    current.setDate(current.getDate() + 1);
                }
                this.refresh();
            }
        } catch (error) {
            console.error('Error removing off time range:', error);
        }
    }

    /**
     * Set up keyboard shortcuts for Google Calendar style navigation
     */
    setup_keyboard_shortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.viewManager) return;
            
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch (e.key) {
                case 't':
                case 'T':
                    // Go to today
                    this.viewManager.go_to_today();
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    // Previous period
                    this.viewManager.navigate_previous();
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    // Next period
                    this.viewManager.navigate_next();
                    e.preventDefault();
                    break;
                case 'm':
                case 'M':
                    // Month view
                    this.viewManager.set_view('month');
                    e.preventDefault();
                    break;
                case 'w':
                case 'W':
                    // Week view
                    this.viewManager.set_view('week');
                    e.preventDefault();
                    break;
                case 'y':
                case 'Y':
                    // Year view
                    this.viewManager.set_view('year');
                    e.preventDefault();
                    break;
            }
        });
    }


}

// Export the class for use in other modules
export { MachineCalendarManager };