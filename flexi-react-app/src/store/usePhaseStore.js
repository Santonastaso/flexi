import { create } from 'zustand';

// Create phase store without direct API calls
// Data fetching is now handled by React Query hooks in useQueries.js
export const usePhaseStore = create((set, get) => ({
  // State
  phases: [],

  // Selectors
  getPhases: () => get().phases,
  getPhaseById: (id) => get().phases.find(phase => phase.id === id),

  // Actions - only for client-side state management
  setPhases: (phases) => set({ phases: phases || [] }),

  // Utility actions
  cleanupDuplicatePhases: () => {
    const state = get();
    
    // Remove duplicate phases (keep first occurrence)
    const uniquePhases = [];
    const seenIds = new Set();
    state.phases.forEach(phase => {
      if (!seenIds.has(phase.id)) {
        seenIds.add(phase.id);
        uniquePhases.push(phase);
      }
    });
    
    set({ phases: uniquePhases });
  },

  reset: () => set({ phases: [] }),
}));
