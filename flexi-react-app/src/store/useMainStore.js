import { create } from 'zustand';
import { apiService } from '../services';
import { handleApiError, logError, AppError } from '../utils/errorUtils';
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
const cleanupRealtimeSubscriptions = () => {
  if (window.realtimeChannel) {
    apiService.cleanupRealtimeSubscriptions(window.realtimeChannel);
    window.realtimeChannel = null;
  }
};

// Setup global cleanup on page unload
let beforeUnloadHandler = null;
if (typeof window !== 'undefined') {
  beforeUnloadHandler = () => {
    cleanupRealtimeSubscriptions();
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);
}

// Cleanup function for removing global event listeners
const cleanupGlobalListeners = () => {
  if (typeof window !== 'undefined' && beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
};

// Handle ODP Orders changes
const handleOdpOrdersChange = (payload, _set, _get) => {
  const { eventType, newRecord, oldRecord } = payload;
  const { setOdpOrders, getOdpOrders } = useOrderStore.getState();
  const { updateSplitTaskInfo } = useSchedulerStore.getState();
  
  switch (eventType) {
    case 'INSERT':
      setOdpOrders([...getOdpOrders(), newRecord]);
      if (newRecord.status === 'SCHEDULED') {
        updateSplitTaskInfo(newRecord.id, newRecord);
      }
      break;
    case 'UPDATE':
      setOdpOrders(getOdpOrders().map(order => 
        order.id === newRecord.id ? newRecord : order
      ));
      updateSplitTaskInfo(newRecord.id, newRecord);
      break;
    case 'DELETE':
      setOdpOrders(getOdpOrders().filter(order => order.id !== oldRecord.id));
      break;
  }
};

// Handle Machines changes
const handleMachinesChange = (payload, _set, _get) => {
  const { eventType, newRecord, oldRecord } = payload;
  const { setMachines, getMachines } = useMachineStore.getState();
  
  switch (eventType) {
    case 'INSERT':
      setMachines([...getMachines(), newRecord]);
      break;
    case 'UPDATE':
      setMachines(getMachines().map(machine => 
        machine.id === newRecord.id ? newRecord : machine
      ));
      break;
    case 'DELETE':
      setMachines(getMachines().filter(machine => machine.id !== oldRecord.id));
      break;
  }
};

// Handle Phases changes
const handlePhasesChange = (payload, _set, _get) => {
  const { eventType, newRecord, oldRecord } = payload;
  const { setPhases, getPhases } = usePhaseStore.getState();
  
  switch (eventType) {
    case 'INSERT':
      setPhases([...getPhases(), newRecord]);
      break;
    case 'UPDATE':
      setPhases(getPhases().map(phase => 
        phase.id === newRecord.id ? newRecord : phase
      ));
      break;
    case 'DELETE':
      setPhases(getPhases().filter(phase => phase.id !== oldRecord.id));
      break;
  }
};

export const useMainStore = create((set, get) => ({
  // Lifecycle
  init: async () => {
    const { getInitializationState, setLoading, setInitialized, showAlert } = useUIStore.getState();
    const { setMachines } = useMachineStore.getState();
    const { setOdpOrders } = useOrderStore.getState();
    const { setPhases } = usePhaseStore.getState();
    const { initializeEmptyMachineAvailability } = useSchedulerStore.getState();
    
    // Check if already initialized to prevent duplicate initialization
    if (getInitializationState()) {
      return;
    }
    
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
            logError(appError, 'API Service Initialization - Final Attempt Failed');
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
      
      // Step 2: Fetch core data with individual error handling
      let machines = [];
      let odpOrders = [];
      let phases = [];
      
      try {
        machines = await apiService.getMachines();
      } catch (machineError) {
        const appError = handleApiError(machineError, 'Machines Data Fetch');
        logError(appError, 'Machines Data Fetch Failed');
        showAlert(
          'Warning: Unable to load machine data. Some features may be limited.',
          'warning'
        );
        // Continue with empty machines array
      }
      
      try {
        odpOrders = await apiService.getOdpOrders();
      } catch (orderError) {
        const appError = handleApiError(orderError, 'Orders Data Fetch');
        logError(appError, 'Orders Data Fetch Failed');
        showAlert(
          'Warning: Unable to load order data. Some features may be limited.',
          'warning'
        );
        // Continue with empty orders array
      }
      
      try {
        phases = await apiService.getPhases();
      } catch (phaseError) {
        const appError = handleApiError(phaseError, 'Phases Data Fetch');
        logError(appError, 'Phases Data Fetch Failed');
        showAlert(
          'Warning: Unable to load phase data. Some features may be limited.',
          'warning'
        );
        // Continue with empty phases array
      }
      
      // Step 3: Process and set data with validation
      try {
        // Remove any duplicate machines before setting state
        const uniqueMachines = [];
        const seenMachineIds = new Set();
        if (machines && machines.length > 0) {
          machines.forEach(machine => {
            if (!seenMachineIds.has(machine.id)) {
              seenMachineIds.add(machine.id);
              uniqueMachines.push(machine);
            }
          });
        }
        
        setMachines(uniqueMachines);
        setOdpOrders(odpOrders || []);
        setPhases(phases || []);
        
        // Initialize empty machine availability
        initializeEmptyMachineAvailability();
        
        // Restore split task information from database
        const { restoreSplitTaskInfo, migrateExistingTasksToSegmentFormat } = useSchedulerStore.getState();
        restoreSplitTaskInfo();
        
        // Migrate existing tasks to new bulletproof segment format
        await migrateExistingTasksToSegmentFormat();
        
        // Step 4: Setup real-time subscriptions with error handling
        if (!window.realtimeChannel) {
          try {
            const realtimeChannel = setupRealtimeSubscriptions(set, get);
            if (realtimeChannel) {
              window.realtimeChannel = realtimeChannel;
            }
          } catch (realtimeError) {
            const appError = handleApiError(realtimeError, 'Real-time Subscriptions Setup');
            logError(appError, 'Real-time Subscriptions Setup Failed');
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
        
        // Show success message if some data was loaded
        const totalDataItems = uniqueMachines.length + (odpOrders?.length || 0) + (phases?.length || 0);
        if (totalDataItems > 0) {
          showAlert(
            `Application initialized successfully. Loaded ${totalDataItems} data items.`,
            'success'
          );
        } else {
          showAlert(
            'Application initialized with limited functionality due to data loading issues.',
            'warning'
          );
        }
        
      } catch (dataProcessingError) {
        const appError = handleApiError(dataProcessingError, 'Data Processing');
        logError(appError, 'Data Processing Failed');
        setLoading(false);
        setInitialized(false);
        showAlert(
          'Failed to process application data. Please refresh the page.',
          'error'
        );
        throw appError;
      }
      
    } catch (error) {
      // Handle any unexpected errors
      const appError = error instanceof AppError ? error : handleApiError(error, 'Store Initialization');
      logError(appError, 'Store Initialization - Unexpected Error');
      
      setLoading(false);
      setInitialized(false);
      
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

  // Manual refresh function for debugging or when real-time fails
  refreshData: async () => {
    const { setLoading } = useUIStore.getState();
    const { setMachines } = useMachineStore.getState();
    const { setOdpOrders } = useOrderStore.getState();
    const { setPhases } = usePhaseStore.getState();
    
    setLoading(true);
    try {
      const [machines, odpOrders, phases] = await Promise.all([
        apiService.getMachines(),
        apiService.getOdpOrders(),
        apiService.getPhases(),
      ]);
      setMachines(machines || []);
      setOdpOrders(odpOrders || []);
      setPhases(phases || []);
      setLoading(false);
    } catch (_error) {
      setLoading(false);
    }
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
    cleanupRealtimeSubscriptions();
    
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
  },

  // Cleanup function for component unmounting
  cleanup: () => {
    cleanupRealtimeSubscriptions();
    cleanupGlobalListeners();
  },

  // Get combined state from all stores
  getState: () => {
    const { getMachines } = useMachineStore.getState();
    const { getOdpOrders } = useOrderStore.getState();
    const { getPhases } = usePhaseStore.getState();
    // const { getMachineAvailability } = useSchedulerStore.getState();
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
