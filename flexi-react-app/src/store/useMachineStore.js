import { create } from 'zustand';
import { apiService } from '../services';
import { createErrorHandler, AppError, ERROR_TYPES } from '../utils/errorUtils';
import { WORK_CENTERS } from '../constants';
import { useUIStore } from './useUIStore';
import { generateCalendarForYear } from '../utils/calendarPopulationUtils';
import { showSuccess, showWarning } from '../utils';

// Generic CRUD helper functions with centralized error handling
const createMachineCrudActions = (set, get) => {
  const errorHandler = createErrorHandler('Machine');

  return {
    addMachine: async (newMachine) => {
      try {
        // Validate work center (skip validation if BOTH is selected)
        const { selectedWorkCenter } = useUIStore.getState();
        if (selectedWorkCenter && selectedWorkCenter !== WORK_CENTERS.BOTH && newMachine.work_center && newMachine.work_center !== selectedWorkCenter) {
          throw new AppError(`Cannot add Machine with different work center. Selected: ${selectedWorkCenter}, Item: ${newMachine.work_center}`, ERROR_TYPES.BUSINESS_LOGIC_ERROR, 400, null, 'MachineStore.addMachine');
        }

        const added = await apiService.addMachine(newMachine);
        set(state => ({ machines: [...state.machines, added] }));

        // --- NEW LOGIC: Automatically populate the new machine's calendar ---
        try {
            const currentYear = new Date().getFullYear();
            const records = generateCalendarForYear([added], currentYear);
            if (records.length > 0) {
                await apiService.bulkUpsertMachineAvailability(records);
            }
            showSuccess(`Machine "${added?.machine_name || 'Unknown'}" added and calendar set successfully`);
        } catch (calendarError) {
            showWarning(`Machine added, but failed to set calendar: ${calendarError.message}`);
        }
        // --- END NEW LOGIC ---

        return added;
      } catch (error) {
        const appError = errorHandler(error);
        // Don't show alert here - let the component handle error display
        throw appError;
      }
    },

    updateMachine: async (id, updates) => {
      try {
        const oldMachine = get().machines.find(machine => machine.id === id);
        const updated = await apiService.updateMachine(id, updates);
        set(state => ({
          machines: state.machines.map(machine =>
            machine.id === id ? { ...machine, ...updated } : machine
          ),
        }));
        // Success message handled by calling component
        return updated;
      } catch (error) {
        const appError = errorHandler(error);
        // Don't show alert here - let the component handle error display
        throw appError;
      }
    },

    removeMachine: async (id) => {
      try {
        const machine = get().machines.find(machine => machine.id === id);
        await apiService.removeMachine(id);
        set(state => ({
          machines: state.machines.filter(machine => machine.id !== id)
        }));
        // Success message handled by calling component
        return true;
      } catch (error) {
        const appError = errorHandler(error);
        // Don't show alert here - let the component handle error display
        throw appError;
      }
    },
  };
};

export const useMachineStore = create((set, get) => ({
  // State
  machines: [],

  // Selectors
  getMachines: () => get().machines,
  
  getMachineById: (id) => get().machines.find(machine => machine.id === id),
  
  getMachinesByWorkCenter: (workCenter) => {
    if (workCenter === WORK_CENTERS.BOTH) {
      return get().machines;
    }
    return get().machines.filter(machine => machine.work_center === workCenter);
  },

  // Actions
  setMachines: (machines) => set({ machines: machines || [] }),

  // CRUD actions
  ...createMachineCrudActions(set, get),

  // Utility actions
  cleanupDuplicateMachines: () => {
    const state = get();
    
    // Remove duplicate machines (keep first occurrence)
    const uniqueMachines = [];
    const seenMachineIds = new Set();
    state.machines.forEach(machine => {
      if (!seenMachineIds.has(machine.id)) {
        seenMachineIds.add(machine.id);
        uniqueMachines.push(machine);
      }
    });
    
    set({ machines: uniqueMachines });
  },

  reset: () => set({ machines: [] }),
}));
