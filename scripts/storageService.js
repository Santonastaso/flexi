/**
 * Storage Service - Centralized localStorage management
 * Handles all data persistence for the Ship Production Suite
 */
class StorageService {
    constructor() {
        this.STORAGE_KEYS = {
            MACHINES: 'schedulerMachines',
            BACKLOG_TASKS: 'backlogTasks',
            SCHEDULED_EVENTS: 'scheduledEvents',
            MACHINE_AVAILABILITY: 'machineAvailability'
        };
        
        // Initialize default data if not present
        this.initializeDefaults();
    }
    
    /**
     * Initialize default data for first-time users
     */
    initializeDefaults() {
        if (!this.getMachines().length) {
            const defaultMachines = [
                { name: 'BOBST M5', city: 'Tallinn', live: true },
                { name: 'Gallus 1', city: 'Milan', live: true },
                { name: 'Mark Andy P7', city: 'Tallinn', live: false }
            ];
            this.saveMachines(defaultMachines);
        }
    }
    
    /**
     * Generic methods for localStorage operations
     */
    getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Error reading from localStorage (${key}):`, error);
            return defaultValue;
        }
    }
    
    setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing to localStorage (${key}):`, error);
            return false;
        }
    }
    
    /**
     * Machine management
     */
    getMachines() {
        return this.getItem(this.STORAGE_KEYS.MACHINES, []);
    }
    
    saveMachines(machines) {
        return this.setItem(this.STORAGE_KEYS.MACHINES, machines);
    }
    
    getLiveMachines() {
        return this.getMachines().filter(machine => machine.live);
    }
    
    getMachineByName(name) {
        return this.getMachines().find(machine => machine.name === name);
    }
    
    /**
     * Backlog task management
     */
    getBacklogTasks() {
        return this.getItem(this.STORAGE_KEYS.BACKLOG_TASKS, []);
    }
    
    saveBacklogTasks(tasks) {
        return this.setItem(this.STORAGE_KEYS.BACKLOG_TASKS, tasks);
    }
    
    addBacklogTask(task) {
        const tasks = this.getBacklogTasks();
        const newTask = {
            id: Date.now(),
            ...task
        };
        tasks.push(newTask);
        this.saveBacklogTasks(tasks);
        return newTask;
    }
    
    removeBacklogTask(taskId) {
        const tasks = this.getBacklogTasks();
        const filteredTasks = tasks.filter(task => task.id !== taskId);
        this.saveBacklogTasks(filteredTasks);
        return filteredTasks;
    }
    
    getTaskById(taskId) {
        return this.getBacklogTasks().find(task => task.id == taskId);
    }
    
    /**
     * Scheduled events management
     */
    getScheduledEvents() {
        return this.getItem(this.STORAGE_KEYS.SCHEDULED_EVENTS, []);
    }
    
    saveScheduledEvents(events) {
        return this.setItem(this.STORAGE_KEYS.SCHEDULED_EVENTS, events);
    }
    
    addScheduledEvent(event) {
        const events = this.getScheduledEvents();
        events.push(event);
        this.saveScheduledEvents(events);
        return event;
    }
    
    removeScheduledEvent(eventId) {
        const events = this.getScheduledEvents();
        const filteredEvents = events.filter(event => event.id != eventId);
        this.saveScheduledEvents(filteredEvents);
        return filteredEvents;
    }
    
    isTaskScheduled(taskId) {
        return this.getScheduledEvents().some(event => event.id == taskId);
    }
    
    getEventsByMachine(machineName) {
        return this.getScheduledEvents().filter(event => event.machine === machineName);
    }
    
    getEventsByDate(date) {
        return this.getScheduledEvents().filter(event => event.date === date);
    }
    
    /**
     * Machine availability management
     */
    getMachineAvailability() {
        return this.getItem(this.STORAGE_KEYS.MACHINE_AVAILABILITY, {});
    }
    
    saveMachineAvailability(availability) {
        return this.setItem(this.STORAGE_KEYS.MACHINE_AVAILABILITY, availability);
    }
    
    getMachineAvailabilityForDate(machineName, date) {
        const availability = this.getMachineAvailability();
        return availability[machineName]?.[date] || [];
    }
    
    setMachineAvailability(machineName, date, unavailableHours) {
        const availability = this.getMachineAvailability();
        
        if (!availability[machineName]) {
            availability[machineName] = {};
        }
        
        availability[machineName][date] = unavailableHours;
        this.saveMachineAvailability(availability);
    }
    
    toggleMachineHourAvailability(machineName, date, hour) {
        const availability = this.getMachineAvailability();
        
        if (!availability[machineName]) {
            availability[machineName] = {};
        }
        
        if (!availability[machineName][date]) {
            availability[machineName][date] = [];
        }
        
        const hourIndex = availability[machineName][date].indexOf(hour);
        if (hourIndex > -1) {
            availability[machineName][date].splice(hourIndex, 1);
        } else {
            availability[machineName][date].push(hour);
        }
        
        this.saveMachineAvailability(availability);
        return availability[machineName][date];
    }
    
    /**
     * Validation helpers
     */
    validateTaskCanBeDeleted(taskId) {
        if (this.isTaskScheduled(taskId)) {
            const task = this.getTaskById(taskId);
            throw new Error(`Cannot delete "${task?.name}". It is currently scheduled. Please remove it from the schedule first.`);
        }
        return true;
    }
    
    validateMachineCanBeDeleted(machineName) {
        const events = this.getEventsByMachine(machineName);
        if (events.length > 0) {
            throw new Error(`Cannot delete "${machineName}". It has tasks scheduled on it. Please remove tasks from the scheduler first.`);
        }
        return true;
    }
    
    /**
     * Data cleanup and maintenance
     */
    cleanupOrphanedEvents() {
        const tasks = this.getBacklogTasks();
        const events = this.getScheduledEvents();
        const validTaskIds = new Set(tasks.map(task => task.id));
        
        const validEvents = events.filter(event => validTaskIds.has(event.id));
        
        if (validEvents.length !== events.length) {
            this.saveScheduledEvents(validEvents);
            console.log(`Cleaned up ${events.length - validEvents.length} orphaned events`);
        }
    }
}

// Export as global singleton
const storageService = new StorageService();

// Make available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.storageService = storageService;
}

// ES6 module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = storageService;
}