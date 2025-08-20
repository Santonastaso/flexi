/**
 * Centralized Error Handling Utilities
 * Provides consistent error handling across the application
 */

export class AppError extends Error {
  constructor(message, code = 'GENERIC_ERROR', statusCode = 500, originalError = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    this.id = this.generateErrorId();
  }

  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      id: this.id,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// Common error types
export const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR'
};

/**
 * Handle API errors consistently
 */
export const handleApiError = (error, context = '') => {
  console.error(`API Error in ${context}:`, error);

  // Handle Supabase errors
  if (error?.code) {
    switch (error.code) {
      case '23505': // Unique constraint violation
        return new AppError('This record already exists', ERROR_TYPES.VALIDATION_ERROR, 409, error);
      case '23503': // Foreign key constraint violation
        return new AppError('Cannot delete this record as it is referenced by other data', ERROR_TYPES.VALIDATION_ERROR, 400, error);
      case 'PGRST116': // No rows found
        return new AppError('Record not found', ERROR_TYPES.NOT_FOUND_ERROR, 404, error);
      case 'PGRST301': // JWT expired
        return new AppError('Session expired. Please log in again.', ERROR_TYPES.AUTHENTICATION_ERROR, 401, error);
      default:
        return new AppError(error.message || 'An unexpected error occurred', ERROR_TYPES.SERVER_ERROR, 500, error);
    }
  }

  // Handle network errors
  if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
    return new AppError('Network error. Please check your connection and try again.', ERROR_TYPES.NETWORK_ERROR, 0, error);
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return new AppError(error.message, ERROR_TYPES.VALIDATION_ERROR, 400, error);
  }

  // Default error handling
  return new AppError(
    error.message || 'An unexpected error occurred',
    ERROR_TYPES.CLIENT_ERROR,
    error.status || 500,
    error
  );
};

/**
 * Log errors for monitoring and debugging
 */
export const logError = (error, context = '') => {
  const errorInfo = {
    id: error.id || `ERR_${Date.now()}`,
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    context,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    stack: error.stack
  };

  // Log to console in development
  if (import.meta.env.MODE === 'development') {
    console.group(`🚨 Error: ${context}`);
    console.error(error);
    console.log('Error Info:', errorInfo);
    console.groupEnd();
  }

  // In production, send to error monitoring service
  if (import.meta.env.MODE === 'production') {
    // Example: Sentry.captureException(error, { extra: errorInfo });
    // Example: LogRocket.captureException(error);
  }

  return errorInfo;
};

/**
 * Create a standardized error handler for async operations
 */
export const createErrorHandler = (context) => {
  return (error) => {
    const appError = handleApiError(error, context);
    logError(appError, context);
    return appError;
  };
};

/**
 * Handle React Hook Form errors
 */
export const handleFormError = (error, setError) => {
  if (error.code === ERROR_TYPES.VALIDATION_ERROR) {
    // Set field-specific errors if available
    if (error.fieldErrors) {
      Object.entries(error.fieldErrors).forEach(([field, message]) => {
        setError(field, { type: 'server', message });
      });
    } else {
      setError('root', { type: 'server', message: error.message });
    }
  } else {
    setError('root', { type: 'server', message: error.message });
  }
};

/**
 * Display user-friendly error messages
 */
export const getUserFriendlyMessage = (error) => {
  switch (error.code) {
    case ERROR_TYPES.NETWORK_ERROR:
      return 'Please check your internet connection and try again.';
    case ERROR_TYPES.AUTHENTICATION_ERROR:
      return 'Please log in to continue.';
    case ERROR_TYPES.AUTHORIZATION_ERROR:
      return 'You don\'t have permission to perform this action.';
    case ERROR_TYPES.NOT_FOUND_ERROR:
      return 'The requested item was not found.';
    case ERROR_TYPES.VALIDATION_ERROR:
      return 'Please check your input and try again.';
    default:
      return 'Something went wrong. Please try again or contact support if the problem persists.';
  }
};
