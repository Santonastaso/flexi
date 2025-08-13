/**
 * UI Components - Reusable UI utilities
 * Consolidates common UI patterns found across the application
 */
class UIComponents {
    /**
     * Create a standardized table row
     */
    static createTableRow(data, columns, actions = null) {
        const cells = columns.map(col => {
            const value = data[col.key] || '';
            return `<td class="editable-cell" data-field="${col.key}">
                <span class="static-value">${this.escapeHtml(value)}</span>
                ${col.editable ? this.createEditInput(col.type, value, col.options) : ''}
            </td>`;
        }).join('');

        const actionButtons = actions ? `<td>${actions}</td>` : '';
        
        return `<tr data-id="${data.id || ''}">${cells}${actionButtons}</tr>`;
    }

    /**
     * Create edit input based on type
     */
    static createEditInput(type, value, options = {}) {
        switch (type) {
            case 'text':
                return `<input type="text" class="edit-input" value="${this.escapeHtml(value)}" style="display: none;">`;
            
            case 'number':
                return `<input type="number" class="edit-input" value="${this.escapeHtml(value)}" style="display: none;">`;
            
            case 'select':
                const optionsHtml = options.options ? options.options.map(opt => 
                    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                ).join('') : '';
                return `<select class="edit-select" style="display: none;">${optionsHtml}</select>`;
            
            case 'color':
                return `<div class="edit-color-container" style="display: none;">
                    <input type="color" class="edit-input" value="${this.escapeHtml(value)}">
                </div>`;
            
            default:
                return `<input type="text" class="edit-input" value="${this.escapeHtml(value)}" style="display: none;">`;
        }
    }

    // Note: Action buttons are provided by EditManager.createActionButtons()

    /**
     * Create form field
     */
    static createFormField(id, label, type = 'text', required = false, placeholder = '', options = {}) {
        const requiredAttr = required ? 'required' : '';
        const placeholderAttr = placeholder ? `placeholder="${placeholder}"` : '';
        
        let input = '';
        switch (type) {
            case 'textarea':
                input = `<textarea id="${id}" ${requiredAttr} ${placeholderAttr}></textarea>`;
                break;
            
            case 'select':
                const optionsHtml = options.options ? options.options.map(opt => 
                    `<option value="${opt.value}">${opt.label}</option>`
                ).join('') : '';
                input = `<select id="${id}" ${requiredAttr}>${optionsHtml}</select>`;
                break;
            
            case 'checkbox':
                input = `<input type="checkbox" id="${id}" ${requiredAttr}>`;
                break;
            
            default:
                input = `<input type="${type}" id="${id}" ${requiredAttr} ${placeholderAttr}>`;
        }
        
        return `
            <div class="form-group">
                <label for="${id}">${label}</label>
                ${input}
            </div>
        `;
    }

    /**
     * Create modal dialog
     */
    static createModal(id, title, content, buttons = []) {
        const buttonHtml = buttons.map(btn => 
            `<button class="btn ${btn.class || 'btn-secondary'}" onclick="${btn.onclick}">${btn.text}</button>`
        ).join('');
        
        return `
            <div id="${id}" class="modal-overlay" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="btn-close" onclick="UIComponents.closeModal('${id}')">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${buttonHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show modal
     */
    static showModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('modal-fade-in');
        }
    }

    /**
     * Close modal
     */
    static closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('modal-fade-in');
            modal.classList.add('modal-fade-out');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.classList.remove('modal-fade-out');
            }, 300);
        }
    }

    /**
     * Create banner notification
     * @deprecated Use the global showBanner function from banner.js instead
     */
    static showBanner(message, type = 'info', duration = 5000) {
        // Use the global showBanner function for consistency
        if (typeof window.showBanner === 'function') {
            window.showBanner(message, type);
        } else {
            console.warn('Global showBanner function not found, falling back to console.log');
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Create loading spinner
     */
    static createSpinner(size = 'medium') {
        const sizeClass = `spinner-${size}`;
        return `<div class="spinner ${sizeClass}"></div>`;
    }

    /**
     * Show loading state
     */
    static showLoading(element, text = 'Loading...') {
        if (element) {
            element.disabled = true;
            element.innerHTML = this.createSpinner('small') + ' ' + text;
        }
    }

    /**
     * Hide loading state
     */
    static hideLoading(element, originalText) {
        if (element) {
            element.disabled = false;
            element.innerHTML = originalText;
        }
    }

    /**
     * Create confirmation dialog
     */
    static confirm(message, onConfirm, onCancel = null) {
        const modalId = 'confirm-modal-' + Date.now();
        const modal = this.createModal(modalId, 'Confirm', 
            `<p>${this.escapeHtml(message)}</p>`,
            [
                {
                    text: 'Cancel',
                    class: 'btn-secondary',
                    onclick: `UIComponents.closeModal('${modalId}'); ${onCancel ? onCancel() : ''}`
                },
                {
                    text: 'Confirm',
                    class: 'btn-danger',
                    onclick: `UIComponents.closeModal('${modalId}'); ${onConfirm()}`
                }
            ]
        );
        
        document.body.insertAdjacentHTML('beforeend', modal);
        this.showModal(modalId);
    }

    /**
     * Validate form fields
     */
    static validateForm(formElement, rules) {
        const errors = [];
        
        Object.entries(rules).forEach(([fieldName, rule]) => {
            const field = formElement.querySelector(`[name="${fieldName}"], #${fieldName}`);
            if (!field) return;
            
            const value = field.value.trim();
            
            if (rule.required && !value) {
                errors.push(`${rule.label || fieldName} is required`);
            } else if (value) {
                if (rule.minLength && value.length < rule.minLength) {
                    errors.push(`${rule.label || fieldName} must be at least ${rule.minLength} characters`);
                }
                
                if (rule.maxLength && value.length > rule.maxLength) {
                    errors.push(`${rule.label || fieldName} must be no more than ${rule.maxLength} characters`);
                }
                
                if (rule.pattern && !rule.pattern.test(value)) {
                    errors.push(`${rule.label || fieldName} format is invalid`);
                }
                
                if (rule.min && parseFloat(value) < rule.min) {
                    errors.push(`${rule.label || fieldName} must be at least ${rule.min}`);
                }
                
                if (rule.max && parseFloat(value) > rule.max) {
                    errors.push(`${rule.label || fieldName} must be no more than ${rule.max}`);
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
    static escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    /**
     * Format date for display
     */
    static formatDate(date, format = 'YYYY-MM-DD') {
        // Use Utils.formatDate for consistency, but handle custom format if needed
        if (format === 'YYYY-MM-DD') {
            return Utils.formatDate(date);
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
    static formatTime(date, format = 'HH:mm') {
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