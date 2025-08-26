import { create } from 'zustand';
import { WORK_CENTERS } from '../constants';

export const useUIStore = create((set, get) => ({
  // State
  isLoading: false,
  isInitialized: false,
  selectedWorkCenter: WORK_CENTERS.BOTH,
  isEditMode: false, // Global edit mode state
  
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
  
  // Conflict resolution dialog state
  conflictDialog: {
    isOpen: false,
    details: null
  },

  // Selectors
  getLoadingState: () => get().isLoading,
  getInitializationState: () => get().isInitialized,
  getSelectedWorkCenter: () => get().selectedWorkCenter,
  getEditMode: () => get().isEditMode,
  getAlert: () => get().alert,
  getConfirmDialog: () => get().confirmDialog,
  getConflictDialog: () => get().conflictDialog,

  // Actions
  setLoading: (loading) => set({ isLoading: loading }),
  
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  
  setSelectedWorkCenter: (workCenter) => set({ selectedWorkCenter: workCenter }),
  
  toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode })),
  
  setEditMode: (enabled) => set({ isEditMode: enabled }),

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
  
  // Conflict dialog actions
  showConflictDialog: (details) => set({
    conflictDialog: { isOpen: true, details }
  }),
  
  hideConflictDialog: () => set({
    conflictDialog: { isOpen: false, details: null }
  }),

  reset: () => set({
    isLoading: false,
    isInitialized: false,
    selectedWorkCenter: WORK_CENTERS.BOTH,
    isEditMode: false,
    alert: { message: '', type: 'info', isVisible: false },
    confirmDialog: { isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' },
    conflictDialog: { isOpen: false, details: null }
  }),
}));
