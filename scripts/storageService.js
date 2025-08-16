/**
 * Storage Service
 * Provides all data operations using Supabase backend
 * Simple, clean interface for database operations
 * This is the final, complete version incorporating all feedback.
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
        await this.wait_for_services();
        await this.supabase_service.init();
        this.initialized = true;
    }

    /**
     * Wait for Supabase service to be available
     */
    async wait_for_services() {
        if (supabase_service && ServiceConfig) {
            this.supabase_service = supabase_service;
            this.config = ServiceConfig;
            return;
        }
        throw new Error('Supabase service or ServiceConfig not available');
    }

    /**
     * Centralized error handling wrapper for Supabase operations
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
            const errorMessage = `Error in StorageService during '${operation_name}' for ${entity_type}`;
            console.error(errorMessage, error);
            throw error; // Re-throw the error so the caller can handle it
        }
    }

    /**
     * Log service calls if enabled
     */
    log_call(method, feature, ...args) {
        if (this.config && this.config.LOG_SERVICE_CALLS) {
            console.log(`🔧 [StorageService] Calling ${method} for ${feature}`, ...args);
        }
    }
    
    /**
     * Show message (delegates to global banner system)
     */
    show_message(message, type = 'info') {
        if (typeof show_banner === 'function') {
            show_banner(message, type);
        } else {
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
            await this.supabase_service.get_machines();
            return { connected: true, error: null };
        } catch (error) {
            return { connected: false, error: error.message || 'Connection failed' };
        }
    }

    /**
     * Clear cache for a specific feature
     */
    async clear_cache(feature) {
        if (this.supabase_service && this.supabase_service.clear_cache) {
            this.supabase_service.clear_cache(feature);
        }
    }

    /**
     * MACHINES METHODS
     */
    async get_machines() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_machines(),
            'get_machines', 'machines'
        );
    }

    async save_machines(machines) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_machines(machines),
            'save_machines', 'machines'
        );
    }
    
    async add_machine(machine) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_machine(machine),
            'add_machine', 'machines'
        );
    }

    async update_machine(id, updates) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.update_machine(id, updates),
            'update_machine', 'machines'
        );
    }
    
    async remove_machine(machine_id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.remove_machine(machine_id),
            'remove_machine', 'machines'
        );
    }
    
    async get_machine_by_id(machineId) {
        return await this.handle_supabase_operation(
            async () => {
                const machines = await this.supabase_service.get_machines();
                return machines.find(m => m.id === machineId) || null;
            }, 'get_machine_by_id', 'machines'
        );
    }

    async get_active_machines() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_active_machines(), 'get_active_machines', 'machines'
        );
    }

    async add_machine_with_sync(machine) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_machine_with_sync(machine), 'add_machine_with_sync', 'machines', 'Machine added with sync'
        );
    }

    async save_machines_with_sync(machines) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_machines_with_sync(machines), 'save_machines_with_sync', 'machines', 'Machines saved with sync'
        );
    }

    async validate_machine_can_be_deleted(machineId) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.validate_machine_can_be_deleted(machineId), 'validate_machine_can_be_deleted', 'machines'
        );
    }

    /**
     * ODP ORDERS METHODS
     */
    async get_odp_orders() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_odp_orders(), 'get_odp_orders', 'odp_orders'
        );
    }

    async save_odp_orders(orders) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_odp_orders(orders), 'save_odp_orders', 'odp_orders'
        );
    }

    async add_odp_order(order) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_odp_order(order), 'add_odp_order', 'odp_orders'
        );
    }

    async update_odp_order(id, updates) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.update_odp_order(id, updates), 'update_odp_order', 'odp_orders'
        );
    }
    
    async remove_odp_order(id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.remove_odp_order(id), 'remove_odp_order', 'odp_orders'
        );
    }
    
    async get_next_odp_number() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_next_odp_number(), 'get_next_odp_number', 'odp_orders'
        );
    }

    async get_odp_order_by_id(id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_odp_order_by_id(id), 'get_odp_order_by_id', 'odp_orders'
        );
    }

    /**
     * PHASES METHODS
     */
    async get_phases() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_phases(), 'get_phases', 'phases'
        );
    }

    async save_phases(phases) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.save_phases(phases), 'save_phases', 'phases'
        );
    }

    async add_phase(phase) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_phase(phase), 'add_phase', 'phases'
        );
    }

    async update_phase(id, updates) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.update_phase(id, updates), 'update_phase', 'phases'
        );
    }

    async remove_phase(id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.remove_phase(id), 'remove_phase', 'phases'
        );
    }

    async get_phase_by_id(id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_phase_by_id(id), 'get_phase_by_id', 'phases'
        );
    }

    /**
     * SCHEDULED EVENTS METHODS
     */
    async get_scheduled_events() {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_scheduled_events(), 'get_scheduled_events', 'scheduled_events'
        );
    }

    async add_scheduled_event(event) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.add_scheduled_event(event), 'add_scheduled_event', 'scheduled_events', 'Scheduled event added'
        );
    }

    async remove_scheduled_event(event_id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.remove_scheduled_event(event_id), 'remove_scheduled_event', 'scheduled_events', 'Scheduled event removed'
        );
    }

    async is_task_scheduled(task_id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.is_task_scheduled(task_id), 'is_task_scheduled', 'scheduled_events'
        );
    }

    async get_events_by_machine(machine_name) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_events_by_machine(machine_name), 'get_events_by_machine', 'scheduled_events'
        );
    }

    async get_events_by_date(date) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_events_by_date(date), 'get_events_by_date', 'scheduled_events'
        );
    }

    async get_scheduled_event_by_id(event_id) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_scheduled_event_by_id(event_id), 'get_scheduled_event_by_id', 'scheduled_events'
        );
    }

    /**
     * MACHINE AVAILABILITY METHODS
     */
    async get_machine_availability_for_date(machineName, date) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_machine_availability_for_date(machineName, date), 'get_machine_availability_for_date', 'machine_availability'
        );
    }

    async get_machine_availability_for_date_all_machines(date) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_machine_availability_for_date_all_machines(date), 'get_machine_availability_for_date_all_machines', 'machine_availability'
        );
    }
    
    async get_machine_availability_for_week_range(machineName, startDate, endDate) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.get_machine_availability_for_week_range(machineName, startDate, endDate), 'get_machine_availability_for_week_range', 'machine_availability'
        );
    }

    async set_machine_availability(machineName, date, unavailableHours) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.set_machine_availability(machineName, date, unavailableHours), 'set_machine_availability', 'machine_availability', 'Machine availability set'
        );
    }

    async toggle_machine_hour_availability(machineName, date, hour) {
        return await this.handle_supabase_operation(
            () => this.supabase_service.toggle_machine_hour_availability(machineName, date, hour), 'toggle_machine_hour_availability', 'machine_availability', 'Machine hour availability toggled'
        );
    }
    
    /**
     * DATA CHANGE NOTIFICATIONS
     */
    notify_data_change(type, action, data) {
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