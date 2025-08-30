import { create } from 'zustand';
import { apiService } from '../services';
import { createErrorHandler } from '../utils/errorUtils';
import { WORK_CENTERS } from '../constants';
import { useUIStore } from './useUIStore';

// Generic CRUD helper functions with centralized error handling
const createOrderCrudActions = (set, get) => {
  const errorHandler = createErrorHandler('OdpOrder');

  return {
    addOdpOrder: async (newOrder) => {
      try {
        // Validate work center (skip validation if BOTH is selected)
        const { selectedWorkCenter } = useUIStore.getState();
        if (selectedWorkCenter && selectedWorkCenter !== WORK_CENTERS.BOTH && newOrder.work_center && newOrder.work_center !== selectedWorkCenter) {
          throw new Error(`Cannot add ODP Order with different work center. Selected: ${selectedWorkCenter}, Item: ${newOrder.work_center}`);
        }

        const added = await apiService.addOdpOrder(newOrder);
        set(state => ({ odpOrders: [...state.odpOrders, added] }));
        useUIStore.getState().showAlert(`ODP Order "${newOrder?.odp_number || 'Unknown'}" added successfully`, 'success');
        return added;
      } catch (error) {
        const appError = errorHandler(error);
        useUIStore.getState().showAlert(appError.message, 'error');
        throw appError;
      }
    },

    updateOdpOrder: async (id, updates) => {
      try {
        const oldOrder = get().odpOrders.find(order => order.id === id);
        const updated = await apiService.updateOdpOrder(id, updates);
        set(state => ({
          odpOrders: state.odpOrders.map(order =>
            order.id === id ? { ...order, ...updated } : order
          ),
        }));
        useUIStore.getState().showAlert(`ODP Order "${oldOrder?.odp_number || 'Unknown'}" updated successfully`, 'success');
        return updated;
      } catch (error) {
        const appError = errorHandler(error);
        useUIStore.getState().showAlert(appError.message, 'error');
        throw appError;
      }
    },

    removeOdpOrder: async (id) => {
      try {
        const order = get().odpOrders.find(order => order.id === id);
        await apiService.removeOdpOrder(id);
        set(state => ({
          odpOrders: state.odpOrders.filter(order => order.id !== id)
        }));
        useUIStore.getState().showAlert(`ODP Order "${order?.odp_number || 'Unknown'}" deleted successfully`, 'success');
        return true;
      } catch (error) {
        const appError = errorHandler(error);
        useUIStore.getState().showAlert(appError.message, 'error');
        throw appError;
      }
    },
  };
};

export const useOrderStore = create((set, get) => ({
  // State
  odpOrders: [],

  // Selectors
  getOdpOrders: () => get().odpOrders,
  
  getOdpOrderById: (id) => get().odpOrders.find(order => order.id === id),
  
  getOdpOrdersByWorkCenter: (workCenter) => {
    if (workCenter === WORK_CENTERS.BOTH) {
      return get().odpOrders;
    }
    return get().odpOrders.filter(order => order.work_center === workCenter);
  },

  getScheduledOrders: () => get().odpOrders.filter(order => order.status === 'SCHEDULED'),
  
  getUnscheduledOrders: () => get().odpOrders.filter(order => order.status === 'NOT SCHEDULED'),

  // Actions
  setOdpOrders: (orders) => set({ odpOrders: orders || [] }),

  // CRUD actions
  ...createOrderCrudActions(set, get),

  // Utility actions
  cleanupDuplicateOrders: () => {
    const state = get();
    
    // Remove duplicate orders (keep first occurrence)
    const uniqueOrders = [];
    const seenOrderIds = new Set();
    state.odpOrders.forEach(order => {
      if (!seenOrderIds.has(order.id)) {
        seenOrderIds.add(order.id);
        uniqueOrders.push(order);
      }
    });
    
    set({ odpOrders: uniqueOrders });
  },

  reset: () => set({ odpOrders: [] }),
}));
