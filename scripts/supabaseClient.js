/**
 * Supabase Client Configuration
 * Handles connection to Supabase backend
 */

// Supabase configuration
const SUPABASE_URL = 'https://jyrfznujcyqskpfthrsf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cmZ6bnVqY3lxc2twZnRocnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODM1OTMsImV4cCI6MjA3MDY1OTU5M30.JOZLGHslSQO7wDeFSq7FHAV6_VNtD9DS-gMNUu4rEnM';

// Create Supabase client
let supabaseClient = null;

function initializeSupabaseClient() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
        
        // Make client globally available after creation
        window.supabaseClient = supabaseClient;
        
        console.log('Supabase client initialized successfully');
    } else {
        console.error('Supabase library not loaded yet');
    }
}

// Initialize only once when DOM is ready
document.addEventListener('DOMContentLoaded', initializeSupabaseClient);

// Helper function to handle Supabase errors
function handle_supabase_error(error, context = '') {
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
async function check_supabase_connection() {
    if (!supabaseClient) {
        console.error('Supabase client not initialized');
        return false;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('machines')
            .select('count')
            .limit(1);
            
        if (error) {
            console.error('Supabase connection check failed:', error);
            return false;
        }
        
        console.log('Supabase connection successful');
        return true;
    } catch (error) {
        console.error('Supabase connection error:', error);
        return false;
    }
}

// Export helper functions for use in other modules
window.handle_supabase_error = handle_supabase_error;
window.check_supabase_connection = check_supabase_connection;
// Note: window.supabaseClient is set in initializeSupabaseClient() after client creation

// NOTE: To fix RLS (Row Level Security) issues, run these SQL commands in your Supabase SQL editor:
// 
// -- Option 1: Disable RLS entirely (simplest for development)
// ALTER TABLE machines DISABLE ROW LEVEL SECURITY;
// ALTER TABLE phases DISABLE ROW LEVEL SECURITY;
// ALTER TABLE odp_orders DISABLE ROW LEVEL SECURITY;
// ALTER TABLE scheduled_events DISABLE ROW LEVEL SECURITY;
// ALTER TABLE machine_availability DISABLE ROW LEVEL SECURITY;
//
// -- Option 2: Create permissive policies (more secure)
// DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON machines;
// CREATE POLICY "Enable all operations for anon users" ON machines FOR ALL USING (true);
//
// DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON phases;
// CREATE POLICY "Enable all operations for anon users" ON phases FOR ALL USING (true);
//
// DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON odp_orders;
// CREATE POLICY "Enable all operations for anon users" ON odp_orders FOR ALL USING (true);
//
// DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON scheduled_events;
// CREATE POLICY "Enable all operations for anon users" ON scheduled_events FOR ALL USING (true);
//
// DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON machine_availability;
// CREATE POLICY "Enable all operations for anon users" ON machine_availability FOR ALL USING (true);
