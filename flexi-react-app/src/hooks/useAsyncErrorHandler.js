import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for handling async errors gracefully
 * Provides retry logic, error state management, and user feedback
 */
export const useAsyncErrorHandler = (options = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onError = null,
    onRetry = null,
    onSuccess = null
  } = options;

  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState(null);
  
  const retryTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Clear any existing retry timeout
  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Abort any ongoing request
  const abortRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Reset error state
  const resetError = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setLastError(null);
    clearRetryTimeout();
    abortRequest();
  }, [clearRetryTimeout, abortRequest]);

  // Handle async operation with error handling
  const executeAsync = useCallback(async (asyncFunction, ...args) => {
    try {
      // Reset error state
      resetError();
      setIsLoading(true);
      
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      // Execute the async function
      const result = await asyncFunction(...args, abortControllerRef.current.signal);
      
      // Success
      setIsLoading(false);
      setRetryCount(0);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
      
    } catch (err) {
      // Check if request was aborted
      if (err.name === 'AbortError') {
        setIsLoading(false);
        return;
      }

      // Handle the error
      const errorMessage = err.message || 'An unexpected error occurred';
      const errorType = err.name || 'Error';
      
      setLastError({
        message: errorMessage,
        type: errorType,
        timestamp: new Date().toISOString(),
        retryCount: retryCount + 1
      });

      // Check if we should retry
      if (retryCount < maxRetries && shouldRetry(err)) {
        setRetryCount(prev => prev + 1);
        
        // Schedule retry
        retryTimeoutRef.current = setTimeout(() => {
          executeAsync(asyncFunction, ...args);
        }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
        
        setError({
          message: `${errorMessage} (Retrying in ${retryDelay / 1000}s...)`,
          type: 'retry',
          retryCount: retryCount + 1,
          maxRetries
        });
      } else {
        // Max retries reached or error shouldn't be retried
        setError({
          message: errorMessage,
          type: errorType,
          retryCount: retryCount + 1,
          maxRetries,
          isMaxRetriesReached: retryCount >= maxRetries
        });
        
        setIsLoading(false);
        
        if (onError) {
          onError(err, { retryCount: retryCount + 1, maxRetries });
        }
      }
      
      throw err;
    }
  }, [retryCount, maxRetries, retryDelay, onError, onSuccess, resetError, clearRetryTimeout, abortRequest]);

  // Manual retry function
  const retry = useCallback(async (asyncFunction, ...args) => {
    if (retryCount >= maxRetries) {
      setError(prev => ({
        ...prev,
        message: 'Maximum retry attempts reached',
        type: 'max_retries'
      }));
      return;
    }

    if (onRetry) {
      onRetry(retryCount + 1, maxRetries);
    }

    // Execute retry
    return executeAsync(asyncFunction, ...args);
  }, [retryCount, maxRetries, onRetry, executeAsync]);

  // Determine if an error should be retried
  const shouldRetry = useCallback((error) => {
    // Don't retry on user errors (4xx status codes)
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
    
    // Don't retry on authentication errors
    if (error.status === 401 || error.status === 403) {
      return false;
    }
    
    // Don't retry on validation errors
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      return false;
    }
    
    // Retry on network errors, timeouts, and server errors
    return true;
  }, []);

  // Get user-friendly error message
  const getErrorMessage = useCallback(() => {
    if (!error) return null;
    
    switch (error.type) {
      case 'retry':
        return `${error.message} (Attempt ${error.retryCount} of ${error.maxRetries})`;
      case 'max_retries':
        return 'Maximum retry attempts reached. Please try again later.';
      case 'network':
        return 'Network connection issue. Please check your internet connection.';
      case 'timeout':
        return 'Request timed out. Please try again.';
      case 'auth':
        return 'Authentication error. Please log in again.';
      case 'permission':
        return 'Access denied. You don\'t have permission for this action.';
      default:
        return error.message;
    }
  }, [error]);

  // Check if operation can be retried
  const canRetry = useCallback(() => {
    return error && retryCount < maxRetries && error.type !== 'max_retries';
  }, [error, retryCount, maxRetries]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    clearRetryTimeout();
    abortRequest();
  }, [clearRetryTimeout, abortRequest]);

  return {
    // State
    error,
    isLoading,
    retryCount,
    lastError,
    
    // Actions
    executeAsync,
    retry,
    resetError,
    abortRequest,
    cleanup,
    
    // Computed values
    getErrorMessage,
    canRetry,
    isMaxRetriesReached: retryCount >= maxRetries,
    remainingRetries: Math.max(0, maxRetries - retryCount)
  };
};

export default useAsyncErrorHandler;
