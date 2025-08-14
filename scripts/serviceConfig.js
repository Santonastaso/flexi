/**
 * Service Configuration
 * Controls which storage backend to use (localStorage or Supabase)
 * Allows gradual migration and testing
 */

const ServiceConfig = {
    // Master switch - set to 'supabase' to use Supabase, 'local' for localStorage
    STORAGE_MODE: 'supabase', // Changed to 'supabase' for backend operations
    
    // Feature flags for gradual migration
    USE_SUPABASE: {
        machines: true,
        phases: true,
        odp_orders: true,
        scheduled_events: true,
        machine_availability: true
    },
    
    // Development/Debug options
    LOG_SERVICE_CALLS: false,
    ENABLE_DUAL_WRITE: false, // Write to both localStorage and Supabase
    ENABLE_REALTIME: false, // Enable Supabase realtime subscriptions
    
    /**
     * Get the appropriate service based on configuration
     */
    get_service() {
        if (this.STORAGE_MODE === 'supabase') {
            return window.supabaseService;
        }
        return window.storageService;
    },
    
    /**
     * Check if a specific feature should use Supabase
     */
    should_use_supabase(feature) {
        if (this.STORAGE_MODE === 'supabase') {
            return true;
        }
        return this.USE_SUPABASE[feature] || false;
    },
    
    /**
     * Enable Supabase for all features
     */
    enable_supabase_all() {
        this.STORAGE_MODE = 'supabase';
        Object.keys(this.USE_SUPABASE).forEach(key => {
            this.USE_SUPABASE[key] = true;
        });
        console.log('Supabase enabled for all features');
    },
    
    /**
     * Enable Supabase for specific feature
     */
    enable_supabase_feature(feature) {
        if (this.USE_SUPABASE.hasOwnProperty(feature)) {
            this.USE_SUPABASE[feature] = true;
            console.log(`Supabase enabled for ${feature}`);
        } else {
            console.error(`Unknown feature: ${feature}`);
        }
    },
    
    /**
     * Disable Supabase (revert to localStorage)
     */
    disable_supabase() {
        this.STORAGE_MODE = 'local';
        Object.keys(this.USE_SUPABASE).forEach(key => {
            this.USE_SUPABASE[key] = false;
        });
        console.log('Reverted to localStorage');
    }
};

// Make available globally
window.ServiceConfig = ServiceConfig;
