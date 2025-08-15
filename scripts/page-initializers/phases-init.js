/**
 * Phases Page Initializer
 * Entry point for the production phases page
 */

import { PhasesManager } from '../phases-manager.js';
import { storageService } from '../storageService.js';
import { editManager } from '../editManager.js';
import { initialize_navigation } from '../../components/navigation.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Initializing Phases Page...');
        
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
        
        // Create and initialize the phases manager
        const phasesManager = new PhasesManager();
        
        // Get the element map and initialize
        const elementMap = phasesManager.get_element_map();
        if (elementMap) {
            const initSuccess = phasesManager.init(elementMap);
            if (initSuccess) {
                console.log('✅ PhasesManager initialized successfully');
            } else {
                console.error('❌ Failed to initialize PhasesManager');
            }
        } else {
            console.error('❌ Failed to get element map for PhasesManager');
        }
        
        // Make manager available globally for debugging (optional)
        window.phasesManager = phasesManager;
        
    } catch (error) {
        console.error('❌ Error initializing Phases Page:', error);
    }
});
