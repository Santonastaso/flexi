/**
 * Storage Service - Centralized localStorage management
 * Handles all data persistence for the Flexi Production Suite
 * Enhanced with strict data integrity and orphan prevention
 */
class StorageService {
    constructor() {
        this.DEBUG = (typeof window !== 'undefined' && window.DEBUG === true);
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
            // Only run detection and reporting - no auto-cleanup
            const results = this.detectAndReportOrphans();
            if (results.hasOrphans && window.DEBUG) {
                console.log('Initial data integrity check completed:', results);
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
                if (window.DEBUG) {
                    console.warn('Data integrity issues detected:', results);
                }
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
        
        // Create sets of valid IDs - ONLY use CURRENT columns
        const validMachineNames = new Set(machines.map(m => m.machine_name));
        const validTaskIds = new Set(tasks.map(t => String(t.id)));
        
        // Check for orphan events
        events.forEach(event => {
            if (!validTaskIds.has(String(event.taskId))) {
                results.orphanEvents.push({
                    type: 'task',
                    event: event,
                    reason: `Task "${event.taskTitle || event.taskId}" (ID: ${event.taskId}) not found in backlog`
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
            checkIntegrity: () => this.validateDataIntegrity(),
            detectOrphans: () => this.detectAndReportOrphans(),
            getValidMachines: () => this.getValidMachinesForDisplay(),
            getValidTasks: () => this.getValidTasksForDisplay(),
            removeVvvvvv: () => this.removeSpecificMachine('vvvvvv'),
            removeMachineById: (id) => this.removeMachineById(id),
            debugMachines: () => this.debugMachines(),
        };

        console.log(`
🔧 Storage Service Debug Commands:
==================================
- storageDebug.checkIntegrity()   // Check data integrity status
- storageDebug.detectOrphans()    // Detect orphan data without cleanup
- storageDebug.getValidMachines() // Get only valid machines
- storageDebug.getValidTasks()    // Get only valid tasks
- storageDebug.removeVvvvvv()     // Remove the "vvvvvv" machine specifically
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
                name: machine.machine_name,
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
            return machine.machine_name;
        });
    }






    
    saveMachines(machines) {
        return this.setItem(this.STORAGE_KEYS.MACHINES, machines);
    }
    
    addMachine(machine) {
        const machines = this.getMachines();
        const normalizedType = Utils.normalizeCode(machine.machine_type || '');
        const normalizedWorkCenter = Utils.normalizeCode(machine.work_center || 'ZANICA');
        const normalizedName = Utils.normalizeName(machine.machine_name || '');
        const normalizedStatus = Utils.normalizeStatus(machine.status || 'ACTIVE');
        
        const newMachine = {
            ...machine,
            id: machine.id || (Date.now() + Math.random().toString(36).substr(2, 9)),
            machine_name: normalizedName,
            work_center: normalizedWorkCenter,
            machine_type: normalizedType || machine.machine_type,
            status: normalizedStatus,
            created_at: machine.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Machine ID will be generated by BusinessLogicService
        // This is now handled by the manager layer
        
        machines.push(newMachine);
        this.saveMachines(machines);
        return newMachine;
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
        
        // Check if ODP number is unique
        if (order.odp_number) {
            const existingOrder = orders.find(o => o.odp_number === order.odp_number);
            if (existingOrder) {
                throw new Error(`ODP number ${order.odp_number} already exists`);
            }
        }
        
        // Normalize inputs
        const normalizedArticle = Utils.normalizeCode(order.article_code);
        const normalizedLot = Utils.normalizeCode(order.production_lot);
        const normalizedWorkCenter = Utils.normalizeCode(order.work_center || 'ZANICA');
        const normalizedDepartment = Utils.normalizeEnumLower(order.department || 'STAMPA');
        
        // Business logic is now handled by BusinessLogicService
        // These determinations are made by the manager layer
        
        const newOrder = {
            id: Utils.normalizeId(order.id) || (Date.now() + Math.random().toString(36).substr(2, 9)),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: Utils.normalizeStatus(order.status || 'DRAFT'),
            
            // IDENTIFICAZIONE (Identification)
            odp_number: order.odp_number,
            article_code: normalizedArticle,
            production_lot: normalizedLot,
            work_center: order.work_center || normalizedWorkCenter,
            nome_cliente: order.nome_cliente || '',
            description: order.description || '',
            
            // SPECIFICHE TECNICHE (Technical Specifications)
            bag_height: parseInt(order.bag_height) || 0,
            bag_width: parseInt(order.bag_width) || 0,
            bag_step: parseInt(order.bag_step) || 0,
            seal_sides: parseInt(order.seal_sides) || 3,
            product_type: Utils.normalizeEnumLower(order.product_type || 'crema'),
            quantity: parseInt(order.quantity) || 1,
            
            // PIANIFICAZIONE (Planning)
            production_start: order.production_start || null,
            delivery_date: order.delivery_date || null,
            
            // DATI COMMERCIALI (Commercial Data)
            internal_customer_code: order.internal_customer_code || normalizedArticle,
            external_customer_code: Utils.normalizeCode(order.external_customer_code || ''),
            customer_order_ref: Utils.normalizeCode(order.customer_order_ref || ''),
            
            // DATI LAVORAZIONE (Processing Data)
            department: order.department || normalizedDepartment,
            fase: Utils.normalizeId(order.fase || ''),
            
            // COLONNE DA CALCOLARE (Calculated Columns)
            duration: parseFloat(order.duration) || 0,
            cost: parseFloat(order.cost) || 0,
            
            // Additional fields
            priority: Utils.normalizeEnumLower(order.priority || 'medium')
        };
        
        orders.push(newOrder);
        this.saveODPOrders(orders);
        return newOrder;
    }

    // ODP number generation is now handled by BusinessLogicService

    updateODPOrder(id, updates) {
        const orders = this.getODPOrders();
        const index = orders.findIndex(order => String(order.id) === String(id));
        
        if (index !== -1) {
            const norm = {};
            if (Object.prototype.hasOwnProperty.call(updates, 'article_code')) {
                norm.article_code = Utils.normalizeCode(updates.article_code);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'production_lot')) {
                norm.production_lot = Utils.normalizeCode(updates.production_lot);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'work_center')) {
                norm.work_center = Utils.normalizeCode(updates.work_center);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
                norm.status = Utils.normalizeStatus(updates.status);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'product_type')) {
                norm.product_type = Utils.normalizeEnumLower(updates.product_type);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'tipo_lavorazione')) {
                norm.tipo_lavorazione = Utils.normalizeEnumLower(updates.tipo_lavorazione);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'fase')) {
                norm.fase = Utils.normalizeId(updates.fase);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'priority')) {
                norm.priority = Utils.normalizeEnumLower(updates.priority);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'internal_customer_code')) {
                norm.internal_customer_code = Utils.normalizeCode(updates.internal_customer_code);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'external_customer_code')) {
                norm.external_customer_code = Utils.normalizeCode(updates.external_customer_code);
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'customer_order_ref')) {
                norm.customer_order_ref = Utils.normalizeCode(updates.customer_order_ref);
            }

            if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
                norm.description = String(updates.description || '').trim();
            }
            const merged = { ...updates, ...norm };
            orders[index] = {
                ...orders[index],
                ...merged,
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
            department: phase.department || phase.type || 'STAMPA', // 'STAMPA' or 'CONFEZIONAMENTO'
            numero_persone: parseInt(phase.numero_persone) || 1, // Number of people required
            
            // Printing parameters
            V_STAMPA: parseFloat(phase.V_STAMPA) || 0, // Velocità stampa in mt/h
            T_SETUP_STAMPA: parseFloat(phase.T_SETUP_STAMPA) || 0, // Tempo attrezzaggio stampa in h
            COSTO_H_STAMPA: parseFloat(phase.COSTO_H_STAMPA) || 0, // Costo orario stampa in €/h
            
            // Packaging parameters
            V_CONF: parseFloat(phase.V_CONF) || 0, // Velocità confezionamento in pz/h
            T_SETUP_CONF: parseFloat(phase.T_SETUP_CONF) || 0, // Tempo attrezzaggio confezionamento in h
            COSTO_H_CONF: parseFloat(phase.COSTO_H_CONF) || 0, // Costo orario confezionamento in €/h
            
            // Phase content (only for CONFEZIONAMENTO)
            contenuto_fase: phase.contenuto_fase || null,
            
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

    getPhasesByDepartment(department) {
        return this.getPhases().filter(phase => {
            // Handle both new department field and legacy type field
            return (phase.department === department) || (phase.type === department);
        });
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
        
        // Dispatch custom event to notify other components
        if (window.DEBUG) console.log(`🔍 Machine availability changed: ${machineName} on ${date} - Unavailable hours:`, availability[machineName][date]);
        window.dispatchEvent(new CustomEvent('machineAvailabilityChanged', {
            detail: { machineName, date, unavailableHours: availability[machineName][date] }
        }));
        
        return availability[machineName][date];
    }
    
    /**
     * Validation helpers
     */
    validateTaskCanBeDeleted(taskId) {
        if (this.isTaskScheduled(taskId)) {
            // ODP-based structure
            const order = this.getODPOrderById(taskId);
            const name = order?.odp_number || String(taskId);
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


    /**
     * Backward-compat wrapper: get backlog task by ID (maps to ODP orders)
     */
    getBacklogTaskById(id) {
        return this.getODPOrderById(id) || null;
    }
    
    /**
     * Get valid machines for Gantt display (live machines that exist)
     * Now uses the same source as machinery tables for SSOT
     */
    getValidGanttMachines() {
        const machines = this.getValidMachinesForDisplay();
        // Consider machines displayable if name exists and not explicitly inactive
        return machines.filter(machine => {
            if (machine.status) {
                return String(machine.status).toUpperCase() !== 'INACTIVE';
            }
            // Legacy fallback: show if has a name
            return true;
        });
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
        
        const validMachineNames = new Set(machines.map(m => m.machine_name));
        const machinesInEvents = new Set(events.map(e => e.machine));
        
        const orphanMachines = Array.from(machinesInEvents).filter(name => !validMachineNames.has(name));
        
        if (orphanMachines.length > 0) {
            if (window.DEBUG) {
                console.warn('Orphan machines detected in events:', orphanMachines);
            }
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
            if (window.DEBUG) {
                console.warn('Orphan tasks detected in events:', orphanTasks);
                console.warn('Valid ODP order IDs:', Array.from(validTaskIds));
                console.warn('Task IDs in events:', Array.from(taskIdsInEvents));
                
                // Additional debugging for the specific case
                orphanTasks.forEach(orphanId => {
                    const orphanEvent = events.find(e => String(e.taskId) === orphanId);
                    const matchingOrder = odpOrders.find(o => String(o.id) === orphanId);
                    console.warn(`Orphan ID: ${orphanId}, Event:`, orphanEvent, 'Matching ODP order:', matchingOrder);
                });
            }
            
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
        // Return all machines without filtering to avoid hiding user data
        return this.getMachines();
    }
    

    
    /**
     * Remove a specific machine by name
     */
    removeSpecificMachine(machineName) {
        console.log(`🗑️ Removing machine: ${machineName}`);
        
        const machines = this.getMachines();
        const filteredMachines = machines.filter(machine => 
            machine.machine_name !== machineName
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
                const filteredEvents = events.filter(event => event.machine !== machineToRemove.machine_name);
                
                if (filteredEvents.length !== events.length) {
                    this.saveScheduledEvents(filteredEvents);
                    console.log(`✅ Also removed ${events.length - filteredEvents.length} events referencing machine ${machineToRemove.machine_name}`);
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
        // Normalize core fields before saving
        const normalized = machines.map(m => ({
            ...m,
            machine_name: Utils.normalizeName(m.machine_name || ''),
            work_center: Utils.normalizeCode(m.work_center || ''),
            machine_type: Utils.normalizeCode(m.machine_type || ''),
            status: Utils.normalizeStatus(m.status || 'ACTIVE')
        }));
        const result = this.saveMachines(normalized);
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