/**
 * UI Components - Reusable UI utilities
 * Consolidates common UI patterns found across the application
 */
class UIComponents {
    /**
     * Create a standardized table row
     */
    static create_table_row(data, columns, actions = null) {
        const cells = columns.map(col => {
            const value = data[col.key] || '';
            return `<td class="editable-cell" data-field="${col.key}">
                <span class="static-value">${this.escape_html(value)}</span>
                ${col.editable ? this.create_edit_input(col.type, value, col.options) : ''}
            </td>`;
        }).join('');
        const action_buttons = actions ? `<td>${actions}</td>` : '';
        return `<tr data-id="${data.id || ''}">${cells}${action_buttons}</tr>`;
    }
    /**
     * Create edit input based on type
     */
    static create_edit_input(type, value, options = {}) {
        switch (type) {
            case 'text':
                return `<input type="text" class="edit-input" value="${this.escape_html(value)}" style="display: none;">`;
            case 'number':
                return `<input type="number" class="edit-input" value="${this.escape_html(value)}" style="display: none;">`;
            case 'select':
                const options_html = options.options ? options.options.map(opt => 
                    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                ).join('') : '';
                return `<select class="edit-select" style="display: none;">${options_html}</select>`;
            case 'color':
                return `<div class="edit-color-container" style="display: none;">
                    <input type="color" class="edit-input" value="${this.escape_html(value)}">
                </div>`;
            default:
                return `<input type="text" class="edit-input" value="${this.escape_html(value)}" style="display: none;">`;
        }
    }
    // Note: Action buttons are provided by EditManager.create_action_buttons()
    /**
     * Create form field
     */
    static create_form_field(id, label, type = 'text', required = false, placeholder = '', options = {}) {
        const required_attr = required ? 'required' : '';
        const placeholder_attr = placeholder ? `placeholder="${placeholder}"` : '';
        let input = '';
        switch (type) {
            case 'textarea':
                input = `<textarea id="${id}" ${required_attr} ${placeholder_attr}></textarea>`;
                break;
            case 'select':
                const options_html = options.options ? options.options.map(opt => 
                    `<option value="${opt.value}">${opt.label}</option>`
                ).join('') : '';
                input = `<select id="${id}" ${required_attr}>${options_html}</select>`;
                break;
            case 'checkbox':
                input = `<input type="checkbox" id="${id}" ${required_attr}>`;
                break;
            default:
                input = `<input type="${type}" id="${id}" ${required_attr} ${placeholder_attr}>`;
        }
        return `
            <div class="form-group">
                <label for="${id}">${label}</label>
                ${input}
            </div>
        `;
    }

    /**
     * Create loading spinner
     */
    static create_spinner(size = 'medium') {
        const sizeClass = `spinner-${size}`;
        return `<div class="spinner ${sizeClass}"></div>`;
    }
    /**
     * Show loading state
     */
    static show_loading(element, text = 'Loading...') {
        if (element) {
            element.disabled = true;
            element.innerHTML = this.create_spinner('small') + ' ' + text;
        }
    }
    /**
     * Hide loading state
     */
    static hide_loading(element, original_text) {
        if (element) {
            element.disabled = false;
            element.innerHTML = original_text;
        }
    }

    /**
     * Validate form fields
     */
    static validate_form(form_element, rules) {
        const errors = [];
        Object.entries(rules).forEach(([field_name, rule]) => {
            const field = form_element.querySelector(`[name="${field_name}"], #${field_name}`);
            if (!field) return;
            const value = field.value.trim();
            if (rule.required && !value) {
                errors.push(`${rule.label || field_name} is required`);
            } else if (value) {
                if (rule.min_length && value.length < rule.min_length) {
                    errors.push(`${rule.label || field_name} must be at least ${rule.min_length} characters`);
                }
                if (rule.max_length && value.length > rule.max_length) {
                    errors.push(`${rule.label || field_name} must be no more than ${rule.max_length} characters`);
                }
                if (rule.pattern && !rule.pattern.test(value)) {
                    errors.push(`${rule.label || field_name} format is invalid`);
                }
                if (rule.min && parseFloat(value) < rule.min) {
                    errors.push(`${rule.label || field_name} must be at least ${rule.min}`);
                }
                if (rule.max && parseFloat(value) > rule.max) {
                    errors.push(`${rule.label || field_name} must be no more than ${rule.max}`);
                }
            }
        });
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    /**
     * Escape HTML to prevent XSS
     */
    static escape_html(text) {
        return Utils.escape_html(text);
    }
    /**
     * Format date for display
     */
    static format_date(date, format = 'YYYY-MM-DD') {
        // Use Utils.format_date for consistency, but handle custom format if needed
        if (format === 'YYYY-MM-DD') {
            return Utils.format_date(date);
        }
        // For custom formats, use the original implementation
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    }
    /**
     * Format time for display
     */
    static format_time(date, format = 'HH:mm') {
        const d = new Date(date);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return format
            .replace('HH', hours)
            .replace('mm', minutes);
    }
}
// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIComponents;
}