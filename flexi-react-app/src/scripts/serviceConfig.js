/**
 * Service Configuration
 * Configuration for Supabase-only backend
 */

export const ServiceConfig = {
    // Always use Supabase
    STORAGE_MODE: 'supabase',
    
    // Development/Debug options
    LOG_SERVICE_CALLS: false,
    ENABLE_REALTIME: false, // Enable Supabase realtime subscriptions
    
    /**
     * Get the Supabase service
     */
    get_service() {
        return window.supabase_service;
    },
    
    /**
     * Check if a specific feature should use Supabase
     * Always returns true - all features use Supabase
     */
    should_use_supabase(feature) {
        return true;
    }
};