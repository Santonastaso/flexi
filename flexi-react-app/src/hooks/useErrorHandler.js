import { useCallback, useMemo } from 'react';
import { useUIStore } from '../store';
import { 
  handleApiError, 
  ERROR_TYPES,
  withRetry,
  safeAsync 
} from '../utils/errorHandling';

/**
 * Custom hook for consistent error handling across components
 * Provides standardized error handling, logging, and user feedback
 */
export const useErrorHandler = (context = '') => {
  const { showAlert, showConfirmDialog } = useUIStore();

  /**
   * Handle errors with consistent logging and user feedback
   */
  const handleError = useCallback((error, options = {}) => {
    const {
      showUserAlert = true,
      alertType = 'error',
      logError: shouldLogError = true,
      context: errorContext = context,
      fallbackMessage = 'An unexpected error occurred'
    } = options;

    // Convert to AppError if it isn't already
    const appError = handleApiError(error, errorContext);
    
    // Error is automatically logged by handleApiError (Sentry integration)

    // Show user alert if requested
    if (showUserAlert) {
      const message = appError.userMessage || fallbackMessage;
      showAlert(message, alertType);
    }

    return appError;
  }, [context, showAlert]);

  /**
   * Handle async operations with automatic error handling
   */
  const handleAsync = useCallback(async (asyncOperation, options = {}) => {
    const {
      showUserAlert = true,
      alertType = 'error',
      context: errorContext = context,
      fallbackMessage = 'Operation failed',
      retry = false,
      maxRetries = 3
    } = options;

    try {
      if (retry) {
        return await withRetry(asyncOperation, maxRetries);
      }
      return await asyncOperation();
    } catch (error) {
      const appError = handleError(error, {
        showUserAlert,
        alertType,
        context: errorContext,
        fallbackMessage
      });
      throw appError;
    }
  }, [context, handleError]);

  /**
   * Handle form submission errors specifically
   */
  const handleFormError = useCallback((error, setError) => {
    const appError = handleError(error, { showUserAlert: false });
    
    if (appError.code === ERROR_TYPES.VALIDATION_ERROR) {
      // Set field-specific errors if available
      if (appError.fieldErrors) {
        Object.entries(appError.fieldErrors).forEach(([field, message]) => {
          setError(field, { type: 'server', message });
        });
      } else {
        setError('root', { type: 'server', message: appError.userMessage });
      }
    } else {
      setError('root', { type: 'server', message: appError.userMessage });
    }
  }, [handleError]);

  /**
   * Handle CRUD operation errors with consistent feedback
   */
  const handleCrudError = useCallback((error, operation, entityName) => {
    const appError = handleError(error, {
      context: `${operation} ${entityName}`,
      fallbackMessage: `Failed to ${operation} ${entityName}`
    });

    // Show specific error messages for common CRUD errors
    if (appError.code === ERROR_TYPES.VALIDATION_ERROR) {
      showAlert(`Please check the ${entityName} information and try again.`, 'error');
    } else if (appError.code === ERROR_TYPES.NOT_FOUND_ERROR) {
      showAlert(`${entityName} not found. It may have been deleted.`, 'error');
    } else if (appError.code === ERROR_TYPES.AUTHORIZATION_ERROR) {
      showAlert(`You don't have permission to ${operation} ${entityName}.`, 'error');
    }

    return appError;
  }, [handleError, showAlert]);

  /**
   * Handle network errors with retry suggestions
   */
  const handleNetworkError = useCallback((error, retryOperation) => {
    const appError = handleError(error, {
      context: 'Network Operation',
      fallbackMessage: 'Network error occurred'
    });

    if (appError.code === ERROR_TYPES.NETWORK_ERROR && retryOperation) {
      showConfirmDialog(
        'Network Error',
        'Your connection seems to be unstable. Would you like to retry?',
        retryOperation,
        'warning'
      );
    }

    return appError;
  }, [handleError, showConfirmDialog]);

  /**
   * Handle authentication errors with redirect suggestions
   */
  const handleAuthError = useCallback((error) => {
    const appError = handleError(error, {
      context: 'Authentication',
      fallbackMessage: 'Authentication error occurred'
    });

    if (appError.code === ERROR_TYPES.AUTHENTICATION_ERROR) {
      showAlert('Please log in again to continue.', 'warning');
      // Could trigger logout or redirect here
    }

    return appError;
  }, [handleError, showAlert]);

  /**
   * Create a safe async wrapper for operations
   */
  const createSafeAsync = useCallback((operation, operationContext = '') => {
    return safeAsync(operation, operationContext || context);
  }, [context]);

  /**
   * Get error severity for conditional rendering
   */
  const getErrorSeverity = useCallback((error) => {
    const appError = handleApiError(error, context);
    return appError.severity || 'medium';
  }, [context]);

  // Memoized error types for easy access
  const errorTypes = useMemo(() => ERROR_TYPES, []);

  return {
    // Core error handling
    handleError,
    handleAsync,
    handleFormError,
    handleCrudError,
    handleNetworkError,
    handleAuthError,
    
    // Utility functions
    createSafeAsync,
    getErrorSeverity,
    errorTypes,
    
    // Direct access to utilities
    withRetry,
    safeAsync
  };
};

export default useErrorHandler;
