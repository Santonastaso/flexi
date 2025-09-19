import { create } from 'zustand';

// Create machine store without direct API calls
// Data fetching is now handled by React Query hooks in useQueries.js
export const useMachineStore = create((set, get) => ({
  // State
  machines: [],

  // Selectors
  getMachines: () => get().machines,
  getMachineById: (id) => get().machines.find(machine => machine.id === id),
  getMachinesByWorkCenter: (workCenter) => {
    if (workCenter === 'BOTH') {
      return get().machines;
    }
    return get().machines.filter(machine => machine.work_center === workCenter);
  },

  // Actions - only for client-side state management
  setMachines: (machines) => set({ machines: machines || [] }),

  // Utility actions
  cleanupDuplicateMachines: () => {
    const state = get();
    
    // Remove duplicate machines (keep first occurrence)
    const uniqueMachines = [];
    const seenIds = new Set();
    state.machines.forEach(machine => {
      if (!seenIds.has(machine.id)) {
        seenIds.add(machine.id);
        uniqueMachines.push(machine);
      }
    });
    
    set({ machines: uniqueMachines });
  },

  reset: () => set({ machines: [] }),
}));
