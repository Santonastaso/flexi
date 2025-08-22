import { create } from 'zustand';
import { WORK_CENTERS } from '../constants';

export const useUIStore = create((set, get) => ({
  // State
  isLoading: false,
  isInitialized: false,
  selectedWorkCenter: WORK_CENTERS.BOTH,
  
  // Alert state
  alert: {
    message: '',
    type: 'info',
    isVisible: false
  },
  
  // Confirmation dialog state
  confirmDialog: {
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger'
  },

  // Selectors
  getLoadingState: () => get().isLoading,
  getInitializationState: () => get().isInitialized,
  getSelectedWorkCenter: () => get().selectedWorkCenter,
  getAlert: () => get().alert,
  getConfirmDialog: () => get().confirmDialog,

  // Actions
  setLoading: (loading) => set({ isLoading: loading }),
  
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  
  setSelectedWorkCenter: (workCenter) => set({ selectedWorkCenter: workCenter }),

  // Alert actions
  showAlert: (message, type = 'info') => set({
    alert: { message, type, isVisible: true }
  }),
  
  hideAlert: () => set({
    alert: { message: '', type: 'info', isVisible: false }
  }),

  // Confirmation dialog actions
  showConfirmDialog: (title, message, onConfirm, type = 'danger') => set({
    confirmDialog: { isOpen: true, title, message, onConfirm, type }
  }),
  
  hideConfirmDialog: () => set({
    confirmDialog: { isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' }
  }),

  reset: () => set({
    isLoading: false,
    isInitialized: false,
    selectedWorkCenter: WORK_CENTERS.BOTH,
    alert: { message: '', type: 'info', isVisible: false },
    confirmDialog: { isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' }
  }),
}));
