import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment with safe fallbacks for dev
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jyrfznujcyqskpfthrsf.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cmZ6bnVqY3lxc2twZnRocnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODM1OTMsImV4cCI6MjA3MDY1OTU5M30.JOZLGHslSQO7wDeFSq7FHAV6_VNtD9DS-gMNUu4rEnM';

// Create and export the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

/**
 * Handle Supabase errors with user-friendly messages
 */
export const handleSupabaseError = (error, _context = '') => {
  
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
};

/**
 * Check if Supabase connection is working
 */
export const checkSupabaseConnection = async () => {
  try {
    const { error } = await supabase
      .from('machines')
      .select('count')
      .limit(1);
      
    if (error) {
      return false;
    }
    
    return true;
  } catch (_error) {
    return false;
  }
};

export default supabase;
