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
            this.attachEventListeners();
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

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    /**
     * Create action buttons for tables
     */
    createActionButtons(editCallback, deleteCallback, saveCallback = null, cancelCallback = null) {
        const editBtn = `<button class="btn-edit" onclick="${editCallback}">Edit</button>`;
        const deleteBtn = `<button class="btn-delete" onclick="${deleteCallback}">Delete</button>`;
        
        let buttons = `${editBtn} ${deleteBtn}`;
        
        if (saveCallback && cancelCallback) {
            const saveBtn = `<button class="btn-save" onclick="${saveCallback}">Save</button>`;
            const cancelBtn = `<button class="btn-cancel" onclick="${cancelCallback}">Cancel</button>`;
            buttons += ` ${saveBtn} ${cancelBtn}`;
        }
        
        return `<div class="action-buttons">${buttons}</div>`;
    }

    /**
     * Handle table click events with delegation
     */
    handleTableClick(e, tableBody) {
        if (e.target.classList.contains('btn-edit')) {
            const row = e.target.closest('tr');
            if (row) {
                this.handleEdit(row);
            }
        } else if (e.target.classList.contains('btn-delete')) {
            const row = e.target.closest('tr');
            if (row) {
                this.handleDelete(row);
            }
        } else if (e.target.classList.contains('btn-save')) {
            const row = e.target.closest('tr');
            if (row) {
                this.handleSave(row);
            }
        } else if (e.target.classList.contains('btn-cancel')) {
            const row = e.target.closest('tr');
            if (row) {
                this.handleCancel(row);
            }
        }
    }

    /**
     * Handle edit action - to be overridden
     */
    handleEdit(row) {
        // Override in subclasses
    }

    /**
     * Handle delete action - to be overridden
     */
    handleDelete(row) {
        // Override in subclasses
    }

    /**
     * Handle save action - to be overridden
     */
    handleSave(row) {
        // Override in subclasses
    }

    /**
     * Handle cancel action - to be overridden
     */
    handleCancel(row) {
        // Override in subclasses
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