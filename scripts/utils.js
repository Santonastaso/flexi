/**
 * Shared Utilities - Common functions used across the application
 * Consolidates duplicate code to follow DRY principles
 */
export class Utils {
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
     * Format date for display in dd/mm/yyyy format (legacy compatibility)
     */
    static format_date_legacy(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Format datetime for display
     */
    static format_datetime(date, includeSeconds = false) {
        const dateStr = this.format_date(date);
        const timeStr = this.format_time(date, includeSeconds);
        return `${dateStr} ${timeStr}`;
    }

    /**
     * Format time for display
     */
    static format_time(date, includeSeconds = false) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        if (includeSeconds) {
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        }
        return `${hours}:${minutes}`;
    }

    /**
     * Parse datetime string to Date object
     */
    static parse_datetime(datetimeStr) {
        try {
            return new Date(datetimeStr);
        } catch (error) {
            console.error('Error parsing datetime:', error);
            return null;
        }
    }

    /**
     * Check if two datetime ranges overlap
     */
    static datetime_ranges_overlap(start1, end1, start2, end2) {
        return start1 < end2 && start2 < end1;
    }

    /**
     * Calculate duration between two datetimes in hours
     */
    static calculate_duration_hours(startDateTime, endDateTime) {
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);
        return (end - start) / (1000 * 60 * 60);
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
     * Get the start of the week (Sunday) for a given date
     */
    static get_start_of_week(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Adjust to Sunday
        return new Date(d.setDate(diff));
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
     * Check if form has required fields for button state
     */
    static has_all_required_fields(data, required_fields) {
        return required_fields.every(field => {
            const value = data[field];
            return value && (typeof value === 'string' ? value.trim() : true);
        });
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

// Export for ES6 modules (already exported above)