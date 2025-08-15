/**
 * Backlog Page Initializer
 * Entry point for the production backlog page
 */

import { BacklogManager } from '../backlog-manager.js';
import { storageService } from '../storageService.js';
import { editManager } from '../editManager.js';
import { initialize_navigation } from '../../components/navigation.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Initializing Backlog Page...');
        
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
        
        // Create and initialize the backlog manager
        const backlogManager = new BacklogManager();
        
        // Get the element map and initialize
        const elementMap = backlogManager.get_element_map();
        if (elementMap) {
            const initSuccess = backlogManager.init(elementMap);
            if (initSuccess) {
                console.log('✅ BacklogManager initialized successfully');
            } else {
                console.error('❌ Failed to initialize BacklogManager');
            }
        } else {
            console.error('❌ Failed to get element map for BacklogManager');
        }
        
        // Make manager available globally for debugging (optional)
        window.backlogManager = backlogManager;
        
    } catch (error) {
        console.error('❌ Error initializing Backlog Page:', error);
    }
});
