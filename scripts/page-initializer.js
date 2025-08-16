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
import { asyncHandler } from './utils.js';

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
        const detectedPage = pageElement.dataset.page;
        console.log('🔍 Page detected from data-page attribute:', detectedPage);
        return detectedPage;
    }
    
    // Fall back to URL path detection
    const path = window.location.pathname;
    let detectedPage = 'index'; // Default to index/home page
    
    if (path.includes('backlog')) detectedPage = 'backlog';
    else if (path.includes('machinery')) detectedPage = 'machinery';
    else if (path.includes('phases')) detectedPage = 'phases';
    else if (path.includes('machine-settings')) detectedPage = 'machine-settings';
    else if (path.includes('scheduler')) detectedPage = 'scheduler';
    
    console.log('🔍 Page detected from URL path:', detectedPage, '(path:', path, ')');
    return detectedPage;
}

/**
 * Initialize storage service
 */
async function initialize_storage() {
    if (!storageService.initialized) {
        await storageService.init();
    }
}

/**
 * Initialize the application store
 */
async function initialize_store() {
    await appStore.init();
}

/**
 * Initialize navigation
 */
function initialize_nav() {
    if (typeof initialize_navigation === 'function') {
        initialize_navigation();
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
        });
    }
}

/**
 * Initialize a specific component
 */
async function initialize_component(config) {
    const { component_class, global_var_name, type } = config;
    
    // Skip component initialization for pages that don't have components
    if (!component_class) {
        return true; // Return true for pages without components
    }
    
    const component_instance = new component_class();
    
    // Get element map and initialize if the component supports it
    if (typeof component_instance.get_element_map === 'function') {
        const element_map = component_instance.get_element_map();
        if (element_map) {
            const init_success = await component_instance.init(element_map);
            if (init_success) {
                // Make component available globally for debugging if specified
                if (global_var_name) {
                    window[global_var_name] = component_instance;
                }
                return true;
            }
        }
    } else if (typeof component_instance.init === 'function') {
        // Try to initialize without element map
        const init_success = await component_instance.init();
        if (init_success) {
            // Make component available globally for debugging if specified
            if (global_var_name) {
                window[global_var_name] = component_instance;
            }
            return true;
        }
    }
    
    return false;
}

/**
 * Custom initialization for the scheduler page
 */
async function initialize_scheduler() {
    // Check if we're on the scheduler page
    if (!document.getElementById('calendar_container')) {
        return;
    }
    
    // Wait for the Scheduler class to be available
    if (typeof Scheduler !== 'function') {
        throw new Error(`Scheduler is not a constructor. Got: ${typeof Scheduler}`);
    }
    
    // Create new scheduler instance
    const scheduler = new Scheduler();
    
    // Initialize the scheduler now that DOM is ready
    if (scheduler.init()) {
        // Set up refresh button if it exists
        const refreshBtn = document.getElementById('refresh_machines');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', asyncHandler(async () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '⏳';
                await scheduler.refresh_machine_data();
                refreshBtn.textContent = '🔄';
            }, 'refresh machines', { rethrow: false }));
            
            // Ensure button is re-enabled on error
            refreshBtn.addEventListener('error', () => {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄';
            });
        }
    }
}

/**
 * Main page initialization function
 */
async function initialize_page() {
    const page_key = detect_page();
    const config = PAGE_CONFIGS[page_key];
    
    console.log('🔍 Initializing page:', page_key);
    console.log('🔍 Page config:', config);
    
    if (!config) {
        console.error(`❌ No configuration found for page: ${page_key}`);
        return;
    }
    
    // Initialize storage and store first
    await initialize_storage();
    await initialize_store();
    
    // Initialize navigation
    initialize_nav();
    
    // Initialize edit manager for tables if needed
    if (config.requires_edit_manager) {
        console.log('🔍 Initializing edit manager');
        initialize_edit_manager();
    }
    
    // Initialize component if this page has one
    if (config.type === 'component') {
        console.log('🔍 Initializing component:', config.component_class.name);
        await initialize_component(config);
    } else {
        console.log('🔍 No component to initialize for page type:', config.type);
    }
    
    // Run custom initialization if this is a complex page
    if (config.type === 'complex' && config.custom_init) {
        console.log('🔍 Running custom initialization');
        await config.custom_init();
    }
    
    // Initialize scheduler if needed
    await initialize_scheduler();
    
    console.log('✅ Page initialization completed successfully');
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 DOM Content Loaded event fired');
    console.log('🔍 Starting page initialization...');
    initialize_page().catch(error => {
        console.error('❌ Error in DOMContentLoaded handler:', error);
    });
});

// Also try to initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    console.log('🔍 DOM still loading, waiting for DOMContentLoaded event');
} else {
    console.log('🔍 DOM already loaded, initializing immediately');
    initialize_page().catch(error => {
        console.error('❌ Error in immediate initialization:', error);
    });
}

// Export functions for manual initialization if needed
export { initialize_page, detect_page, PAGE_CONFIGS };
