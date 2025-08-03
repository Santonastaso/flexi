/**
 * Storage Service - Centralized localStorage management
 * Handles all data persistence for the Ship Production Suite
 * Enhanced with strict data integrity and orphan prevention
 */
class StorageService {
    constructor() {
        this.STORAGE_KEYS = {
            MACHINES: 'schedulerMachines',
            BACKLOG_TASKS: 'backlogTasks',
            SCHEDULED_EVENTS: 'scheduledEvents',
            MACHINE_AVAILABILITY: 'machineAvailability',
            MACHINERY_CATALOG: 'machineryCatalog'
        };
        
        // Initialize default data if not present
        this.initializeDefaults();
        
        // Run initial data integrity check
        this.runInitialDataIntegrityCheck();
        
        // Set up periodic integrity checks
        this.setupPeriodicIntegrityChecks();
    }
    
    /**
     * Set up periodic data integrity checks
     */
    setupPeriodicIntegrityChecks() {
        // Run integrity check every 5 minutes
        setInterval(() => {
            this.runDataIntegrityCheck();
        }, 5 * 60 * 1000);
        
        // Run integrity check when window gains focus
        window.addEventListener('focus', () => {
            this.runDataIntegrityCheck();
        });
    }
    
    /**
     * Run comprehensive data integrity check on initialization
     */
    runInitialDataIntegrityCheck() {
        try {
            const syncResults = this.syncGanttChartData();
            if (syncResults.ghostMachinesRemoved > 0 || syncResults.ghostTasksRemoved > 0 || syncResults.orphanedEventsRemoved > 0) {
                console.log('Initial data integrity check completed:', syncResults);
                this.showIntegrityNotification(syncResults);
            }
        } catch (error) {
            console.error('Error during initial data integrity check:', error);
        }
    }
    
    /**
     * Run periodic data integrity check
     */
    runDataIntegrityCheck() {
        try {
            const results = this.detectAndReportOrphans();
            if (results.hasOrphans) {
                console.warn('Data integrity issues detected:', results);
                this.showIntegrityNotification(results);
            }
        } catch (error) {
            console.error('Error during data integrity check:', error);
        }
    }
    
    /**
     * Detect and report orphan data without automatic removal
     */
    detectAndReportOrphans() {
        const results = {
            hasOrphans: false,
            orphanMachines: [],
            orphanTasks: [],
            orphanEvents: [],
            recommendations: []
        };
        
        // Get current data (use validated sources for SSOT)
        const machines = this.getValidMachinesForDisplay();
        const tasks = this.getValidTasksForDisplay();
        const events = this.getScheduledEvents();
        
        // Create sets of valid IDs
        const validMachineNames = new Set(machines.map(m => m.name || m.nominazione));
        const validTaskIds = new Set(tasks.map(t => t.id));
        
        // Check for orphan events
        events.forEach(event => {
            if (!validTaskIds.has(event.taskId)) {
                results.orphanEvents.push({
                    type: 'task',
                    event: event,
                    reason: `Task "${event.taskTitle}" (ID: ${event.taskId}) not found in backlog`
                });
                results.hasOrphans = true;
            }
            
            if (!validMachineNames.has(event.machine)) {
                results.orphanEvents.push({
                    type: 'machine',
                    event: event,
                    reason: `Machine "${event.machine}" not found in machinery list`
                });
                results.hasOrphans = true;
            }
        });
        
        // Check for orphan machines in events
        const machinesInEvents = new Set(events.map(e => e.machine));
        machinesInEvents.forEach(machineName => {
            if (!validMachineNames.has(machineName)) {
                results.orphanMachines.push({
                    name: machineName,
                    reason: `Machine "${machineName}" appears in scheduled events but not in machinery list`
                });
                results.hasOrphans = true;
            }
        });
        
        // Generate recommendations
        if (results.orphanEvents.length > 0) {
            results.recommendations.push('Remove orphaned scheduled events');
        }
        if (results.orphanMachines.length > 0) {
            results.recommendations.push('Add missing machines to machinery list or remove from events');
        }
        
        return results;
    }
    
