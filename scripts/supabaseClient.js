/**
 * Supabase Client Initialization
 * Handles Supabase client creation and connection management
 */

// Supabase configuration
const SUPABASE_URL = 'https://jyrfznujcyqskpfthrsf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cmZ6bnVqY3lxc2twZnRocnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODM1OTMsImV4cCI6MjA3MDY1OTU5M30.JOZLGHslSQO7wDeFSq7FHAV6_VNtD9DS-gMNUu4rEnM';

let supabase_client = null;
let initialization_promise = null;

function initializeSupabaseClient() {
    return new Promise((resolve, reject) => {
        const maxAttempts = 100; // 10 seconds max wait
        let attempts = 0;
        
        const tryInitialize = () => {
            if (window.supabase) {
                try {
                    supabase_client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                        auth: {
                            persistSession: true,
                            autoRefreshToken: true
                        },
                        realtime: {
                            params: {
                                eventsPerSecond: 10
                            }
                        }
                    });
                    
                    console.log('✅ Supabase client initialized successfully');
                    resolve(supabase_client);
                } catch (error) {
                    console.error('❌ Error creating Supabase client:', error);
                    reject(error);
                }
            } else {
                attempts++;
                if (attempts >= maxAttempts) {
                    const error = new Error('Supabase library not loaded after 10 seconds');
                    console.error('❌', error.message);
                    reject(error);
                    return;
                }
                
                // Wait 100ms before trying again
                setTimeout(tryInitialize, 100);
            }
        };
        
        tryInitialize();
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initialization_promise = initializeSupabaseClient();
});

// Helper function to handle Supabase errors
export function handle_supabase_error(error, context = '') {
    console.error(`Supabase error${context ? ` in ${context}` : ''}:`, error);
    
    // User-friendly error messages
    if (error.code === '23505') {
        return 'This record already exists';
    } else if (error.code === '23503') {
        return 'Cannot perform this operation due to related records';
    } else if (error.code === 'PGRST116') {
        return 'No records found';
    } else if (error.message?.includes('JWT')) {
        return 'Authentication error. Please refresh the page';
    }
    
    return error.message || 'An unexpected error occurred';
}

// Connection status checker
export async function check_supabase_connection() {
    if (!supabase_client) {
        console.error('Supabase client not initialized');
        return false;
    }
    
    try {
        const { data, error } = await supabase_client
            .from('machines')
            .select('count')
            .limit(1);
            
        if (error) {
            console.error('Supabase connection check failed:', error);
            return false;
        }
        
        console.log('✅ Supabase connection successful');
        return true;
    } catch (error) {
        console.error('Supabase connection error:', error);
        return false;
    }
}

// Export the client getter function with waiting capability
export async function get_supabase_client() {
    if (supabase_client) {
        return supabase_client;
    }
    
    // Wait for initialization if it's still in progress
    if (initialization_promise) {
        try {
            await initialization_promise;
            return supabase_client;
        } catch (error) {
            console.error('Failed to wait for Supabase client initialization:', error);
            return null;
        }
    }
    
    return null;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handle_supabase_error,
        check_supabase_connection,
        get_supabase_client
    };
}
