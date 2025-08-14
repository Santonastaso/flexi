/**
 * Storage Service
 * Provides data storage and retrieval using Supabase backend
 */
class StorageService {
    constructor() {
        this.supabaseService = null;
        this.config = null;
        this.initialized = false;
    }

    /**
     * Initialize the service
     */
    async init() {
        // Wait for all required services to be available
        await this.wait_for_services();
        
        // Always initialize Supabase service
        await this.supabaseService.init();
        this.initialized = true;
    }

    /**
     * Wait for all required services to be available
     */
    async wait_for_services() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        while (attempts < maxAttempts) {
            if (window.supabaseService && window.ServiceConfig) {
                this.supabaseService = window.supabaseService;
                this.config = window.ServiceConfig;
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Required services not available after 5 seconds');
    }

    /**
     * Get the appropriate service for a feature
     */
    get_service_for_feature(feature) {
        if (!this.initialized) {
            throw new Error('StorageService not initialized yet');
        }
        
        // Always return Supabase service
        return this.supabaseService;
    }

    /**
     * Get service with safety check to prevent infinite recursion
     */
    get_safe_service(feature) {
        const service = this.get_service_for_feature(feature);
        
        // Safety check to prevent infinite recursion
        if (service === this) {
            throw new Error('Circular reference detected');
        }
        
        return service;
    }

    /**
     * Force refresh from Supabase and clear cache
     */
    async force_supabase_refresh(feature) {
        if (!this.initialized) {
            await this.wait_for_services();
            await this.init();
        }
        
        if (this.config && this.config.should_use_supabase(feature)) {
            // Clear any cached data
            if (this.supabaseService.clear_cache) {
                this.supabaseService.clear_cache(feature);
            }
            console.log(`Forced refresh from Supabase for ${feature}`);
            return true;
        }
        return false;
    }

    /**
     * Check current data source for a feature
     */
    get_data_source(feature) {
        if (!this.initialized) {
            return 'not_initialized';
        }
        
        if (this.config && this.config.should_use_supabase(feature)) {
            return 'supabase';
        }
        return 'localStorage';
    }

    /**
     * Force Supabase usage for a feature
     */
    async force_supabase_usage(feature) {
        if (!this.initialized) {
            await this.wait_for_services();
            await this.init();
        }
        
        if (this.config && this.config.should_use_supabase(feature)) {
            console.log(`Forcing Supabase usage for ${feature}`);
            return true;
        }
        
        console.warn(`Cannot force Supabase usage for ${feature} - not configured`);
        return false;
    }

    /**
     * Log service calls if enabled
     */
    log_call(method, feature, ...args) {
        if (this.config && this.config.LOG_SERVICE_CALLS) {
            const service = this.config.should_use_supabase(feature) ? 'Supabase' : 'LocalStorage';
            console.log(`[${service}] ${method}`, ...args);
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
        this.log_call('get_machines', 'machines');
        const service = this.get_safe_service('machines');
        
        try {
            const result = await service.get_machines();
            return result;
        } catch (error) {
            console.error('Error in Supabase get_machines:', error);
            throw new Error('Failed to load machines from Supabase');
        }
    }

    async get_active_machines() {
        this.log_call('get_active_machines', 'machines');
        const service = this.get_service_for_feature('machines');
        
        try {
            const result = await service.get_active_machines();
            return result;
        } catch (error) {
            console.error('Error getting active machines from Supabase:', error);
            throw new Error('Failed to get active machines from Supabase');
        }
    }
    
    async save_machines(machines) {
        this.log_call('save_machines', 'machines', machines);
        
        const service = this.get_service_for_feature('machines');
        try {
            const result = await service.save_machines(machines);
            console.log('Machines saved to Supabase');
            return result;
        } catch (error) {
            console.error('Error saving machines to Supabase:', error);
            throw new Error('Failed to save machines to Supabase');
        }
    }

    async add_machine(machine) {
        this.log_call('add_machine', 'machines', machine);
        
        const service = this.get_service_for_feature('machines');
        try {
            const result = await service.add_machine(machine);
            console.log('Machine added to Supabase');
            return result;
        } catch (error) {
            console.error('Error adding machine to Supabase:', error);
            throw new Error('Failed to add machine to Supabase');
        }
    }

    async update_machine(id, updates) {
        this.log_call('update_machine', 'machines', id, updates);
        const service = this.get_service_for_feature('machines');
        
        try {
            const result = await service.update_machine(id, updates);
            console.log('Machine updated in Supabase');
            return result;
        } catch (error) {
            console.error('Error updating machine in Supabase:', error);
            throw new Error('Failed to update machine in Supabase');
        }
    }

    async remove_machine(machine_id) {
        this.log_call('remove_machine', 'machines', machine_id);
        
        const service = this.get_service_for_feature('machines');
        try {
            const result = await service.remove_machine(machine_id);
            console.log('Machine removed from Supabase');
            return result;
        } catch (error) {
            console.error('Error removing machine from Supabase:', error);
            throw new Error('Failed to remove machine from Supabase');
        }
    }

    async add_machine_with_sync(machine) {
        this.log_call('add_machine_with_sync', 'machines', machine);
        const service = this.get_service_for_feature('machines');
        
        try {
            const result = await service.add_machine_with_sync(machine);
            console.log('Machine added with sync to Supabase');
            return result;
        } catch (error) {
            console.error('Error adding machine with sync to Supabase:', error);
            throw new Error('Failed to add machine with sync to Supabase');
        }
    }

    async save_machines_with_sync(machines) {
        this.log_call('save_machines_with_sync', 'machines', machines);
        const service = this.get_service_for_feature('machines');
        
        try {
            const result = await service.save_machines_with_sync(machines);
            console.log('Machines saved with sync to Supabase');
            return result;
        } catch (error) {
            console.error('Error saving machines with sync to Supabase:', error);
            throw new Error('Failed to save machines with sync to Supabase');
        }
    }

    async validate_machine_can_be_deleted(machineId) {
        this.log_call('validate_machine_can_be_deleted', 'machines', machineId);
        const service = this.get_service_for_feature('machines');
        
        try {
            const result = await service.validate_machine_can_be_deleted(machineId);
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
        this.log_call('get_odp_orders', 'odp_orders');
        const service = this.get_service_for_feature('odp_orders');
        
        try {
            const result = await service.get_odp_orders();
            console.log('ODP orders loaded from Supabase:', result.length);
            return result;
        } catch (error) {
            console.error('Error loading ODP orders from Supabase:', error);
            throw new Error('Failed to load ODP orders from Supabase');
        }
    }

    async save_odp_orders(orders) {
        this.log_call('save_odp_orders', 'odp_orders', orders);
        
        const service = this.get_service_for_feature('odp_orders');
        try {
            const result = await service.save_odp_orders(orders);
            console.log('ODP orders saved to Supabase');
            return result;
        } catch (error) {
            console.error('Error saving ODP orders to Supabase:', error);
            throw new Error('Failed to save ODP orders to Supabase');
        }
    }

    async add_odp_order(order) {
        this.log_call('add_odp_order', 'odp_orders', order);
        
        const service = this.get_service_for_feature('odp_orders');
        try {
            const result = await service.add_odp_order(order);
            console.log('ODP order added to Supabase');
            return result;
        } catch (error) {
            console.error('Error adding ODP order to Supabase:', error);
            throw new Error('Failed to add ODP order to Supabase');
        }
    }

    async update_odp_order(id, updates) {
        this.log_call('update_odp_order', 'odp_orders', id, updates);
        const service = this.get_service_for_feature('odp_orders');
        
        try {
            const result = await service.update_odp_order(id, updates);
            console.log('ODP order updated in Supabase');
            return result;
        } catch (error) {
            console.error('Error updating ODP order in Supabase:', error);
            throw new Error('Failed to update ODP order in Supabase');
        }
    }

    async remove_odp_order(id) {
        this.log_call('remove_odp_order', 'odp_orders', id);
        
        const service = this.get_service_for_feature('odp_orders');
        try {
            const result = await service.remove_odp_order(id);
            console.log('ODP order removed from Supabase');
            return result;
        } catch (error) {
            console.error('Error removing ODP order from Supabase:', error);
            throw new Error('Failed to remove ODP order from Supabase');
        }
    }

    async get_next_odp_number() {
        this.log_call('get_next_odp_number', 'odp_orders');
        const service = this.get_service_for_feature('odp_orders');
        
        try {
            const result = await service.get_next_odp_number();
            return result;
        } catch (error) {
            console.error('Error getting next ODP number from Supabase:', error);
            throw new Error('Failed to get next ODP number from Supabase');
        }
    }

    async get_valid_tasks_for_display() {
        this.log_call('get_valid_tasks_for_display', 'odp_orders');
        const service = this.get_service_for_feature('odp_orders');
        
        try {
            const result = await service.get_valid_tasks_for_display();
            return result;
        } catch (error) {
            console.error('Error getting valid tasks from Supabase:', error);
            throw new Error('Failed to get valid tasks from Supabase');
        }
    }

    async get_odp_order_by_id(id) {
        this.log_call('get_odp_order_by_id', 'odp_orders', id);
        const service = this.get_service_for_feature('odp_orders');
        
        try {
            const result = await service.get_odp_order_by_id(id);
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
        this.log_call('get_phases', 'phases');
        
        // Ensure initialization
        if (!this.initialized) {
            await this.wait_for_services();
            await this.init();
        }
        
        try {
            const result = await this.supabaseService.get_phases();
            console.log('Phases loaded from Supabase:', result.length);
            return result;
        } catch (error) {
            console.error('Error loading phases from Supabase:', error);
            throw new Error('Failed to load phases from Supabase');
        }
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
        const service = this.get_service_for_feature('phases');
        
        try {
            const result = await service.update_phase(id, updates);
            console.log('Phase updated in Supabase');
            return result;
        } catch (error) {
            console.error('Error updating phase in Supabase:', error);
            throw new Error('Failed to update phase in Supabase');
        }
    }

    async remove_phase(id) {
        this.log_call('remove_phase', 'phases', id);
        
        const service = this.get_service_for_feature('phases');
        try {
            const result = await service.remove_phase(id);
            console.log('Phase removed from Supabase');
            return result;
        } catch (error) {
            console.error('Error removing phase from Supabase:', error);
            throw new Error('Failed to remove phase from Supabase');
        }
    }

    async get_phase_by_id(id) {
        this.log_call('get_phase_by_id', 'phases', id);
        const service = this.get_service_for_feature('phases');
        
        try {
            const result = await service.get_phase_by_id(id);
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
        const service = this.get_service_for_feature('scheduled_events');
        
        try {
            const result = await service.get_scheduled_events();
            return result;
        } catch (error) {
            console.error('Error getting scheduled events from Supabase:', error);
            throw new Error('Failed to get scheduled events from Supabase');
        }
    }

    async save_scheduled_events(events) {
        this.log_call('save_scheduled_events', 'scheduled_events', events);
        
        const service = this.get_service_for_feature('scheduled_events');
        try {
            const result = await service.save_scheduled_events(events);
            console.log('Scheduled events saved to Supabase');
            return result;
        } catch (error) {
            console.error('Error saving scheduled events to Supabase:', error);
            throw new Error('Failed to save scheduled events to Supabase');
        }
    }

    async add_scheduled_event(event) {
        this.log_call('add_scheduled_event', 'scheduled_events', event);
        
        const service = this.get_service_for_feature('scheduled_events');
        try {
            const result = await service.add_scheduled_event(event);
            console.log('Scheduled event added to Supabase');
            return result;
        } catch (error) {
            console.error('Error adding scheduled event to Supabase:', error);
            throw new Error('Failed to add scheduled event to Supabase');
        }
    }

    async remove_scheduled_event(event_id) {
        this.log_call('remove_scheduled_event', 'scheduled_events', event_id);
        
        const service = this.get_service_for_feature('scheduled_events');
        try {
            const result = await service.remove_scheduled_event(event_id);
            console.log('Scheduled event removed from Supabase');
            return result;
        } catch (error) {
            console.error('Error removing scheduled event from Supabase:', error);
            throw new Error('Failed to remove scheduled event from Supabase');
        }
    }

    async is_task_scheduled(task_id) {
        this.log_call('is_task_scheduled', 'scheduled_events', task_id);
        const service = this.get_service_for_feature('scheduled_events');
        
        try {
            const result = await service.is_task_scheduled(task_id);
            return result;
        } catch (error) {
            console.error('Error checking if task is scheduled in Supabase:', error);
            throw new Error('Failed to check if task is scheduled in Supabase');
        }
    }

    async get_events_by_machine(machine_name) {
        this.log_call('get_events_by_machine', 'scheduled_events', machine_name);
        const service = this.get_service_for_feature('scheduled_events');
        
        try {
            const result = await service.get_events_by_machine(machine_name);
            return result;
        } catch (error) {
            console.error('Error getting events by machine from Supabase:', error);
            throw new Error('Failed to get events by machine from Supabase');
        }
    }

    async get_events_by_date(date) {
        this.log_call('get_events_by_date', 'scheduled_events', date);
        const service = this.get_service_for_feature('scheduled_events');
        
        try {
            const result = await service.get_events_by_date(date);
            return result;
        } catch (error) {
            console.error('Error getting events by date from Supabase:', error);
            throw new Error('Failed to get events by date from Supabase');
        }
    }

    async get_scheduled_event_by_id(event_id) {
        this.log_call('get_scheduled_event_by_id', 'scheduled_events', event_id);
        const service = this.get_service_for_feature('scheduled_events');
        
        try {
            const result = await service.get_scheduled_event_by_id(event_id);
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
        const service = this.get_service_for_feature('machine_availability');
        
        try {
            const result = await service.get_machine_availability();
            return result;
        } catch (error) {
            console.error('Error getting machine availability from Supabase:', error);
            throw new Error('Failed to get machine availability from Supabase');
        }
    }

    async save_machine_availability(availability) {
        this.log_call('save_machine_availability', 'machine_availability', availability);
        
        const service = this.get_service_for_feature('machine_availability');
        try {
            const result = await service.save_machine_availability(availability);
            console.log('Machine availability saved to Supabase');
            return result;
        } catch (error) {
            console.error('Error saving machine availability to Supabase:', error);
            throw new Error('Failed to save machine availability to Supabase');
        }
    }

    async get_machine_availability_for_date(machineName, date) {
        this.log_call('get_machine_availability_for_date', 'machine_availability', machineName, date);
        const service = this.get_service_for_feature('machine_availability');
        
        try {
            const result = await service.get_machine_availability_for_date(machineName, date);
            return result;
        } catch (error) {
            console.error('Error getting machine availability for date from Supabase:', error);
            return []; // Return empty array on error to prevent UI issues
        }
    }

    async set_machine_availability(machineName, date, unavailableHours) {
        this.log_call('set_machine_availability', 'machine_availability', machineName, date, unavailableHours);
        
        const service = this.get_service_for_feature('machine_availability');
        try {
            const result = await service.set_machine_availability(machineName, date, unavailableHours);
            console.log('Machine availability set in Supabase');
            return result;
        } catch (error) {
            console.error('Error setting machine availability in Supabase:', error);
            throw new Error('Failed to set machine availability in Supabase');
        }
    }

    async toggle_machine_hour_availability(machineName, date, hour) {
        this.log_call('toggle_machine_hour_availability', 'machine_availability', machineName, date, hour);
        const service = this.get_service_for_feature('machine_availability');
        
        try {
            const result = await service.toggle_machine_hour_availability(machineName, date, hour);
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
        if (this.config && this.config.ENABLE_REALTIME && this.config.should_use_supabase(table)) {
            return this.supabaseService.subscribe_to_changes(table, callback);
        }
        return null;
    }

    unsubscribe_from_changes(table) {
        if (this.config && this.config.ENABLE_REALTIME) {
            this.supabaseService.unsubscribe_from_changes(table);
        }
    }

    unsubscribe_all() {
        if (this.config && this.config.ENABLE_REALTIME) {
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
