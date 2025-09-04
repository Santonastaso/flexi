import { create } from 'zustand';
import { apiService } from '../services';
import { createErrorHandler, AppError, ERROR_TYPES } from '../utils/errorUtils';
import { WORK_CENTERS } from '../constants';
import { useUIStore } from './useUIStore';
import { showSuccess } from '../utils';

// Generic CRUD helper functions with centralized error handling
const createPhaseCrudActions = (set, get) => {
  const errorHandler = createErrorHandler('Phase');

  return {
    addPhase: async (newPhase) => {
      try {
        // Validate work center (skip validation if BOTH is selected)
        const { selectedWorkCenter } = useUIStore.getState();
        if (selectedWorkCenter && selectedWorkCenter !== WORK_CENTERS.BOTH && newPhase.work_center && newPhase.work_center !== selectedWorkCenter) {
          throw new AppError(`Cannot add Phase with different work center. Selected: ${selectedWorkCenter}, Item: ${newPhase.work_center}`, ERROR_TYPES.BUSINESS_LOGIC_ERROR, 400, null, 'PhaseStore.addPhase');
        }

        const added = await apiService.addPhase(newPhase);
        set(state => ({ phases: [...state.phases, added] }));
        showSuccess(`Phase "${newPhase?.name || 'Unknown'}" added successfully`);
        return added;
      } catch (error) {
        const appError = errorHandler(error);
        // Don't show alert here - let the component handle error display
        throw appError;
      }
    },

    updatePhase: async (id, updates) => {
      try {
        const oldPhase = get().phases.find(phase => phase.id === id);
        const updated = await apiService.updatePhase(id, updates);
        set(state => ({
          phases: state.phases.map(phase =>
            phase.id === id ? { ...phase, ...updated } : phase
          ),
        }));
        showSuccess(`Phase "${oldPhase?.name || 'Unknown'}" updated successfully`);
        return updated;
      } catch (error) {
        const appError = errorHandler(error);
        // Don't show alert here - let the component handle error display
        throw appError;
      }
    },

    removePhase: async (id) => {
      try {
        const phase = get().phases.find(phase => phase.id === id);
        await apiService.removePhase(id);
        set(state => ({
          phases: state.phases.filter(phase => phase.id !== id)
        }));
        showSuccess(`Phase "${phase?.name || 'Unknown'}" deleted successfully`);
        return true;
      } catch (error) {
        const appError = errorHandler(error);
        // Don't show alert here - let the component handle error display
        throw appError;
      }
    },
  };
};

export const usePhaseStore = create((set, get) => ({
  // State
  phases: [],

  // Selectors
  getPhases: () => get().phases,
  
  getPhaseById: (id) => get().phases.find(phase => phase.id === id),
  
  getPhasesByWorkCenter: (workCenter) => {
    if (workCenter === WORK_CENTERS.BOTH) {
      return get().phases;
    }
    return get().phases.filter(phase => phase.work_center === workCenter);
  },

  // Actions
  setPhases: (phases) => set({ phases: phases || [] }),

  // CRUD actions
  ...createPhaseCrudActions(set, get),

  // Utility actions
  cleanupDuplicatePhases: () => {
    const state = get();
    
    // Remove duplicate phases (keep first occurrence)
    const uniquePhases = [];
    const seenPhaseIds = new Set();
    state.phases.forEach(phase => {
      if (!seenPhaseIds.has(phase.id)) {
        seenPhaseIds.add(phase.id);
        uniquePhases.push(phase);
      }
    });
    
    set({ phases: uniquePhases });
  },

  reset: () => set({ phases: [] }),
}));
