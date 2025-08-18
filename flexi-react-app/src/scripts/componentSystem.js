/**
 * Lightweight Component System
 * 
 * A vanilla JavaScript component system that provides:
 * - Declarative component rendering
 * - Efficient DOM updates
 * - Reusable component templates
 * - Event handling
 * - Data binding
 * 
 * This system eliminates the need for manual DOM manipulation
 * and provides a consistent pattern across the application.
 */

class ComponentSystem {
    constructor() {
        this.components = new Map();
        this.templates = new Map();
        this.eventHandlers = new Map();
    }

    /**
     * Register a component template
     * @param {string} name - Component name
     * @param {Function} template - Template function that returns HTML
     * @param {Object} options - Component options
     */
    registerComponent(name, template, options = {}) {
        this.templates.set(name, {
            template,
            options: {
                autoBind: true,
                preserveState: false,
                ...options
            }
        });
    }

    /**
     * Render a component
     * @param {string} name - Component name
     * @param {Object} data - Data to pass to the component
     * @param {Object} options - Render options
     * @returns {HTMLElement} The rendered component element
     */
    render(name, data = {}, options = {}) {
        const component = this.templates.get(name);
        if (!component) {
            throw new Error(`Component '${name}' not found`);
        }

        const { template, options: componentOptions } = component;
        const mergedOptions = { ...componentOptions, ...options };

        // Generate HTML from template
        const html = template(data, mergedOptions);
        
        // Create DOM element - handle table elements specially
        let element;
        
        // Check if the HTML starts with table elements
        if (html.trim().startsWith('<tr') || html.trim().startsWith('<td') || html.trim().startsWith('<th')) {
            // For table elements, create a temporary table structure
            const tempTable = document.createElement('table');
            tempTable.innerHTML = `<tbody>${html}</tbody>`;
            element = tempTable.querySelector('tbody').firstElementChild;
        } else {
            // For regular elements, use the wrapper approach
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            element = wrapper.firstElementChild || wrapper;
        }

        // Add component metadata
        element.dataset.component = name;
        element.dataset.componentId = this._generateId();

        // Bind events if autoBind is enabled
        if (mergedOptions.autoBind) {
            this._bindEvents(element, data, mergedOptions);
        }

        // Store component instance
        this.components.set(element.dataset.componentId, {
            name,
            element,
            data,
            options: mergedOptions
        });

        return element;
    }

    /**
     * Update an existing component
     * @param {HTMLElement} element - The component element to update
     * @param {Object} newData - New data for the component
     * @param {Object} options - Update options
     */
    update(element, newData = {}, options = {}) {
        const componentId = element.dataset.componentId;
        const component = this.components.get(componentId);
        
        if (!component) {
            throw new Error('Component not found for update');
        }

        const { name, options: componentOptions } = component;
        const mergedOptions = { ...componentOptions, ...options };
        const mergedData = { ...component.data, ...newData };

        // Generate new HTML
        const template = this.templates.get(name).template;
        const newHtml = template(mergedData, mergedOptions);

        // Update the element - handle table elements specially
        if (element.tagName === 'TR' || element.tagName === 'TD' || element.tagName === 'TH') {
            // For table elements, we need to replace the entire element
            const tempTable = document.createElement('table');
            tempTable.innerHTML = `<tbody>${newHtml}</tbody>`;
            const newElement = tempTable.querySelector('tbody').firstElementChild;
            
            // Copy the new element's content and attributes
            element.innerHTML = newElement.innerHTML;
            Array.from(newElement.attributes).forEach(attr => {
                element.setAttribute(attr.name, attr.value);
            });
        } else {
            // For regular elements, use innerHTML
            element.innerHTML = newHtml;
        }

        // Update stored data
        component.data = mergedData;

        // Re-bind events if needed
        if (mergedOptions.autoBind) {
            this._bindEvents(element, mergedData, mergedOptions);
        }
    }

    /**
     * Render multiple components
     * @param {string} name - Component name
     * @param {Array} dataArray - Array of data objects
     * @param {Object} options - Render options
     * @returns {Array} Array of rendered components
     */
    renderMany(name, dataArray = [], options = {}) {
        return dataArray.map(data => this.render(name, data, options));
    }

    /**
     * Replace content in a container with components
     * @param {HTMLElement} container - Container element
     * @param {string} componentName - Component name
     * @param {Array} dataArray - Array of data objects
     * @param {Object} options - Render options
     */
    renderIntoContainer(container, componentName, dataArray = [], options = {}) {
        // Clear container
        container.innerHTML = '';
        
        // Render components
        const components = this.renderMany(componentName, dataArray, options);
        
        // Append to container
        components.forEach(component => {
            container.appendChild(component);
        });

        return components;
    }

    /**
     * Efficiently update a container with new data
     * @param {HTMLElement} container - Container element
     * @param {string} componentName - Component name
     * @param {Array} newDataArray - New data array
     * @param {Object} options - Update options
     */
    updateContainer(container, componentName, newDataArray = [], options = {}) {
        // For table rows and other complex components, always re-render completely
        // This ensures proper updates when data structure changes
        return this.renderIntoContainer(container, componentName, newDataArray, options);
    }

    /**
     * Bind events to a component element
     * @param {HTMLElement} element - The component element
     * @param {Object} data - Component data
     * @param {Object} options - Component options
     */
    _bindEvents(element, data, options) {
        // Find all elements with data-action attributes
        const actionElements = element.querySelectorAll('[data-action]');
        
        actionElements.forEach(actionElement => {
            const action = actionElement.dataset.action;
            const handler = options[`on${action.charAt(0).toUpperCase() + action.slice(1)}`];
            
            if (handler && typeof handler === 'function') {
                // Remove existing event listeners
                actionElement.removeEventListener('click', handler);
                
                // Add new event listener
                actionElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    handler(data, e, element);
                });
            }
        });
    }

    /**
     * Generate unique component ID
     * @returns {string} Unique ID
     */
    _generateId() {
        return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get component instance by element
     * @param {HTMLElement} element - Component element
     * @returns {Object|null} Component instance or null
     */
    getComponent(element) {
        const componentId = element.dataset.componentId;
        return componentId ? this.components.get(componentId) : null;
    }

    /**
     * Destroy a component
     * @param {HTMLElement} element - Component element to destroy
     */
    destroy(element) {
        const componentId = element.dataset.componentId;
        if (componentId) {
            this.components.delete(componentId);
            element.remove();
        }
    }

    /**
     * Clear all components
     */
    clear() {
        this.components.clear();
    }
}

// Create global instance
const componentSystem = new ComponentSystem();

// Export for use in other modules
export { ComponentSystem, componentSystem };
