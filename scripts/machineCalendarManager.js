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
        if (!this.getMachineFromURL()) {
            this.showError('No machine specified in URL. Please select a machine first.');
            return;
        }
        
        if (!this.bindElements()) {
            this.showError('Failed to initialize calendar components.');
            return;
        }
        
        this.initializeComponents();
        this.setupPageTitle();
        this.setupBodyClass();
    }
    
    /**
     * Get machine name from URL parameters
     */
    getMachineFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        this.machineName = urlParams.get('machine');
        
        if (!this.machineName) {
            console.error('No machine specified in URL');
            return false;
        }
        
        console.log(`Initializing calendar for machine: ${this.machineName}`);
        return true;
    }
    
    /**
     * Bind DOM elements
     */
    bindElements() {
        this.elements = {
            machineTitle: document.getElementById('machine-title'),
            controlsContainer: document.getElementById('calendar-controls-container'),
            calendarContainer: document.getElementById('calendar-container')
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
    initializeComponents() {
        try {
            // Initialize storage
            this.eventStorage = new EventStorage();
            
            // Initialize calendar renderer
            this.calendarRenderer = new CalendarRenderer(
                this.elements.calendarContainer,
                null, // ViewManager will be set later
                this.eventStorage
            );
            
            // Initialize view manager
            this.viewManager = new ViewManager(
                this.calendarRenderer,
                this.elements.controlsContainer
            );
            
            // Set up circular reference
            this.calendarRenderer.viewManager = this.viewManager;
            
            // Set machine name in renderer
            this.calendarRenderer.machineName = this.machineName;
            
            // Initial render
            this.viewManager.setView('month', new Date());
            
            console.log('Calendar system initialized successfully');
            
        } catch (error) {
            console.error('Error initializing calendar components:', error);
            this.showError('Failed to initialize calendar. Please refresh the page.');
        }
    }
    
    /**
     * Set up page title
     */
    setupPageTitle() {
        if (this.elements.machineTitle) {
            this.elements.machineTitle.textContent = `Availability for: ${this.machineName}`;
        }
        
        // Update browser title
        document.title = `Ship - ${this.machineName} Availability`;
    }
    
    /**
     * Set up body class for styling
     */
    setupBodyClass() {
        // No special body class needed - using standard content-section styling
    }
    
    /**
     * Show error message
     */
    showError(message) {
        if (this.elements.machineTitle) {
            this.elements.machineTitle.textContent = 'Error';
        }
        
        if (this.elements.calendarContainer) {
            this.elements.calendarContainer.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--gc-text-secondary);">
                    <h3>Unable to Load Calendar</h3>
                    <p>${message}</p>
                    <p><a href="../machinery.html" style="color: var(--gc-blue);">← Back to Machinery List</a></p>
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
     * Public method to navigate to a specific view and date
     */
    navigateTo(view, date) {
        if (this.viewManager) {
            this.viewManager.setView(view, date);
        }
    }
    
    /**
     * Public method to get machine availability summary
     */
    getMachineSummary(startDate, endDate) {
        if (this.eventStorage && this.machineName) {
            return this.eventStorage.getMachineSummary(this.machineName, startDate, endDate);
        }
        return null;
    }
    
    /**
     * Public method to set off-time for a date range
     */
    setOffTimeRange(startDate, endDate) {
        if (this.eventStorage && this.machineName) {
            this.eventStorage.setDateRangeOffTime(this.machineName, startDate, endDate);
            this.refresh();
        }
    }
    
    /**
     * Public method to remove off-time for a date range
     */
    removeOffTimeRange(startDate, endDate) {
        if (this.eventStorage && this.machineName) {
            this.eventStorage.removeOffTimeEvents(this.machineName, startDate, endDate);
            this.refresh();
        }
    }
    
    /**
     * Public method to export calendar data
     */
    exportCalendarData(format = 'json') {
        if (!this.eventStorage || !this.machineName) return null;
        
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1); // 1 month ago
        
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 2); // 2 months ahead
        
        const events = this.eventStorage.getEventsForMonth(
            this.machineName, 
            startDate.getFullYear(), 
            startDate.getMonth()
        );
        
        const summary = this.getMachineSummary(startDate, endDate);
        
        const data = {
            machineName: this.machineName,
            exportDate: new Date().toISOString(),
            dateRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            },
            events: events,
            summary: summary
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        return data;
    }
    
    /**
     * Public method to get current view state
     */
    getCurrentViewState() {
        if (this.viewManager) {
            return {
                view: this.viewManager.currentView,
                date: this.viewManager.currentDate,
                machineName: this.machineName
            };
        }
        return null;
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the machine calendar page
    if (document.getElementById('calendar-container')) {
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
                    manager.viewManager.goToToday();
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    // Previous period
                    manager.viewManager.navigatePrevious();
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    // Next period
                    manager.viewManager.navigateNext();
                    e.preventDefault();
                    break;
                case 'm':
                case 'M':
                    // Month view
                    manager.viewManager.setView('month');
                    e.preventDefault();
                    break;
                case 'w':
                case 'W':
                    // Week view
                    manager.viewManager.setView('week');
                    e.preventDefault();
                    break;
                case 'y':
                case 'Y':
                    // Year view
                    manager.viewManager.setView('year');
                    e.preventDefault();
                    break;
            }
        });
        
        console.log('Machine Calendar Manager initialized with keyboard shortcuts');
    }
});