/**
 * Storage Service
 * Provides all data operations using Supabase backend
 * Simple, clean interface for database operations
 */
import { supabase_service } from './supabaseService.js';
import { ServiceConfig } from './serviceConfig.js';

class StorageService {
    constructor() {
        this.supabase_service = null;
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
        await this.supabase_service.init();
        this.initialized = true;
    }

    /**
     * Wait for Supabase service to be available
     */
    async wait_for_services() {
        // Services are now imported directly, so they should be available immediately
        if (supabase_service && ServiceConfig) {
            this.supabase_service = supabase_service;
            this.config = ServiceConfig;
            console.log('StorageService dependencies loaded successfully');
            return;
        }
        
        throw new Error('Supabase service not available');
    }



    /**
     * Clear cache for a specific feature
     */
    async clear_cache(feature) {
        if (this.supabase_service && this.supabase_service.clear_cache) {
            this.supabase_service.clear_cache(feature);
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
     * Show message (delegates to global banner system)
     */
    show_message(message, type = 'info') {
        if (typeof show_banner === 'function') {
            show_banner(message, type);
        } else {
            // Fallback to console if banner system not available
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    /**
     * Check if the database connection is working
     */
    async check_connection() {
        try {
            if (!this.supabase_service) {
                return { connected: false, error: 'Supabase service not available' };
            }
            
            // Try a simple operation to test connection
            await this.supabase_service.get_machines();
            return { connected: true, error: null };
        } catch (error) {
            return { 
                connected: false, 
                error: error.message || 'Connection failed' 
            };
        }
    }

    /**
     * MACHINES METHODS
     */
    async get_machines() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_machines(),
            'get_machines',
            'machines'
        );
    }

    async get_active_machines() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_active_machines(),
            'get_active_machines',
            'machines'
        );
    }
    
