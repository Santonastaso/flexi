/**
 * Unified Storage Service
 * Wrapper that switches between localStorage and Supabase based on configuration
 * Maintains the same API for seamless migration
 */
class UnifiedStorageService {
    constructor() {
        this.localService = window.storageService;
        this.supabaseService = window.supabaseService;
        this.config = window.ServiceConfig;
        this.initialized = false;
        
        console.log('UnifiedStorageService constructor - localService:', this.localService);
        console.log('UnifiedStorageService constructor - supabaseService:', this.supabaseService);
        console.log('UnifiedStorageService constructor - config:', this.config);
    }

    /**
     * Initialize the service
     */
    async init() {
        if (this.config.STORAGE_MODE === 'supabase' || Object.values(this.config.USE_SUPABASE).some(v => v)) {
            await this.supabaseService.init();
        }
        this.initialized = true;
    }

    /**
     * Get the appropriate service for a feature
     */
    get_service_for_feature(feature) {
        if (this.config.should_use_supabase(feature)) {
            return this.supabaseService;
        }
        return this.localService;
    }

    /**
     * Log service calls if enabled
     */
    log_call(method, feature, ...args) {
        if (this.config.LOG_SERVICE_CALLS) {
            const service = this.config.should_use_supabase(feature) ? 'Supabase' : 'LocalStorage';
            console.log(`[${service}] ${method}`, ...args);
        }
    }

    /**
     * Show message (delegates to appropriate service)
     */
    show_message(message, type = 'info') {
        // Both services have the same show_message implementation
        this.localService.show_message(message, type);
    }

    /**
     * MACHINES METHODS
     */
    async get_machines() {
        this.log_call('get_machines', 'machines');
        const service = this.get_service_for_feature('machines');
        
        console.log('UnifiedStorageService.get_machines - using service:', service === this.supabaseService ? 'Supabase' : 'LocalStorage');
        
        if (service === this.supabaseService) {
            try {
                const result = await service.get_machines();
                console.log('Supabase get_machines result:', result);
                return result;
            } catch (error) {
                console.error('Error in Supabase get_machines:', error);
                console.log('Falling back to localStorage for machines');
                return this.localService.get_machines();
            }
        }
        return service.get_machines();
    }

    async get_active_machines() {
        this.log_call('get_active_machines', 'machines');
        const service = this.get_service_for_feature('machines');
        
        if (service === this.supabaseService) {
            return await service.get_active_machines();
        }
        return service.get_active_machines();
    }

    async save_machines(machines) {
        this.log_call('save_machines', 'machines', machines);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            // Write to both services
            this.localService.save_machines(machines);
            if (this.config.should_use_supabase('machines')) {
                return await this.supabaseService.save_machines(machines);
            }
        }
        
