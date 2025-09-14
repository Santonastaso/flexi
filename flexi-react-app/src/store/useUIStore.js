import { create } from 'zustand';
import { WORK_CENTERS } from '../constants';
import { showToast } from '../utils/toast';

export const useUIStore = create((set, get) => ({
  // State
  isLoading: false,
  isInitialized: false,
  selectedWorkCenter: localStorage.getItem('selectedWorkCenter') || WORK_CENTERS.BOTH,
  isEditMode: false, // Global edit mode state
  
  // Scheduling operations loading state
  schedulingLoading: {
    isScheduling: false,
    isRescheduling: false,
    isShunting: false,
    isNavigating: false, // For day navigation
    operationType: null, // 'schedule', 'reschedule', 'shunt', 'unschedule', 'navigate'
    taskId: null
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

  // Drag preview state
  dragPreview: {
    isActive: false,
    startSlot: null,
    durationSlots: 0,
    machineId: null
  },

  // Selectors
  getLoadingState: () => get().isLoading,
  getInitializationState: () => get().isInitialized,
  getSelectedWorkCenter: () => get().selectedWorkCenter,
  getEditMode: () => get().isEditMode,
  getConfirmDialog: () => get().confirmDialog,
  getConflictDialog: () => get().conflictDialog,
  getSchedulingLoading: () => get().schedulingLoading,
  getDragPreview: () => get().dragPreview,

  // Actions
  setLoading: (loading) => set({ isLoading: loading }),
  
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  
  setSelectedWorkCenter: (workCenter) => {
    localStorage.setItem('selectedWorkCenter', workCenter);
    set({ selectedWorkCenter: workCenter });
  },
  
  toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode })),
  
  setEditMode: (enabled) => set({ isEditMode: enabled }),

  // Scheduling loading actions
  setSchedulingLoading: (loadingState) => set({ schedulingLoading: loadingState }),
  
  startSchedulingOperation: (operationType, taskId = null) => set({
    schedulingLoading: {
      isScheduling: operationType === 'schedule',
      isRescheduling: operationType === 'reschedule',
      isShunting: operationType === 'shunt',
      isNavigating: operationType === 'navigate',
      operationType,
      taskId
    }
  }),
  
  stopSchedulingOperation: () => set({
    schedulingLoading: {
      isScheduling: false,
      isRescheduling: false,
      isShunting: false,
      isNavigating: false,
      operationType: null,
      taskId: null
    }
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

  // Drag preview actions
  setDragPreview: (previewData) => set({
    dragPreview: previewData
  }),
  
  clearDragPreview: () => set({
    dragPreview: { isActive: false, startSlot: null, durationSlots: 0, machineId: null }
  }),

  // Alert actions
  showAlert: (message, type = 'info') => {
    showToast(message, type);
  },

  reset: () => set({
    isLoading: false,
    isInitialized: false,
    selectedWorkCenter: WORK_CENTERS.BOTH,
    isEditMode: false,
    schedulingLoading: { isScheduling: false, isRescheduling: false, isShunting: false, isNavigating: false, operationType: null, taskId: null },
    confirmDialog: { isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' },
    conflictDialog: { isOpen: false, details: null },
    dragPreview: { isActive: false, startSlot: null, durationSlots: 0, machineId: null }
  }),
}));
