/**
 * Supabase Service - Backend data management
 * Provides all data operations using Supabase backend
 */
import { get_supabase_client, check_supabase_connection } from './supabaseClient.js';
import { show_banner } from './banner.js';

class SupabaseService {
    constructor() {
        this.client = null;
        this.subscriptions = new Map();
        this.cache = new Map();
        this.cache_timeout = 5000; // 5 seconds cache

        this.TABLES = {
            MACHINES: 'machines',
            SCHEDULED_EVENTS: 'odp_orders', // Consolidated table
            MACHINE_AVAILABILITY: 'machine_availability',
            ODP_ORDERS: 'odp_orders',
            PHASES: 'phases'
        };
    }

    /**
     * Initialize service and check connection
     */
    async init() {
        let attempts = 0;
        while (!this.client && attempts < 50) {
            this.client = await get_supabase_client();
            if (!this.client) await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!this.client) {
            console.error('❌ Supabase client not available after 5 seconds');
            return false;
        }

        const connected = await check_supabase_connection();
        if (!connected) {
            console.error('❌ Failed to connect to Supabase');
            show_banner?.('Failed to connect to database. Some features may not work.', 'error');
        }
        return connected;
    }

    /**
     * Ensure client is available
     */
    ensure_client() {
        if (!this.client) throw new Error('SupabaseService not initialized - client is null');
        return this.client;
    }

