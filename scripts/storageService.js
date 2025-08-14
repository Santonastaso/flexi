/**
 * Storage Service
 * Provides all data operations using Supabase backend
 * Simple, clean interface for database operations
 */
class StorageService {
    constructor() {
        this.supabaseService = null;
        this.config = null;
        this.initialized = false;
    }

    /**
     * Initialize the StorageService with Supabase backend
     */
    async init() {
        // Wait for Supabase service to be available
        await this.wait_for_services();
        
        // Initialize Supabase connection
        await this.supabaseService.init();
        this.initialized = true;
    }

    /**
     * Wait for Supabase service to be available
     */
    async wait_for_services() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        while (attempts < maxAttempts) {
            if (window.supabaseService && window.ServiceConfig) {
                this.supabaseService = window.supabaseService;
                this.config = window.ServiceConfig;
                console.log('StorageService dependencies loaded successfully');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Supabase service not available after 5 seconds');
    }



    /**
     * Clear cache for a specific feature
     */
    async clear_cache(feature) {
        if (this.supabaseService && this.supabaseService.clear_cache) {
            this.supabaseService.clear_cache(feature);
            console.log(`Cache cleared for ${feature}`);
        }
    }
    
    /**
     * Centralized error handling wrapper for Supabase operations
     * Reduces code duplication and ensures consistent error handling
     */
    async handle_supabase_operation(operation, operation_name, entity_type, success_message = null) {
        this.log_call(operation_name, entity_type);
        
        try {
            const result = await operation();
            if (success_message) {
                console.log(`${success_message} to Supabase`);
            }
            return result;
        } catch (error) {
            const errorMessage = `Error ${operation_name.replace('_', ' ')} ${entity_type} ${operation_name.includes('get') || operation_name.includes('load') ? 'from' : 'to'} Supabase`;
            console.error(`${errorMessage}:`, error);
            throw new Error(`Failed to ${operation_name.replace('_', ' ')} ${entity_type} ${operation_name.includes('get') || operation_name.includes('load') ? 'from' : 'to'} Supabase`);
        }
    }

    /**
     * Log service calls if enabled
     */
    log_call(method, feature, ...args) {
        if (this.config && this.config.LOG_SERVICE_CALLS) {
            console.log(`[Supabase] ${method}`, ...args);
        }
    }

    /**
     * Show message (delegates to appropriate service)
     */
    show_message(message, type = 'info') {
        // Use Supabase service for message display
        if (this.supabaseService && this.supabaseService.show_message) {
            this.supabaseService.show_message(message, type);
        } else {
            // Fallback to basic message display
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * MACHINES METHODS
     */
    async get_machines() {
        return await this.handle_supabase_operation(
            () => this.supabaseService.get_machines(),
            'get_machines',
            'machines'
        );
    }

    async get_active_machines() {
        return await this.handle_supabase_operation(
            () => this.supabaseService.get_active_machines(),
            'get_active_machines',
            'machines'
        );
    }
    
    async save_machines(machines) {
        return await this.handle_supabase_operation(
            () => this.supabaseService.save_machines(machines),
            'save_machines',
            'machines',
            'Machines saved'
        );
    }
    
    async add_machine(machine) {
        return await this.handle_supabase_operation(
            () => this.supabaseService.add_machine(machine),
            'add_machine',
            'machines',
            'Machine added'
        );
    }

    async update_machine(id, updates) {
        return await this.handle_supabase_operation(
            () => this.supabaseService.update_machine(id, updates),
            'update_machine',
            'machines',
            'Machine updated'
        );
    }
    
    async remove_machine(machine_id) {
        return await this.handle_supabase_operation(
            () => this.supabaseService.remove_machine(machine_id),
            'remove_machine',
            'machines',
            'Machine removed'
        );
    }

    async add_machine_with_sync(machine) {
        this.log_call('add_machine_with_sync', 'machines', machine);
        
        try {
            const result = await this.supabaseService.add_machine_with_sync(machine);
            console.log('Machine added with sync to Supabase');
            return result;
        } catch (error) {
            console.error('Error adding machine with sync to Supabase:', error);
            throw new Error('Failed to add machine with sync to Supabase');
        }
    }

    async save_machines_with_sync(machines) {
        this.log_call('save_machines_with_sync', 'machines', machines);
        
        try {
            const result = await this.supabaseService.save_machines_with_sync(machines);
            console.log('Machines saved with sync to Supabase');
            return result;
        } catch (error) {
            console.error('Error saving machines with sync to Supabase:', error);
            throw new Error('Failed to save machines with sync to Supabase');
        }
    }

    async validate_machine_can_be_deleted(machineId) {
        this.log_call('validate_machine_can_be_deleted', 'machines', machineId);
        
        try {
            const result = await this.supabaseService.validate_machine_can_be_deleted(machineId);
            return result;
        } catch (error) {
            console.error('Error validating machine deletion in Supabase:', error);
            throw new Error('Failed to validate machine deletion in Supabase');
        }
    }

    /**
     * ODP ORDERS METHODS
     */
    async get_odp_orders() {
        const result = await this.handle_supabase_operation(
            () => this.supabaseService.get_odp_orders(),
            'get_odp_orders',
            'odp_orders'
        );
        console.log('ODP orders loaded from Supabase:', result.length);
        return result;
    }

    async save_odp_orders(orders) {
        return await this.handle_supabase_operation(
            () => this.supabaseService.save_odp_orders(orders),
            'save_odp_orders',
            'odp_orders',
            'ODP orders saved'
        );
    }

    async add_odp_order(order) {
        return await this.handle_supabase_operation(
            () => this.supabaseService.add_odp_order(order),
            'add_odp_order',
            'odp_orders',
            'ODP order added'
        );
    }

    async update_odp_order(id, updates) {
        this.log_call('update_odp_order', 'odp_orders', id, updates);
        
        try {
            const result = await this.supabaseService.update_odp_order(id, updates);
            console.log('ODP order updated in Supabase');
            return result;
        } catch (error) {
            console.error('Error updating ODP order in Supabase:', error);
            throw new Error('Failed to update ODP order in Supabase');
        }
    }

    async remove_odp_order(id) {
        this.log_call('remove_odp_order', 'odp_orders', id);
        
        try {
            const result = await this.supabaseService.remove_odp_order(id);
            console.log('ODP order removed from Supabase');
            return result;
        } catch (error) {
            console.error('Error removing ODP order from Supabase:', error);
            throw new Error('Failed to remove ODP order from Supabase');
        }
    }

    async get_next_odp_number() {
        this.log_call('get_next_odp_number', 'odp_orders');
        
        try {
            const result = await this.supabaseService.get_next_odp_number();
            return result;
        } catch (error) {
            console.error('Error getting next ODP number from Supabase:', error);
            throw new Error('Failed to get next ODP number from Supabase');
        }
    }

    async get_valid_tasks_for_display() {
        this.log_call('get_valid_tasks_for_display', 'odp_orders');
        
        try {
            const result = await this.supabaseService.get_valid_tasks_for_display();
            return result;
        } catch (error) {
            console.error('Error getting valid tasks from Supabase:', error);
            throw new Error('Failed to get valid tasks from Supabase');
        }
    }

    async get_odp_order_by_id(id) {
        this.log_call('get_odp_order_by_id', 'odp_orders', id);
        
        try {
            const result = await this.supabaseService.get_odp_order_by_id(id);
            return result;
        } catch (error) {
            console.error('Error getting ODP order by ID from Supabase:', error);
            throw new Error('Failed to get ODP order by ID from Supabase');
        }
    }

    /**
     * PHASES METHODS
     */
    async get_phases() {
        // Ensure initialization
        if (!this.initialized) {
            await this.wait_for_services();
            await this.init();
        }
        
        const result = await this.handle_supabase_operation(
            () => this.supabaseService.get_phases(),
            'get_phases',
            'phases'
        );
        console.log('Phases loaded from Supabase:', result.length);
        return result;
    }

    async save_phases(phases) {
        this.log_call('save_phases', 'phases', phases);
        
        // Ensure initialization
        if (!this.initialized) {
            await this.wait_for_services();
            await this.init();
        }
        
        try {
            const result = await this.supabaseService.save_phases(phases);
            console.log('Phases saved to Supabase');
            return result;
        } catch (error) {
            console.error('Error saving phases to Supabase:', error);
            throw new Error('Failed to save phases to Supabase');
        }
    }

    async add_phase(phase) {
        this.log_call('add_phase', 'phases', phase);
        
        // Ensure initialization
        if (!this.initialized) {
            await this.wait_for_services();
            await this.init();
        }
        
        try {
            const result = await this.supabaseService.add_phase(phase);
            console.log('Phase added to Supabase');
            return result;
        } catch (error) {
            console.error('Error adding phase to Supabase:', error);
            throw new Error('Failed to add phase to Supabase');
        }
    }

    async update_phase(id, updates) {
        this.log_call('update_phase', 'phases', id, updates);
        
        try {
            const result = await this.supabaseService.update_phase(id, updates);
            console.log('Phase updated in Supabase');
            return result;
        } catch (error) {
            console.error('Error updating phase in Supabase:', error);
            throw new Error('Failed to update phase in Supabase');
        }
    }

    async remove_phase(id) {
        this.log_call('remove_phase', 'phases', id);
        
        try {
            const result = await this.supabaseService.remove_phase(id);
            console.log('Phase removed from Supabase');
            return result;
        } catch (error) {
            console.error('Error removing phase from Supabase:', error);
            throw new Error('Failed to remove phase from Supabase');
        }
    }

    async get_phase_by_id(id) {
        this.log_call('get_phase_by_id', 'phases', id);
        
        try {
            const result = await this.supabaseService.get_phase_by_id(id);
            return result;
        } catch (error) {
            console.error('Error getting phase by ID from Supabase:', error);
            throw new Error('Failed to get phase by ID from Supabase');
        }
    }

    /**
     * SCHEDULED EVENTS METHODS
     */
    async get_scheduled_events() {
        this.log_call('get_scheduled_events', 'scheduled_events');
        
        try {
            const result = await this.supabaseService.get_scheduled_events();
            return result;
        } catch (error) {
            console.error('Error getting scheduled events from Supabase:', error);
            throw new Error('Failed to get scheduled events from Supabase');
        }
    }

    async save_scheduled_events(events) {
        this.log_call('save_scheduled_events', 'scheduled_events', events);
        
        try {
            const result = await this.supabaseService.save_scheduled_events(events);
            console.log('Scheduled events saved to Supabase');
            return result;
        } catch (error) {
            console.error('Error saving scheduled events to Supabase:', error);
            throw new Error('Failed to save scheduled events to Supabase');
        }
    }

    async add_scheduled_event(event) {
        this.log_call('add_scheduled_event', 'scheduled_events', event);
        
        try {
            const result = await this.supabaseService.add_scheduled_event(event);
            console.log('Scheduled event added to Supabase');
            return result;
        } catch (error) {
            console.error('Error adding scheduled event to Supabase:', error);
            throw new Error('Failed to add scheduled event to Supabase');
        }
    }

    async remove_scheduled_event(event_id) {
        this.log_call('remove_scheduled_event', 'scheduled_events', event_id);
        
        try {
            const result = await this.supabaseService.remove_scheduled_event(event_id);
            console.log('Scheduled event removed from Supabase');
            return result;
        } catch (error) {
            console.error('Error removing scheduled event from Supabase:', error);
            throw new Error('Failed to remove scheduled event from Supabase');
        }
    }

    async is_task_scheduled(task_id) {
        this.log_call('is_task_scheduled', 'scheduled_events', task_id);
        
        try {
            const result = await this.supabaseService.is_task_scheduled(task_id);
            return result;
        } catch (error) {
            console.error('Error checking if task is scheduled in Supabase:', error);
            throw new Error('Failed to check if task is scheduled in Supabase');
        }
    }

    async get_events_by_machine(machine_name) {
        this.log_call('get_events_by_machine', 'scheduled_events', machine_name);
        
        try {
            const result = await this.supabaseService.get_events_by_machine(machine_name);
            return result;
        } catch (error) {
            console.error('Error getting events by machine from Supabase:', error);
            throw new Error('Failed to get events by machine from Supabase');
        }
    }

    async get_events_by_date(date) {
        this.log_call('get_events_by_date', 'scheduled_events', date);
        
        try {
            const result = await this.supabaseService.get_events_by_date(date);
            return result;
        } catch (error) {
            console.error('Error getting events by date from Supabase:', error);
            throw new Error('Failed to get events by date from Supabase');
        }
    }

    async get_scheduled_event_by_id(event_id) {
        this.log_call('get_scheduled_event_by_id', 'scheduled_events', event_id);
        
        try {
            const result = await this.supabaseService.get_scheduled_event_by_id(event_id);
            return result;
        } catch (error) {
            console.error('Error getting scheduled event by ID from Supabase:', error);
            throw new Error('Failed to get scheduled event by ID from Supabase');
        }
    }

    /**
     * MACHINE AVAILABILITY METHODS
     */
    async get_machine_availability() {
        this.log_call('get_machine_availability', 'machine_availability');
        
        try {
            const result = await this.supabaseService.get_machine_availability();
            return result;
        } catch (error) {
            console.error('Error getting machine availability from Supabase:', error);
            throw new Error('Failed to get machine availability from Supabase');
        }
    }

    async save_machine_availability(availability) {
        this.log_call('save_machine_availability', 'machine_availability', availability);
        
        try {
            const result = await this.supabaseService.save_machine_availability(availability);
            console.log('Machine availability saved to Supabase');
            return result;
        } catch (error) {
            console.error('Error saving machine availability to Supabase:', error);
            throw new Error('Failed to save machine availability to Supabase');
        }
    }

    async get_machine_availability_for_date(machineName, date) {
        this.log_call('get_machine_availability_for_date', 'machine_availability', machineName, date);
        
        try {
            const result = await this.supabaseService.get_machine_availability_for_date(machineName, date);
            return result;
        } catch (error) {
            console.error('Error getting machine availability for date from Supabase:', error);
            return []; // Return empty array on error to prevent UI issues
        }
    }

    async set_machine_availability(machineName, date, unavailableHours) {
        this.log_call('set_machine_availability', 'machine_availability', machineName, date, unavailableHours);
        
        try {
            const result = await this.supabaseService.set_machine_availability(machineName, date, unavailableHours);
            console.log('Machine availability set in Supabase');
            return result;
        } catch (error) {
            console.error('Error setting machine availability in Supabase:', error);
            throw new Error('Failed to set machine availability in Supabase');
        }
    }

    async toggle_machine_hour_availability(machineName, date, hour) {
        this.log_call('toggle_machine_hour_availability', 'machine_availability', machineName, date, hour);
        
        try {
            const result = await this.supabaseService.toggle_machine_hour_availability(machineName, date, hour);
            console.log('Machine hour availability toggled in Supabase');
            return result;
        } catch (error) {
            console.error('Error toggling machine hour availability in Supabase:', error);
            throw new Error('Failed to toggle machine hour availability in Supabase');
        }
    }
    
    /**
     * DATA CHANGE NOTIFICATIONS
     */
    notify_data_change(type, action, data) {
        // Both services implement this the same way
        window.dispatchEvent(new CustomEvent('dataChanged', {
            detail: { type, action, data }
        }));
    }

    /**
     * REALTIME SUBSCRIPTIONS (Supabase only)
     */
    subscribe_to_changes(table, callback) {
        if (this.config && this.config.ENABLE_REALTIME && this.supabaseService) {
            return this.supabaseService.subscribe_to_changes(table, callback);
        }
        return null;
    }

    unsubscribe_from_changes(table) {
        if (this.config && this.config.ENABLE_REALTIME && this.supabaseService) {
            this.supabaseService.unsubscribe_from_changes(table);
        }
    }

    unsubscribe_all() {
        if (this.config && this.config.ENABLE_REALTIME && this.supabaseService) {
            this.supabaseService.unsubscribe_all();
        }
    }
}

// Create and export storage service
const storageService = new StorageService();

// Make available globally
if (typeof window !== 'undefined') {
    window.storageService = storageService;
    
    // Initialize the service after all scripts are loaded
    window.addEventListener('load', async () => {
        try {
            await storageService.init();
            console.log('StorageService initialized successfully');
            
            // Dispatch a custom event to notify other components
            window.dispatchEvent(new CustomEvent('storageServiceReady'));
        } catch (error) {
            console.error('Failed to initialize StorageService:', error);
        }
    });
}

// ES6 module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = storageService;
}