    async save_machines(machines) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_machines(machines),
            'save_machines',
            'machines',
            'Machines saved'
        );
    }
    
    async add_machine(machine) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_machine(machine),
            'add_machine',
            'machines',
            'Machine added'
        );
    }

    async update_machine(id, updates) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.update_machine(id, updates),
            'update_machine',
            'machines',
            'Machine updated'
        );
    }
    
    async remove_machine(machine_id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.remove_machine(machine_id),
            'remove_machine',
            'machines',
            'Machine removed'
        );
    }

    async add_machine_with_sync(machine) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_machine_with_sync(machine),
            'add_machine_with_sync',
            'machines',
            'Machine added with sync'
        );
    }

    async save_machines_with_sync(machines) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_machines_with_sync(machines),
            'save_machines_with_sync',
            'machines',
            'Machines saved with sync'
        );
    }
    
    async validate_machine_can_be_deleted(machineId) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.validate_machine_can_be_deleted(machineId),
            'validate_machine_can_be_deleted',
            'machines'
        );
    }
    
    /**
     * ODP ORDERS METHODS
     */
    async get_odp_orders() {
        const result = await this.handle_supabase_operation(
            () => this.supabase_service.get_odp_orders(),
            'get_odp_orders',
            'odp_orders'
        );
        console.log('ODP orders loaded from Supabase:', result.length);
        return result;
    }

    async save_odp_orders(orders) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_odp_orders(orders),
            'save_odp_orders',
            'odp_orders',
            'ODP orders saved'
        );
    }

    async add_odp_order(order) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_odp_order(order),
            'add_odp_order',
            'odp_orders',
            'ODP order added'
        );
    }

    async update_odp_order(id, updates) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.update_odp_order(id, updates),
            'update_odp_order',
            'odp_orders',
            'ODP order updated'
        );
    }
    
    async remove_odp_order(id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.remove_odp_order(id),
            'remove_odp_order',
            'odp_orders',
            'ODP order removed'
        );
    }
    
    async get_next_odp_number() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_next_odp_number(),
            'get_next_odp_number',
            'odp_orders'
        );
    }

    async get_valid_tasks_for_display() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_valid_tasks_for_display(),
            'get_valid_tasks_for_display',
            'odp_orders'
        );
    }

    async get_odp_order_by_id(id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_odp_order_by_id(id),
            'get_odp_order_by_id',
            'odp_orders'
        );
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
            () => this.supabase_service.get_phases(),
            'get_phases',
            'phases'
        );
        console.log('Phases loaded from Supabase:', result.length);
        return result;
    }

    async save_phases(phases) {
        // Ensure initialization
        if (!this.initialized) {
            await this.wait_for_services();
            await this.init();
        }
        
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_phases(phases),
            'save_phases',
            'phases',
            'Phases saved'
        );
    }

    async add_phase(phase) {
        // Ensure initialization
        if (!this.initialized) {
            await this.wait_for_services();
            await this.init();
        }
        
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_phase(phase),
            'add_phase',
            'phases',
            'Phase added'
        );
    }

    async update_phase(id, updates) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.update_phase(id, updates),
            'update_phase',
            'phases',
            'Phase updated'
        );
    }

    async remove_phase(id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.remove_phase(id),
            'remove_phase',
            'phases',
            'Phase removed'
        );
    }

    async get_phase_by_id(id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_phase_by_id(id),
            'get_phase_by_id',
            'phases'
        );
    }

    /**
     * SCHEDULED EVENTS METHODS
     */
    async get_scheduled_events() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_scheduled_events(),
            'get_scheduled_events',
            'scheduled_events'
        );
    }

    async save_scheduled_events(events) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_scheduled_events(events),
            'save_scheduled_events',
            'scheduled_events',
            'Scheduled events saved'
        );
    }

    async add_scheduled_event(event) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_scheduled_event(event),
            'add_scheduled_event',
            'scheduled_events',
            'Scheduled event added'
        );
    }

    async remove_scheduled_event(event_id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.remove_scheduled_event(event_id),
            'remove_scheduled_event',
            'scheduled_events',
            'Scheduled event removed'
        );
    }

    async is_task_scheduled(task_id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.is_task_scheduled(task_id),
            'is_task_scheduled',
            'scheduled_events'
        );
    }

    async get_events_by_machine(machine_name) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_events_by_machine(machine_name),
            'get_events_by_machine',
            'scheduled_events'
        );
    }

    async get_events_by_date(date) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_events_by_date(date),
            'get_events_by_date',
            'scheduled_events'
        );
    }

    async get_scheduled_event_by_id(event_id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_scheduled_event_by_id(event_id),
            'get_scheduled_event_by_id',
            'scheduled_events'
        );
    }

    /**
     * MACHINE AVAILABILITY METHODS
     */
    async get_machine_availability() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_machine_availability(),
            'get_machine_availability',
            'machine_availability'
        );
    }

    async save_machine_availability(availability) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_machine_availability(availability),
            'save_machine_availability',
            'machine_availability',
            'Machine availability saved'
        );
    }

    async get_machine_availability_for_date(machineName, date) {
        this.log_call('get_machine_availability_for_date', 'machine_availability', machineName, date);
        
        try {
            const result = await this.supabase_service.get_machine_availability_for_date(machineName, date);
            return result;
        } catch (error) {
            console.error('Error getting machine availability for date from Supabase:', error);
            return []; // Return empty array on error to prevent UI issues
        }
    }

    async set_machine_availability(machineName, date, unavailableHours) {
        this.log_call('set_machine_availability', 'machine_availability', machineName, date, unavailableHours);
        
        try {
            const result = await this.supabase_service.set_machine_availability(machineName, date, unavailableHours);
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
            const result = await this.supabase_service.toggle_machine_hour_availability(machineName, date, hour);
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
        if (this.config && this.config.ENABLE_REALTIME && this.supabase_service) {
            return this.supabase_service.subscribe_to_changes(table, callback);
        }
        return null;
    }

    unsubscribe_from_changes(table) {
        if (this.config && this.config.ENABLE_REALTIME && this.supabase_service) {
            this.supabase_service.unsubscribe_from_changes(table);
        }
    }

    unsubscribe_all() {
        if (this.config && this.config.ENABLE_REALTIME && this.supabase_service) {
            this.supabase_service.unsubscribe_all();
        }
    }
}

// Create and export storage service
export const storageService = new StorageService();

// ES6 module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = storageService;
}
