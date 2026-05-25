import { create } from 'zustand';
import { apiService } from '../services';
import { handleApiError, AppError } from '../utils/errorHandling';
import { useSchedulerStore } from './useSchedulerStore';
import { useUIStore } from './useUIStore';

export const useMainStore = create((set, get) => ({
  // State
  isInitializing: false,
  
  // Lifecycle - simplified to only handle non-data initialization
  init: async () => {
    const { getInitializationState, setLoading, setInitialized, showAlert } = useUIStore.getState();
    const { initializeEmptyMachineAvailability } = useSchedulerStore.getState();
    
    // Check if already initialized to prevent duplicate initialization
    if (getInitializationState()) {
      return;
    }
    
    // Check if initialization is already in progress
    if (get().isInitializing) {
      // Wait for the ongoing initialization to complete
      return new Promise((resolve) => {
        const checkInitialization = () => {
          if (getInitializationState()) {
            resolve();
          } else {
            setTimeout(checkInitialization, 100);
          }
        };
        checkInitialization();
      });
    }
    
    // Mark initialization as in progress
    set({ isInitializing: true });
    
    setLoading(true);
    
    try {
      // Step 1: Initialize API service with retry mechanism
      let apiInitSuccess = false;
      let apiInitAttempts = 0;
      const maxApiInitAttempts = 3;
      
      while (!apiInitSuccess && apiInitAttempts < maxApiInitAttempts) {
        try {
          await apiService.init();
          apiInitSuccess = true;
        } catch (apiError) {
          apiInitAttempts++;
          const appError = handleApiError(apiError, 'API Service Initialization');
          
          if (apiInitAttempts >= maxApiInitAttempts) {
            // Final attempt failed - show critical error and set app to failed state
            // Error automatically logged by handleApiError (Sentry integration)
            setLoading(false);
            setInitialized(false);
            showAlert(
              'Unable to connect to the server. Please check your internet connection and refresh the page.',
              'error'
            );
            throw new AppError(
              'API service initialization failed after multiple attempts',
              'CRITICAL_INIT_ERROR',
              503,
              appError,
              'Store Initialization'
            );
          }
          
          // Wait before retry with exponential backoff
          const retryDelay = Math.min(1000 * Math.pow(2, apiInitAttempts - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          // Show retry message to user
          showAlert(
            `Connection attempt ${apiInitAttempts} failed. Retrying...`,
            'warning'
          );
        }
      }
      
      // Step 2: Initialize non-data components
      try {
        // Initialize empty machine availability
        initializeEmptyMachineAvailability();

        // Success - mark as initialized
        setLoading(false);
        setInitialized(true);
        set({ isInitializing: false });
        
        showAlert(
          'Application initialized successfully. Data will be loaded via React Query.',
          'success'
        );
        
      } catch (dataProcessingError) {
        const appError = handleApiError(dataProcessingError, 'Data Processing');
        // Error automatically logged by handleApiError (Sentry integration)
        setLoading(false);
        setInitialized(false);
        set({ isInitializing: false });
        showAlert(
          'Failed to process application data. Please refresh the page.',
          'error'
        );
        throw appError;
      }
      
    } catch (error) {
      // Handle any unexpected errors
      const appError = error instanceof AppError ? error : handleApiError(error, 'Store Initialization');
      // Error automatically logged by handleApiError (Sentry integration)
      
      setLoading(false);
      setInitialized(false);
      set({ isInitializing: false });
      
      // Show appropriate error message based on error type
      if (appError.code === 'CRITICAL_INIT_ERROR') {
        showAlert(
          'Critical initialization error. Please contact support if the problem persists.',
          'error'
        );
      } else {
        showAlert(
          'Application initialization failed. Please refresh the page or contact support.',
          'error'
        );
      }
      
      throw appError;
    }
  },

  // Manual refresh function - now handled by React Query invalidation
  refreshData: () => {
    // No-op: Use React Query invalidation instead
  },

  reset: () => {
    // Reset remaining stores
    const { reset: resetSchedulerStore } = useSchedulerStore.getState();
    const { reset: resetUIStore } = useUIStore.getState();
    
    resetSchedulerStore();
    resetUIStore();
    
    // Reset local state
    set({ isInitializing: false });
  },

  cleanup: () => {},

  // Get combined state from stores
  // Note: Data fetching is now handled by React Query hooks
  getState: () => {
    const { getLoadingState, getInitializationState } = useUIStore.getState();
    
    return {
      machineAvailability: useSchedulerStore.getState().getMachineAvailabilityState(),
      isLoading: getLoadingState(),
      isInitialized: getInitializationState(),
    };
  },
}));
