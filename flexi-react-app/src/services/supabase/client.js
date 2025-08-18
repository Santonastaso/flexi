import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://jyrfznujcyqskpfthrsf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cmZ6bnVqY3lxc2twZnRocnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODM1OTMsImV4cCI6MjA3MDY1OTU5M30.JOZLGHslSQO7wDeFSq7FHAV6_VNtD9DS-gMNUu4rEnM';

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
export const handleSupabaseError = (error, context = '') => {
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
};

/**
 * Check if Supabase connection is working
 */
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('machines')
      .select('count')
      .limit(1);
      
    if (error) {
      console.error('Supabase connection check failed:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
};

export default supabase;
