/**
 * Scheduler Page Initializer
 * Entry point for the production scheduler page
 */

import { storageService } from '../storageService.js';
import { editManager } from '../editManager.js';
import { initialize_navigation } from '../../components/navigation.js';
import { BusinessLogicService } from '../businessLogicService.js';
import { Scheduler } from '../scheduler.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Initializing Scheduler Page...');
        
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
        
        // Initialize the scheduler
        await initialize_scheduler();
        
        console.log('✅ Scheduler Page core services initialized');
        
    } catch (error) {
        console.error('❌ Error initializing Scheduler Page:', error);
    }
});

/**
 * Initialize the scheduler functionality
 */
async function initialize_scheduler() {
    try {
        // Check if we're on the scheduler page
        if (!document.getElementById('calendar_container')) {
            console.log('⚠️ Not on scheduler page, skipping scheduler initialization');
            return;
        }
        
        // Make storage service available globally for the scheduler
        window.storageService = storageService;
        
        // Make BusinessLogicService available globally
        window.BusinessLogicService = BusinessLogicService;
        
        // Debug: Check if we have data
        console.log('🔍 Checking available data for scheduler...');
        try {
            const machines = await storageService.get_machines();
            console.log(`📊 Found ${machines.length} machines:`, machines);
            
            const odpOrders = await storageService.get_odp_orders();
            console.log(`📋 Found ${odpOrders.length} ODP orders:`, odpOrders);
            
            // In the consolidated approach, scheduled events come from ODP orders
            const scheduledOdps = odpOrders.filter(order => order.scheduled_machine);
            console.log(`📅 Found ${scheduledOdps.length} scheduled ODP orders:`, scheduledOdps);
        } catch (error) {
            console.error('❌ Error checking data:', error);
        }
        
        // Debug: Check if Scheduler class is available
        console.log('🔍 Scheduler class:', Scheduler);
        console.log('🔍 Scheduler constructor:', typeof Scheduler);
        
        if (typeof Scheduler !== 'function') {
            throw new Error(`Scheduler is not a constructor. Got: ${typeof Scheduler}`);
        }
        
        // Debug: Check if required DOM elements exist
        console.log('🔍 Checking required DOM elements...');
        const requiredElements = ['task_pool', 'calendar_container', 'current_date', 'today_btn', 'prev_day', 'next_day', 'message_container'];
        requiredElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            console.log(`🔍 ${elementId}:`, element ? '✅ Found' : '❌ Missing');
        });
        
        // Force clean initialization - remove any existing incomplete scheduler
        if (window.scheduler) {
            delete window.scheduler;
        }
        
        // Create new scheduler instance with proper services
        window.scheduler = new Scheduler(storageService, BusinessLogicService);
        
        // Initialize the scheduler now that DOM is ready
        if (window.scheduler.init()) {
            console.log('✅ Scheduler initialized successfully');
        } else {
            console.error('❌ Scheduler initialization failed');
        }
        
    } catch (error) {
        console.error('❌ Error initializing scheduler:', error);
        console.error('❌ Error details:', error.stack);
    }
}
