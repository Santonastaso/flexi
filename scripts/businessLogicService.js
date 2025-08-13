/**
 * Business Logic Service - Centralized business logic for all entities
 * Handles calculations, determinations, and business rules
 */
class BusinessLogicService {
    constructor() {
    }
    // ===== MACHINERY BUSINESS LOGIC =====
    /**
     * Generate machine ID based on type and work center
     */
    generate_machine_id(machine_type, work_center) {
        const prefix = this.get_machine_type_prefix(machine_type);
        const work_center_code = work_center === 'BUSTO_GAROLFO' ? 'BGF' : 'ZAN';
        // This would typically query existing machines to find next number
        // For now, return a timestamp-based ID
        const timestamp = Date.now().toString(36);
        return `${prefix}_${work_center_code}_${timestamp}`;
    }
    /**
     * Get machine type prefix for ID generation
     */
    get_machine_type_prefix(machine_type) {
        const prefixes = {
            'DIGITAL_PRINT': 'DIGI',
            'FLEXO_PRINT': 'FLEX',
            'ROTOGRAVURE': 'ROTO',
            'DOYPACK': 'DOYP',
            'PLURI_PIU': 'PLUR',
            'MONO_PIU': 'MONO'
        };
        return prefixes[machine_type] || 'MACH';
    }
    /**
     * Get valid machine types for a department
     */
    get_valid_machine_types(department) {
        const valid_types = {
            'STAMPA': ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE'],
            'CONFEZIONAMENTO': ['DOYPACK', 'PLURI_PIU', 'MONO_PIU']
        };
        return valid_types[department] || [];
    }
    /**
     * Get valid work centers
     */
    get_valid_work_centers() {
        return ['ZANICA', 'BUSTO_GAROLFO'];
    }
    /**
     * Get machine display name
     */
    get_machine_display_name(machine) {
        if (!machine) return 'Unknown Machine';
        // Use current field first
        if (machine.machine_name) {
            return machine.machine_name;
        }
        // Return default name
        return 'Unknown Machine';
    }
    /**
     * Check if machine is active
     */
    is_active_machine(machine) {
        if (!machine) return false;
        // Use current status field
        if (machine.status) {
            return String(machine.status).toUpperCase() === 'ACTIVE';
        }
        // Any named machine is considered active
        return !!machine.machine_name;
    }
    // ===== ODP BUSINESS LOGIC =====
    /**
     * Auto-determine work center based on article code
     */
    auto_determine_work_center(article_code) {
        if (!article_code) return 'ZANICA';
        // Article codes starting with P05 or ISP05 go to BUSTO GAROLFO
        if (article_code.startsWith('P05') || article_code.startsWith('ISP05')) {
            return 'BUSTO_GAROLFO';
        }
        // All other article codes go to ZANICA
        return 'ZANICA';
    }
    /**
     * Auto-determine department based on article code
     */
    auto_determine_department(article_code) {
        if (!article_code) return 'STAMPA';
        // Article codes starting with P0 go to CONFEZIONAMENTO
        if (article_code.startsWith('P0')) {
            return 'CONFEZIONAMENTO';
        }
        // All other article codes go to STAMPA
        return 'STAMPA';
    }
    /**
     * Generate ODP number (next in sequence)
     */
    generate_odp_number(existing_odp_numbers = []) {
        const existing_numbers = existing_odp_numbers
            .map(num => num && num.startsWith('OP') ? parseInt(num.substring(2)) : 0)
            .filter(num => !isNaN(num));
        const next_number = existing_numbers.length > 0 ? Math.max(...existing_numbers) + 1 : 1;
        return `OP${next_number.toString().padStart(6, '0')}`;
    }
    /**
     * Auto-set internal customer code from article code
     */
    auto_set_internal_customer_code(article_code) {
        return article_code || '';
    }
    /**
     * Calculate production duration based on phase and quantity
     */
    calculate_production_duration(phase, quantity, bag_width, bag_height) {
        if (!phase || !quantity) return 0;
        let speed = 0;
        let setup_time = 0;
        if (phase.department === 'STAMPA') {
            speed = phase.v_stampa || 0; // mt/h
            setup_time = phase.t_setup_stampa || 0;
            // For printing, calculate based on bag width and quantity
            if (speed > 0 && bag_width > 0) {
                const meters_per_bag = bag_width / 1000; // Convert mm to meters
                const bags_per_hour = speed / meters_per_bag;
                const production_time = quantity / bags_per_hour;
                return setup_time + production_time;
            }
        } else if (phase.department === 'CONFEZIONAMENTO') {
            speed = phase.v_conf || 0; // pz/h
            setup_time = phase.t_setup_conf || 0;
            // For packaging, calculate based on quantity and speed
            if (speed > 0) {
                const production_time = quantity / speed;
                return setup_time + production_time;
            }
        }
        return setup_time;
    }
    /**
     * Calculate production cost based on phase and duration
     */
    calculate_production_cost(phase, duration) {
        if (!phase || !duration) return 0;
        let hourly_cost = 0;
        if (phase.department === 'STAMPA') {
            hourly_cost = phase.costo_h_stampa || 0;
        } else if (phase.department === 'CONFEZIONAMENTO') {
            hourly_cost = phase.costo_h_conf || 0;
        }
        return hourly_cost * duration;
    }
    // ===== STATUS CALCULATION LOGIC =====
    /**
     * Determine ODP status based on Gantt schedule
     */
    determineODPStatus(odpNumber, scheduledEvents) {
        if (!odpNumber || !scheduledEvents) return 'Not Scheduled';
        // Check if this ODP is scheduled using multiple matching strategies
        const isScheduled = scheduledEvents.some(event => {
            // Primary: Check taskId
            if (String(event.taskId) === String(odpNumber)) return true;
            // Secondary: Check if taskTitle contains the ODP number
            if (event.taskTitle && String(event.taskTitle).includes(odpNumber)) return true;
            // Tertiary: Check if there's an odp_number field
            if (event.odp_number && String(event.odp_number) === String(odpNumber)) return true;
            return false;
        });
        return isScheduled ? 'Scheduled' : 'Not Scheduled';
    }
    /**
     * Get production start timestamp from Gantt schedule
     */
    getProductionStartTimestamp(odpNumber, scheduledEvents) {
        if (!odpNumber || !scheduledEvents) return null;
        // Find scheduled event by ODP number
        const scheduledEvent = scheduledEvents.find(event => {
            if (String(event.taskId) === String(odpNumber)) return true;
            if (event.taskTitle && String(event.taskTitle).includes(odpNumber)) return true;
            if (event.odp_number && String(event.odp_number) === String(odpNumber)) return true;
            return false;
        });
        if (scheduledEvent) {
            // Task is scheduled, return the timestamp
            const start_date = new Date(scheduledEvent.date);
            const startHour = scheduledEvent.startHour || 0;
            start_date.setHours(startHour, 0, 0, 0);
            return start_date.toISOString();
        }
        return null;
    }
    // ===== COMPATIBILITY LOGIC =====
    /**
     * Check if machine is compatible with ODP requirements
     */
    isMachineCompatible(machine, odpData) {
        if (!machine || !odpData) return false;
        // Department compatibility
        if (machine.department !== odpData.department) return false;
        // Web width compatibility
        if (machine.max_web_width !== undefined && odpData.bag_width !== undefined) {
            if (parseInt(odpData.bag_width) > machine.max_web_width) return false;
        }
        // Bag height compatibility
        if (machine.max_bag_height !== undefined && odpData.bag_height !== undefined) {
            if (parseInt(odpData.bag_height) > machine.max_bag_height) return false;
        }
        // Machine status compatibility
        if (machine.status !== 'ACTIVE') return false;
        return true;
    }
    /**
     * Get machine compatibility status with detailed information
     */
    getMachineCompatibilityStatus(machine, odpData) {
        const isCompatible = this.isMachineCompatible(machine, odpData);
        const reasons = [];
        if (!isCompatible) {
            if (machine.department !== odpData.department) {
                reasons.push(`Department mismatch: ${machine.department} vs ${odpData.department}`);
            }
            if (machine.max_web_width !== undefined && odpData.bag_width !== undefined) {
                if (parseInt(odpData.bag_width) > machine.max_web_width) {
                    reasons.push(`Bag width (${odpData.bag_width}mm) exceeds machine capacity (${machine.max_web_width}mm)`);
                }
            }
            if (machine.max_bag_height !== undefined && odpData.bag_height !== undefined) {
                if (parseInt(odpData.bag_height) > machine.max_bag_height) {
                    reasons.push(`Bag height (${odpData.bag_height}mm) exceeds machine capacity (${machine.max_bag_height}mm)`);
                }
            }
            if (machine.status !== 'ACTIVE') {
                reasons.push(`Machine is not active (status: ${machine.status})`);
            }
        }
        return {
            isCompatible,
            reasons,
            status: isCompatible ? 'compatible' : 'incompatible',
            icon: isCompatible ? '✅' : '❌',
            message: isCompatible ? 'Compatible' : 'Incompatible'
        };
    }
    // ===== DATA NORMALIZATION =====
    /**
     * Normalize machine data for storage
     */
    normalizeMachineData(machineData) {
        return {
            ...machineData,
            machine_name: this.normalize_name(machineData.machine_name || ''),
            machine_type: this.normalize_code(machineData.machine_type || ''),
            work_center: this.normalize_code(machineData.work_center || 'ZANICA'),
            department: this.normalize_code(machineData.department || ''),
            status: this.normalize_status(machineData.status || 'ACTIVE')
        };
    }
    /**
     * Normalize ODP data for storage
     */
    normalizeODPData(odpData) {
        return {
            ...odpData,
            article_code: this.normalize_code(odpData.article_code || ''),
            production_lot: this.normalize_code(odpData.production_lot || ''),
            work_center: this.normalize_code(odpData.work_center || ''),
            department: this.normalize_code(odpData.department || ''),
            product_type: this.normalize_enum_lower(odpData.product_type || 'crema'),
            status: this.normalize_status(odpData.status || 'DRAFT'),
            priority: this.normalize_enum_lower(odpData.priority || 'medium')
        };
    }
    /**
     * Normalize phase data for storage
     */
    normalizePhaseData(phaseData) {
        return {
            ...phaseData,
            name: this.normalize_name(phaseData.name || ''),
            department: this.normalize_code(phaseData.department || 'STAMPA')
        };
    }
    // ===== UTILITY METHODS =====
    /**
     * Normalize name (trim, uppercase, replace spaces with underscores)
     */
    normalize_name(name) {
        return String(name || '').trim().toUpperCase().replace(/\s+/g, '_');
    }
    /**
     * Normalize code (trim, uppercase, replace spaces with underscores)
     */
    normalize_code(code) {
        return String(code || '').trim().toUpperCase().replace(/\s+/g, '_');
    }
    /**
     * Normalize status (trim, uppercase)
     */
    normalize_status(status) {
        return String(status || '').trim().toUpperCase();
    }
    /**
     * Normalize enum to lowercase
     */
    normalize_enum_lower(value) {
        return String(value || '').trim().toLowerCase();
    }
    /**
     * Normalize ID (ensure string format)
     */
    normalize_id(id) {
        return String(id || '').trim();
    }
}
// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BusinessLogicService;
} else if (typeof window !== 'undefined') {
    window.BusinessLogicService = BusinessLogicService;
}
