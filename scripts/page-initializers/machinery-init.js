/**
 * Machinery Page Initializer
 * Entry point for the machinery management page
 */

import { MachineryManager } from '../machinery-manager.js';
import { storageService } from '../storageService.js';
import { editManager } from '../editManager.js';
import { initialize_navigation } from '../../components/navigation.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Initializing Machinery Page...');
        
        // Wait for storage service to be ready
        if (!storageService.initialized) {
            await storageService.init();
            console.log('✅ StorageService initialized');
        }
        
        // Initialize navigation
        if (typeof initialize_navigation === 'function') {
            initialize_navigation();
            console.log('✅ Navigation initialized');
        }
        
        // Create and initialize the machinery manager
        const machineryManager = new MachineryManager();
        
        // Get the element map and initialize
        const elementMap = machineryManager.get_element_map();
        if (elementMap) {
            const initSuccess = await machineryManager.init(elementMap);
            if (initSuccess) {
                console.log('✅ MachineryManager initialized successfully');
            } else {
                console.error('❌ Failed to initialize MachineryManager');
            }
        } else {
            console.error('❌ Failed to get element map for MachineryManager');
        }
        
        // Make manager available globally for debugging (optional)
        window.machineryManager = machineryManager;
        
    } catch (error) {
        console.error('❌ Error initializing Machinery Page:', error);
    }
});
