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
        // Don't auto-initialize - let the page initializer handle this
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
            // Disabled automatic re-rendering to prevent loops
            this.unsubscribe = appStore.subscribe((state) => {
                // Calendar will only render when explicitly called
            });
            
            // Create a wrapper that provides storage service methods through the store
            const storageWrapper = {
                // Cache for events and availability to prevent duplicate calls
                _eventsCache: new Map(),
                _availabilityCache: new Map(),
                _weekAvailabilityData: null, // Store week data locally
                
                // Get events for a specific date
                get_events_by_date: async (dateStr) => {
                    const cacheKey = `events_${dateStr}`;
                    if (storageWrapper._eventsCache.has(cacheKey)) {
                        return storageWrapper._eventsCache.get(cacheKey);
                    }
                    
                    try {
                        const events = await appStore.storageService.get_events_by_date(dateStr);
                        storageWrapper._eventsCache.set(cacheKey, events);
                        return events;
                    } catch (error) {
                        console.error('Error getting events for date:', error);
                        return [];
                    }
                },
                
                // Get machine availability for a specific date
                get_machine_availability_for_date: async (machineName, dateStr) => {
                    const cacheKey = `availability_${machineName}_${dateStr}`;
                    if (storageWrapper._availabilityCache.has(cacheKey)) {
                        return storageWrapper._availabilityCache.get(cacheKey);
                    }
                    
                    try {
                        // First check if we have week data that covers this date
                        if (storageWrapper._weekAvailabilityData) {
                            const weekData = storageWrapper._weekAvailabilityData.find(row => 
                                row.machine_name === machineName && row.date === dateStr
                            );
                            if (weekData) {
                                storageWrapper._availabilityCache.set(cacheKey, weekData.unavailable_hours || []);
                                return weekData.unavailable_hours || [];
                            }
                        }
                        
                        // Fallback to individual date query
                        const availability = await appStore.storageService.get_machine_availability_for_date(machineName, dateStr);
                        storageWrapper._availabilityCache.set(cacheKey, availability);
                        return availability;
                    } catch (error) {
                        console.error('Error getting machine availability for date:', error);
                        return [];
                    }
                },
                
                // Get machine availability for a week range
                get_machine_availability_for_week_range: async (machineName, startDate, endDate) => {
                    try {
                        const weekData = await appStore.storageService.get_machine_availability_for_week_range(
                            machineName,
                            startDate,
                            endDate
                        );
                        storageWrapper._weekAvailabilityData = weekData;
                        return weekData;
                    } catch (error) {
                        console.error('Error getting machine availability for week range:', error);
                        return [];
                    }
                },
                
                // Set machine availability for a specific date
                set_machine_availability: async (machineName, dateStr, hours) => {
                    try {
                        await appStore.setMachineAvailability(machineName, dateStr, hours);
                        
                        // Clear cache for this machine/date
                        const cacheKey = `availability_${machineName}_${dateStr}`;
                        storageWrapper._availabilityCache.delete(cacheKey);
                        
                        // Clear week data since it might be outdated
                        storageWrapper._weekAvailabilityData = null;
                        
                    } catch (error) {
                        console.error('Error updating machine availability:', error);
                        throw error;
                    }
                },
                
                // Clear all caches
                clearCache: () => {
                    storageWrapper._eventsCache.clear();
                    storageWrapper._availabilityCache.clear();
                    storageWrapper._weekAvailabilityData = null;
                },
                
                // Clear cache for a specific date
                clearCacheForDate: (dateStr) => {
                    // Clear events cache for this date
                    const eventsKey = `events_${dateStr}`;
                    storageWrapper._eventsCache.delete(eventsKey);
                    
                    // Clear availability cache for all machines on this date
                    for (const key of storageWrapper._availabilityCache.keys()) {
                        if (key.includes(dateStr)) {
                            storageWrapper._availabilityCache.delete(key);
                        }
                    }
                },
                
                // Clear week data
                clearWeekData: () => {
                    storageWrapper._weekAvailabilityData = null;
                }
            };
            
            // Create calendar renderer with configuration
            const calendarConfig = {
                mode: 'machine-settings',
                views: ['year', 'month', 'week'],
                storageService: storageWrapper,
                machineName: this.machineName,
                showMachines: false,
                interactive: true,
                enableDragDrop: false,
                onSlotClick: this.handle_availability_toggle.bind(this),
                onViewChange: this.handle_view_change.bind(this)
            };
            
            this.calendarRenderer = new CalendarRenderer(this.elements.calendar_container, calendarConfig);
            
            // Initialize the calendar renderer
            this.calendarRenderer.init();
            
            // Create view manager with calendar renderer and controls container
            this.viewManager = new ViewManager(this.calendarRenderer, this.elements.controls_container);
            
            // Set up circular reference
            this.calendarRenderer.set_view_manager(this.viewManager);
            
            // Defer initial render to avoid initialization errors
            setTimeout(() => {
                try {
                    this.viewManager.set_view('month', new Date());
                } catch (error) {
                    console.error('Error in deferred initial render:', error);
                    this.show_error('Failed to render initial calendar view. Please refresh the page.');
                }
            }, 100);
            
            // Simple debug interface
            window.machineCalendarDebug = {
                getMachineName: () => this.machineName,
                getViewManager: () => this.viewManager,
                testWeekView: () => {
                    this.viewManager.set_view('week', new Date());
                    return 'Week view activated';
                }
            };
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

    /**
     * Handle availability toggle for time slots
     */
    handle_availability_toggle(slotData) {
        console.log('🔍 Availability toggle requested:', slotData);
        // The actual toggle logic is now handled in the CalendarRenderer
        // This method can be used for additional logging or side effects
    }

    /**
     * Handle view change events
     */
    handle_view_change(viewData) {
        console.log('🔍 View change requested:', viewData);
        // This method can be used for additional logging or side effects
        // The actual view change is handled by the ViewManager
    }

}

// Export the class for use in other modules
export { MachineCalendarManager };