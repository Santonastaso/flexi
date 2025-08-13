/**
 * Shared Utilities - Common functions used across the application
 * Consolidates duplicate code to follow DRY principles
 */
class Utils {
    /**
     * Format date for display (YYYY-MM-DD)
     */
    static format_date(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }



    /**
     * Format hour for display (H:00)
     */
    static format_hour(hour) {
        return `${hour}:00`;
    }

    static get_week_start_date(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Adjust to Sunday
        return new Date(d.setDate(diff));
    }

    static get_day_of_week_name(day_index, short = false) {
        const day_names = short ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : 
                                   ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return day_names[day_index];
    }

    static is_date_today(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    /**
     * Escape HTML to prevent XSS
     */
    static escape_html(text) {
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
        return function executed_function(...args) {
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
    static generate_id() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Validate required fields
     */
    static validate_required_fields(data, required_fields, field_labels = {}) {
        const errors = [];
        
        required_fields.forEach(field => {
            if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
                const label = field_labels[field] || field.replace(/([A-Z])/g, ' $1').toLowerCase();
                errors.push(`${label} is required`);
            }
        });
        
        return {
            is_valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Show message (fallback if no banner system available)
     */
    static show_message(message, type = 'info') {
        if (typeof show_banner === 'function') {
            show_banner(message, type);
        }
    }

    /**
     * Validate numeric fields are non-negative
     */
    static validate_numeric_fields(fields, data, field_labels = {}) {
        const errors = [];
        
        fields.forEach(field => {
            const value = parseFloat(data[field]);
            if (data[field] && (isNaN(value) || value < 0)) {
                const label = field_labels[field] || field.replace(/([A-Z])/g, ' $1').toLowerCase();
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
    static validate_date_range(start_date, end_date) {
        if (!start_date || !end_date) return { isValid: true, errors: [] };
        
        const start = new Date(start_date);
        const end = new Date(end_date);
        
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
    static validate_field_formats(fields, data) {
        const errors = [];
        
        Object.entries(fields).forEach(([field_name, pattern]) => {
            const value = data[field_name];
            if (value && !pattern.test(value)) {
                errors.push(`${field_name} format is invalid`);
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
    static has_all_required_fields(data, required_fields) {
        return required_fields.every(field => {
            const value = data[field];
            return value && (typeof value === 'string' ? value.trim() : true);
        });
    }

    /**
     * Common validation patterns
     */
    static get_validation_patterns() {
        return {
            articleCode: /^(P0|ISP0)\w+$/,
            productionLot: /^[A-Z]{2,4}\d{3,6}$/,
            // Align with StorageService.generateODPNumber() which returns OP######
            odpNumber: /^OP\d{6}$/
        };
    }

    /**
     * Normalizers for consistent data
     */
    static normalize_id(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    static normalize_code(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim().toUpperCase().replace(/\s+/g, '_');
    }

    static normalize_status(value, fallback = 'ACTIVE') {
        const v = value === undefined || value === null ? fallback : value;
        return String(v).trim().toUpperCase();
    }

    static normalize_enum_lower(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim().toLowerCase();
    }

    static normalize_name(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    /**
     * Generic field validation with custom messages
     */
    static validate_fields(fields, data, validators = {}) {
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
    static create_numeric_validator(field_name, min = 0, max = null) {
        return (value) => {
            const num = parseFloat(value);
            if (isNaN(num)) {
                return { isValid: false, message: `${field_name} must be a valid number` };
            }
            if (num < min) {
                return { isValid: false, message: `${field_name} must be greater than or equal to ${min}` };
            }
            if (max !== null && num > max) {
                return { isValid: false, message: `${field_name} must be less than or equal to ${max}` };
            }
            return { isValid: true };
        };
    }

    /**
     * Validate that one field is greater than or equal to another field
     */
    static validate_field_relationship(field1, value1, field2, value2, field1_label, field2_label) {
        const num1 = parseFloat(value1);
        const num2 = parseFloat(value2);
        
        if (isNaN(num1) || isNaN(num2)) {
            return { isValid: true }; // Skip validation if values aren't numbers
        }
        
        if (num1 < num2) {
            return { 
                isValid: false, 
                message: `${field1_label} must be greater than or equal to ${field2_label}` 
            };
        }
        
        return { isValid: true };
    }

    /**
     * Machine helpers (centralized)
     */
    // Machine helper methods moved to BusinessLogicService

    // Machine compatibility methods moved to BusinessLogicService

    // Compatibility status method moved to BusinessLogicService



    /**
     * Printing cost calculation
     */
    static calculate_printing_cost(tempo_odp_totale_stampa, costo_h_stampa) {
        // costo_ODP_stampa = tempo_ODP_totale_Stampa * costo_orario_fase
        const totalTime = parseFloat(tempo_odp_totale_stampa) || 0;
        const hourlyRate = parseFloat(costo_h_stampa) || 0;
        return totalTime * hourlyRate; // Time already in hours
    }

    /**
     * Packaging cost calculation
     */
    static calculate_packaging_cost(tempo_odp_totale, costo_h_conf) {
        // costo_ODP_confezionamento = tempo_ODP_totale * costo_orario_fase
        const totalTime = parseFloat(tempo_odp_totale) || 0;
        const hourlyRate = parseFloat(costo_h_conf) || 0;
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