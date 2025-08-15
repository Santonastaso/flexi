/**
 * Business Logic Service - Centralized business logic for all entities
 * Handles calculations, determinations, and business rules
 */
import { Utils } from './utils.js';

export class BusinessLogicService {
    constructor() {}

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
            'MONO_PIU': 'MONO',
            'CONFEZIONAMENTO_TRADIZIONALE': 'CONFTRAD'
        };
        return prefixes[machine_type] || 'MACH';
    }

    /**
     * Get valid machine types for a department
     */
    get_valid_machine_types(department) {
        const valid_types = {
            'STAMPA': ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE'],
            'CONFEZIONAMENTO': ['DOYPACK', 'PLURI_PIU', 'MONO_PIU', 'CONFEZIONAMENTO_TRADIZIONALE']
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
        return machine?.machine_name || 'Unknown Machine';
    }

    /**
     * Check if machine is active
     */
    is_active_machine(machine) {
        if (!machine) return false;
        return machine.status ? String(machine.status).toUpperCase() === 'ACTIVE' : !!machine.machine_name;
    }

    // ===== ODP BUSINESS LOGIC =====
    /**
     * Auto-determine work center based on article code
     */
    auto_determine_work_center(article_code) {
        if (!article_code) return 'ZANICA';
        return (article_code.startsWith('P05') || article_code.startsWith('ISP05')) ? 'BUSTO_GAROLFO' : 'ZANICA';
    }

    /**
     * Auto-determine department based on article code
     */
    auto_determine_department(article_code) {
        if (!article_code) return 'STAMPA';
        return article_code.startsWith('P0') ? 'CONFEZIONAMENTO' : 'STAMPA';
    }

    /**
     * Generate ODP number (next in sequence)
     */
    generate_odp_number(existing_odp_numbers = []) {
        const maxNum = existing_odp_numbers.reduce((max, num) => {
            if (num?.startsWith('OP')) {
                const currentNum = parseInt(num.substring(2), 10);
                return Math.max(max, isNaN(currentNum) ? 0 : currentNum);
            }
            return max;
        }, 0);
        return `OP${(maxNum + 1).toString().padStart(6, '0')}`;
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
        let production_time = 0;

        if (phase.department === 'STAMPA') {
            speed = phase.v_stampa || 0;
            setup_time = phase.t_setup_stampa || 0;
            if (speed > 0 && bag_width > 0) {
                const meters_per_bag = bag_width / 1000;
                const bags_per_hour = speed / meters_per_bag;
                production_time = quantity / bags_per_hour;
            }
        } else if (phase.department === 'CONFEZIONAMENTO') {
            speed = phase.v_conf || 0;
            setup_time = phase.t_setup_conf || 0;
            if (speed > 0) {
                production_time = quantity / speed;
            }
        }
        return setup_time + production_time;
    }

    /**
     * Calculate production cost based on phase and duration
     */
    calculate_production_cost(phase, duration) {
        if (!phase || !duration) return 0;
        const costMap = {
            'STAMPA': phase.costo_h_stampa || 0,
            'CONFEZIONAMENTO': phase.costo_h_conf || 0
        };
        const hourly_cost = costMap[phase.department] || 0;
        return hourly_cost * duration;
    }

    // ===== STATUS CALCULATION LOGIC =====
    /**
     * Unified event matching logic for ODP scheduling
     */
    _matchesODP(odpNumber, event) {
        const odpStr = String(odpNumber);
        return String(event.taskId) === odpStr ||
            event.taskTitle?.includes(odpStr) ||
            String(event.odp_number) === odpStr;
    }

    /**
     * Determine ODP status based on Gantt schedule
     */
    determineODPStatus(odpNumber, scheduledEvents) {
        if (!odpNumber || !scheduledEvents) return 'Not Scheduled';
        return scheduledEvents.some(event => this._matchesODP(odpNumber, event)) ? 'Scheduled' : 'Not Scheduled';
    }

    /**
     * Get production start timestamp from Gantt schedule
     */
    getProductionStartTimestamp(odpNumber, scheduledEvents) {
        if (!odpNumber || !scheduledEvents) return null;
        const scheduledEvent = scheduledEvents.find(event => this._matchesODP(odpNumber, event));
        if (scheduledEvent) {
            const start_date = new Date(scheduledEvent.date);
            start_date.setHours(scheduledEvent.startHour || 0, 0, 0, 0);
            return start_date.toISOString();
        }
        return null;
    }

    // ===== COMPATIBILITY LOGIC =====
    /**
     * Unified machine compatibility checking
     */
    getMachineCompatibility(machine, odpData, options = {}) {
        const { returnDetails = false } = options;

        const createResponse = (isCompatible, reasons = []) => {
            if (!returnDetails) return isCompatible;
            return {
                isCompatible,
                reasons,
                status: isCompatible ? 'compatible' : 'incompatible',
                icon: isCompatible ? '✅' : '❌',
                message: isCompatible ? 'Compatible' : 'Incompatible'
            };
        };

        if (!machine || !odpData) {
            return createResponse(false, ['Machine or ODP data is missing']);
        }

        const checks = [
            () => (machine.department !== odpData.department) ? `Department mismatch: ${machine.department} vs ${odpData.department}` : null,
            () => (machine.max_web_width !== undefined && parseInt(odpData.bag_width) > machine.max_web_width) ? `Bag width (${odpData.bag_width}mm) exceeds machine capacity (${machine.max_web_width}mm)` : null,
            () => (machine.max_bag_height !== undefined && parseInt(odpData.bag_height) > machine.max_bag_height) ? `Bag height (${odpData.bag_height}mm) exceeds machine capacity (${machine.max_bag_height}mm)` : null,
            () => (machine.status !== 'ACTIVE') ? `Machine is not active (status: ${machine.status})` : null,
        ];

        for (const check of checks) {
            const reason = check();
            if (reason) {
                return createResponse(false, [reason]);
            }
        }

        return createResponse(true);
    }

    /**
     * Check if machine is compatible with ODP requirements (boolean result)
     * @deprecated Use getMachineCompatibility(machine, odpData) instead
     */
    isMachineCompatible(machine, odpData) {
        return this.getMachineCompatibility(machine, odpData);
    }

    /**
     * Get machine compatibility status with detailed information
     * @deprecated Use getMachineCompatibility(machine, odpData, { returnDetails: true }) instead
     */
    getMachineCompatibilityStatus(machine, odpData) {
        return this.getMachineCompatibility(machine, odpData, { returnDetails: true });
    }

    // ===== DATA NORMALIZATION =====
    /**
     * Normalize machine data for storage
     */
    normalizeMachineData(machineData) {
        return {
            ...machineData,
            machine_name: this.normalize_name(machineData.machine_name || ''),
            machine_type: Utils.normalize_code(machineData.machine_type || ''),
            work_center: Utils.normalize_code(machineData.work_center || 'ZANICA'),
            department: Utils.normalize_code(machineData.department || ''),
            status: Utils.normalize_status(machineData.status, 'ACTIVE')
        };
    }

    /**
     * Normalize ODP data for storage
     */
    normalizeODPData(odpData) {
        return {
            ...odpData,
            article_code: Utils.normalize_code(odpData.article_code || ''),
            production_lot: Utils.normalize_code(odpData.production_lot || ''),
            work_center: Utils.normalize_code(odpData.work_center || ''),
            department: Utils.normalize_code(odpData.department || ''),
            product_type: this.normalize_enum_lower(odpData.product_type || 'crema'),
            status: Utils.normalize_status(odpData.status, 'DRAFT'),
            priority: Utils.normalize_enum_lower(odpData.priority || 'medium')
        };
    }

    /**
     * Normalize phase data for storage
     */
    normalizePhaseData(phaseData) {
        return {
            ...phaseData,
            name: this.normalize_name(phaseData.name || ''),
            department: Utils.normalize_code(phaseData.department || 'STAMPA'),
            work_center: Utils.normalize_code(phaseData.work_center || 'ZANICA')
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
     * Normalize enum to lowercase
     */
    normalize_enum_lower(value) {
        return String(value || '').trim().toLowerCase();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BusinessLogicService;
}