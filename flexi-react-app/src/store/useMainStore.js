import { create } from 'zustand';
import { apiService } from '../services';
import { handleApiError, logError } from '../utils/errorUtils';
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
const handleOdpOrdersChange = (payload, set, get) => {
  const { eventType, newRecord, oldRecord } = payload;
  const { setOdpOrders, getOdpOrders } = useOrderStore.getState();
  
  switch (eventType) {
    case 'INSERT':
      setOdpOrders([...getOdpOrders(), newRecord]);
      break;
    case 'UPDATE':
      setOdpOrders(getOdpOrders().map(order => 
        order.id === newRecord.id ? newRecord : order
      ));
      break;
    case 'DELETE':
      setOdpOrders(getOdpOrders().filter(order => order.id !== oldRecord.id));
      break;
  }
};

// Handle Machines changes
const handleMachinesChange = (payload, set, get) => {
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
const handlePhasesChange = (payload, set, get) => {
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
    
    try {
      await apiService.init();
      if (getInitializationState()) {
        return;
      }
      setLoading(true);
      
      const [machines, odpOrders, phases] = await Promise.all([
        apiService.getMachines(),
        apiService.getOdpOrders(),
        apiService.getPhases(),
      ]);
      
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
      setLoading(false);
      setInitialized(true);
      
      // Initialize empty machine availability like appStore
      initializeEmptyMachineAvailability();
      
      // Setup real-time subscriptions after data is loaded (only once)
      if (!window.realtimeChannel) {
        const realtimeChannel = setupRealtimeSubscriptions(set, get);
        if (realtimeChannel) {
          // Store channel reference for cleanup
          window.realtimeChannel = realtimeChannel;
        }
      }
    } catch (error) {
      const appError = handleApiError(error, 'Store Initialization');
      logError(appError, 'Store Initialization');
      setLoading(false);
      setInitialized(false);
      showAlert(appError.userMessage, 'error');
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
    } catch (error) {
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
    const duplicateMachineIds = machineIds.filter((id, index) => machineIds.indexOf(id) !== index);
    // Duplicate machine IDs handled silently
    
    const orderIds = getOdpOrders().map(o => o.id);
    const duplicateOrderIds = orderIds.filter((id, index) => orderIds.indexOf(id) !== index);
    // Duplicate order IDs handled silently
    
    const phaseIds = getPhases().map(p => p.id);
    const duplicatePhaseIds = phaseIds.filter((id, index) => phaseIds.indexOf(id) !== index);
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
    const { getMachineAvailability } = useSchedulerStore.getState();
    const { getLoadingState, getInitializationState } = useUIStore.getState();
    
    return {
      machines: getMachines(),
      odpOrders: getOdpOrders(),
      phases: getPhases(),
      machineAvailability: getMachineAvailability(),
      isLoading: getLoadingState(),
      isInitialized: getInitializationState(),
    };
  },
}));
