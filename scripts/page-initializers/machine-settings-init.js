/**
 * Machine Settings Page Initializer
 * Entry point for the machine availability settings page
 */

import { storageService } from '../storageService.js';
import { editManager } from '../editManager.js';
import { initialize_navigation } from '../../components/navigation.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Initializing Machine Settings Page...');
        
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
        
        // Initialize edit manager for any tables on the page
        if (editManager) {
            const tables = document.querySelectorAll('.modern-table');
            tables.forEach(table => {
                editManager.init_table_edit(table);
                console.log('✅ Edit functionality initialized for table');
            });
        }
        
        // Note: Machine calendar functionality will be handled by the machineCalendarManager.js module
        // This initializer ensures the core services are ready
        
        console.log('✅ Machine Settings Page core services initialized');
        
    } catch (error) {
        console.error('❌ Error initializing Machine Settings Page:', error);
    }
});
