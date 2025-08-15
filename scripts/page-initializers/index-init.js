/**
 * Index/Home Page Initializer
 * Entry point for the main application home page
 */

import { storageService } from '../storageService.js';
import { initialize_navigation } from '../../components/navigation.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Initializing Home Page...');
        
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
        
        console.log('✅ Home Page initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing Home Page:', error);
    }
});
