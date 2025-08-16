/**
 * Universal Page Initializer
 * Single file that handles initialization for all pages based on configuration
 * Eliminates the need for individual page initializer files
 */

import { storageService } from './storageService.js';
import { appStore } from './store.js'; // Import the store
import { editManager } from './editManager.js';
import { initialize_navigation } from '../components/navigation.js';
import { BacklogManager } from './backlog-manager.js';
import { MachineryManager } from './machinery-manager.js';
import { PhasesManager } from './phases-manager.js';
import { BusinessLogicService } from './businessLogicService.js';
import { Scheduler } from './scheduler.js';
import { MachineCalendarManager } from './machineCalendarManager.js';

// Page configuration - defines how each page should be initialized
const PAGE_CONFIGS = {
    'index': {
        name: 'Home Page',
        type: 'simple',
        requires_edit_manager: false
    },
    'backlog': {
        name: 'Backlog Page',
        type: 'component',
        component_class: BacklogManager,
        global_var_name: 'backlogManager'
    },
    'machinery': {
        name: 'Machinery Page',
        type: 'component',
        component_class: MachineryManager,
        global_var_name: 'machineryManager'
    },
    'phases': {
        name: 'Phases Page',
        type: 'component',
        component_class: PhasesManager,
        global_var_name: 'phasesManager'
    },
    'machine-settings': {
        name: 'Machine Settings Page',
        type: 'component',
        component_class: MachineCalendarManager,
        global_var_name: 'machineCalendarManager',
        requires_edit_manager: true
    },
    'scheduler': {
        name: 'Scheduler Page',
        type: 'complex',
        requires_edit_manager: true,
        custom_init: initialize_scheduler
    }
};

/**
 * Detect which page we're on based on URL or data attribute
 */
function detect_page() {
    // Try to get page from data attribute first
    const pageElement = document.querySelector('[data-page]');
    if (pageElement) {
        return pageElement.dataset.page;
    }
    
    // Fall back to URL path detection
    const path = window.location.pathname;
    if (path.includes('backlog')) return 'backlog';
    if (path.includes('machinery')) return 'machinery';
    if (path.includes('phases')) return 'phases';
    if (path.includes('machine-settings')) return 'machine-settings';
    if (path.includes('scheduler')) return 'scheduler';
    
    // Default to index/home page
    return 'index';
}

/**
 * Initialize storage service
 */
async function initialize_storage() {
    if (!storageService.initialized) {
        await storageService.init();
        console.log('✅ StorageService initialized');
    }
}

/**
 * Initialize the central data store
 */
async function initialize_store() {
    await appStore.init();
    console.log('✅ AppStore initialized');
}

/**
 * Initialize navigation
 */
function initialize_nav() {
    if (typeof initialize_navigation === 'function') {
        initialize_navigation();
        console.log('✅ Navigation initialized');
    }
}

/**
 * Initialize edit manager for tables
 */
function initialize_edit_manager() {
    if (editManager) {
        const tables = document.querySelectorAll('.modern-table');
        tables.forEach(table => {
            editManager.init_table_edit(table);
            console.log('✅ Edit functionality initialized for table');
        });
    }
}

/**
 * Initialize a component manager
 */
async function initialize_component(config) {
    const { component_class, global_var_name } = config;
    
    if (!component_class) {
        console.error('❌ No component class specified');
        return false;
    }
    
    try {
        const component_instance = new component_class();
        
        // Get element map and initialize if the component supports it
        if (typeof component_instance.get_element_map === 'function') {
            const element_map = component_instance.get_element_map();
            if (element_map) {
                const init_success = await component_instance.init(element_map);
                if (init_success) {
                    console.log(`✅ ${component_class.name} initialized successfully`);
                } else {
                    console.error(`❌ Failed to initialize ${component_class.name}`);
                    return false;
                }
            } else {
                console.error(`❌ Failed to get element map for ${component_class.name}`);
                return false;
            }
        } else if (typeof component_instance.init === 'function') {
            // Try to initialize without element map
            const init_success = await component_instance.init();
            if (init_success) {
                console.log(`✅ ${component_class.name} initialized successfully`);
            } else {
                console.error(`❌ Failed to initialize ${component_class.name}`);
                return false;
            }
        }
        
        // Make component available globally for debugging if specified
        if (global_var_name) {
            window[global_var_name] = component_instance;
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Error initializing ${component_class.name}:`, error);
        return false;
    }
}

/**
 * Custom initialization for the scheduler page
 */
async function initialize_scheduler() {
    try {
        // Check if we're on the scheduler page
        if (!document.getElementById('calendar_container')) {
            console.log('⚠️ Not on scheduler page, skipping scheduler initialization');
            return;
        }
        
        // Debug: Check if Scheduler class is available
        if (typeof Scheduler !== 'function') {
            throw new Error(`Scheduler is not a constructor. Got: ${typeof Scheduler}`);
        }
        
        // Create new scheduler instance
        const scheduler = new Scheduler();
        
        // Initialize the scheduler now that DOM is ready
        if (scheduler.init()) {
            console.log('✅ Scheduler initialized successfully');
            
            // Add refresh machines button event listener
            const refreshBtn = document.getElementById('refresh_machines_btn');
            if (refreshBtn && scheduler.refresh_machine_data) {
                refreshBtn.addEventListener('click', async () => {
                    try {
                        refreshBtn.disabled = true;
                        refreshBtn.textContent = '⏳';
                        await scheduler.refresh_machine_data();
                        refreshBtn.textContent = '🔄';
                    } catch (error) {
                        console.error('Error refreshing machines:', error);
                        refreshBtn.textContent = '🔄';
                    } finally {
                        refreshBtn.disabled = false;
                    }
                });
                console.log('✅ Refresh machines button initialized');
            }
        } else {
            console.error('❌ Scheduler initialization failed');
        }
        
    } catch (error) {
        console.error('❌ Error initializing scheduler:', error);
        console.error('❌ Error details:', error.stack);
    }
}

/**
 * Main initialization function
 */
async function initialize_page() {
    try {
        const page_key = detect_page();
        const config = PAGE_CONFIGS[page_key];
        
        if (!config) {
            console.error(`❌ No configuration found for page: ${page_key}`);
            return;
        }
        
        console.log(`🚀 Initializing ${config.name}...`);
        
        // Initialize core services IN THE CORRECT ORDER
        await initialize_storage();
        await initialize_store();
        initialize_nav();
        
        // Initialize edit manager if required
        if (config.requires_edit_manager) {
            initialize_edit_manager();
        }
        
        // Initialize component if this is a component page
        if (config.type === 'component') {
            await initialize_component(config);
        }
        
        // Run custom initialization if this is a complex page
        if (config.type === 'complex' && config.custom_init) {
            await config.custom_init();
        }
        
        console.log(`✅ ${config.name} initialized successfully`);
        
    } catch (error) {
        console.error('❌ Error during page initialization:', error);
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize_page);

// Export functions for manual initialization if needed
export { initialize_page, detect_page, PAGE_CONFIGS };