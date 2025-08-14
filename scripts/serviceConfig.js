/**
 * Service Configuration
 * Controls which storage backend to use (localStorage or Supabase)
 * Allows gradual migration and testing
 */

const ServiceConfig = {
    // Master switch - set to 'supabase' to use Supabase only
    STORAGE_MODE: 'supabase',
    
    // All features use Supabase
    USE_SUPABASE: {
        machines: true,
        phases: true,
        odp_orders: true,
        scheduled_events: true,
        machine_availability: true
    },
    
    // Development/Debug options
    LOG_SERVICE_CALLS: false,
    ENABLE_DUAL_WRITE: false, // Disabled - no localStorage fallback
    ENABLE_REALTIME: false, // Enable Supabase realtime subscriptions
    
    /**
     * Get the appropriate service based on configuration
     */
    get_service() {
        // Always return Supabase service
        return window.supabaseService;
    },
    
    /**
     * Check if a specific feature should use Supabase
     */
    should_use_supabase(feature) {
        // Always return true - all features use Supabase
        return true;
    },
    
    /**
     * Enable Supabase for all features
     */
    enable_supabase_all() {
        this.STORAGE_MODE = 'supabase';
        Object.keys(this.USE_SUPABASE).forEach(key => {
            this.USE_SUPABASE[key] = true;
        });

    },
    
    /**
     * Enable Supabase for specific feature
     */
    enable_supabase_feature(feature) {
        if (this.USE_SUPABASE.hasOwnProperty(feature)) {
            this.USE_SUPABASE[feature] = true;

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

    }
};

// Make available globally
window.ServiceConfig = ServiceConfig;
