/**
 * Business Logic Service - Centralized business logic for all entities
 * Handles calculations, determinations, and business rules
 * Cleaned up to remove unused functions - only contains actively used logic
 */

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
            'CONFEZIONAMENTO_TRADIZIONALE': 'CONFTRAD',
            'CONFEZIONAMENTO_POLVERI': 'CONFPOL'
        };
        return prefixes[machine_type] || 'MACH';
    }

    /**
     * Get valid machine types for a department
     */
    get_valid_machine_types(department) {
        const valid_types = {
            'STAMPA': ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE'],
            'CONFEZIONAMENTO': ['DOYPACK', 'PLURI_PIU', 'MONO_PIU', 'CONFEZIONAMENTO_TRADIZIONALE','CONFEZIONAMENTO_POLVERI']
        };
        return valid_types[department] || [];
    }

    /**
     * Get machine display name
     */
    get_machine_display_name(machine) {
        return machine?.machine_name || 'Unknown Machine';
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
     * Calculate completion rate based on quantity and quantity_completed
     * Note: This is now handled by the database computed column, but kept for validation
     */
    calculate_completion_rate(quantity, quantity_completed) {
        if (!quantity || quantity === 0) return 0;
        return Math.round((quantity_completed * 100.0) / quantity);
    }

    /**
     * Calculate time remaining based on duration and progress
     * Note: This is now handled by the database computed column, but kept for validation
     */
    calculate_time_remaining(duration, progress_percentage) {
        if (!duration || duration === 0) return 0;
        if (!progress_percentage || progress_percentage === 0) return duration;
        return Math.round((duration * (1 - (progress_percentage / 100))) * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Validate quantity_completed against total quantity
     */
    validate_quantity_completed(quantity, quantity_completed) {
        if (quantity_completed < 0) return false;
        if (quantity_completed > quantity) return false;
        return true;
    }

    /**
     * Calculate the number of boxes needed for a given quantity and quantity per box
     * @param {number} quantity - Total quantity needed
     * @param {number} quantity_per_box - Quantity that fits in each box
     * @returns {number} Number of boxes needed (rounded up)
     */
    calculate_n_boxes(quantity, quantity_per_box) {
        if (!quantity_per_box || quantity_per_box <= 0) return 0;
        return Math.ceil(quantity / quantity_per_box);
    }

    /**
     * Validate that quantity_per_box is reasonable
     * @param {number} quantity_per_box - Quantity per box to validate
     * @returns {Object} Validation result with isValid boolean and message
     */
    validate_quantity_per_box(quantity_per_box) {
        if (!quantity_per_box || quantity_per_box <= 0) {
            return { isValid: false, message: 'Quantity per box must be greater than 0' };
        }
        if (quantity_per_box > 10000) {
            return { isValid: false, message: 'Quantity per box seems unreasonably high' };
        }
        return { isValid: true };
    }

    // ===== UTILITY METHODS =====
    /**
     * Normalize name (trim, uppercase, replace spaces with underscores)
     */
    normalize_name(name) {
        return String(name || '').trim().toUpperCase().replace(/\s+/g, '_');
    }

    // ===== PHASE CALCULATION LOGIC =====
    /**
     * Calculate production metrics based on selected phase and quantity
     */
    calculate_production_metrics(phase, quantity, bagStep) {
        const results = {
            printing: { processing_time: 0, setup_time: 0, total_time: 0, cost: 0 },
            packaging: { processing_time: 0, setup_time: 0, total_time: 0, cost: 0 },
            totals: { duration: 0, cost: 0 }
        };

        if (phase.department === 'STAMPA' && phase.v_stampa > 0) {
            const metersToPrint = (bagStep * quantity) / 1000;
            results.printing.processing_time = Math.round((metersToPrint / phase.v_stampa) * 100) / 100;
            results.printing.setup_time = Math.round((phase.t_setup_stampa || 0) * 100) / 100;
            results.printing.total_time = results.printing.processing_time + results.printing.setup_time;
            results.printing.cost = Math.round((results.printing.total_time * (phase.costo_h_stampa || 0)) * 100) / 100;
        }

        if (phase.department === 'CONFEZIONAMENTO' && phase.v_conf > 0) {
            results.packaging.processing_time = Math.round((quantity / phase.v_conf) * 100) / 100;
            results.packaging.setup_time = Math.round((phase.t_setup_conf || 0) * 100) / 100;
            results.packaging.total_time = results.packaging.processing_time + results.packaging.setup_time;
            results.packaging.cost = Math.round((results.packaging.total_time * (phase.costo_h_conf || 0)) * 100) / 100;
        }

        results.totals.duration = Math.round((results.printing.total_time + results.packaging.total_time) * 100) / 100;
        results.totals.cost = Math.round((results.printing.cost + results.packaging.cost) * 100) / 100;

        return results;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BusinessLogicService;
}