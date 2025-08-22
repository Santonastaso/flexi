import { create } from 'zustand';
import { useMachineStore } from './useMachineStore';
import { useOrderStore } from './useOrderStore';
import { usePhaseStore } from './usePhaseStore';
import { useSchedulerStore } from './useSchedulerStore';
import { useUIStore } from './useUIStore';
import { useMainStore } from './useMainStore';

// Legacy compatibility wrapper - this store now delegates to the slice stores
export const useStore = create((set, get) => ({
  // State - delegate to slice stores
  get machines() {
    return useMachineStore.getState().getMachines();
  },
  
  get odpOrders() {
    return useOrderStore.getState().getOdpOrders();
  },
  
  get phases() {
    return usePhaseStore.getState().getPhases();
  },
  
  get machineAvailability() {
    return useSchedulerStore.getState().getMachineAvailability();
  },
  
  get isLoading() {
    return useUIStore.getState().getLoadingState();
  },
  
  get isInitialized() {
    return useUIStore.getState().getInitializationState();
  },
  
  get selectedWorkCenter() {
    return useUIStore.getState().getSelectedWorkCenter();
  },
  
  get alert() {
    return useUIStore.getState().getAlert();
  },
  
  get confirmDialog() {
    return useUIStore.getState().getConfirmDialog();
  },

  // Selectors (optional helpers)
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

  // Lifecycle - delegate to main store
  init: async () => {
    return useMainStore.getState().init();
  },

  refreshData: async () => {
    return useMainStore.getState().refreshData();
  },

  debugData: () => {
    return useMainStore.getState().debugData();
  },

  cleanupDuplicates: () => {
    return useMainStore.getState().cleanupDuplicates();
  },

  setSelectedWorkCenter: (workCenter) => {
    return useUIStore.getState().setSelectedWorkCenter(workCenter);
  },

  reset: () => {
    return useMainStore.getState().reset();
  },

  cleanup: () => {
    return useMainStore.getState().cleanup();
  },

  // Alert actions - delegate to UI store
  showAlert: (message, type = 'info') => {
    return useUIStore.getState().showAlert(message, type);
  },
  
  hideAlert: () => {
    return useUIStore.getState().hideAlert();
  },

  // Confirmation dialog actions - delegate to UI store
  showConfirmDialog: (title, message, onConfirm, type = 'danger') => {
    return useUIStore.getState().showConfirmDialog(title, message, onConfirm, type);
  },
  
  hideConfirmDialog: () => {
    return useUIStore.getState().hideConfirmDialog();
  },

  // CRUD actions - delegate to respective stores
  addMachine: async (newMachine) => {
    return useMachineStore.getState().addMachine(newMachine);
  },

  updateMachine: async (id, updates) => {
    return useMachineStore.getState().updateMachine(id, updates);
  },

  removeMachine: async (id) => {
    return useMachineStore.getState().removeMachine(id);
  },

  addOdpOrder: async (newOrder) => {
    return useOrderStore.getState().addOdpOrder(newOrder);
  },

  updateOdpOrder: async (id, updates) => {
    return useOrderStore.getState().updateOdpOrder(id, updates);
  },

  removeOdpOrder: async (id) => {
    return useOrderStore.getState().removeOdpOrder(id);
  },

  addPhase: async (newPhase) => {
    return usePhaseStore.getState().addPhase(newPhase);
  },

  updatePhase: async (id, updates) => {
    return usePhaseStore.getState().updatePhase(id, updates);
  },

  removePhase: async (id) => {
    return usePhaseStore.getState().removePhase(id);
  },

  // Scheduler actions - delegate to scheduler store
  scheduleTask: async (taskId, eventData) => {
    return useSchedulerStore.getState().scheduleTask(taskId, eventData);
  },

  unscheduleTask: async (taskId) => {
    return useSchedulerStore.getState().unscheduleTask(taskId);
  },

  // Machine availability - delegate to scheduler store
  loadMachineAvailabilityForDateRange: async (machineId, startDate, endDate) => {
    return useSchedulerStore.getState().loadMachineAvailabilityForDateRange(machineId, startDate, endDate);
  },

  getMachineAvailabilityForDate: async (machineId, dateStr) => {
    return useSchedulerStore.getState().getMachineAvailabilityForDate(machineId, dateStr);
  },

  setMachineAvailability: async (machineId, dateStr, unavailableHours) => {
    return useSchedulerStore.getState().setMachineAvailability(machineId, dateStr, unavailableHours);
  },

  toggleMachineHourAvailability: async (machineId, dateStr, hour) => {
    return useSchedulerStore.getState().toggleMachineHourAvailability(machineId, dateStr, hour);
  },

  loadMachineAvailabilityForDate: async (dateStr) => {
    return useSchedulerStore.getState().loadMachineAvailabilityForDate(dateStr);
  },

  loadMachineAvailabilityForMachine: async (machineId, startDate, endDate) => {
    return useSchedulerStore.getState().loadMachineAvailabilityForMachine(machineId, startDate, endDate);
  },

  getMachineAvailability: async (machineId, dateStr) => {
    return useSchedulerStore.getState().getMachineAvailability(machineId, dateStr);
  },

  isTimeSlotUnavailable: async (machineId, dateStr, hour) => {
    return useSchedulerStore.getState().isTimeSlotUnavailable(machineId, dateStr, hour);
  },

  initializeEmptyMachineAvailability: () => {
    return useSchedulerStore.getState().initializeEmptyMachineAvailability();
  },

  getEventsByDate: async (dateStr) => {
    return useSchedulerStore.getState().getEventsByDate(dateStr);
  },

  setMachineUnavailability: async (machineId, startDate, endDate, startTime, endTime) => {
    return useSchedulerStore.getState().setMachineUnavailability(machineId, startDate, endDate, startTime, endTime);
  },

  isMachineAvailabilityAccessible: async () => {
    return useSchedulerStore.getState().isMachineAvailabilityAccessible();
  },

  getMachineAvailabilityStatus: async () => {
    return useSchedulerStore.getState().getMachineAvailabilityStatus();
  },
}));
