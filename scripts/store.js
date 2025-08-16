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
    isLoading: false
};

// Private subscribers array to hold callback functions
const subscribers = [];

/**
 * Private method to notify all subscribers of state changes
 * This triggers UI updates when data changes
 */
function _notify() {
    subscribers.forEach(callback => {
        try {
            callback(state);
        } catch (error) {
            console.error('Error in store subscriber callback:', error);
        }
    });
}

/**
 * Application Store - Single source of truth for application state
 */
export const appStore = {
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
        return { ...state }; // Return copy to prevent direct mutation
    },

    /**
     * Initialize the store by loading initial data from storage service
     * This should be called after storageService is initialized.
     */
    async init() {
        try {
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
            
            // Notify subscribers of the new data
            _notify();
            
            console.log('✅ Store initialized and initial data loaded successfully');
            console.log(`📊 Loaded ${state.machines.length} machines, ${state.odpOrders.length} ODP orders, and ${state.phases.length} phases.`);
            
        } catch (error) {
            state.isLoading = false;
            _notify();
            console.error('❌ Error loading initial data for store:', error);
            throw error;
        }
    },

    // --- Machine Actions ---
    async addMachine(newMachine) {
        try {
            const addedMachine = await storageService.add_machine(newMachine);
            state.machines.push(addedMachine);
            _notify();
            console.log('✅ Machine added successfully:', addedMachine.machine_name);
            return addedMachine;
        } catch (error) {
            console.error('❌ Error adding machine:', error);
            throw error;
        }
    },

    async updateMachine(id, updates) {
        try {
            const updatedMachine = await storageService.update_machine(id, updates);
            const machineIndex = state.machines.findIndex(machine => machine.id === id);
            if (machineIndex !== -1) {
                state.machines[machineIndex] = { ...state.machines[machineIndex], ...updatedMachine };
            }
            _notify();
            console.log('✅ Machine updated successfully:', id);
            return updatedMachine;
        } catch (error) {
            console.error('❌ Error updating machine:', error);
            throw error;
        }
    },

    // --- ODP Order Actions ---
    async addOdpOrder(newOrder) {
        try {
            const addedOrder = await storageService.add_odp_order(newOrder);
            state.odpOrders.push(addedOrder);
            _notify();
            console.log('✅ ODP order added successfully:', addedOrder.odp_number);
            return addedOrder;
        } catch (error) {
            console.error('❌ Error adding ODP order:', error);
            throw error;
        }
    },
    async updateOdpOrder(id, updates) {
        try {
            const updatedOrder = await storageService.update_odp_order(id, updates);
            const orderIndex = state.odpOrders.findIndex(order => order.id === id);
            if (orderIndex !== -1) {
                state.odpOrders[orderIndex] = { ...state.odpOrders[orderIndex], ...updatedOrder };
            }
            _notify();
            console.log('✅ ODP order updated successfully:', id);
            return updatedOrder;
        } catch (error) {
            console.error('❌ Error updating ODP order:', error);
            throw error;
        }
    },
    async removeOdpOrder(id) {
        try {
            await storageService.remove_odp_order(id);
            state.odpOrders = state.odpOrders.filter(order => order.id !== id);
            _notify();
            console.log('✅ ODP order removed successfully:', id);
            return true;
        } catch (error) {
            console.error('❌ Error removing ODP order:', error);
            throw error;
        }
    },

    // --- Phase Actions ---
    async addPhase(newPhase) {
        try {
            const addedPhase = await storageService.add_phase(newPhase);
            state.phases.push(addedPhase);
            _notify();
            console.log('✅ Phase added successfully:', addedPhase.name);
            return addedPhase;
        } catch (error) {
            console.error('❌ Error adding phase:', error);
            throw error;
        }
    },
    async updatePhase(id, updates) {
        try {
            const updatedPhase = await storageService.update_phase(id, updates);
            const phaseIndex = state.phases.findIndex(phase => phase.id === id);
            if (phaseIndex !== -1) {
                state.phases[phaseIndex] = { ...state.phases[phaseIndex], ...updatedPhase };
            }
            _notify();
            console.log('✅ Phase updated successfully:', id);
            return updatedPhase;
        } catch (error) {
            console.error('❌ Error updating phase:', error);
            throw error;
        }
    },
    async removePhase(id) {
        try {
            await storageService.remove_phase(id);
            state.phases = state.phases.filter(phase => phase.id !== id);
            _notify();
            console.log('✅ Phase removed successfully:', id);
            return true;
        } catch (error) {
            console.error('❌ Error removing phase:', error);
            throw error;
        }
    },

    // --- Scheduler Actions ---
    async scheduleTask(taskId, eventData) {
        try {
            const updates = {
                scheduled_machine_id: eventData.machine,
                scheduled_start_time: eventData.start_time,
                scheduled_end_time: eventData.end_time,
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
            return await storageService.set_machine_availability(machineName, dateStr, hours);
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

    // --- Enhanced Machine Availability Actions ---
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

            // Initialize machine availability if it doesn't exist
            if (!state.machineAvailability[machineName]) {
                state.machineAvailability[machineName] = {};
            }

            const machineAvailability = {};
            const current = new Date(startDate);
            
            while (current <= endDate) {
                const dateStr = current.toISOString().split('T')[0];
                
                // Only load if we don't already have this date
                if (!state.machineAvailability[machineName][dateStr]) {
                    try {
                        const unavailableHours = await storageService.get_machine_availability_for_date(machineName, dateStr);
                        if (unavailableHours.length > 0) {
                            machineAvailability[dateStr] = unavailableHours;
                        }
                    } catch (error) {
                        console.warn(`⚠️ Could not load availability for ${machineName} on ${dateStr}:`, error.message);
                    }
                }
                
                current.setDate(current.getDate() + 1);
            }

            // Update state with new data
            Object.assign(state.machineAvailability[machineName], machineAvailability);
            
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
        const machines = state.machines;
        machines.forEach(machine => {
            if (!state.machineAvailability[machine.machine_name]) {
                state.machineAvailability[machine.machine_name] = {};
            }
        });
        console.log('✅ Empty machine availability data initialized for all machines');
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
            const machineData = state.machineAvailability[machineName];
            if (!machineData) return [];
            
            return machineData[dateStr] || [];
        } catch (error) {
            console.error('❌ Error getting machine availability from store:', error);
            return [];
        }
    },

    /**
     * Check if machine availability table is accessible
     */
    async isMachineAvailabilityAccessible() {
        try {
            await storageService.get_machine_availability_for_date('test', '2025-01-01');
            return true;
        } catch (error) {
            return false;
        }
    },

    /**
     * Get machine availability table status
     */
    async getMachineAvailabilityStatus() {
        try {
            await storageService.get_machine_availability_for_date('test', '2025-01-01');
            return { accessible: true, message: 'Machine availability table is accessible' };
        } catch (error) {
            if (error.message.includes('406') || error.message.includes('Not Acceptable')) {
                return { 
                    accessible: false, 
                    message: 'Machine availability table does not exist or has permission issues. Please run the SQL script to create the table.' 
                };
            }
            return { 
                accessible: false, 
                message: `Error accessing machine availability table: ${error.message}` 
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