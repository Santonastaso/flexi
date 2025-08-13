/**
 * Shared Utilities - Common functions used across the application
 * Consolidates duplicate code to follow DRY principles
 */
class Utils {
    /**
     * Format date for display (YYYY-MM-DD)
     */
    static formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Format hour for display (H:00)
     */
    static formatHour(hour) {
        return `${hour}:00`;
    }

    static getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Adjust to Sunday
        return new Date(d.setDate(diff));
    }

    static getDayName(dayIndex, short = false) {
        const dayNames = short ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : 
                                   ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return dayNames[dayIndex];
    }

    static isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    /**
     * Escape HTML to prevent XSS
     */
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Debounce function calls
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Generate unique ID
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Validate required fields
     */
    static validateRequiredFields(data, requiredFields, fieldLabels = {}) {
        const errors = [];
        
        requiredFields.forEach(field => {
            if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
                const label = fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').toLowerCase();
                errors.push(`${label} is required`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Show message (fallback if no banner system available)
     */
    static showMessage(message, type = 'info') {
        if (typeof showBanner === 'function') {
            showBanner(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Validate numeric fields are non-negative
     */
    static validateNumericFields(fields, data, fieldLabels = {}) {
        const errors = [];
        
        fields.forEach(field => {
            const value = parseFloat(data[field]);
            if (data[field] && (isNaN(value) || value < 0)) {
                const label = fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').toLowerCase();
                errors.push(`${label} must be greater than or equal to 0`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate date range (start before end)
     */
    static validateDateRange(startDate, endDate) {
        if (!startDate || !endDate) return { isValid: true, errors: [] };
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start >= end) {
            return {
                isValid: false,
                errors: ['Start date must be before end date']
            };
        }
        
        return { isValid: true, errors: [] };
    }

    /**
     * Validate field format using regex patterns
     */
    static validateFieldFormats(fields, data) {
        const errors = [];
        
        Object.entries(fields).forEach(([fieldName, pattern]) => {
            const value = data[fieldName];
            if (value && !pattern.test(value)) {
                errors.push(`${fieldName} format is invalid`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Check if form has required fields for button state
     */
    static hasRequiredFields(data, requiredFields) {
        return requiredFields.every(field => {
            const value = data[field];
            return value && (typeof value === 'string' ? value.trim() : true);
        });
    }

    /**
     * Common validation patterns
     */
    static getValidationPatterns() {
        return {
            articleCode: /^(P0|ISP0)\w+$/,
            productionLot: /^AAPU\d{3}$/,
            // Align with StorageService.generateODPNumber() which returns OP######
            odpNumber: /^OP\d{6}$/
        };
    }

    /**
     * Normalizers for consistent data
     */
    static normalizeId(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    static normalizeCode(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim().toUpperCase().replace(/\s+/g, '_');
    }

    static normalizeStatus(value, fallback = 'ACTIVE') {
        const v = value === undefined || value === null ? fallback : value;
        return String(v).trim().toUpperCase();
    }

    static normalizeEnumLower(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim().toLowerCase();
    }

    static normalizeName(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    /**
     * Generic field validation with custom messages
     */
    static validateFields(fields, data, validators = {}) {
        const errors = [];
        
        Object.entries(validators).forEach(([field, validator]) => {
            const value = data[field];
            if (value !== undefined && value !== null && value !== '') {
                const result = validator(value);
                if (!result.isValid) {
                    errors.push(result.message);
                }
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Create a numeric validator for a field
     */
    static createNumericValidator(fieldName, min = 0, max = null) {
        return (value) => {
            const num = parseFloat(value);
            if (isNaN(num)) {
                return { isValid: false, message: `${fieldName} must be a valid number` };
            }
            if (num < min) {
                return { isValid: false, message: `${fieldName} must be greater than or equal to ${min}` };
            }
            if (max !== null && num > max) {
                return { isValid: false, message: `${fieldName} must be less than or equal to ${max}` };
            }
            return { isValid: true };
        };
    }

    /**
     * Validate that one field is greater than or equal to another field
     */
    static validateFieldRelationship(field1, value1, field2, value2, field1Label, field2Label) {
        const num1 = parseFloat(value1);
        const num2 = parseFloat(value2);
        
        if (isNaN(num1) || isNaN(num2)) {
            return { isValid: true }; // Skip validation if values aren't numbers
        }
        
        if (num1 < num2) {
            return { 
                isValid: false, 
                message: `${field1Label} must be greater than or equal to ${field2Label}` 
            };
        }
        
        return { isValid: true };
    }

    /**
     * Machine helpers (centralized)
     */
    static getMachineDisplayName(machine) {
        return (machine && machine.machine_name) || 'Unknown Machine';
    }

    static isActiveMachine(machine) {
        if (!machine) return false;
        if (machine.status) return String(machine.status).toUpperCase() === 'ACTIVE';
        // Legacy: any named machine is considered active
        return !!machine.machine_name;
    }

    /**
     * Machine-ODP Compatibility Checker
     * Verifies if a machine is compatible with an ODP order
     */
    static isCompatible(machine, odp) {
        // Check if both machine and ODP have required fields
        if (!machine || !odp) {
            return { compatible: false, reasons: ['Missing machine or ODP data'] };
        }

        const reasons = [];

        // 1. Check work center compatibility
        if (machine.site && odp.work_center && machine.site !== odp.work_center) {
            reasons.push(`Work center mismatch: Machine is at ${machine.site}, ODP requires ${odp.work_center}`);
        }

        // 2. Check web width compatibility (bag_width vs machine web width)
        const bagWidth = parseInt(odp.bag_width) || 0;
        const minWebWidth = parseInt(machine.min_web_width) || 0;
        const maxWebWidth = parseInt(machine.max_web_width) || 0;
        
        if (bagWidth > 0 && maxWebWidth > 0) {
            if (bagWidth < minWebWidth) {
                reasons.push(`Bag width too small: ${bagWidth}mm < minimum ${minWebWidth}mm`);
            }
            if (bagWidth > maxWebWidth) {
                reasons.push(`Bag width too large: ${bagWidth}mm > maximum ${maxWebWidth}mm`);
            }
        }

        // 3. Check bag height compatibility
        const bagHeight = parseInt(odp.bag_height) || 0;
        const minBagHeight = parseInt(machine.min_bag_height) || 0;
        const maxBagHeight = parseInt(machine.max_bag_height) || 0;
        
        if (bagHeight > 0 && maxBagHeight > 0) {
            if (bagHeight < minBagHeight) {
                reasons.push(`Bag height too small: ${bagHeight}mm < minimum ${minBagHeight}mm`);
            }
            if (bagHeight > maxBagHeight) {
                reasons.push(`Bag height too large: ${bagHeight}mm > maximum ${maxBagHeight}mm`);
            }
        }

        // 4. Check machine type vs processing type compatibility
        const machineType = machine.machine_type;
        const tipoLavorazione = odp.tipo_lavorazione;
        
        if (machineType && tipoLavorazione) {
            const printingMachines = ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE', 'printing'];
            const packagingMachines = ['PACKAGING', 'DOYPACK', 'packaging'];
            
            if (tipoLavorazione === 'printing' && !printingMachines.includes(machineType)) {
                reasons.push(`Machine type incompatible: ${machineType} cannot perform printing operations`);
            }
            
            if (tipoLavorazione === 'packaging' && !packagingMachines.includes(machineType)) {
                reasons.push(`Machine type incompatible: ${machineType} cannot perform packaging operations`);
            }
        }

        return {
            compatible: reasons.length === 0,
            reasons: reasons,
            score: reasons.length === 0 ? 100 : Math.max(0, 100 - (reasons.length * 25))
        };
    }

    /**
     * Get compatibility status for display
     */
    static getCompatibilityStatus(machine, odp) {
        const result = Utils.isCompatible(machine, odp);
        
        if (result.compatible) {
            return { status: 'compatible', icon: '✅', message: 'Compatible' };
        } else if (result.score > 50) {
            return { status: 'warning', icon: '⚠️', message: 'Partially compatible' };
        } else {
            return { status: 'incompatible', icon: '❌', message: 'Incompatible' };
        }
    }



    /**
     * Printing cost calculation
     */
    static calculatePrintingCost(tempoODPTotaleStampa, costoHStampa) {
        // costo_ODP_stampa = tempo_ODP_totale_Stampa * costo_orario_fase
        const totalTime = parseFloat(tempoODPTotaleStampa) || 0;
        const hourlyRate = parseFloat(costoHStampa) || 0;
        return totalTime * hourlyRate; // Time already in hours
    }

    /**
     * Packaging cost calculation
     */
    static calculatePackagingCost(tempoODPTotale, costoHConf) {
        // costo_ODP_confezionamento = tempo_ODP_totale * costo_orario_fase
        const totalTime = parseFloat(tempoODPTotale) || 0;
        const hourlyRate = parseFloat(costoHConf) || 0;
        return totalTime * hourlyRate; // Time already in hours
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}