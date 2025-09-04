import { create } from 'zustand';
import { WORK_CENTERS } from '../constants';

export const useUIStore = create((set, get) => ({
  // State
  isLoading: false,
  isInitialized: false,
  selectedWorkCenter: WORK_CENTERS.BOTH,
  isEditMode: false, // Global edit mode state
  isSidebarOpen: true, // Sidebar visibility state
  

  
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
  getSidebarOpen: () => get().isSidebarOpen,
  getConfirmDialog: () => get().confirmDialog,
  getConflictDialog: () => get().conflictDialog,

  // Actions
  setLoading: (loading) => set({ isLoading: loading }),
  
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  
  setSelectedWorkCenter: (workCenter) => set({ selectedWorkCenter: workCenter }),
  
  toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode })),
  
  setEditMode: (enabled) => set({ isEditMode: enabled }),
  
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),



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

  // Alert actions
  showAlert: (message, type = 'info') => {
    // For now, just log to console. In a real app, you'd use a toast library
    console.log(`[${type.toUpperCase()}] ${message}`);
  },

  reset: () => set({
    isLoading: false,
    isInitialized: false,
    selectedWorkCenter: WORK_CENTERS.BOTH,
    isEditMode: false,
    isSidebarOpen: true,
    confirmDialog: { isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' },
    conflictDialog: { isOpen: false, details: null }
  }),
}));
