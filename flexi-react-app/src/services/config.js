/**
 * Application Configuration
 * Simplified configuration for the modern React architecture
 */

export const AppConfig = {
  // Supabase configuration
  SUPABASE: {
    ENABLE_REALTIME: true, // Enable realtime subscriptions for multi-user sync
    LOG_QUERIES: false,      // Disable query logging in production
  },
  
  // Application settings
  APP: {
    DEFAULT_PAGE_SIZE: 50,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    DATE_FORMAT: 'dd/MM/yyyy',
    TIME_FORMAT: 'HH:mm',
    TIMEZONE: 'UTC',
    FIRST_DAY_OF_WEEK: 1, // Monday as first day of week (0=Sunday, 1=Monday)
  },
  
  // Validation rules
  VALIDATION: {
    MIN_MACHINE_NAME_LENGTH: 2,
    MAX_MACHINE_NAME_LENGTH: 100,
    MIN_QUANTITY: 1,
    MAX_QUANTITY: 999999,
    MIN_DIMENSION: 1,
    MAX_DIMENSION: 10000,
  },
  
  // Business rules
  BUSINESS: {
    DEFAULT_SETUP_TIME: 0.5,
    DEFAULT_CHANGEOVER_TIME: 0.25,
    DEFAULT_HOURLY_COST: 50,
    WORK_SHIFTS: {
      T1: { start: 6, end: 14, name: 'Morning Shift' },
      T2: { start: 14, end: 22, name: 'Afternoon Shift' },
      T3: { start: 22, end: 6, name: 'Night Shift' },
    },
  },
  
  // Feature flags
  FEATURES: {
    ENABLE_MACHINE_AVAILABILITY: true,
    ENABLE_ADVANCED_SCHEDULING: true,
    ENABLE_COST_CALCULATIONS: true,
    ENABLE_PHASE_EDITING: true,
  }
};

export default AppConfig;