    /**
     * Cache management
     */
    get_from_cache(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp < this.cache_timeout)) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    set_cache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    clear_cache(prefix = '') {
        if (prefix) {
            for (const key of this.cache.keys()) {
                if (key.startsWith(prefix)) this.cache.delete(key);
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
        try {
            const { data, error } = await this.ensure_client().from(this.TABLES.MACHINES).select('*').order('created_at', { ascending: false });
            if (error) throw error;
            this.set_cache('machines', data ?? []);
            return data ?? [];
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
            const { error: deleteError } = await this.ensure_client().from(this.TABLES.MACHINES).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (deleteError) throw deleteError;
            this.clear_cache('machines');
            if (!machines?.length) return [];

            const { data, error } = await this.ensure_client().from(this.TABLES.MACHINES).insert(machines).select();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error saving machines:', error);
            throw error;
        }
    }

    async add_machine(machine) {
        try {
            const newMachine = { ...machine, id: machine.id || crypto.randomUUID(), created_at: machine.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
            const { data, error } = await this.ensure_client().from(this.TABLES.MACHINES).insert(newMachine).select().single();
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
            const { data, error } = await this.ensure_client().from(this.TABLES.MACHINES).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
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
            const { error } = await this.ensure_client().from(this.TABLES.MACHINES).delete().eq('id', machine_id);
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
            const { data, error } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).select(`*, machines!scheduled_machine_id(machine_name)`).order('created_at', { ascending: false });
            if (error) throw error;
            this.set_cache('odp_orders', data ?? []);
            return data ?? [];
        } catch (error) {
            console.error('Error fetching ODP orders:', error);
            return [];
        }
    }

    async save_odp_orders(orders) {
        try {
            const { error: deleteError } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (deleteError) throw deleteError;
            this.clear_cache('odp_orders');
            if (!orders?.length) return [];

            const { data, error } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).insert(orders).select();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error saving ODP orders:', error);
            throw error;
        }
    }

    async add_odp_order(order) {
        try {
            const { data: existing } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).select('id').eq('odp_number', order.odp_number).single();
            if (existing) throw new Error(`ODP number ${order.odp_number} already exists`);

            const newOrder = { ...order, id: order.id || crypto.randomUUID(), created_at: order.created_at || new Date().toISOString(), updated_at: new Date().toISOString(), status: order.status || 'NOT SCHEDULED' };
            const { data, error } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).insert(newOrder).select().single();
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
            const { data, error } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
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
            const { error } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).delete().eq('id', id);
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
            const { data, error } = await this.ensure_client().from(this.TABLES.PHASES).select('*').order('name', { ascending: true });
            if (error) throw error;
            this.set_cache('phases', data ?? []);
            return data ?? [];
        } catch (error) {
            console.error('Error fetching phases:', error);
            return [];
        }
    }

    // `save_phases`, `add_phase`, `update_phase`, `remove_phase`, `get_phase_by_id` are highly repetitive
    // of the machine/ODP methods and remain unchanged for brevity, but would follow the same streamlined pattern.
    async save_phases(phases) {
        try {
            const { error: deleteError } = await this.ensure_client().from(this.TABLES.PHASES).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (deleteError) throw deleteError;
            this.clear_cache('phases');
            if (!phases?.length) return [];
            const { data, error } = await this.ensure_client().from(this.TABLES.PHASES).insert(phases).select();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error saving phases:', error);
            throw error;
        }
    }
    async add_phase(phase) {
        try {
            const newPhase = { ...phase, id: phase.id || crypto.randomUUID(), created_at: phase.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
            const { data, error } = await this.ensure_client().from(this.TABLES.PHASES).insert(newPhase).select().single();
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
            const { data, error } = await this.ensure_client().from(this.TABLES.PHASES).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
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
            const { error } = await this.ensure_client().from(this.TABLES.PHASES).delete().eq('id', id);
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
            const { data, error } = await this.ensure_client().from(this.TABLES.PHASES).select('*').eq('id', id).single();
            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (error) {
            console.error('Error fetching phase by id:', error);
            return null;
        }
    }


    /**
     * SCHEDULED EVENTS (consolidated into ODP_ORDERS)
     */
    async get_scheduled_events() {
        const cached = this.get_from_cache('scheduled_events');
        if (cached) return cached;
        try {
            const { data, error } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).select(`*, machines!scheduled_machine_id(id, machine_name)`).not('scheduled_machine_id', 'is', null).order('scheduled_start_time', { ascending: true });
            if (error) throw error;

            const events = (data ?? []).map(odp => ({
                id: `event_${odp.id}_${odp.scheduled_machine_id}`,
                taskId: odp.id,
                taskTitle: odp.odp_number,
                machine: odp.machines?.machine_name || 'Unknown Machine',
                machineId: odp.scheduled_machine_id,
                start_time: odp.scheduled_start_time,
                end_time: odp.scheduled_end_time,
                // Use time_remaining instead of duration for accurate remaining work display
                duration: odp.time_remaining || odp.duration,
                color: odp.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                cost: odp.cost,
                progress: odp.progress,
                priority: odp.priority,
                status: odp.status,
                date: odp.scheduled_start_time ? new Date(odp.scheduled_start_time).toLocaleDateString('en-GB') : null,
                startHour: odp.scheduled_start_time ? new Date(odp.scheduled_start_time).getHours() : 0,
                endHour: odp.scheduled_end_time ? new Date(odp.scheduled_end_time).getHours() : 0
            }));
            this.set_cache('scheduled_events', events);
            return events;
        } catch (error) {
            console.error('Error fetching scheduled events:', error);
            return [];
        }
    }

    async add_scheduled_event(event) {
        try {
            // Validate required fields
            if (!event.machine || !event.taskId || !event.start_time || !event.end_time) {
                throw new Error('Missing required fields: machine, taskId, start_time, end_time');
            }
            
            // Validate machine is UUID format
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.machine)) {
                throw new Error('Machine must be a valid UUID');
            }
            
            const { error } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).update({
                scheduled_machine_id: event.machine,
                scheduled_start_time: event.start_time,
                scheduled_end_time: event.end_time,
                color: event.color,
                status: 'SCHEDULED'
            }).eq('id', event.taskId);
            if (error) throw error;
            this.clear_cache('scheduled_events');
            this.clear_cache('odp_orders');
            return event;
        } catch (error) {
            console.error('Error adding scheduled event:', error);
            throw error;
        }
    }

    async remove_scheduled_event(event_id) {
        try {
            const events = await this.get_scheduled_events();
            const event = events.find(e => e.id === event_id);
            if (!event || !event.taskId) throw new Error('Event not found or missing taskId');

            const { error } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).update({
                scheduled_machine_id: null,
                scheduled_start_time: null,
                scheduled_end_time: null,
                color: null,
                status: 'NOT SCHEDULED'
            }).eq('id', event.taskId);
            if (error) throw error;
            this.clear_cache('scheduled_events');
            this.clear_cache('odp_orders');
            return this.get_scheduled_events();
        } catch (error) {
            console.error('Error removing scheduled event:', error);
            throw error;
        }
    }
    // ... other get_events methods remain the same ...
    async is_task_scheduled(task_id) { const e = await this.get_scheduled_events(); return e.some(ev => String(ev.taskId)===String(task_id)); }
    async get_events_by_machine(machine_name) { const e = await this.get_scheduled_events(); return e.filter(ev => ev.machine===machine_name); }
    async get_events_by_date(date) { const e = await this.get_scheduled_events(); return e.filter(ev => ev.date === date || (ev.start_time && new Date(ev.start_time).toDateString() === new Date(date).toDateString())); }
    async get_scheduled_event_by_id(event_id) { const e = await this.get_scheduled_events(); return e.find(ev => ev.id === event_id) || null; }


    /**
     * MACHINE AVAILABILITY
     */
    async get_machine_availability_for_date(machineName, date) {
        try {
            // Encode machine name to handle special characters
            const encodedMachineName = encodeURIComponent(machineName);
            console.log('🔍 [SupabaseService] Getting availability for:', { machineName, encodedMachineName, date });
            
            const { data, error } = await this.ensure_client()
                .from(this.TABLES.MACHINE_AVAILABILITY)
                .select('unavailable_hours')
                .eq('machine_name', machineName) // Use original name for database query
                .eq('date', date)
                .single();
                
            if (error && error.code !== 'PGRST116') {
                console.warn('⚠️ [SupabaseService] Database error:', error);
                throw error;
            }
            
            const result = data?.unavailable_hours || [];
            console.log('🔍 [SupabaseService] Availability result:', { machineName, date, result });
            return result;
        } catch (error) {
            console.error('❌ [SupabaseService] Error getting availability:', error);
            return []; // Silently fail, availability is optional
        }
    }

    async set_machine_availability(machineName, date, unavailableHours) {
        try {
            // Upsert operation: update if exists, insert if not.
            const { error } = await this.ensure_client().from(this.TABLES.MACHINE_AVAILABILITY).upsert({
                machine_name: machineName,
                date: date,
                unavailable_hours: unavailableHours
            }, { onConflict: 'machine_name, date' });
            if (error) throw error;
        } catch (error) {
            console.error('Error setting machine availability:', error);
            throw error;
        }
    }

    async toggle_machine_hour_availability(machineName, date, hour) {
        const currentHours = await this.get_machine_availability_for_date(machineName, date);
        const newHours = currentHours.includes(hour)
            ? currentHours.filter(h => h !== hour)
            : [...currentHours, hour].sort((a, b) => a - b);
        await this.set_machine_availability(machineName, date, newHours);
        return newHours;
    }

    /**
     * Set machine unavailability for a date range with specific time windows
     * @param {string} machineName - Name of the machine
     * @param {string} startDate - Start date in dd/mm/yyyy format
     * @param {string} endDate - End date in dd/mm/yyyy format  
     * @param {string} startTime - Start time in HH:mm format (24-hour)
     * @param {string} endTime - End time in HH:mm format (24-hour)
     * @returns {Promise<boolean>} Success status
     */
    async setUnavailableHoursForRange(machineName, startDate, endDate, startTime, endTime) {
        try {
            // Validate inputs
            if (!machineName || !startDate || !endDate || !startTime || !endTime) {
                throw new Error('All parameters are required');
            }

            // Parse dates from dd/mm/yyyy format
            const parseDate = (dateStr) => {
                const [day, month, year] = dateStr.split('/').map(Number);
                if (!day || !month || !year) {
                    throw new Error(`Invalid date format: ${dateStr}. Expected dd/mm/yyyy`);
                }
                return new Date(year, month - 1, day); // month is 0-indexed
            };

            // Parse time from HH:mm format
            const parseTime = (timeStr) => {
                const [hours, minutes] = timeStr.split(':').map(Number);
                if (hours === undefined || minutes === undefined || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm (24-hour)`);
                }
                return { hours, minutes };
            };

            const startDateTime = parseDate(startDate);
            const endDateTime = parseDate(endDate);
            const startTimeObj = parseTime(startTime);
            const endTimeObj = parseTime(endTime);

            // Validate date range
            if (startDateTime > endDateTime) {
                throw new Error('Start date must be before or equal to end date');
            }

            // Calculate the date range
            const dates = [];
            const current = new Date(startDateTime);
            
            while (current <= endDateTime) {
                dates.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }

            // Process each date in the range
            for (const date of dates) {
                const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format for database
                
                // Get existing unavailable hours for this date
                const existingHours = await this.get_machine_availability_for_date(machineName, dateStr);
                
                // Calculate which hours should be unavailable for this specific date
                let hoursToAdd = [];
                
                if (date.toDateString() === startDateTime.toDateString()) {
                    // First day: from start time to end of day
                    for (let hour = startTimeObj.hours; hour < 24; hour++) {
                        hoursToAdd.push(hour);
                    }
                } else if (date.toDateString() === endDateTime.toDateString()) {
                    // Last day: from start of day to end time
                    for (let hour = 0; hour <= endTimeObj.hours; hour++) {
                        hoursToAdd.push(hour);
                    }
                } else {
                    // Middle days: full day (0-23)
                    for (let hour = 0; hour < 24; hour++) {
                        hoursToAdd.push(hour);
                    }
                }

                // Merge with existing hours, remove duplicates, and sort
                const allHours = [...new Set([...existingHours, ...hoursToAdd])].sort((a, b) => a - b);
                
                // Update the database for this date
                await this.set_machine_availability(machineName, dateStr, allHours);
            }

            // Clear cache to ensure fresh data
            this.clear_cache(this.TABLES.MACHINE_AVAILABILITY);
            
            return true;
        } catch (error) {
            console.error('Error setting machine unavailability for range:', error);
            throw error;
        }
    }

    /**
     * Get machine availability for a specific date for all machines
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Array>} Array of availability records
     */
    async get_machine_availability_for_date_all_machines(date) {
        try {
            const { data, error } = await this.ensure_client()
                .from(this.TABLES.MACHINE_AVAILABILITY)
                .select('machine_name, date, unavailable_hours')
                .eq('date', date);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting machine availability for date:', error);
            return [];
        }
    }

    /**
     * Get machine availability for a specific machine and week range
     * @param {string} machineName - Name of the machine
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @returns {Promise<Array>} Array of availability records for the week
     */
    async get_machine_availability_for_week_range(machineName, startDate, endDate) {
        try {
            const { data, error } = await this.ensure_client()
                .from(this.TABLES.MACHINE_AVAILABILITY)
                .select('machine_name, date, unavailable_hours')
                .eq('machine_name', machineName)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date');
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting machine availability for week range:', error);
            return [];
        }
    }

    /**
     * COMPATIBILITY & HELPERS
     */
    async get_next_odp_number() {
        const orders = await this.get_odp_orders();
        const maxNum = orders.reduce((max, order) => {
            const numStr = order.odp_number;
            if (numStr?.startsWith('OP')) {
                const currentNum = parseInt(numStr.substring(2), 10);
                return Math.max(max, isNaN(currentNum) ? 0 : currentNum);
            }
            return max;
        }, 0);
        return `OP${(maxNum + 1).toString().padStart(6, '0')}`;
    }

    async get_odp_order_by_id(id) {
        try {
            const { data, error } = await this.ensure_client().from(this.TABLES.ODP_ORDERS).select('*').eq('id', id).single();
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
        if (events.some(event => event.machine === machine.machine_name)) {
            return { canDelete: false, reason: 'Cannot delete machine with scheduled events' };
        }
        return { canDelete: true };
    }

    /**
     * REALTIME SUBSCRIPTIONS
     */
    subscribe_to_changes(table, callback) {
        const channel = `${table}_changes`;
        const subscription = this.ensure_client().channel(channel)
            .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
                this.clear_cache(table);
                callback(payload);
            }).subscribe();
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
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions.clear();
    }
}

export const supabase_service = new SupabaseService();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = supabase_service;
}