/**
 * Migration Utility - Migrate from localStorage to Supabase
 * Handles data migration with validation and rollback capabilities
 */
class MigrationUtility {
    constructor() {
        this.storageService = window.storageService;
        this.supabaseService = window.supabaseService;
        this.migrationLog = [];
        this.backupData = {};
    }

    /**
     * Log migration events
     */
    log(message, type = 'info', data = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message,
            type,
            data
        };
        
        this.migrationLog.push(logEntry);
        console.log(`[Migration ${type.toUpperCase()}] ${message}`, data || '');
    }

    /**
     * Create backup of all localStorage data
     */
    create_backup() {
        this.log('Creating backup of localStorage data...');
        
        try {
            this.backupData = {
                machines: this.storageService.get_machines(),
                phases: this.storageService.get_phases(),
                odp_orders: this.storageService.get_odp_orders(),
                scheduled_events: this.storageService.get_scheduled_events(),
                machine_availability: this.storageService.get_machine_availability(),
                backup_timestamp: new Date().toISOString()
            };
            
            // Save backup to localStorage with timestamp
            localStorage.setItem('migration_backup_' + Date.now(), JSON.stringify(this.backupData));
            
            this.log('Backup created successfully', 'success', {
                machines: this.backupData.machines.length,
                phases: this.backupData.phases.length,
                odp_orders: this.backupData.odp_orders.length,
                scheduled_events: this.backupData.scheduled_events.length
            });
            
            return true;
        } catch (error) {
            this.log('Failed to create backup', 'error', error);
            return false;
        }
    }

    /**
     * Validate data before migration
     */
    validate_data() {
        this.log('Validating data before migration...');
        const issues = [];

        // Validate machines
        const machines = this.backupData.machines;
        machines.forEach((machine, index) => {
            if (!machine.machine_name) {
                issues.push(`Machine at index ${index} missing machine_name`);
            }
            if (!machine.department) {
                issues.push(`Machine ${machine.machine_name || index} missing department`);
            }
        });

        // Validate phases
        const phases = this.backupData.phases;
        phases.forEach((phase, index) => {
            if (!phase.name) {
                issues.push(`Phase at index ${index} missing name`);
            }
            if (!phase.department) {
                issues.push(`Phase ${phase.name || index} missing department`);
            }
        });

        // Validate ODP orders
        const orders = this.backupData.odp_orders;
        orders.forEach((order, index) => {
            if (!order.odp_number) {
                issues.push(`Order at index ${index} missing odp_number`);
            }
            if (!order.article_code) {
                issues.push(`Order ${order.odp_number || index} missing article_code`);
            }
        });

        if (issues.length > 0) {
            this.log('Validation issues found', 'warning', issues);
            return false;
        }

        this.log('Data validation passed', 'success');
        return true;
    }

    /**
     * Transform data for Supabase compatibility
     */
    transform_data() {
        this.log('Transforming data for Supabase...');

        // Transform machines - ensure all fields are properly typed
        this.backupData.machines = this.backupData.machines.map(machine => ({
            ...machine,
            id: machine.id || crypto.randomUUID(),
            created_at: machine.created_at || new Date().toISOString(),
            updated_at: machine.updated_at || new Date().toISOString(),
            status: machine.status || 'ACTIVE',
            min_web_width: parseInt(machine.min_web_width) || 0,
            max_web_width: parseInt(machine.max_web_width) || 0,
            min_bag_height: parseInt(machine.min_bag_height) || 0,
            max_bag_height: parseInt(machine.max_bag_height) || 0,
            standard_speed: parseInt(machine.standard_speed) || 0,
            setup_time_standard: parseFloat(machine.setup_time_standard) || 0,
            changeover_color: parseFloat(machine.changeover_color) || 0,
            changeover_material: parseFloat(machine.changeover_material) || 0,
            active_shifts: machine.active_shifts || ['T1']
        }));

        // Transform phases
        this.backupData.phases = this.backupData.phases.map(phase => ({
            ...phase,
            id: phase.id || crypto.randomUUID(),
            created_at: phase.created_at || new Date().toISOString(),
            updated_at: phase.updated_at || new Date().toISOString(),
            numero_persone: parseInt(phase.numero_persone) || 1,
            v_stampa: parseFloat(phase.v_stampa) || 0,
            t_setup_stampa: parseFloat(phase.t_setup_stampa) || 0,
            costo_h_stampa: parseFloat(phase.costo_h_stampa) || 0,
            v_conf: parseFloat(phase.v_conf) || 0,
            t_setup_conf: parseFloat(phase.t_setup_conf) || 0,
            costo_h_conf: parseFloat(phase.costo_h_conf) || 0
        }));

        // Transform ODP orders
        this.backupData.odp_orders = this.backupData.odp_orders.map(order => ({
            ...order,
            id: order.id || crypto.randomUUID(),
            created_at: order.created_at || new Date().toISOString(),
            updated_at: order.updated_at || new Date().toISOString(),
            status: order.status || 'NOT SCHEDULED',
            bag_height: parseInt(order.bag_height) || 0,
            bag_width: parseInt(order.bag_width) || 0,
            bag_step: parseInt(order.bag_step) || 0,
            seal_sides: parseInt(order.seal_sides) || 3,
            quantity: parseInt(order.quantity) || 1,
            duration: parseFloat(order.duration) || 0,
            cost: parseFloat(order.cost) || 0,
            progress: parseInt(order.progress) || 0,
            delivery_date: order.delivery_date || null,
            production_start: order.production_start || null,
            production_end: order.production_end || null
        }));

        this.log('Data transformation completed', 'success');
        return true;
    }

    /**
     * Migrate a single entity type
     */
    async migrate_entity(entityType, data) {
        this.log(`Migrating ${entityType}...`, 'info', { count: data.length });

        try {
            let result;
            switch (entityType) {
                case 'machines':
                    result = await this.supabaseService.save_machines(data);
                    break;
                case 'phases':
                    result = await this.supabaseService.save_phases(data);
                    break;
                case 'odp_orders':
                    result = await this.supabaseService.save_odp_orders(data);
                    break;
                case 'scheduled_events':
                    result = await this.supabaseService.save_scheduled_events(data);
                    break;
                case 'machine_availability':
                    result = await this.supabaseService.save_machine_availability(data);
                    break;
                default:
                    throw new Error(`Unknown entity type: ${entityType}`);
            }

            this.log(`Successfully migrated ${entityType}`, 'success');
            return true;
        } catch (error) {
            this.log(`Failed to migrate ${entityType}`, 'error', error);
            throw error;
        }
    }

    /**
     * Perform the full migration
     */
    async migrate() {
        this.log('Starting migration from localStorage to Supabase...');

        try {
            // Step 1: Check Supabase connection
            const connected = await this.supabaseService.init();
            if (!connected) {
                throw new Error('Cannot connect to Supabase');
            }

            // Step 2: Create backup
            if (!this.create_backup()) {
                throw new Error('Failed to create backup');
            }

            // Step 3: Validate data
            if (!this.validate_data()) {
                const proceed = confirm('Validation issues found. Do you want to proceed anyway?');
                if (!proceed) {
                    throw new Error('Migration cancelled due to validation issues');
                }
            }

            // Step 4: Transform data
            if (!this.transform_data()) {
                throw new Error('Failed to transform data');
            }

            // Step 5: Migrate each entity type in order
            const migrationOrder = [
                { type: 'machines', data: this.backupData.machines },
                { type: 'phases', data: this.backupData.phases },
                { type: 'odp_orders', data: this.backupData.odp_orders },
                { type: 'scheduled_events', data: this.backupData.scheduled_events },
                { type: 'machine_availability', data: this.backupData.machine_availability }
            ];

            for (const { type, data } of migrationOrder) {
                await this.migrate_entity(type, data);
            }

            this.log('Migration completed successfully!', 'success');
            
            // Save migration log
            localStorage.setItem('migration_log_' + Date.now(), JSON.stringify(this.migrationLog));
            
            return {
                success: true,
                log: this.migrationLog
            };

        } catch (error) {
            this.log('Migration failed', 'error', error);
            
            return {
                success: false,
                error: error.message,
                log: this.migrationLog
            };
        }
    }

    /**
     * Verify migration by comparing counts
     */
    async verify_migration() {
        this.log('Verifying migration...');

        try {
            const localCounts = {
                machines: this.backupData.machines.length,
                phases: this.backupData.phases.length,
                odp_orders: this.backupData.odp_orders.length,
                scheduled_events: this.backupData.scheduled_events.length
            };

            const supabaseCounts = {
                machines: (await this.supabaseService.get_machines()).length,
                phases: (await this.supabaseService.get_phases()).length,
                odp_orders: (await this.supabaseService.get_odp_orders()).length,
                scheduled_events: (await this.supabaseService.get_scheduled_events()).length
            };

            const mismatches = [];
            for (const [key, localCount] of Object.entries(localCounts)) {
                if (localCount !== supabaseCounts[key]) {
                    mismatches.push(`${key}: local=${localCount}, supabase=${supabaseCounts[key]}`);
                }
            }

            if (mismatches.length > 0) {
                this.log('Count mismatches found', 'warning', mismatches);
                return false;
            }

            this.log('Migration verification passed', 'success');
            return true;

        } catch (error) {
            this.log('Failed to verify migration', 'error', error);
            return false;
        }
    }

    /**
     * Generate migration report
     */
    generate_report() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total_events: this.migrationLog.length,
                errors: this.migrationLog.filter(l => l.type === 'error').length,
                warnings: this.migrationLog.filter(l => l.type === 'warning').length,
                success: this.migrationLog.filter(l => l.type === 'success').length
            },
            log: this.migrationLog
        };

        return report;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.MigrationUtility = MigrationUtility;
}
