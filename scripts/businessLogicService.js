/**
 * Business Logic Service - Centralized business logic for all entities
 * Handles calculations, determinations, and business rules
 * Cleaned up to remove unused functions - only contains actively used logic
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

    // ===== UTILITY METHODS =====
    /**
     * Normalize name (trim, uppercase, replace spaces with underscores)
     */
    normalize_name(name) {
        return String(name || '').trim().toUpperCase().replace(/\s+/g, '_');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BusinessLogicService;
}