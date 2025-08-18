/**
 * Application State Management Store
 * Centralized state management for the entire application
 * Provides a single source of truth for all application data
 */

import { storageService } from './storageService.js';

// Private state object
const state = {
    machines: [],
    odpOrders: [],
    phases: [], // <-- Added phases state
    machineAvailability: {}, // <-- Added machine availability state
    isLoading: false,
    isInitialized: false // <-- Added initialization guard
};

// Private subscribers array to hold callback functions
const subscribers = [];

/**
 * Private method to notify all subscribers of state changes
 * This triggers UI updates when data changes
 */
function _notify() {
    subscribers.forEach(callback => {
        callback(state);
    });
}

/**
 * Application Store - Single source of truth for application state
 */
export const appStore = {
    // Expose storageService for direct access
    storageService,
    
    /**
     * Subscribe to state changes
     * @param {Function} callback - Function to call when state changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        subscribers.push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = subscribers.indexOf(callback);
            if (index > -1) {
                subscribers.splice(index, 1);
            }
        };
    },

    /**
     * Get current state
     * @returns {Object} Current state object
     */
    getState() {
        return structuredClone(state); // Return deep clone to prevent any mutation
    },

    /**
     * Check if store is initialized
     * @returns {boolean} True if store has been initialized
     */
    isInitialized() {
        return state.isInitialized;
    },

    /**
     * Reset store state (for testing/debugging)
     * @returns {void}
     */
    reset() {
        state.machines = [];
        state.odpOrders = [];
        state.phases = [];
        state.machineAvailability = {};
        state.isLoading = false;
        state.isInitialized = false;
        console.log('🔄 [Store] Store state reset');
    },

    /**
     * Initialize the store by loading initial data from storage service
     * This should be called after storageService is initialized.
     */
    async init() {
        await storageService.init(); // Add this line

        // Prevent duplicate initialization
        if (state.isInitialized) {
            console.log('🔒 [Store] Already initialized, skipping duplicate init');
            return;
        }
        
        console.log('🚀 [Store] Initializing store...');
        state.isLoading = true;
        _notify(); // Notify that loading has started
        
        // Load all initial data in parallel
        const [machines, odpOrders, phases] = await Promise.all([
            storageService.get_machines(),
            storageService.get_odp_orders(),
            storageService.get_phases() // <-- Load phases
        ]);
        
        // Update state
        state.machines = machines || [];
        state.odpOrders = odpOrders || [];
        state.phases = phases || []; // <-- Set phases state
        
        // Initialize empty machine availability data (no database calls)
        this.initializeEmptyMachineAvailability();
        
        state.isLoading = false;
        state.isInitialized = true; // Mark as initialized
        
        console.log('✅ [Store] Store initialization completed');
        
        // Notify subscribers of the new data
        _notify();
    },

    // --- Machine Actions ---
    /**
     * Add a new machine to the store
     * @param {Object} newMachine - The machine object to add
     * @returns {Object} The added machine
     */
    async addMachine(newMachine) {
        const addedMachine = await storageService.add_machine(newMachine);
        state.machines = [...state.machines, addedMachine];
        _notify();
        return addedMachine;
    },

    /**
     * Update an existing machine in the store
     * @param {string} id - The machine ID to update
     * @param {Object} updates - The updates to apply
     * @returns {Object} The updated machine
     */
    async updateMachine(id, updates) {
        const updatedMachine = await storageService.update_machine(id, updates);
        state.machines = state.machines.map(machine => 
            machine.id === id 
                ? { ...machine, ...updatedMachine }
                : machine
        );
        _notify();
        return updatedMachine;
    },

    // --- ODP Order Actions ---
    /**
     * Add a new ODP order to the store
     * @param {Object} newOrder - The order object to add
     * @returns {Object} The added order
     */
    async addOdpOrder(newOrder) {
        const addedOrder = await storageService.add_odp_order(newOrder);
        state.odpOrders = [...state.odpOrders, addedOrder];
        _notify();
        return addedOrder;
    },

    /**
     * Update an existing ODP order in the store
     * @param {string} id - The order ID to update
     * @param {Object} updates - The updates to apply
     * @returns {Object} The updated order
     */
    async updateOdpOrder(id, updates) {
        const updatedOrder = await storageService.update_odp_order(id, updates);
        state.odpOrders = state.odpOrders.map(order => 
            order.id === id 
                ? { ...order, ...updatedOrder }
                : order
        );
        _notify();
        return updatedOrder;
    },
    async removeOdpOrder(id) {
        await storageService.remove_odp_order(id);
        state.odpOrders = state.odpOrders.filter(order => order.id !== id);
        _notify();
        return true;
    },

    // --- Phase Actions ---
    /**
     * Add a new phase to the store
     * @param {Object} newPhase - The phase object to add
     * @returns {Object} The added phase
     */
    async addPhase(newPhase) {
        const addedPhase = await storageService.add_phase(newPhase);
        state.phases = [...state.phases, addedPhase];
        _notify();
        return addedPhase;
    },

    /**
     * Update an existing phase in the store
     * @param {string} id - The phase ID to update
     * @param {Object} updates - The updates to apply
     * @returns {Object} The updated phase
     */
    async updatePhase(id, updates) {
        const updatedPhase = await storageService.update_phase(id, updates);
        state.phases = state.phases.map(phase => 
            phase.id === id 
                ? { ...phase, ...updatedPhase }
                : phase
        );
        _notify();
        return updatedPhase;
    },

    /**
     * Remove a phase from the store
     * @param {string} id - The phase ID to remove
     * @returns {boolean} True if successful
     */
    async removePhase(id) {
        await storageService.remove_phase(id);
        state.phases = state.phases.filter(phase => phase.id !== id);
        _notify();
        return true;
    },

    /**
     * Remove a machine from the store
     * @param {string} id - The machine ID to remove
     * @returns {boolean} True if successful
     */
    async removeMachine(id) {
        await storageService.remove_machine(id);
        state.machines = state.machines.filter(machine => machine.id !== id);
        _notify();
        return true;
    },

    // --- Scheduler Actions ---
    async scheduleTask(taskId, eventData) {
        try {
            const updates = {
                scheduled_machine_id: eventData.machine,
                scheduled_start_time: eventData.start_time,
                scheduled_end_time: eventData.end_time,
                production_start: eventData.start_time,
                production_end: eventData.end_time,
                color: eventData.color,
                status: 'SCHEDULED'
            };
            await this.updateOdpOrder(taskId, updates); // Re-use existing action
        } catch (error) {
            console.error('❌ Error scheduling task in store:', error);
            throw error;
        }
    },

    async unscheduleTask(taskId) {
        try {
            const updates = {
                scheduled_machine_id: null,
                scheduled_start_time: null,
                scheduled_end_time: null,
                production_start: null,
                production_end: null,
                color: null,
                status: 'NOT SCHEDULED'
            };
            await this.updateOdpOrder(taskId, updates); // Re-use existing action
        } catch (error) {
            console.error('❌ Error unscheduling task in store:', error);
            throw error;
        }
    },

    // --- Machine Availability Actions ---
    async getMachineAvailabilityForDate(machineName, dateStr) {
        try {
            return await storageService.get_machine_availability_for_date(machineName, dateStr);
        } catch (error) {
            console.error('❌ Error getting machine availability:', error);
            return [];
        }
    },

    async setMachineAvailability(machineName, dateStr, hours) {
        try {
            // Update the database
            await storageService.set_machine_availability(machineName, dateStr, hours);
            
            // Update the local state
            if (!state.machineAvailability[dateStr]) {
                state.machineAvailability[dateStr] = [];
            }
            
            // Find existing row or create new one
            let machineRow = state.machineAvailability[dateStr].find(row => row.machine_name === machineName);
            if (machineRow) {
                machineRow.unavailable_hours = hours;
            } else {
                state.machineAvailability[dateStr].push({
                    machine_name: machineName,
                    date: dateStr,
                    unavailable_hours: hours
                });
            }
            
            // Notify subscribers
            _notify();
            
            return true;
        } catch (error) {
            console.error('❌ Error setting machine availability:', error);
            throw error;
        }
    },

    async getEventsByDate(dateStr) {
        try {
            return await storageService.get_events_by_date(dateStr);
        } catch (error) {
            console.error('❌ Error getting events by date:', error);
            return [];
        }
    },

    /**
     * Load machine availability data for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     */
    async loadMachineAvailabilityForDate(date) {
        // Check if already loading or already loaded
        if (state.machineAvailability[date]?._loading) {
            return;
        }
        
        if (state.machineAvailability[date] && state.machineAvailability[date].length >= 0) {
            return;
        }
        
        try {
            // Mark as loading
            if (!state.machineAvailability[date]) {
                state.machineAvailability[date] = [];
            }
            state.machineAvailability[date]._loading = true;
            _notify();
            
            // Load availability data
            const availabilityData = await storageService.get_machine_availability_for_date_all_machines(date);
            
            // Update state
            state.machineAvailability[date] = availabilityData || [];
            delete state.machineAvailability[date]._loading;
            
            // Notify subscribers
            _notify();
            
        } catch (error) {
            console.error('❌ Error loading machine availability for date:', error);
            // Remove loading state on error
            if (state.machineAvailability[date]) {
                delete state.machineAvailability[date]._loading;
            }
            throw error;
        }
    },

    /**
     * Load machine availability data for a specific machine and date range
     * This is much more efficient than loading all data upfront
     */
    async loadMachineAvailabilityForMachine(machineName, startDate, endDate) {
        try {
            // Check if machine_availability table is accessible
            try {
                await storageService.get_machine_availability_for_date('test', '2025-01-01');
            } catch (tableError) {
                console.warn('⚠️ Machine availability table not accessible, skipping availability loading:', tableError.message);
                return {};
            }

            const machineAvailability = {};
            const current = new Date(startDate);
            
            while (current <= endDate) {
                const dateStr = current.toISOString().split('T')[0];
                
                // Check if we already have this date's data
                if (!state.machineAvailability[dateStr]) {
                    // Load all machines for this date
                    await this.loadMachineAvailabilityForDate(dateStr);
                }
                
                // Get the data for this specific machine
                const machineData = this.getMachineAvailability(machineName, dateStr);
                if (machineData && machineData.length > 0) {
                    machineAvailability[dateStr] = machineData;
                }
                
                current.setDate(current.getDate() + 1);
            }

            return machineAvailability;
        } catch (error) {
            console.error('❌ Error loading machine availability for machine:', error);
            return {};
        }
    },

    /**
     * Load all machine availability data into the store (legacy method - now deprecated)
     */
    async loadMachineAvailability() {
        console.warn('⚠️ loadMachineAvailability() is deprecated. Use loadMachineAvailabilityForMachine() instead.');
        return {};
    },

    /**
     * Initialize empty machine availability data for all machines (no database calls)
     */
    initializeEmptyMachineAvailability() {
        const { machines } = state;
        machines.forEach(machine => {
            if (!state.machineAvailability[machine.machine_name]) {
                state.machineAvailability[machine.machine_name] = {};
            }
        });
    },

    /**
     * Set machine unavailability for a date range
     */
    async setMachineUnavailability(machineName, startDate, endDate, startTime, endTime) {
        try {
            // Check if machine availability table is accessible
            const isAccessible = await this.isMachineAvailabilityAccessible();
            if (!isAccessible) {
                throw new Error('Machine availability table is not accessible. Please check database permissions or table existence.');
            }

            // Call the new backend function
            await storageService.setUnavailableHoursForRange(machineName, startDate, endDate, startTime, endTime);
            
            // Re-fetch machine availability for the affected date range
            const startDateObj = new Date(startDate.split('/').reverse().join('-'));
            const endDateObj = new Date(endDate.split('/').reverse().join('-'));
            await this.loadMachineAvailabilityForMachine(machineName, startDateObj, endDateObj);
            
            // Notify subscribers of the change
            _notify();
            
            console.log('✅ Machine unavailability set successfully');
            return true;
        } catch (error) {
            console.error('❌ Error setting machine unavailability:', error);
            throw error;
        }
    },

    /**
     * Get machine availability for a specific machine and date
     */
    getMachineAvailability(machineName, dateStr) {
        try {
            // Use the new data structure: machineAvailability[date] = [rows]
            const dateData = state.machineAvailability[dateStr];
            if (!dateData || !Array.isArray(dateData)) return [];
            
            // Find the row for this machine
            const machineRow = dateData.find(row => row.machine_name === machineName);
            return machineRow ? machineRow.unavailable_hours || [] : [];
        } catch (error) {
            console.error('❌ Error getting machine availability from store:', error);
            return [];
        }
    },

    /**
     * Check if machine availability table is accessible
     * @returns {Promise<boolean>} True if accessible, false otherwise
     */
    async isMachineAvailabilityAccessible() {
        try {
            // Try to access the table with a simple query
            await storageService.get_machine_availability_for_date_all_machines('2025-01-01');
            return true;
        } catch (error) {
            console.warn('⚠️ Machine availability table not accessible:', error.message);
            return false;
        }
    },

    /**
     * Get machine availability table status
     * @returns {Promise<Object>} Status information
     */
    async getMachineAvailabilityStatus() {
        try {
            const isAccessible = await this.isMachineAvailabilityAccessible();
            return {
                accessible: isAccessible,
                message: isAccessible ? 'Table is accessible' : 'Table is not accessible - check permissions or table existence'
            };
        } catch (error) {
            return {
                accessible: false,
                message: `Error checking table: ${error.message}`
            };
        }
    },

    /**
     * Check if a specific time slot is unavailable
     */
    isTimeSlotUnavailable(machineName, dateStr, hour) {
        try {
            const unavailableHours = this.getMachineAvailability(machineName, dateStr);
            return unavailableHours.includes(hour);
        } catch (error) {
            console.error('❌ Error checking time slot availability:', error);
            return false;
        }
    }
};

export default appStore;