    /**
     * Show integrity notification to user
     */
    showIntegrityNotification(results) {
        const message = this.formatIntegrityMessage(results);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'integrity-notification';
        notification.innerHTML = `
            <div class="integrity-alert">
                <h4>⚠️ Data Integrity Alert</h4>
                <p>${message}</p>
                <div class="integrity-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-secondary">Dismiss</button>
                    <button onclick="window.storageService.autoCleanupOrphans()" class="btn btn-primary">Auto-Cleanup</button>
                </div>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: white;
            border: 2px solid #f59e0b;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 30000);
    }
    
    /**
     * Format integrity message for display
     */
    formatIntegrityMessage(results) {
        let message = 'Data integrity issues detected:<br><br>';
        
        if (results.orphanEvents && results.orphanEvents.length > 0) {
            message += `<strong>Orphaned Events:</strong> ${results.orphanEvents.length}<br>`;
        }
        
        if (results.orphanMachines && results.orphanMachines.length > 0) {
            message += `<strong>Orphaned Machines:</strong> ${results.orphanMachines.length}<br>`;
        }
        
        if (results.recommendations && results.recommendations.length > 0) {
            message += '<br><strong>Recommendations:</strong><br>';
            results.recommendations.forEach(rec => {
                message += `• ${rec}<br>`;
            });
        }
        
        return message;
    }
    
    /**
     * Auto-cleanup orphaned data
     */
    autoCleanupOrphans() {
        const results = this.syncGanttChartData();
        console.log('Auto-cleanup completed:', results);
        
        // Show success message
        this.showMessage('Orphaned data has been automatically cleaned up', 'success');
        
        // Refresh any open pages
        this.notifyDataChange('integrity', 'cleanup', results);
        
        return results;
    }
    
    /**
     * Force full cleanup of all orphan data
     */
    forceFullCleanup() {
        console.log('🔄 Starting force full cleanup...');
        
        // Clean up invalid machines
        const invalidMachinesRemoved = this.cleanupInvalidMachines();
        
        // Clean up orphan events
        const syncResults = this.syncGanttChartData();
        
        // Clean up orphaned events
        const orphanedEventsRemoved = this.cleanupOrphanedEvents();
        
        const totalResults = {
            invalidMachinesRemoved,
            orphanedEventsRemoved,
            syncResults,
            totalCleaned: invalidMachinesRemoved + orphanedEventsRemoved + syncResults.orphanedEventsRemoved
        };
        
        console.log('✅ Force full cleanup completed:', totalResults);
        this.showMessage(`Force cleanup completed: ${totalResults.totalCleaned} items removed`, 'success');
        
        return totalResults;
    }
    
    /**
     * Show message to user
     */
    showMessage(message, type = 'info') {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        // Add styles
        const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            background: ${bgColor};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-weight: 500;
        `;
        
        document.body.appendChild(messageEl);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentElement) {
                messageEl.remove();
            }
        }, 3000);
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
        
        // Add console commands for debugging
        this.addConsoleCommands();
    }
    
    /**
     * Add console commands for debugging
     */
    addConsoleCommands() {
        window.storageDebug = {
            forceCleanup: () => this.forceFullCleanup(),
            checkIntegrity: () => this.validateDataIntegrity(),
            detectOrphans: () => this.detectAndReportOrphans(),
            syncData: () => this.syncGanttChartData(),
            cleanupMachines: () => this.cleanupInvalidMachines(),
            getValidMachines: () => this.getValidMachinesForDisplay(),
            getValidTasks: () => this.getValidTasksForDisplay(),
            removeVvvvvv: () => this.removeSpecificMachine('vvvvvv')
        };
        
        console.log(`
🔧 Storage Service Debug Commands:
==================================
- storageDebug.forceCleanup()     // Force full cleanup of all orphan data
- storageDebug.checkIntegrity()   // Check data integrity status
- storageDebug.detectOrphans()    // Detect orphan data without cleanup
- storageDebug.syncData()         // Sync and cleanup Gantt chart data
- storageDebug.cleanupMachines()  // Clean up invalid machines only
- storageDebug.getValidMachines() // Get only valid machines
- storageDebug.getValidTasks()    // Get only valid tasks
- storageDebug.removeVvvvvv()     // Remove the "vvvvvv" machine specifically
        `);
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
    
    addMachine(machine) {
        const machines = this.getMachines();
        const newMachine = {
            id: machine.id || Date.now().toString(),
            ...machine,
            createdAt: machine.createdAt || new Date().toISOString()
        };
        machines.push(newMachine);
        this.saveMachines(machines);
        return newMachine;
    }
    
    getMachinesByType(type) {
        return this.getValidMachinesForDisplay().filter(machine => machine.type === type);
    }
    
    getPrintingMachines() {
        return this.getValidMachinesForDisplay().filter(machine => machine.type === 'printing');
    }
    
    getPackagingMachines() {
        return this.getValidMachinesForDisplay().filter(machine => machine.type === 'packaging');
    }
    
    getLiveMachines() {
        return this.getValidMachinesForDisplay().filter(machine => machine.live);
    }
    
    getMachineByName(name) {
        return this.getValidMachinesForDisplay().find(machine => 
            machine.name === name || machine.nominazione === name
        );
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
        return this.getBacklogTasks().find(task => String(task.id) === String(taskId));
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
        const filteredEvents = events.filter(event => String(event.id) !== String(eventId));
        this.saveScheduledEvents(filteredEvents);
        return filteredEvents;
    }
    
    isTaskScheduled(taskId) {
        return this.getScheduledEvents().some(event => String(event.taskId) === String(taskId));
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
     * Machinery catalog management
     */
    getMachineryCatalog() {
        return this.getItem(this.STORAGE_KEYS.MACHINERY_CATALOG, []);
    }
    
    saveMachineryCatalog(catalog) {
        return this.setItem(this.STORAGE_KEYS.MACHINERY_CATALOG, catalog);
    }
    
    addMachineryCatalogItem(machinery) {
        const catalog = this.getMachineryCatalog();
        const newMachinery = {
            id: Date.now().toString(),
            ...machinery,
            createdAt: new Date().toISOString()
        };
        catalog.push(newMachinery);
        this.saveMachineryCatalog(catalog);
        return newMachinery;
    }
    
    removeMachineryCatalogItem(machineryId) {
        const catalog = this.getMachineryCatalog();
        const filteredCatalog = catalog.filter(machinery => machinery.id !== machineryId);
        this.saveMachineryCatalog(filteredCatalog);
        return filteredCatalog;
    }
    
    getMachineryById(machineryId) {
        return this.getMachineryCatalog().find(machinery => machinery.id === machineryId);
    }
    
    getMachineryByType(type) {
        return this.getMachineryCatalog().filter(machinery => machinery.type === type);
    }

    /**
     * Data cleanup and maintenance
     */
    cleanupOrphanedEvents() {
        const tasks = this.getBacklogTasks();
        const events = this.getScheduledEvents();
        const validTaskIds = new Set(tasks.map(task => String(task.id)));
        
        const validEvents = events.filter(event => validTaskIds.has(String(event.taskId)));
        
        if (validEvents.length !== events.length) {
            this.saveScheduledEvents(validEvents);
            console.log(`Cleaned up ${events.length - validEvents.length} orphaned events`);
            return events.length - validEvents.length;
        }
        return 0;
    }
    
    /**
     * Comprehensive data synchronization and ghost cleanup
     * Enhanced with strict validation and detailed logging
     */
    syncGanttChartData() {
        const results = {
            ghostMachinesRemoved: 0,
            ghostTasksRemoved: 0,
            orphanedEventsRemoved: 0,
            details: []
        };
        
        // Clean up invalid machines first
        const invalidMachinesRemoved = this.cleanupInvalidMachines();
        if (invalidMachinesRemoved > 0) {
            results.details.push(`Cleaned up ${invalidMachinesRemoved} invalid machines`);
        }
        
        // Get current data (use validated sources for SSOT)
        const machines = this.getValidMachinesForDisplay();
        const tasks = this.getValidTasksForDisplay();
        const events = this.getScheduledEvents();
        
        // Create sets of valid IDs with detailed logging
        const validMachineNames = new Set();
        const validTaskIds = new Set();
        
        machines.forEach(machine => {
            const machineName = machine.name || machine.nominazione;
            if (machineName) {
                validMachineNames.add(machineName);
            } else {
                console.warn('Machine without name found:', machine);
            }
        });
        
        tasks.forEach(task => {
            if (task.id) {
                // Convert to string for consistent comparison
                validTaskIds.add(String(task.id));
            } else {
                console.warn('Task without ID found:', task);
            }
        });
        
        // Clean up scheduled events with detailed validation
        const validEvents = events.filter(event => {
            let isValid = true;
            let reason = '';
            
            // Validate task
            if (!validTaskIds.has(String(event.taskId))) {
                reason = `Task "${event.taskTitle}" (ID: ${event.taskId}) not found in backlog`;
                results.ghostTasksRemoved++;
                results.details.push(reason);
                console.log(`Removing orphan task event: ${reason}`);
                console.log(`Debug: event.taskId = ${event.taskId} (type: ${typeof event.taskId})`);
                console.log(`Debug: validTaskIds contains:`, Array.from(validTaskIds));
                console.log(`Debug: String(event.taskId) = "${String(event.taskId)}"`);
                console.log(`Debug: validTaskIds.has(String(event.taskId)) = ${validTaskIds.has(String(event.taskId))}`);
                isValid = false;
            }
            
            // Validate machine
            if (!validMachineNames.has(event.machine)) {
                reason = `Machine "${event.machine}" not found in machinery list`;
                results.ghostMachinesRemoved++;
                results.details.push(reason);
                console.log(`Removing orphan machine event: ${reason}`);
                isValid = false;
            }
            
            // Additional validation: check if event has required properties
            if (!event.startHour || !event.endHour) {
                reason = `Event missing required time properties: ${event.taskTitle}`;
                results.ghostTasksRemoved++;
                results.details.push(reason);
                console.log(`Removing invalid event: ${reason}`);
                isValid = false;
            }
            
            return isValid;
        });
        
        // Save cleaned events if changes were made
        if (validEvents.length !== events.length) {
            this.saveScheduledEvents(validEvents);
            results.orphanedEventsRemoved = events.length - validEvents.length;
            
            console.log(`Data integrity cleanup completed: ${results.orphanedEventsRemoved} events removed`);
            console.log('Cleanup details:', results.details);
        }
        
        return results;
    }
    
    /**
     * Get valid machines for Gantt display (live machines that exist)
     * Now uses the same source as machinery tables for SSOT
     */
    getValidGanttMachines() {
        // Use the same strictly validated machines as the machinery tables
        const validMachines = this.getValidMachinesForDisplay();
        return validMachines.filter(machine => machine.live === true);
    }
    
    /**
     * Get valid tasks for task pool (tasks not scheduled)
     */
    getValidTaskPoolTasks() {
        const tasks = this.getBacklogTasks();
        const scheduledEvents = this.getScheduledEvents();
        const scheduledTaskIds = new Set(scheduledEvents.map(event => String(event.taskId)));
        
        return tasks.filter(task => !scheduledTaskIds.has(String(task.id)));
    }
    
    /**
     * Strict validation: Ensure all machinery in events exists in machinery list
     */
    validateMachineryIntegrity() {
        const machines = this.getValidMachinesForDisplay();
        const events = this.getScheduledEvents();
        
        const validMachineNames = new Set(machines.map(m => m.name || m.nominazione));
        const machinesInEvents = new Set(events.map(e => e.machine));
        
        const orphanMachines = Array.from(machinesInEvents).filter(name => !validMachineNames.has(name));
        
        if (orphanMachines.length > 0) {
            console.warn('Orphan machines detected in events:', orphanMachines);
            return {
                isValid: false,
                orphanMachines: orphanMachines,
                message: `Found ${orphanMachines.length} machines in events that don't exist in machinery list`
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * Strict validation: Ensure all tasks in events exist in backlog
     */
    validateTaskIntegrity() {
        const tasks = this.getValidTasksForDisplay();
        const events = this.getScheduledEvents();
        
        const validTaskIds = new Set(tasks.map(t => String(t.id)));
        const taskIdsInEvents = new Set(events.map(e => String(e.taskId)));
        
        const orphanTasks = Array.from(taskIdsInEvents).filter(id => !validTaskIds.has(id));
        
        if (orphanTasks.length > 0) {
            console.warn('Orphan tasks detected in events:', orphanTasks);
            return {
                isValid: false,
                orphanTasks: orphanTasks,
                message: `Found ${orphanTasks.length} tasks in events that don't exist in backlog`
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * Comprehensive data integrity validation
     */
    validateDataIntegrity() {
        const machineryValidation = this.validateMachineryIntegrity();
        const taskValidation = this.validateTaskIntegrity();
        
        const results = {
            isValid: machineryValidation.isValid && taskValidation.isValid,
            machineryValidation,
            taskValidation,
            issues: []
        };
        
        if (!machineryValidation.isValid) {
            results.issues.push(machineryValidation.message);
        }
        
        if (!taskValidation.isValid) {
            results.issues.push(taskValidation.message);
        }
        
        return results;
    }
    
    /**
     * Get only valid machines for display (strict filtering)
     */
    getValidMachinesForDisplay() {
        const machines = this.getMachines();
        return machines.filter(machine => {
            // Must have a name
            if (!machine.name && !machine.nominazione) {
                console.warn('Machine without name found:', machine);
                return false;
            }
            
            // Must have required properties based on type
            if (machine.type === 'printing') {
                if (!machine.numeroMacchina || !machine.nominazione) {
                    console.warn('Printing machine missing required properties:', machine);
                    return false;
                }
            } else if (machine.type === 'packaging') {
                if (!machine.numeroMacchina || !machine.nominazione) {
                    console.warn('Packaging machine missing required properties:', machine);
                    return false;
                }
            }
            
            return true;
        });
    }
    
    /**
     * Clean up invalid machines from storage
     */
    cleanupInvalidMachines() {
        const machines = this.getMachines();
        const validMachines = this.getValidMachinesForDisplay();
        
        if (validMachines.length !== machines.length) {
            const invalidMachines = machines.filter(machine => {
                // Check if machine is in valid machines list
                const isValid = validMachines.some(validMachine => 
                    (validMachine.name || validMachine.nominazione) === (machine.name || machine.nominazione)
                );
                
                if (!isValid) {
                    console.log(`Removing invalid machine: ${machine.name || machine.nominazione}`, machine);
                }
                
                return isValid;
            });
            
            console.log(`Cleaning up ${machines.length - invalidMachines.length} invalid machines`);
            this.saveMachines(invalidMachines);
            return machines.length - invalidMachines.length;
        }
        
        return 0;
    }
    
    /**
     * Remove a specific machine by name
     */
    removeSpecificMachine(machineName) {
        console.log(`🗑️ Removing machine: ${machineName}`);
        
        const machines = this.getMachines();
        const filteredMachines = machines.filter(machine => 
            (machine.name || machine.nominazione) !== machineName
        );
        
        if (filteredMachines.length !== machines.length) {
            this.saveMachines(filteredMachines);
            console.log(`✅ Removed machine: ${machineName}`);
            
            // Also clean up any events referencing this machine
            const events = this.getScheduledEvents();
            const filteredEvents = events.filter(event => event.machine !== machineName);
            
            if (filteredEvents.length !== events.length) {
                this.saveScheduledEvents(filteredEvents);
                console.log(`✅ Also removed ${events.length - filteredEvents.length} events referencing ${machineName}`);
            }
            
            return true;
        } else {
            console.log(`❌ Machine not found: ${machineName}`);
            return false;
        }
    }
    
    /**
     * Get only valid tasks for display (strict filtering)
     */
    getValidTasksForDisplay() {
        const tasks = this.getBacklogTasks();
        return tasks.filter(task => {
            // Must have required properties
            if (!task.id || !task.name) {
                console.warn('Task missing required properties:', task);
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * Notify all listeners of data changes
     */
    notifyDataChange(dataType, action, data = null) {
        const event = new CustomEvent('dataChange', {
            detail: { dataType, action, data }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * Enhanced machine operations with notifications
     */
    addMachineWithSync(machine) {
        const result = this.addMachine(machine);
        this.notifyDataChange('machines', 'add', result);
        return result;
    }
    
    saveMachinesWithSync(machines) {
        const result = this.saveMachines(machines);
        this.syncGanttChartData();
        this.notifyDataChange('machines', 'update', machines);
        return result;
    }
    
    /**
     * Enhanced task operations with notifications
     */
    addBacklogTaskWithSync(task) {
        const result = this.addBacklogTask(task);
        this.notifyDataChange('tasks', 'add', result);
        return result;
    }
    
    removeBacklogTaskWithSync(taskId) {
        const result = this.removeBacklogTask(taskId);
        this.syncGanttChartData();
        this.notifyDataChange('tasks', 'remove', { id: taskId });
        return result;
    }
    
    saveBacklogTasksWithSync(tasks) {
        const result = this.saveBacklogTasks(tasks);
        this.syncGanttChartData();
        this.notifyDataChange('tasks', 'update', tasks);
        return result;
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