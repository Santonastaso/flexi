/**
 * Base Manager Class - Provides common functionality for all managers
 * Consolidates repeated patterns across BacklogManager, MachineryManager, etc.
 */
class BaseManager {
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
            this.render_data();
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
        const missing_elements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);
            
        if (missing_elements.length > 0) {
            console.error('Missing required elements:', missing_elements);
            return false;
        }
        return true;
    }

    /**
     * Attach event listeners - to be overridden by subclasses
     */
    attach_event_listeners() {
        // Override in subclasses
    }

    /**
     * Render data - to be overridden by subclasses
     */
    render_data() {
        // Override in subclasses
    }

    /**
     * Show banner message
     */
    show_message(message, type = 'info') {
        if (typeof showBanner === 'function') {
            showBanner(message, type);
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
     */
    static initialize_manager(ManagerClass, manager_name) {
        const initialize_manager = () => {
            if (window.storageService) {
                const manager = new ManagerClass();
                window[manager_name] = manager;
                
                // Initialize the manager with its element map
                const elementMap = manager.get_element_map();
                if (elementMap) {
                    const initSuccess = manager.init(elementMap);
                                    if (initSuccess) {
                    // Manager initialized successfully
                } else {
                    console.error(`❌ Failed to initialize ${manager_name}`);
                }
                } else {
                    console.error(`❌ Failed to get element map for ${manager_name}`);
                }
            } else {
                setTimeout(initialize_manager, 50);
            }
        };
        initialize_manager();
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
                if (element.type === 'checkbox' || element.type === 'radio') {
                    element.checked = false;
                } else {
                    element.value = '';
                }
            }
        });
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
        
        // Check if updatedData is valid
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
        

        
        // Test if we can call the method at all
        let validation;
        try {
            validation = this.validate_form(updatedData, validationConfig);

        } catch (error) {
            console.error('Error calling validate_form:', error);
            this.show_error_message('validating data', new Error('Validation method error: ' + error.message));
            return null;
        }
        
        // Check if validation result is valid
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