import { create } from 'zustand';
import { apiService } from '../services';
import { handleApiError, AppError } from '../utils/errorHandling';
import { useMachineStore } from './useMachineStore';
import { useOrderStore } from './useOrderStore';
import { usePhaseStore } from './usePhaseStore';
import { useSchedulerStore } from './useSchedulerStore';
import { useUIStore } from './useUIStore';

// Real-time subscription setup
const setupRealtimeSubscriptions = (set, get) => {
  const onOdpOrdersChange = (payload) => {
    handleOdpOrdersChange(payload, set, get);
  };
  
  const onMachinesChange = (payload) => {
    handleMachinesChange(payload, set, get);
  };
  
  const onPhasesChange = (payload) => {
    handlePhasesChange(payload, set, get);
  };
  
  return apiService.setupRealtimeSubscriptions(
    onOdpOrdersChange,
    onMachinesChange,
    onPhasesChange
  );
};

// Cleanup function for real-time subscriptions
const cleanupRealtimeSubscriptions = (get, set) => {
  const { realtimeChannel } = get();
  if (realtimeChannel) {
    apiService.cleanupRealtimeSubscriptions(realtimeChannel);
    set({ realtimeChannel: null });
  }
};

// Setup global cleanup on page unload - will be managed by store instance
let beforeUnloadHandler = null;

// Cleanup function for removing global event listeners
const cleanupGlobalListeners = () => {
  if (typeof window !== 'undefined' && beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
};

// Handle ODP Orders changes - now invalidates React Query cache
const handleOdpOrdersChange = (payload, _set, _get) => {
  const { eventType, newRecord, oldRecord } = payload;
  const { updateSplitTaskInfo } = useSchedulerStore.getState();
  
  // Update split task info for scheduled orders
  if (eventType === 'INSERT' && newRecord.status === 'SCHEDULED') {
    updateSplitTaskInfo(newRecord.id, newRecord);
  } else if (eventType === 'UPDATE') {
    updateSplitTaskInfo(newRecord.id, newRecord);
  }
  
  // Note: Data updates are now handled by React Query invalidation
  // The actual data fetching and cache updates are managed by React Query
  console.log(`Orders ${eventType.toLowerCase()}:`, newRecord || oldRecord);
};

// Handle Machines changes - now invalidates React Query cache
const handleMachinesChange = (payload, _set, _get) => {
  const { eventType, newRecord, oldRecord } = payload;
  
  // Note: Data updates are now handled by React Query invalidation
  // The actual data fetching and cache updates are managed by React Query
  console.log(`Machines ${eventType.toLowerCase()}:`, newRecord || oldRecord);
};

// Handle Phases changes - now invalidates React Query cache
const handlePhasesChange = (payload, _set, _get) => {
  const { eventType, newRecord, oldRecord } = payload;
  
  // Note: Data updates are now handled by React Query invalidation
  // The actual data fetching and cache updates are managed by React Query
  console.log(`Phases ${eventType.toLowerCase()}:`, newRecord || oldRecord);
};

export const useMainStore = create((set, get) => ({
  // State
  isInitializing: false,
  realtimeChannel: null, // Store realtime channel in state instead of global window
  
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
        
        // Restore split task information from database
        const { restoreSplitTaskInfo, migrateExistingTasksToSegmentFormat } = useSchedulerStore.getState();
        restoreSplitTaskInfo();
        
        // Migrate existing tasks to new bulletproof segment format
        await migrateExistingTasksToSegmentFormat();
        
        // Step 3: Setup real-time subscriptions with error handling
        const { realtimeChannel: existingChannel } = get();
        if (!existingChannel) {
          try {
            const realtimeChannel = setupRealtimeSubscriptions(set, get);
            if (realtimeChannel) {
              set({ realtimeChannel });
              
              // Setup cleanup on page unload
              if (typeof window !== 'undefined' && !beforeUnloadHandler) {
                beforeUnloadHandler = () => {
                  cleanupRealtimeSubscriptions(get, set);
                };
                window.addEventListener('beforeunload', beforeUnloadHandler);
              }
            }
          } catch (realtimeError) {
            const appError = handleApiError(realtimeError, 'Real-time Subscriptions Setup');
            // Error automatically logged by handleApiError (Sentry integration)
            showAlert(
              'Warning: Real-time updates are not available. Data may not update automatically.',
              'warning'
            );
            // Continue without real-time subscriptions
          }
        }
        
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
    // This method is deprecated - use React Query's invalidateQueries instead
    console.warn('refreshData is deprecated. Use React Query invalidation instead.');
  },

  // Debug function to check for duplicate data
  debugData: () => {
    const { getMachines } = useMachineStore.getState();
    const { getOdpOrders } = useOrderStore.getState();
    const { getPhases } = usePhaseStore.getState();
    
    // Check for duplicate IDs
    const machineIds = getMachines().map(m => m.id);
    const _duplicateMachineIds = machineIds.filter((id, index) => machineIds.indexOf(id) !== index);
    // Duplicate machine IDs handled silently
    
    const orderIds = getOdpOrders().map(o => o.id);
    const _duplicateOrderIds = orderIds.filter((id, index) => orderIds.indexOf(id) !== index);
    // Duplicate order IDs handled silently
    
    const phaseIds = getPhases().map(p => p.id);
    const _duplicatePhaseIds = phaseIds.filter((id, index) => phaseIds.indexOf(id) !== index);
    // Duplicate phase IDs handled silently
  },

  // Clean up duplicate data
  cleanupDuplicates: () => {
    const { cleanupDuplicateMachines } = useMachineStore.getState();
    const { cleanupDuplicateOrders } = useOrderStore.getState();
    const { cleanupDuplicatePhases } = usePhaseStore.getState();
    
    cleanupDuplicateMachines();
    cleanupDuplicateOrders();
    cleanupDuplicatePhases();
  },

  reset: () => {
    // Cleanup real-time subscriptions
    cleanupRealtimeSubscriptions(get, set);
    
    // Reset all stores
    const { reset: resetMachineStore } = useMachineStore.getState();
    const { reset: resetOrderStore } = useOrderStore.getState();
    const { reset: resetPhaseStore } = usePhaseStore.getState();
    const { reset: resetSchedulerStore } = useSchedulerStore.getState();
    const { reset: resetUIStore } = useUIStore.getState();
    
    resetMachineStore();
    resetOrderStore();
    resetPhaseStore();
    resetSchedulerStore();
    resetUIStore();
    
    // Reset local state
    set({ isInitializing: false, realtimeChannel: null });
  },

  // Cleanup function for component unmounting
  cleanup: () => {
    cleanupRealtimeSubscriptions(get, set);
    cleanupGlobalListeners();
  },

  // Get combined state from all stores
  // Note: Data fetching is now handled by React Query hooks
  getState: () => {
    const { getMachines } = useMachineStore.getState();
    const { getOdpOrders } = useOrderStore.getState();
    const { getPhases } = usePhaseStore.getState();
    const { getLoadingState, getInitializationState } = useUIStore.getState();
    
    return {
      machines: getMachines(),
      odpOrders: getOdpOrders(),
      phases: getPhases(),
      machineAvailability: useSchedulerStore.getState().getMachineAvailabilityState(),
      isLoading: getLoadingState(),
      isInitialized: getInitializationState(),
    };
  },
}));
