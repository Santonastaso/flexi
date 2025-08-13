/**
 * Base Manager Class - Provides common functionality for all managers
 * Consolidates repeated patterns across BacklogManager, MachineryManager, etc.
 */
class BaseManager {
    constructor(storageService) {
        this.storageService = storageService;
        this.elements = {};
        this.currentEditingId = null;
    }

    /**
     * Initialize the manager with element binding and event listeners
     */
    init(elementMap) {
        if (this.bindElements(elementMap)) {
            this.attachEventListeners(); // idempotent expectation
            this.renderData();
            return true;
        }
        return false;
    }

    /**
     * Bind DOM elements with validation
     */
    bindElements(elementMap) {
        this.elements = elementMap;
        return this.validateElements();
    }

    /**
     * Validate that all required elements exist
     */
    validateElements() {
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);
            
        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            return false;
        }
        return true;
    }

    /**
     * Attach event listeners - to be overridden by subclasses
     */
    attachEventListeners() {
        // Override in subclasses
    }

    /**
     * Render data - to be overridden by subclasses
     */
    renderData() {
        // Override in subclasses
    }

    /**
     * Show banner message
     */
    showMessage(message, type = 'info') {
        if (typeof showBanner === 'function') {
            showBanner(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Common success message for CRUD operations
     */
    showSuccessMessage(operation, itemName = '') {
        const message = itemName ? 
            `${operation} "${itemName}" completed successfully!` : 
            `${operation} completed successfully!`;
        this.showMessage(message, 'success');
    }

    /**
     * Common error message for CRUD operations
     */
    showErrorMessage(operation, error) {
        const message = `Error ${operation}: ${error.message}`;
        this.showMessage(message, 'error');
    }

    /**
     * Common CRUD operation wrapper with error handling
     */
    async executeCRUDOperation(operation, operationFn, successMessage, itemName = '') {
        try {
            const result = await operationFn();
            this.showSuccessMessage(successMessage, itemName);
            return result;
        } catch (error) {
            this.showErrorMessage(successMessage.toLowerCase(), error);
            throw error;
        }
    }

    /**
     * Common initialization pattern for managers
     */
    static initializeManager(ManagerClass, managerName) {
        const initializeManager = () => {
            if (window.storageService) {
                window[managerName] = new ManagerClass();
            } else {
                setTimeout(initializeManager, 50);
            }
        };
        initializeManager();
    }

    /**
     * Common storage service validation
     */
    validateStorageService() {
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
    clearForm(fields) {
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
    clearFormFields() {
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

    // Note: Action buttons are provided by EditManager.createActionButtons()

    // Note: table click/edit handling is provided by EditManager

    /**
     * Consolidated validation for forms with required fields, numeric validation, and relationships
     */
    validateForm(data, config) {
        const errors = [];
        
        // Debug logging
        console.log('validateForm called with:', { data, config });
        
        // Required fields validation
        if (config.requiredFields) {
            try {
                console.log('About to call Utils.validateRequiredFields with:', {
                    data,
                    requiredFields: config.requiredFields,
                    fieldLabels: config.fieldLabels || {}
                });
                const requiredValidation = Utils.validateRequiredFields(
                    data, 
                    config.requiredFields, 
                    config.fieldLabels || {}
                );
                console.log('Required validation result:', requiredValidation);
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
                console.log('About to call Utils.validateNumericFields with:', {
                    data,
                    numericFields: config.numericFields,
                    fieldLabels: config.fieldLabels || {}
                });
                const numericValidation = Utils.validateNumericFields(
                    config.numericFields, 
                    data, 
                    config.fieldLabels || {}
                );
                console.log('Numeric validation result:', numericValidation);
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
                const relationshipValidation = Utils.validateFieldRelationship(
                    rel.field1, data[rel.field1],
                    rel.field2, data[rel.field2], 
                    rel.field1Label, rel.field2Label
                );
                if (!relationshipValidation.isValid) {
                    errors.push(relationshipValidation.message);
                }
            });
        }
        
        console.log('validateForm returning:', { isValid: errors.length === 0, errors: errors });
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Standard edit row validation and error handling
     */
    validateEditRow(row, requiredFields, numericFields, fieldLabels = {}) {
        const updatedData = this.editManager.collectEditedValues(row);
        console.log('collectEditedValues returned:', updatedData);
        
        // Check if updatedData is valid
        if (!updatedData || typeof updatedData !== 'object') {
            console.error('Invalid updatedData:', updatedData);
            this.showErrorMessage('validating data', new Error('Failed to collect edited values'));
            return null;
        }
        
        const validationConfig = {
            requiredFields: requiredFields,
            numericFields: numericFields,
            fieldLabels: fieldLabels
        };
        
        console.log('About to call this.validateForm with:', { updatedData, validationConfig });
        console.log('this.validateForm exists:', typeof this.validateForm);
        console.log('this.validateForm is function:', typeof this.validateForm === 'function');
        
        // Test if we can call the method at all
        let validation;
        try {
            validation = this.validateForm(updatedData, validationConfig);
            console.log('validateForm call completed, result:', validation);
        } catch (error) {
            console.error('Error calling validateForm:', error);
            this.showErrorMessage('validating data', new Error('Validation method error: ' + error.message));
            return null;
        }
        
        // Check if validation result is valid
        if (!validation || typeof validation !== 'object' || validation.isValid === undefined) {
            console.error('Invalid validation result:', validation);
            this.showErrorMessage('validating data', new Error('Validation failed'));
            return null;
        }
        
        if (!validation.isValid) {
            this.showErrorMessage('validating data', new Error(validation.errors.join(', ')));
            return null;
        }
        
        return updatedData;
    }

    /**
     * Element binding helper with error handling
     */
    bindElementsById(elementIds) {
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