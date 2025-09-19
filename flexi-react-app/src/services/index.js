/**
 * Services Index
 * Centralized export for all application services
 */

// Export Supabase client and utilities
export { supabase, handleSupabaseError, checkSupabaseConnection } from './supabase/client';

// Export configuration
export { AppConfig } from './config';

// Export API service
export { apiService } from './api';

// Re-export for convenience
export * from './supabase/client';
export * from './config';
