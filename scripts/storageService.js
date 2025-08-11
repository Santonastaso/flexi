/**
 * Storage Service - Centralized localStorage management
 * Handles all data persistence for the Flexi Production Suite
 * Enhanced with strict data integrity and orphan prevention
 */
class StorageService {
    constructor() {
        this.STORAGE_KEYS = {
            MACHINES: 'schedulerMachines',
            SCHEDULED_EVENTS: 'scheduledEvents',
            MACHINE_AVAILABILITY: 'machineAvailability',
            ODP_ORDERS: 'odpOrders',
            PHASES: 'productionPhases'
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
            // Clean up old backlog tasks and orphaned events (migration to ODP structure)
            const cleanupResults = this.cleanupDuplicateTasks();
            
            // Then sync Gantt chart data
            const syncResults = this.syncGanttChartData();
            
            if (cleanupResults.oldTasksRemoved > 0 || cleanupResults.orphanedEventsRemoved > 0 || 
                syncResults.ghostMachinesRemoved > 0 || syncResults.ghostTasksRemoved > 0 || syncResults.orphanedEventsRemoved > 0) {
                console.log('Initial data integrity check completed:', { ...cleanupResults, ...syncResults });
                this.showIntegrityNotification({ ...cleanupResults, ...syncResults });
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
        const validTaskIds = new Set(tasks.map(t => String(t.id)));
        
        // Check for orphan events
        events.forEach(event => {
            if (!validTaskIds.has(String(event.taskId))) {
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
        
        // Clean up duplicate tasks first
        const duplicateResults = this.cleanupDuplicateTasks();
        
        // Clean up invalid machines
        const invalidMachinesRemoved = this.cleanupInvalidMachines();
        
        // Clean up orphan events
        const syncResults = this.syncGanttChartData();
        
        // Clean up orphaned events
        const orphanedEventsRemoved = this.cleanupOrphanedEvents();
        
        const totalResults = {
            ...duplicateResults,
            invalidMachinesRemoved,
            orphanedEventsRemoved,
            syncResults,
            totalCleaned: duplicateResults.duplicateTasksRemoved + duplicateResults.orphanedEventsRemoved + invalidMachinesRemoved + orphanedEventsRemoved + syncResults.orphanedEventsRemoved
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
        // No hardcoded machines - users must add their own
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
            removeVvvvvv: () => this.removeSpecificMachine('vvvvvv'),
            cleanupDuplicates: () => this.cleanupDuplicateTasks(),
            removeMachineById: (id) => this.removeMachineById(id),
            debugMachines: () => this.debugMachines(),
        };

        console.log(`
🔧 Storage Service Debug Commands:
==================================
- storageDebug.forceCleanup()     // Force full cleanup of all orphan data
- storageDebug.checkIntegrity()   // Check data integrity status
- storageDebug.detectOrphans()    // Detect orphan data without cleanup
- storageDebug.syncData()         // Sync and cleanup Gantt chart data
- storageDebug.cleanupMachines()  // Clean up invalid machines only
- storageDebug.getValidTasks()    // Get only valid tasks
- storageDebug.removeVvvvvv()     // Remove the "vvvvvv" machine specifically
- storageDebug.cleanupDuplicates() // Clean up duplicate tasks and orphaned data
- storageDebug.removeMachineById(id) // Remove machine by ID
- storageDebug.debugMachines()    // Debug machine data
        `);
    }

    /**
     * Debug machine data and migration status
     */
    debugMachines() {
        console.log('🔍 Machine Debug Information:');
        console.log('================================');
        
        const rawMachines = this.getItem(this.STORAGE_KEYS.MACHINES, []);
        console.log('Raw machines from localStorage:', rawMachines);
        
        const migratedMachines = this.getMachines();
        console.log('Machines after migration:', migratedMachines);
        
        const activeMachines = this.getActiveMachines();
        console.log('Active machines:', activeMachines);
        
        // Check migration status
        const needsMigration = this.needsMachineModelMigration(rawMachines);
        console.log('Needs migration:', needsMigration);
        
        // Check individual machine status
        migratedMachines.forEach((machine, index) => {
            console.log(`Machine ${index + 1}:`, {
                id: machine.id,
                name: machine.machine_name || machine.name || machine.nominazione,
                status: machine.status,
                hasLive: machine.hasOwnProperty('live'),
                live: machine.live,
                version: machine.version,
                needsMigration: !machine.status || machine.version < 1
            });
        });
        
        return {
            raw: rawMachines,
            migrated: migratedMachines,
            active: activeMachines,
            needsMigration: needsMigration
        };
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

    /**
     * Get only active machines for production scheduling
     */
    getActiveMachines() {
        return this.getMachines().filter(machine => {
            // Check status field (case-insensitive)
            if (machine.status) {
                return machine.status.toUpperCase() === 'ACTIVE';
            }
            
            // Fallback: machines with names are considered active
            return machine.machine_name || machine.name || machine.nominazione;
        });
    }






    
    saveMachines(machines) {
        return this.setItem(this.STORAGE_KEYS.MACHINES, machines);
    }
    
    addMachine(machine) {
        const machines = this.getMachines();
        
        // Generate machine_id if not provided (TYPE_SITE_NN format)
        if (!machine.machine_id && machine.machine_type && machine.site) {
            machine.machine_id = this.generateMachineId(machine.machine_type, machine.site);
        }
        
        // Add timestamp if not present
        if (!machine.created_at) {
            machine.created_at = new Date().toISOString();
        }
        machine.updated_at = new Date().toISOString();
        
        machines.push(machine);
        this.saveMachines(machines);
        return machine;
    }
    
    generateMachineId(machineType, site) {
        const machines = this.getMachines();
        const prefix = this.getMachineTypePrefix(machineType);
        const siteCode = site === 'ZANICA' ? 'ZAN' : 'BGF';
        
        // Find existing machines with same prefix and site
        const existingIds = machines
            .filter(m => m.machine_id && m.machine_id.startsWith(`${prefix}_${siteCode}_`))
            .map(m => m.machine_id.split('_').pop())
            .map(num => parseInt(num))
            .filter(num => !isNaN(num));
            
        const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        return `${prefix}_${siteCode}_${nextNumber.toString().padStart(2, '0')}`;
    }
    
    getMachineTypePrefix(machineType) {
        const prefixes = {
            'DIGITAL_PRINT': 'DIGI',
            'FLEXO_PRINT': 'FLEX',
            'ROTOGRAVURE': 'ROTO',
            'PACKAGING': 'PACK',
            'DOYPACK': 'DOYP'
        };
        return prefixes[machineType] || 'MACH';
    }
    

    
    
    
    getLiveMachines() {
        return this.getValidMachinesForDisplay().filter(machine => {
            // Legacy machines have 'live' property
            if (machine.hasOwnProperty('live')) {
                return machine.live === true;
            }
            
            // New enhanced machines are considered live by default
            // unless they have a specific status field indicating otherwise
            return machine.status !== 'inactive' && machine.status !== 'maintenance';
        });
    }
    

    


    /**
     * ODP (Ordine di Produzione) Management
     */
    getODPOrders() {
        return this.getItem(this.STORAGE_KEYS.ODP_ORDERS, []);
    }

    saveODPOrders(orders) {
        return this.setItem(this.STORAGE_KEYS.ODP_ORDERS, orders);
    }

    addODPOrder(order) {
        const orders = this.getODPOrders();
        
        // Generate ODP number if not provided
        if (!order.odp_number) {
            order.odp_number = this.generateODPNumber();
        }
        
        const newOrder = {
            id: order.id || (Date.now() + Math.random().toString(36).substr(2, 9)),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: order.status || 'DRAFT',
            
            // IDENTIFICAZIONE (Identification)
            odp_number: order.odp_number,
            article_code: order.article_code || '',
            production_lot: order.production_lot || '',
            work_center: order.work_center || 'ZANICA',
            
            // SPECIFICHE TECNICHE (Technical Specifications)
            bag_height: parseInt(order.bag_height) || 0,
            bag_width: parseInt(order.bag_width) || 0,
            bag_step: parseInt(order.bag_step) || 0,
            seal_sides: parseInt(order.seal_sides) || 3,
            product_type: order.product_type || 'LIQUID',
            
            // PIANIFICAZIONE (Planning)
            production_start: order.production_start || null,
            delivery_date: order.delivery_date || null,
            assigned_phase: order.assigned_phase || '',
            
            // DATI COMMERCIALI (Commercial Data)
            internal_customer_code: order.internal_customer_code || '',
            external_customer_code: order.external_customer_code || '',
            customer_order_ref: order.customer_order_ref || '',
            
            // DATI LAVORAZIONE (Processing Data)
            tipo_lavorazione: order.tipo_lavorazione || 'printing',
            fase: order.fase || '',
            
            // COLONNE DA CALCOLARE (Calculated Columns)
            duration: parseFloat(order.duration) || 0,
            cost: parseFloat(order.cost) || 0,
            
            // Additional fields for compatibility with existing system
            title: order.title || `${order.article_code || 'ODP'} - ${order.production_lot || ''}`,
            description: order.description || '',
            priority: order.priority || 'medium',
            quantity: parseInt(order.quantity) || 1
        };
        
        orders.push(newOrder);
        this.saveODPOrders(orders);
        return newOrder;
    }

    generateODPNumber() {
        const orders = this.getODPOrders();
        const existingNumbers = orders
            .map(o => o.odp_number)
            .filter(num => num && num.startsWith('OP'))
            .map(num => parseInt(num.substring(2)))
            .filter(num => !isNaN(num));
        
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
        return `OP${nextNumber.toString().padStart(6, '0')}`;
    }

    updateODPOrder(id, updates) {
        const orders = this.getODPOrders();
        const index = orders.findIndex(order => String(order.id) === String(id));
        
        if (index !== -1) {
            orders[index] = {
                ...orders[index],
                ...updates,
                updated_at: new Date().toISOString()
            };
            this.saveODPOrders(orders);
            return orders[index];
        }
        return null;
    }

    removeODPOrder(id) {
        const orders = this.getODPOrders();
        const filteredOrders = orders.filter(order => String(order.id) !== String(id));
        this.saveODPOrders(filteredOrders);
        return filteredOrders;
    }

    getODPOrderById(id) {
        return this.getODPOrders().find(order => String(order.id) === String(id));
    }

    getODPOrderByNumber(odpNumber) {
        return this.getODPOrders().find(order => order.odp_number === odpNumber);
    }

    getODPOrdersByWorkCenter(workCenter) {
        return this.getODPOrders().filter(order => order.work_center === workCenter);
    }

    getODPOrdersByStatus(status) {
        return this.getODPOrders().filter(order => order.status === status);
    }

    /**
     * Phase (Fase) Management
     */
    getPhases() {
        return this.getItem(this.STORAGE_KEYS.PHASES, []);
    }

    savePhases(phases) {
        return this.setItem(this.STORAGE_KEYS.PHASES, phases);
    }

    addPhase(phase) {
        const phases = this.getPhases();
        const newPhase = {
            id: phase.id || (Date.now() + Math.random().toString(36).substr(2, 9)),
            name: phase.name || '',
            type: phase.type || 'printing', // 'printing' or 'packaging'
            
            // Printing parameters
            V_STAMPA: parseInt(phase.V_STAMPA) || 0, // Velocità stampa in mt/min
            T_SETUP_STAMPA: parseInt(phase.T_SETUP_STAMPA) || 0, // Tempo attrezzaggio stampa in min
            COSTO_H_STAMPA: parseFloat(phase.COSTO_H_STAMPA) || 0, // Costo orario stampa in €/h
            
            // Packaging parameters
            V_CONF: parseInt(phase.V_CONF) || 0, // Velocità confezionamento in pz/h
            T_SETUP_CONF: parseInt(phase.T_SETUP_CONF) || 0, // Tempo attrezzaggio confezionamento in min
            COSTO_H_CONF: parseFloat(phase.COSTO_H_CONF) || 0, // Costo orario confezionamento in €/h
            
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        phases.push(newPhase);
        this.savePhases(phases);
        return newPhase;
    }

    updatePhase(id, updates) {
        const phases = this.getPhases();
        const index = phases.findIndex(phase => String(phase.id) === String(id));
        
        if (index !== -1) {
            phases[index] = {
                ...phases[index],
                ...updates,
                updated_at: new Date().toISOString()
            };
            this.savePhases(phases);
            return phases[index];
        }
        return null;
    }

    removePhase(id) {
        const phases = this.getPhases();
        const filteredPhases = phases.filter(phase => String(phase.id) !== String(id));
        this.savePhases(filteredPhases);
        return filteredPhases;
    }

    getPhaseById(id) {
        return this.getPhases().find(phase => String(phase.id) === String(id));
    }

    getPhasesByType(type) {
        return this.getPhases().filter(phase => phase.type === type);
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
            // Try to get ODP order first, then fall back to old task
            const order = this.getODPOrderById(taskId);
            const task = order || this.getTaskById(taskId);
            const name = order ? order.odp_number : task?.name;
            throw new Error(`Cannot delete "${name}". It is currently scheduled. Please remove it from the schedule first.`);
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
        // Get machines that are present in the machinery tables (printing + packaging)
        const validMachines = this.getValidMachinesForDisplay();
        console.log('Valid machines for display:', validMachines.length);
        
        // Filter for machines with any type (not null)
        const machinesWithType = validMachines.filter(m => {
            const machineType = m.machine_type || m.type;
            return machineType != null && machineType !== '';
        });
        
        console.log('Machines with type:', machinesWithType.length);
        
        // Filter for active machines (check both legacy 'live' property and new active status)
        const ganttMachines = machinesWithType.filter(machine => {
            // Legacy machines have 'live' property
            if (machine.hasOwnProperty('live')) {
                return machine.live === true;
            }
            
            // New enhanced machines are considered active by default
            // unless they have a specific status field indicating otherwise
            return machine.status !== 'inactive' && machine.status !== 'maintenance';
        });
        
        console.log('Gantt machines after filtering:', ganttMachines.length);
        console.log('Gantt machines:', ganttMachines);
        
        return ganttMachines;
    }
    
    /**
     * Get valid tasks for task pool (ODP orders not scheduled)
     */
    getValidTaskPoolTasks() {
        const odpOrders = this.getODPOrders();
        const scheduledEvents = this.getScheduledEvents();
        const scheduledTaskIds = new Set(scheduledEvents.map(event => event.taskId));
        
        console.log('ODP orders found:', odpOrders.length);
        console.log('Scheduled events found:', scheduledEvents.length);
        console.log('Scheduled task IDs:', Array.from(scheduledTaskIds));
        
        // Convert ODP orders to task format for Gantt compatibility
        const tasks = odpOrders.map(order => ({
            id: order.id,
            name: order.odp_number,
            title: `${order.article_code} - ${order.production_lot}`,
            type: order.tipo_lavorazione,
            duration: order.duration || 0,
            cost: order.cost || 0,
            machineId: null, // Will be assigned when scheduled
            machineName: null,
            // Additional fields for compatibility
            numeroBuste: order.quantity || 0,
            passoBusta: order.bag_step || 0,
            altezzaBusta: order.bag_height || 0,
            fasciaBusta: order.bag_width || 0,
            color: '#3B82F6', // Default blue color
            linearMeters: 0, // Will be calculated if needed
            totalTime: order.duration || 0,
            totalCost: order.cost || 0
        }));
        
        const availableTasks = tasks.filter(task => !scheduledTaskIds.has(task.id));
        console.log('Available tasks for task pool:', availableTasks.length);
        console.log('Available tasks:', availableTasks);
        
        return availableTasks;
    }
    
    /**
     * Strict validation: Ensure all machinery in events exists in machinery list
     */
    validateMachineryIntegrity() {
        const machines = this.getValidMachinesForDisplay();
        const events = this.getScheduledEvents();
        
        const validMachineNames = new Set(machines.map(m => m.name || m.nominazione || m.machine_name));
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
     * Strict validation: Ensure all tasks in events exist in ODP orders
     */
    validateTaskIntegrity() {
        const odpOrders = this.getValidTasksForDisplay();
        const events = this.getScheduledEvents();
        
        // Convert all IDs to strings for consistent comparison
        const validTaskIds = new Set(odpOrders.map(o => String(o.id)));
        const taskIdsInEvents = new Set(events.map(e => String(e.taskId)));
        
        const orphanTasks = Array.from(taskIdsInEvents).filter(id => !validTaskIds.has(id));
        
        if (orphanTasks.length > 0) {
            console.warn('Orphan tasks detected in events:', orphanTasks);
            console.warn('Valid ODP order IDs:', Array.from(validTaskIds));
            console.warn('Task IDs in events:', Array.from(taskIdsInEvents));
            
            // Additional debugging for the specific case
            orphanTasks.forEach(orphanId => {
                const orphanEvent = events.find(e => String(e.taskId) === orphanId);
                const matchingOrder = odpOrders.find(o => String(o.id) === orphanId);
                console.warn(`Orphan ID: ${orphanId}, Event:`, orphanEvent, 'Matching ODP order:', matchingOrder);
            });
            
            return {
                isValid: false,
                orphanTasks: orphanTasks,
                message: `Found ${orphanTasks.length} tasks in events that don't exist in ODP orders`
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
            // Must have a name (check both legacy and new formats)
            if (!machine.name && !machine.nominazione && !machine.machine_name) {
                console.warn('Machine without name found:', machine);
                return false;
            }
            
            // Must have a type (check both new and legacy formats)
            if (!machine.machine_type && !machine.type) {
                console.warn('Machine without type found:', machine);
                return false;
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
                const isValid = validMachines.some(validMachine => {
                    const machineName = machine.name || machine.nominazione || machine.machine_name;
                    const validMachineName = validMachine.name || validMachine.nominazione || validMachine.machine_name;
                    return machineName === validMachineName;
                });
                
                if (!isValid) {
                    const machineName = machine.name || machine.nominazione || machine.machine_name;
                    console.log(`Removing invalid machine: ${machineName}`, machine);
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
     * Remove a specific machine by ID
     */
    removeMachineById(machineId) {
        console.log(`🗑️ Removing machine by ID: ${machineId}`);
        
        const machines = this.getMachines();
        const filteredMachines = machines.filter(machine => machine.id !== machineId);
        
        if (filteredMachines.length !== machines.length) {
            this.saveMachines(filteredMachines);
            console.log(`✅ Removed machine with ID: ${machineId}`);
            
            // Also clean up any events referencing this machine
            const machineToRemove = machines.find(m => m.id === machineId);
            if (machineToRemove) {
                const events = this.getScheduledEvents();
                const filteredEvents = events.filter(event => event.machine !== (machineToRemove.name || machineToRemove.nominazione));
                
                if (filteredEvents.length !== events.length) {
                    this.saveScheduledEvents(filteredEvents);
                    console.log(`✅ Also removed ${events.length - filteredEvents.length} events referencing machine ${machineToRemove.name || machineToRemove.nominazione}`);
                }
            }
            
            return true;
        } else {
            console.log(`❌ Machine with ID not found: ${machineId}`);
            return false;
        }
    }
    
    /**
     * Get only valid ODP orders for display (strict filtering)
     */
    getValidTasksForDisplay() {
        const odpOrders = this.getODPOrders();
        return odpOrders.filter(order => {
            // Must have required properties
            if (!order.id || !order.odp_number) {
                console.warn('ODP order missing required properties:', order);
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * Clean up orphaned events (migration to ODP structure)
     */
    cleanupDuplicateTasks() {
        const events = this.getScheduledEvents();
        const odpOrders = this.getODPOrders();
        
        // Get valid ODP order IDs
        const validOdpIds = new Set(odpOrders.map(o => String(o.id)));
        
        // Remove events that reference non-existent tasks
        const validEvents = events.filter(event => validOdpIds.has(String(event.taskId)));
        const orphanedEvents = events.filter(event => !validOdpIds.has(String(event.taskId)));
        
        if (orphanedEvents.length > 0) {
            console.log(`Removing ${orphanedEvents.length} orphaned events`);
            this.saveScheduledEvents(validEvents);
        }
            
            return {
            oldTasksRemoved: 0, // No old tasks to remove anymore
            orphanedEventsRemoved: orphanedEvents.length
            };
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