        const service = this.get_service_for_feature('machines');
        if (service === this.supabaseService) {
            return await service.save_machines(machines);
        }
        return service.save_machines(machines);
    }

    async add_machine(machine) {
        this.log_call('add_machine', 'machines', machine);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.add_machine(machine);
            if (this.config.should_use_supabase('machines')) {
                return await this.supabaseService.add_machine(machine);
            }
        }
        
        const service = this.get_service_for_feature('machines');
        if (service === this.supabaseService) {
            return await service.add_machine(machine);
        }
        return service.add_machine(machine);
    }

    async update_machine(id, updates) {
        this.log_call('update_machine', 'machines', id, updates);
        const service = this.get_service_for_feature('machines');
        
        if (service === this.supabaseService) {
            return await service.update_machine(id, updates);
        }
        return service.update_machine(id, updates);
    }

    async remove_machine(machine_id) {
        this.log_call('remove_machine', 'machines', machine_id);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.remove_machine(machine_id);
        }
        
        const service = this.get_service_for_feature('machines');
        if (service === this.supabaseService) {
            return await service.remove_machine(machine_id);
        }
        return service.remove_machine(machine_id);
    }

    async add_machine_with_sync(machine) {
        this.log_call('add_machine_with_sync', 'machines', machine);
        const service = this.get_service_for_feature('machines');
        
        if (service === this.supabaseService) {
            return await service.add_machine_with_sync(machine);
        }
        return service.add_machine_with_sync(machine);
    }

    async save_machines_with_sync(machines) {
        this.log_call('save_machines_with_sync', 'machines', machines);
        const service = this.get_service_for_feature('machines');
        
        if (service === this.supabaseService) {
            return await service.save_machines_with_sync(machines);
        }
        return service.save_machines_with_sync(machines);
    }

    async validate_machine_can_be_deleted(machineId) {
        this.log_call('validate_machine_can_be_deleted', 'machines', machineId);
        const service = this.get_service_for_feature('machines');
        
        if (service === this.supabaseService) {
            return await service.validate_machine_can_be_deleted(machineId);
        }
        return service.validate_machine_can_be_deleted(machineId);
    }

    /**
     * ODP ORDERS METHODS
     */
    async get_odp_orders() {
        this.log_call('get_odp_orders', 'odp_orders');
        const service = this.get_service_for_feature('odp_orders');
        
        if (service === this.supabaseService) {
            return await service.get_odp_orders();
        }
        return service.get_odp_orders();
    }

    async save_odp_orders(orders) {
        this.log_call('save_odp_orders', 'odp_orders', orders);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.save_odp_orders(orders);
            if (this.config.should_use_supabase('odp_orders')) {
                return await this.supabaseService.save_odp_orders(orders);
            }
        }
        
        const service = this.get_service_for_feature('odp_orders');
        if (service === this.supabaseService) {
            return await service.save_odp_orders(orders);
        }
        return service.save_odp_orders(orders);
    }

    async add_odp_order(order) {
        this.log_call('add_odp_order', 'odp_orders', order);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.add_odp_order(order);
            if (this.config.should_use_supabase('odp_orders')) {
                return await this.supabaseService.add_odp_order(order);
            }
        }
        
        const service = this.get_service_for_feature('odp_orders');
        if (service === this.supabaseService) {
            return await service.add_odp_order(order);
        }
        return service.add_odp_order(order);
    }

    async update_odp_order(id, updates) {
        this.log_call('update_odp_order', 'odp_orders', id, updates);
        const service = this.get_service_for_feature('odp_orders');
        
        if (service === this.supabaseService) {
            return await service.update_odp_order(id, updates);
        }
        return service.update_odp_order(id, updates);
    }

    async remove_odp_order(id) {
        this.log_call('remove_odp_order', 'odp_orders', id);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.remove_odp_order(id);
        }
        
        const service = this.get_service_for_feature('odp_orders');
        if (service === this.supabaseService) {
            return await service.remove_odp_order(id);
        }
        return service.remove_odp_order(id);
    }

    async get_next_odp_number() {
        this.log_call('get_next_odp_number', 'odp_orders');
        const service = this.get_service_for_feature('odp_orders');
        
        if (service === this.supabaseService) {
            return await service.get_next_odp_number();
        }
        return service.get_next_odp_number();
    }

    async get_valid_tasks_for_display() {
        this.log_call('get_valid_tasks_for_display', 'odp_orders');
        const service = this.get_service_for_feature('odp_orders');
        
        if (service === this.supabaseService) {
            return await service.get_valid_tasks_for_display();
        }
        return service.get_valid_tasks_for_display();
    }

    async get_odp_order_by_id(id) {
        this.log_call('get_odp_order_by_id', 'odp_orders', id);
        const service = this.get_service_for_feature('odp_orders');
        
        if (service === this.supabaseService) {
            return await service.get_odp_order_by_id(id);
        }
        return service.get_odp_order_by_id(id);
    }

    /**
     * PHASES METHODS
     */
    async get_phases() {
        this.log_call('get_phases', 'phases');
        const service = this.get_service_for_feature('phases');
        
        if (service === this.supabaseService) {
            return await service.get_phases();
        }
        return service.get_phases();
    }

    async save_phases(phases) {
        this.log_call('save_phases', 'phases', phases);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.save_phases(phases);
            if (this.config.should_use_supabase('phases')) {
                return await this.supabaseService.save_phases(phases);
            }
        }
        
        const service = this.get_service_for_feature('phases');
        if (service === this.supabaseService) {
            return await service.save_phases(phases);
        }
        return service.save_phases(phases);
    }

    async add_phase(phase) {
        this.log_call('add_phase', 'phases', phase);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.add_phase(phase);
            if (this.config.should_use_supabase('phases')) {
                return await this.supabaseService.add_phase(phase);
            }
        }
        
        const service = this.get_service_for_feature('phases');
        if (service === this.supabaseService) {
            return await service.add_phase(phase);
        }
        return service.add_phase(phase);
    }

    async update_phase(id, updates) {
        this.log_call('update_phase', 'phases', id, updates);
        const service = this.get_service_for_feature('phases');
        
        if (service === this.supabaseService) {
            return await service.update_phase(id, updates);
        }
        return service.update_phase(id, updates);
    }

    async remove_phase(id) {
        this.log_call('remove_phase', 'phases', id);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.remove_phase(id);
        }
        
        const service = this.get_service_for_feature('phases');
        if (service === this.supabaseService) {
            return await service.remove_phase(id);
        }
        return service.remove_phase(id);
    }

    async get_phase_by_id(id) {
        this.log_call('get_phase_by_id', 'phases', id);
        const service = this.get_service_for_feature('phases');
        
        if (service === this.supabaseService) {
            return await service.get_phase_by_id(id);
        }
        return service.get_phase_by_id(id);
    }

    /**
     * SCHEDULED EVENTS METHODS
     */
    async get_scheduled_events() {
        this.log_call('get_scheduled_events', 'scheduled_events');
        const service = this.get_service_for_feature('scheduled_events');
        
        if (service === this.supabaseService) {
            return await service.get_scheduled_events();
        }
        return service.get_scheduled_events();
    }

    async save_scheduled_events(events) {
        this.log_call('save_scheduled_events', 'scheduled_events', events);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.save_scheduled_events(events);
            if (this.config.should_use_supabase('scheduled_events')) {
                return await this.supabaseService.save_scheduled_events(events);
            }
        }
        
        const service = this.get_service_for_feature('scheduled_events');
        if (service === this.supabaseService) {
            return await service.save_scheduled_events(events);
        }
        return service.save_scheduled_events(events);
    }

    async add_scheduled_event(event) {
        this.log_call('add_scheduled_event', 'scheduled_events', event);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.add_scheduled_event(event);
            if (this.config.should_use_supabase('scheduled_events')) {
                return await this.supabaseService.add_scheduled_event(event);
            }
        }
        
        const service = this.get_service_for_feature('scheduled_events');
        if (service === this.supabaseService) {
            return await service.add_scheduled_event(event);
        }
        return service.add_scheduled_event(event);
    }

    async remove_scheduled_event(event_id) {
        this.log_call('remove_scheduled_event', 'scheduled_events', event_id);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.remove_scheduled_event(event_id);
        }
        
        const service = this.get_service_for_feature('scheduled_events');
        if (service === this.supabaseService) {
            return await service.remove_scheduled_event(event_id);
        }
        return service.remove_scheduled_event(event_id);
    }

    async is_task_scheduled(task_id) {
        this.log_call('is_task_scheduled', 'scheduled_events', task_id);
        const service = this.get_service_for_feature('scheduled_events');
        
        if (service === this.supabaseService) {
            return await service.is_task_scheduled(task_id);
        }
        return service.is_task_scheduled(task_id);
    }

    async get_events_by_machine(machine_name) {
        this.log_call('get_events_by_machine', 'scheduled_events', machine_name);
        const service = this.get_service_for_feature('scheduled_events');
        
        if (service === this.supabaseService) {
            return await service.get_events_by_machine(machine_name);
        }
        return service.get_events_by_machine(machine_name);
    }

    async get_events_by_date(date) {
        this.log_call('get_events_by_date', 'scheduled_events', date);
        const service = this.get_service_for_feature('scheduled_events');
        
        if (service === this.supabaseService) {
            return await service.get_events_by_date(date);
        }
        return service.get_events_by_date(date);
    }

    async get_scheduled_event_by_id(event_id) {
        this.log_call('get_scheduled_event_by_id', 'scheduled_events', event_id);
        const service = this.get_service_for_feature('scheduled_events');
        
        if (service === this.supabaseService) {
            return await service.get_scheduled_event_by_id(event_id);
        }
        return service.get_scheduled_event_by_id(event_id);
    }

    /**
     * MACHINE AVAILABILITY METHODS
     */
    async get_machine_availability() {
        this.log_call('get_machine_availability', 'machine_availability');
        const service = this.get_service_for_feature('machine_availability');
        
        if (service === this.supabaseService) {
            return await service.get_machine_availability();
        }
        return service.get_machine_availability();
    }

    async save_machine_availability(availability) {
        this.log_call('save_machine_availability', 'machine_availability', availability);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.save_machine_availability(availability);
            if (this.config.should_use_supabase('machine_availability')) {
                return await this.supabaseService.save_machine_availability(availability);
            }
        }
        
        const service = this.get_service_for_feature('machine_availability');
        if (service === this.supabaseService) {
            return await service.save_machine_availability(availability);
        }
        return service.save_machine_availability(availability);
    }

    async get_machine_availability_for_date(machineName, date) {
        this.log_call('get_machine_availability_for_date', 'machine_availability', machineName, date);
        const service = this.get_service_for_feature('machine_availability');
        
        if (service === this.supabaseService) {
            return await service.get_machine_availability_for_date(machineName, date);
        }
        return service.get_machine_availability_for_date(machineName, date);
    }

    async set_machine_availability(machineName, date, unavailableHours) {
        this.log_call('set_machine_availability', 'machine_availability', machineName, date, unavailableHours);
        
        if (this.config.ENABLE_DUAL_WRITE) {
            this.localService.set_machine_availability(machineName, date, unavailableHours);
        }
        
        const service = this.get_service_for_feature('machine_availability');
        if (service === this.supabaseService) {
            return await service.set_machine_availability(machineName, date, unavailableHours);
        }
        return service.set_machine_availability(machineName, date, unavailableHours);
    }

    async toggle_machine_hour_availability(machineName, date, hour) {
        this.log_call('toggle_machine_hour_availability', 'machine_availability', machineName, date, hour);
        const service = this.get_service_for_feature('machine_availability');
        
        if (service === this.supabaseService) {
            return await service.toggle_machine_hour_availability(machineName, date, hour);
        }
        return service.toggle_machine_hour_availability(machineName, date, hour);
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
        if (this.config.ENABLE_REALTIME && this.config.should_use_supabase(table)) {
            return this.supabaseService.subscribe_to_changes(table, callback);
        }
        return null;
    }

    unsubscribe_from_changes(table) {
        if (this.config.ENABLE_REALTIME) {
            this.supabaseService.unsubscribe_from_changes(table);
        }
    }

    unsubscribe_all() {
        if (this.config.ENABLE_REALTIME) {
            this.supabaseService.unsubscribe_all();
        }
    }
}

// Create and export unified service
const unifiedStorageService = new UnifiedStorageService();

// Make available globally
if (typeof window !== 'undefined') {
    window.unifiedStorageService = unifiedStorageService;
    
    // Override the default storageService reference to use unified service
    // This allows existing code to work without modification
    window.storageService = unifiedStorageService;
    
    console.log('UnifiedStorageService assigned to window.storageService');
    console.log('ServiceConfig:', window.ServiceConfig);
    console.log('Supabase service available:', !!window.supabaseService);
}

// ES6 module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = unifiedStorageService;
}
