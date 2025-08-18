/**
 * Base Manager Class - Provides common functionality for all managers
 * Consolidates repeated patterns across BacklogManager, MachineryManager, etc.
 */
import { Utils } from './utils.js';

export class BaseManager {
    constructor(storage_service) {
        this.storage_service = storage_service;
        this.elements = {};
        this.current_editing_id = null;
    }

    /**
     * Initialize the manager with element binding and event listeners
     */
    init(element_map) {
        if (this.bind_elements(element_map)) {
            this.attach_event_listeners(); // idempotent expectation
            return true;
        }
        return false;
    }

    /**
     * Bind DOM elements with validation
     */
    bind_elements(element_map) {
        this.elements = element_map;
        return this.validate_elements();
    }

    /**
     * Validate that all required elements exist
     */
    validate_elements() {
        const missing_keys = Object.keys(this.elements).filter(key => !this.elements[key]);

        if (missing_keys.length > 0) {
            console.error('Missing required elements:', missing_keys);
            return false;
        }
        return true;
    }

    /**
     * Helper method to get DOM elements by ID with error logging
     * @param {string[]} elementIds - Array of element IDs to retrieve
     * @returns {Object} Map of {id: element} pairs
     */
    get_elements_by_id(elementIds) {
        const elementMap = {};
        const missingElements = [];

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                elementMap[id] = element;
            } else {
                missingElements.push(id);
                elementMap[id] = null;
            }
        });

        // Log errors for missing elements
        if (missingElements.length > 0) {
            console.error(`Missing DOM elements with IDs: ${missingElements.join(', ')}`);
        }

        return elementMap;
    }

    /**
     * Attach event listeners - to be overridden by subclasses
     */
    attach_event_listeners() {
        // Override in subclasses
    }

    /**
     * Show banner message
     */
    show_message(message, type = 'info') {
        if (typeof show_banner === 'function') {
            show_banner(message, type);
        }
    }

    /**
     * Common success message for CRUD operations
     */
    show_success_message(operation, item_name = '') {
        const message = item_name ?
            `${operation} "${item_name}" completed successfully!` :
            `${operation} completed successfully!`;
        this.show_message(message, 'success');
    }

    /**
     * Common error message for CRUD operations
     */
    show_error_message(operation, error) {
        const message = `Error ${operation}: ${error.message}`;
        this.show_message(message, 'error');
    }

    /**
     * Common CRUD operation wrapper with error handling
     */
    async execute_crud_operation(operation, operation_fn, success_message, item_name = '') {
        try {
            const result = await operation_fn();
            this.show_success_message(success_message, item_name);
            return result;
        } catch (error) {
            this.show_error_message(success_message.toLowerCase(), error);
            throw error;
        }
    }

    /**
     * Common initialization pattern for managers
     * @deprecated Use ES6 module imports instead
     */
    static initialize_manager(ManagerClass, manager_name) {
        console.warn('BaseManager.initialize_manager is deprecated. Use ES6 module imports instead.');
    }

    /**
     * Common storage service validation
     */
    validate_storage_service() {
        if (!this.storageService) {
            console.error('StorageService not available');
            return false;
        }
        return true;
    }

    /**
     * Validate required form fields
     */
    validateRequiredFields(fields) {
        const errors = [];

        fields.forEach(field => {
            const element = this.elements[field];
            if (!element || !element.value.trim()) {
                errors.push(`${field} is required`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Clear form fields
     */
    clear_form(fields) {
        fields.forEach(field => {
            const element = this.elements[field];
            if (element) {
                element.value = '';
            }
        });
    }

    /**
     * Clear all form input fields automatically
     */
    clear_form_fields() {
        Object.values(this.elements).forEach(element => {
            if (element && (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA')) {
                (element.type === 'checkbox' || element.type === 'radio') ? element.checked = false: element.value = '';
            }
        });
        
        // Call custom clear logic if it exists
        if (typeof this.custom_clear_form === 'function') {
            this.custom_clear_form();
        }
    }

    // Note: Action buttons are provided by EditManager.create_action_buttons()

    // Note: table click/edit handling is provided by EditManager

    /**
     * Consolidated validation for forms with required fields, numeric validation, and relationships
     */
    validate_form(data, config) {
        const errors = [];

        // Required fields validation
        if (config.required_fields) {
            try {
                const requiredValidation = Utils.validate_required_fields(
                    data,
                    config.required_fields,
                    config.field_labels || {}
                );
                if (!requiredValidation.isValid) {
                    errors.push(...requiredValidation.errors);
                }
            } catch (error) {
                console.error('Error in required validation:', error);
                errors.push('Required validation failed: ' + error.message);
            }
        }

        // Numeric fields validation  
        if (config.numericFields) {
            try {
                const numericValidation = Utils.validate_numeric_fields(
                    config.numericFields,
                    data,
                    config.field_labels || {}
                );
                if (!numericValidation.isValid) {
                    errors.push(...numericValidation.errors);
                }
            } catch (error) {
                console.error('Error in numeric validation:', error);
                errors.push('Numeric validation failed: ' + error.message);
            }
        }

        // Field relationship validation
        if (config.relationships) {
            config.relationships.forEach(rel => {
                const relationshipValidation = Utils.validate_field_relationship(
                    rel.field1, data[rel.field1],
                    rel.field2, data[rel.field2],
                    rel.field1_label, rel.field2_label
                );
                if (!relationshipValidation.isValid) {
                    errors.push(relationshipValidation.message);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Standard edit row validation and error handling
     */
    validate_edit_row(row, required_fields, numericFields, field_labels = {}) {
        const updatedData = this.editManager.collect_edited_values(row);

        if (!updatedData || typeof updatedData !== 'object') {
            console.error('Invalid updatedData:', updatedData);
            this.show_error_message('validating data', new Error('Failed to collect edited values'));
            return null;
        }

        const validationConfig = {
            required_fields: required_fields,
            numericFields: numericFields,
            field_labels: field_labels
        };

        let validation;
        try {
            validation = this.validate_form(updatedData, validationConfig);
        } catch (error) {
            console.error('Error calling validate_form:', error);
            this.show_error_message('validating data', new Error('Validation method error: ' + error.message));
            return null;
        }

        if (!validation || typeof validation !== 'object' || validation.isValid === undefined) {
            console.error('Invalid validation result:', validation);
            this.show_error_message('validating data', new Error('Validation failed'));
            return null;
        }

        if (!validation.isValid) {
            this.show_error_message('validating data', new Error(validation.errors.join(', ')));
            return null;
        }

        return updatedData;
    }

    /**
     * Element binding helper with error handling
     */
    bind_elementsById(elementIds) {
        const elements = {};
        const missing = [];

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                elements[id] = element;
            } else {
                missing.push(id);
            }
        });

        if (missing.length > 0) {
            console.error('Missing elements:', missing);
            return null;
        }

        return elements;
    }

    /**
     * Validate form and update button state - lean validation approach
     * Only responsibility is to enable/disable the action button
     */
    validate_form_with_button_state(validation, actionButton) {
        if (!actionButton) {
            console.warn('No action button provided for validation');
            return false;
        }
        
        const isValid = validation && validation.isValid === true;
        actionButton.disabled = !isValid;
        
        return isValid;
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Remove event listeners
        // Clear intervals/timeouts
        // Clean up references
        this.elements = {};
        this.currentEditingId = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseManager;
}