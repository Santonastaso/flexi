/**
 * Supabase Service - Backend data management
 * Provides all data operations using Supabase backend
 */
import { get_supabase_client, check_supabase_connection } from './supabaseClient.js';
import { show_banner } from './banner.js';

// No longer needed - using stable event IDs instead of random UUIDs

class SupabaseService {
    constructor() {
        this.client = null; // Will be set in init()
        this.subscriptions = new Map();
        this.cache = new Map();
        this.cache_timeout = 5000; // 5 seconds cache
        
        // Table names matching Supabase schema
        this.TABLES = {
            MACHINES: 'machines',
            SCHEDULED_EVENTS: 'odp_orders', // Now using consolidated table
            MACHINE_AVAILABILITY: 'machine_availability',
            ODP_ORDERS: 'odp_orders',
            PHASES: 'phases'
        };
    }

    /**
     * Initialize service and check connection
     */
    async init() {
        // Wait for supabase_client to be available
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        while (attempts < maxAttempts) {
            const client = await get_supabase_client();
            if (client) {
                this.client = client;
                console.log('✅ SupabaseService client assigned:', !!this.client);
                break;
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!this.client) {
            console.error('❌ Supabase client not available after 5 seconds');
            return false;
        }
        
        const connected = await check_supabase_connection();
        if (!connected) {
            console.error('❌ Failed to connect to Supabase');
            if (typeof show_banner === 'function') {
                show_banner('Failed to connect to database. Some features may not work.', 'error');
            }
        }
        return connected;
    }

    /**
     * Ensure client is available
     */
    ensure_client() {
        if (!this.client) {
            throw new Error('SupabaseService not initialized - client is null');
        }
        return this.client;
    }



    /**
     * Cache management
     */
    get_from_cache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cache_timeout) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    set_cache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    clear_cache(prefix = '') {
        if (prefix) {
            for (const key of this.cache.keys()) {
                if (key.startsWith(prefix)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    /**
     * MACHINES CRUD OPERATIONS
     */
    async get_machines() {
        const cached = this.get_from_cache('machines');
        if (cached) return cached;

        if (!this.client) {
            console.error('Supabase client not initialized');
            throw new Error('Supabase client not initialized');
        }

        try {
            const { data, error } = await this.client
                .from(this.TABLES.MACHINES)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.set_cache('machines', data || []);
            return data || [];
        } catch (error) {
            console.error('Error fetching machines:', error);
            return [];
        }
    }

    async get_active_machines() {
        const machines = await this.get_machines();
        return machines.filter(machine => machine.status === 'ACTIVE');
    }

    async save_machines(machines) {
        try {
            // Delete all existing machines and insert new ones (batch update)
            const { error: deleteError } = await this.client
                .from(this.TABLES.MACHINES)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (deleteError) throw deleteError;

            if (machines.length > 0) {
                const { data, error } = await this.client
                    .from(this.TABLES.MACHINES)
                    .insert(machines)
                    .select();

                if (error) throw error;
                
                this.clear_cache('machines');
                return data;
            }
            
            this.clear_cache('machines');
            return [];
        } catch (error) {
            console.error('Error saving machines:', error);
            throw error;
        }
    }

    async add_machine(machine) {
        try {
            const newMachine = {
                ...machine,
                id: machine.id || crypto.randomUUID(),
                created_at: machine.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from(this.TABLES.MACHINES)
                .insert(newMachine)
                .select()
                .single();

            if (error) throw error;
            
            this.clear_cache('machines');
            return data;
        } catch (error) {
            console.error('Error adding machine:', error);
            throw error;
        }
    }

    async update_machine(id, updates) {
        try {

            
            const { data, error } = await this.client
                .from(this.TABLES.MACHINES)
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            
            this.clear_cache('machines');
            return data;
        } catch (error) {
            console.error('Error updating machine:', error);
            throw error;
        }
    }

    async remove_machine(machine_id) {
        try {
            const { error } = await this.client
                .from(this.TABLES.MACHINES)
                .delete()
                .eq('id', machine_id);

            if (error) throw error;
            
            this.clear_cache('machines');
            return true;
        } catch (error) {
            console.error('Error removing machine:', error);
            throw error;
        }
    }

    /**
     * ODP ORDERS CRUD OPERATIONS
     */
    async get_odp_orders() {
        const cached = this.get_from_cache('odp_orders');
        if (cached) return cached;

        try {
            const client = this.ensure_client();
            const { data, error } = await client
                .from(this.TABLES.ODP_ORDERS)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.set_cache('odp_orders', data || []);
            return data || [];
        } catch (error) {
            console.error('Error fetching ODP orders:', error);
            return [];
        }
    }

    async save_odp_orders(orders) {
        try {
            // Delete all existing orders and insert new ones (batch update)
            const { error: deleteError } = await this.client
                .from(this.TABLES.ODP_ORDERS)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (deleteError) throw deleteError;

            if (orders.length > 0) {
                const { data, error } = await this.client
                    .from(this.TABLES.ODP_ORDERS)
                    .insert(orders)
                    .select();

                if (error) throw error;
                
                this.clear_cache('odp_orders');
                return data;
            }
            
            this.clear_cache('odp_orders');
            return [];
        } catch (error) {
            console.error('Error saving ODP orders:', error);
            throw error;
        }
    }

    async add_odp_order(order) {
        try {
            // Check if ODP number is unique
            const { data: existing } = await this.client
                .from(this.TABLES.ODP_ORDERS)
                .select('id')
                .eq('odp_number', order.odp_number)
                .single();

            if (existing) {
                throw new Error(`ODP number ${order.odp_number} already exists`);
            }

            const newOrder = {
                ...order,
                id: order.id || crypto.randomUUID(),
                created_at: order.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: order.status || 'NOT SCHEDULED'
            };

            const { data, error } = await this.client
                .from(this.TABLES.ODP_ORDERS)
                .insert(newOrder)
                .select()
                .single();

            if (error) throw error;
            
            this.clear_cache('odp_orders');
            return data;
        } catch (error) {
            console.error('Error adding ODP order:', error);
            throw error;
        }
    }

    async update_odp_order(id, updates) {
        try {
            const { data, error } = await this.client
                .from(this.TABLES.ODP_ORDERS)
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            
            this.clear_cache('odp_orders');
            return data;
        } catch (error) {
            console.error('Error updating ODP order:', error);
            throw error;
        }
    }

    async remove_odp_order(id) {
        try {
            const { error } = await this.client
                .from(this.TABLES.ODP_ORDERS)
                .delete()
                .eq('id', id);

            if (error) throw error;
            
            this.clear_cache('odp_orders');
            return true;
        } catch (error) {
            console.error('Error removing ODP order:', error);
            throw error;
        }
    }

    /**
     * PHASES CRUD OPERATIONS
     */
    async get_phases() {
        const cached = this.get_from_cache('phases');
        if (cached) return cached;

        try {
            const client = this.ensure_client();
            const { data, error } = await client
                .from(this.TABLES.PHASES)
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            
            this.set_cache('phases', data || []);
            return data || [];
        } catch (error) {
            console.error('Error fetching phases:', error);
            return [];
        }
    }

    async save_phases(phases) {
        try {
            // Delete all existing phases and insert new ones (batch update)
            const { error: deleteError } = await this.client
                .from(this.TABLES.PHASES)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (deleteError) throw deleteError;

            if (phases.length > 0) {
                const { data, error } = await this.client
                    .from(this.TABLES.PHASES)
                    .insert(phases)
                    .select();

                if (error) throw error;
                
                this.clear_cache('phases');
                return data;
            }
            
            this.clear_cache('phases');
            return [];
        } catch (error) {
            console.error('Error saving phases:', error);
            throw error;
        }
    }

    async add_phase(phase) {
        try {
            const newPhase = {
                ...phase,
                id: phase.id || crypto.randomUUID(),
                created_at: phase.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from(this.TABLES.PHASES)
                .insert(newPhase)
                .select()
                .single();

            if (error) throw error;
            
            this.clear_cache('phases');
            return data;
        } catch (error) {
            console.error('Error adding phase:', error);
            throw error;
        }
    }

    async update_phase(id, updates) {
        try {
            const { data, error } = await this.client
                .from(this.TABLES.PHASES)
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            
            this.clear_cache('phases');
            return data;
        } catch (error) {
            console.error('Error updating phase:', error);
            throw error;
        }
    }

    async remove_phase(id) {
        try {
            const { error } = await this.client
                .from(this.TABLES.PHASES)
                .delete()
                .eq('id', id);

            if (error) throw error;
            
            this.clear_cache('phases');
            return true;
        } catch (error) {
            console.error('Error removing phase:', error);
            throw error;
        }
    }

    async get_phase_by_id(id) {
        try {
            const { data, error } = await this.client
                .from(this.TABLES.PHASES)
                .select('*')
                .eq('id', id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            
            return data || null;
        } catch (error) {
            console.error('Error fetching phase by id:', error);
            return null;
        }
    }

    /**
     * Helper method to convert legacy date/hour format to ISO datetime
     */
    convert_legacy_to_datetime(date_str, hour) {
        if (!date_str || hour === undefined) return null;
        
        try {
            // Parse date in dd/mm/yyyy format
            const [day, month, year] = date_str.split('/').map(Number);
            const date = new Date(year, month - 1, day, hour, 0, 0, 0);
            return date.toISOString();
        } catch (error) {
            console.error('Error converting legacy format to datetime:', error);
            return null;
        }
    }

    /**
     * SCHEDULED EVENTS CRUD OPERATIONS
     */
    async get_scheduled_events() {
        const cached = this.get_from_cache('scheduled_events');
        if (cached) return cached;

        try {
            const client = this.ensure_client();
            // Get ODP orders that have scheduling information (consolidated approach)
            const { data, error } = await client
                .from(this.TABLES.ODP_ORDERS)
                .select('*')
                .not('scheduled_machine', 'is', null)
                .order('scheduled_start_time', { ascending: true });

            if (error) throw error;
            
                        // Transform ODP orders to match the expected scheduled_events format
            const events = (data || []).map(odp => {
                // Generate a STABLE event ID based on ODP ID and machine to ensure consistency
                // This prevents event IDs from changing on every get_scheduled_events call
                const eventId = `event_${odp.id}_${odp.scheduled_machine}`;
                
                return {
                    id: eventId,                    // Stable event ID based on ODP ID and machine
                    taskId: odp.id,                 // ODP order ID for database operations
                    taskTitle: odp.odp_number,
                    machine: odp.scheduled_machine,
                    start_time: odp.scheduled_start_time,
                    end_time: odp.scheduled_end_time,
                    duration: odp.duration,
                    color: odp.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    // Additional ODP fields for enhanced tooltips
                    cost: odp.cost,
                    progress: odp.progress,
                    priority: odp.priority,
                    status: odp.status,
                    // Legacy compatibility - calculate old fields for backward compatibility
                    date: odp.scheduled_start_time ? new Date(odp.scheduled_start_time).toLocaleDateString('en-GB') : null,
                    startHour: odp.scheduled_start_time ? new Date(odp.scheduled_start_time).getHours() : 0,
                    endHour: odp.scheduled_end_time ? new Date(odp.scheduled_end_time).getHours() : 0
                };
            });
            
            // Debug: Log the event transformation to verify IDs are correct
            console.log('get_scheduled_events debug - Event transformation:', events.map(event => ({
                eventId: event.id,
                taskId: event.taskId,
                taskTitle: event.taskTitle,
                machine: event.machine
            })));
            
            this.set_cache('scheduled_events', events); // Keep cache key for backward compatibility
            return events;
        } catch (error) {
            console.error('Error fetching scheduled events:', error);
            return [];
        }
    }

    async save_scheduled_events(events) {
        try {
            // Clear all existing scheduling information from ODP orders
            const { error: clearError } = await this.client
                .from(this.TABLES.ODP_ORDERS)
                .update({
                    scheduled_machine: null,
                    scheduled_start_time: null,
                    scheduled_end_time: null,
                    color: null,
                    status: 'NOT SCHEDULED'
                })
                .not('scheduled_machine', 'is', null);

            if (clearError) throw clearError;

            if (events.length > 0) {
                // Update ODP orders with new scheduling information
                for (const event of events) {
                    const { error: updateError } = await this.client
                        .from(this.TABLES.ODP_ORDERS)
                        .update({
                            scheduled_machine: event.machine,
                            scheduled_start_time: event.start_time,
                            scheduled_end_time: event.end_time,
                            color: event.color,
                            status: 'SCHEDULED'
                        })
                        .eq('id', event.taskId);

                    if (updateError) throw updateError;
                }
            }
            
            this.clear_cache('scheduled_events'); // Keep for backward compatibility
            this.clear_cache('odp_orders');
            return events;
        } catch (error) {
            console.error('Error saving scheduled events:', error);
            throw error;
        }
    }

    async add_scheduled_event(event) {
        try {
            // Debug: Log what's being passed to add_scheduled_event
            console.log('add_scheduled_event debug:', {
                eventId: event.id,
                taskId: event.taskId,
                machine: event.machine,
                start_time: event.start_time,
                end_time: event.end_time,
                eventKeys: Object.keys(event)
            });
            
            // Update the ODP order with scheduling information instead of creating a separate event
            const { data, error } = await this.client
                .from(this.TABLES.ODP_ORDERS)
                .update({
                    scheduled_machine: event.machine,
                    scheduled_start_time: event.start_time,
                    scheduled_end_time: event.end_time,
                    color: event.color,
                    status: 'SCHEDULED'
                })
                .eq('id', event.taskId)
                .select()
                .single();

            if (error) throw error;
            
            this.clear_cache('scheduled_events'); // Keep for backward compatibility
            this.clear_cache('odp_orders');
            return event;
        } catch (error) {
            console.error('Error adding scheduled event:', error);
            throw error;
        }
    }

    async remove_scheduled_event(event_id) {
        try {
            // First, get the event to find the taskId (ODP order ID)
            const events = await this.get_scheduled_events();
            const event = events.find(e => e.id === event_id);
            
            if (!event || !event.taskId) {
                console.error('Cannot remove scheduled event: event not found or missing taskId');
                throw new Error('Event not found or missing taskId');
            }
            
            console.log('remove_scheduled_event debug:', {
                eventId: event_id,
                taskId: event.taskId,
                eventMachine: event.machine,
                eventKeys: Object.keys(event)
            });
            
            // Clear scheduling information from the ODP order using the taskId
            const { error } = await this.client
                .from(this.TABLES.ODP_ORDERS)
                .update({
                    scheduled_machine: null,
                    scheduled_start_time: null,
                    scheduled_end_time: null,
                    color: null,
                    status: 'NOT SCHEDULED'
                })
                .eq('id', event.taskId);

            if (error) throw error;
            
            this.clear_cache('scheduled_events'); // Keep for backward compatibility
            this.clear_cache('odp_orders');
            
            // Return remaining events
            return await this.get_scheduled_events();
        } catch (error) {
            console.error('Error removing scheduled event:', error);
            throw error;
        }
    }

    async is_task_scheduled(task_id) {
        const events = await this.get_scheduled_events();
        return events.some(event => String(event.taskId) === String(task_id));
    }

    async get_events_by_machine(machine_name) {
        const events = await this.get_scheduled_events();
        return events.filter(event => event.machine === machine_name);
    }

    async get_events_by_date_range(start_date, end_date) {
        const events = await this.get_scheduled_events();
        const start = new Date(start_date);
        const end = new Date(end_date);
        
        return events.filter(event => {
            if (event.start_time && event.end_time) {
                const eventStart = new Date(event.start_time);
                const eventEnd = new Date(event.end_time);
                // Check if event overlaps with the date range
                return eventStart <= end && eventEnd >= start;
            }
            // Legacy compatibility - check if event date falls within range
            if (event.date) {
                const eventDate = new Date(event.date);
                return eventDate >= start && eventDate <= end;
            }
            return false;
        });
    }

    async get_events_by_date(date) {
        const events = await this.get_scheduled_events();
        // Support both legacy date format and new datetime format
        return events.filter(event => {
            if (event.date === date) return true; // Legacy compatibility
            if (event.start_time) {
                const eventDate = new Date(event.start_time);
                const targetDate = new Date(date);
                return eventDate.toDateString() === targetDate.toDateString();
            }
            return false;
        });
    }

    async get_scheduled_event_by_id(event_id) {
        const events = await this.get_scheduled_events();
        return events.find(event => event.id === event_id) || null;
    }

    /**
     * MACHINE AVAILABILITY CRUD OPERATIONS
     */
    async get_machine_availability() {
        try {
            const { data, error } = await this.client
                .from(this.TABLES.MACHINE_AVAILABILITY)
                .select('*');

            if (error) throw error;
            
            // Convert to legacy format
            const availability = {};
            (data || []).forEach(record => {
                if (!availability[record.machine_name]) {
                    availability[record.machine_name] = {};
                }
                availability[record.machine_name][record.date] = record.unavailable_hours || [];
            });
            
            return availability;
        } catch (error) {
            console.error('Error fetching machine availability:', error);
            return {};
        }
    }

    async save_machine_availability(availability) {
        try {
            // Delete all existing availability
            const { error: deleteError } = await this.client
                .from(this.TABLES.MACHINE_AVAILABILITY)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');

            if (deleteError) throw deleteError;

            // Convert legacy format to database format
            const records = [];
            for (const [machineName, dates] of Object.entries(availability)) {
                for (const [date, hours] of Object.entries(dates)) {
                    if (hours.length > 0) {
                        records.push({
                            machine_name: machineName,
                            date: date,
                            unavailable_hours: hours
                        });
                    }
                }
            }

            if (records.length > 0) {
                const { error } = await this.client
                    .from(this.TABLES.MACHINE_AVAILABILITY)
                    .insert(records);

                if (error) throw error;
            }
            
            return availability;
        } catch (error) {
            console.error('Error saving machine availability:', error);
            throw error;
        }
    }

    async get_machine_availability_for_date(machineName, date) {
        try {
            const client = this.ensure_client();
            const { data, error } = await client
                .from(this.TABLES.MACHINE_AVAILABILITY)
                .select('unavailable_hours')
                .eq('machine_name', machineName)
                .eq('date', date)
                .single();

            // PGRST116 means "no rows returned", which is fine - no availability restrictions
            if (error && error.code !== 'PGRST116') {
                // Log schema/table issues but don't spam console
                if (error.code === 'PGRST204' || error.message?.includes('does not exist') || error.message?.includes('406')) {
                    // Table or column doesn't exist, or 406 Not Acceptable - return empty availability
                    console.warn('Machine availability query failed (table/schema issue):', error.message);
                    return [];
                }
                throw error;
            }
            
            return data?.unavailable_hours || [];
        } catch (error) {
            // Silently return empty array - machine availability is optional
            return [];
        }
    }

    async set_machine_availability(machineName, date, unavailableHours) {
        try {
            // Delete existing record
            await this.client
                .from(this.TABLES.MACHINE_AVAILABILITY)
                .delete()
                .eq('machine_name', machineName)
                .eq('date', date);

            // Insert new record if there are unavailable hours
            if (unavailableHours.length > 0) {
                const { error } = await this.client
                    .from(this.TABLES.MACHINE_AVAILABILITY)
                    .insert({
                        machine_name: machineName,
                        date: date,
                        unavailable_hours: unavailableHours
                    });

                if (error) throw error;
            }
        } catch (error) {
            console.error('Error setting machine availability:', error);
            throw error;
        }
    }

    async toggle_machine_hour_availability(machineName, date, hour) {
        const currentHours = await this.get_machine_availability_for_date(machineName, date);
        const hourIndex = currentHours.indexOf(hour);
        
        let newHours;
        if (hourIndex === -1) {
            newHours = [...currentHours, hour].sort((a, b) => a - b);
        } else {
            newHours = currentHours.filter(h => h !== hour);
        }
        
        await this.set_machine_availability(machineName, date, newHours);
        return newHours;
    }

    /**
     * COMPATIBILITY METHODS
     */
    async get_valid_tasks_for_display() {
        const odpOrders = await this.get_odp_orders();
        return odpOrders.filter(order => {
            return order.id && order.odp_number && order.article_code && 
                   order.quantity > 0 && order.department && order.fase;
        });
    }

    async get_next_odp_number() {
        const orders = await this.get_odp_orders();
        const numbers = orders
            .map(order => order.odp_number)
            .filter(num => num && num.startsWith('OP'))
            .map(num => parseInt(num.substring(2)))
            .filter(num => !isNaN(num));
        
        const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
        return `OP${String(maxNumber + 1).padStart(6, '0')}`;
    }

    async get_odp_order_by_id(id) {
        try {
            const { data, error } = await this.client
                .from(this.TABLES.ODP_ORDERS)
                .select('*')
                .eq('id', id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            
            return data || null;
        } catch (error) {
            console.error('Error fetching ODP order by id:', error);
            return null;
        }
    }

    async validate_machine_can_be_deleted(machineId) {
        const events = await this.get_scheduled_events();
        const machine = (await this.get_machines()).find(m => m.id === machineId);
        
        if (!machine) return { canDelete: false, reason: 'Machine not found' };
        
        const hasEvents = events.some(event => event.machine === machine.machine_name);
        
        if (hasEvents) {
            return { 
                canDelete: false, 
                reason: 'Cannot delete machine with scheduled events' 
            };
        }
        
        return { canDelete: true };
    }

    /**
     * SYNC METHODS (for compatibility)
     */
    async add_machine_with_sync(machine) {
        const result = await this.add_machine(machine);
        this.notify_data_change('machines', 'add', result);
        return result;
    }

    async save_machines_with_sync(machines) {
        const result = await this.save_machines(machines);
        this.notify_data_change('machines', 'update', machines);
        return result;
    }

    notify_data_change(type, action, data) {
        window.dispatchEvent(new CustomEvent('dataChanged', {
            detail: { type, action, data }
        }));
    }

    /**
     * REALTIME SUBSCRIPTIONS
     */
    subscribe_to_changes(table, callback) {
        const subscription = this.client
            .channel(`${table}_changes`)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: table },
                (payload) => {
                    this.clear_cache(table);
                    callback(payload);
                }
            )
            .subscribe();
        
        this.subscriptions.set(table, subscription);
        return subscription;
    }

    unsubscribe_from_changes(table) {
        const subscription = this.subscriptions.get(table);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(table);
        }
    }

    unsubscribe_all() {
        for (const [table, subscription] of this.subscriptions) {
            subscription.unsubscribe();
        }
        this.subscriptions.clear();
    }
}

// Export as global singleton
export const supabase_service = new SupabaseService();

// ES6 module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = supabase_service;
}
