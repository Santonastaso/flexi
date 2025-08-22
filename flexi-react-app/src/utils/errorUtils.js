/**
 * Centralized Error Handling Utilities
 * Provides consistent error handling across the application
 */

export class AppError extends Error {
  constructor(message, code = 'GENERIC_ERROR', statusCode = 500, originalError = null, context = '') {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.id = this.generateErrorId();
    this.userMessage = this.getUserFriendlyMessage();
  }

  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getUserFriendlyMessage() {
    return getUserFriendlyMessage(this);
  }

  toJSON() {
    return {
      id: this.id,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      userMessage: this.userMessage,
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
  CLIENT_ERROR: 'CLIENT_ERROR',
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR'
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Handle API errors consistently
 */
export const handleApiError = (error, context = '') => {
  console.error(`API Error in ${context}:`, error);

  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }

  // Handle Supabase errors
  if (error?.code) {
    switch (error.code) {
      case '23505': // Unique constraint violation
        return new AppError('This record already exists', ERROR_TYPES.VALIDATION_ERROR, 409, error, context);
      case '23503': // Foreign key constraint violation
        return new AppError('Cannot delete this record as it is referenced by other data', ERROR_TYPES.VALIDATION_ERROR, 400, error, context);
      case 'PGRST116': // No rows found
        return new AppError('Record not found', ERROR_TYPES.NOT_FOUND_ERROR, 404, error, context);
      case 'PGRST301': // JWT expired
        return new AppError('Session expired. Please log in again.', ERROR_TYPES.AUTHENTICATION_ERROR, 401, error, context);
      case 'PGRST302': // JWT invalid
        return new AppError('Invalid session. Please log in again.', ERROR_TYPES.AUTHENTICATION_ERROR, 401, error, context);
      case 'PGRST303': // JWT missing
        return new AppError('Authentication required. Please log in.', ERROR_TYPES.AUTHENTICATION_ERROR, 401, error, context);
      default:
        return new AppError(error.message || 'An unexpected error occurred', ERROR_TYPES.SERVER_ERROR, 500, error, context);
    }
  }

  // Handle network errors
  if (error.name === 'NetworkError' || error.message?.includes('fetch') || error.message?.includes('network')) {
    return new AppError('Network error. Please check your connection and try again.', ERROR_TYPES.NETWORK_ERROR, 0, error, context);
  }

  // Handle timeout errors
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return new AppError('Request timed out. Please try again.', ERROR_TYPES.TIMEOUT_ERROR, 408, error, context);
  }

  // Handle rate limit errors
  if (error.status === 429 || error.message?.includes('rate limit')) {
    return new AppError('Too many requests. Please wait a moment and try again.', ERROR_TYPES.RATE_LIMIT_ERROR, 429, error, context);
  }

  // Handle validation errors
  if (error.name === 'ValidationError' || error.message?.includes('validation')) {
    return new AppError(error.message, ERROR_TYPES.VALIDATION_ERROR, 400, error, context);
  }

  // Handle business logic errors
  if (error.message?.includes('Cannot add') || error.message?.includes('work center')) {
    return new AppError(error.message, ERROR_TYPES.BUSINESS_LOGIC_ERROR, 400, error, context);
  }

  // Default error handling
  return new AppError(
    error.message || 'An unexpected error occurred',
    ERROR_TYPES.CLIENT_ERROR,
    error.status || 500,
    error,
    context
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
    url: typeof window !== 'undefined' ? window.location.href : 'server',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    stack: error.stack,
    severity: getErrorSeverity(error)
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
 * Determine error severity based on error type and context
 */
export const getErrorSeverity = (error) => {
  if (error.code === ERROR_TYPES.AUTHENTICATION_ERROR || error.code === ERROR_TYPES.AUTHORIZATION_ERROR) {
    return ERROR_SEVERITY.HIGH;
  }
  if (error.code === ERROR_TYPES.NETWORK_ERROR || error.code === ERROR_TYPES.SERVER_ERROR) {
    return ERROR_SEVERITY.MEDIUM;
  }
  if (error.code === ERROR_TYPES.VALIDATION_ERROR || error.code === ERROR_TYPES.BUSINESS_LOGIC_ERROR) {
    return ERROR_SEVERITY.LOW;
  }
  return ERROR_SEVERITY.MEDIUM;
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
    case ERROR_TYPES.BUSINESS_LOGIC_ERROR:
      return error.message || 'This operation cannot be completed.';
    case ERROR_TYPES.TIMEOUT_ERROR:
      return 'The request took too long. Please try again.';
    case ERROR_TYPES.RATE_LIMIT_ERROR:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return 'Something went wrong. Please try again or contact support if the problem persists.';
  }
};

/**
 * Retry mechanism for failed operations
 */
export const withRetry = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain error types
      if (error.code === ERROR_TYPES.VALIDATION_ERROR || 
          error.code === ERROR_TYPES.AUTHORIZATION_ERROR ||
          error.code === ERROR_TYPES.BUSINESS_LOGIC_ERROR) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError;
};

/**
 * Create a safe async wrapper that handles errors consistently
 */
export const safeAsync = (operation, context = '') => {
  return async (...args) => {
    try {
      return await operation(...args);
    } catch (error) {
      const appError = handleApiError(error, context);
      logError(appError, context);
      throw appError;
    }
  };
};
