import { create } from 'zustand';

// Create order store without direct API calls
// Data fetching is now handled by React Query hooks in useQueries.js
export const useOrderStore = create((set, get) => ({
  // State
  odpOrders: [],

  // Selectors
  getOdpOrders: () => get().odpOrders,
  getOrderById: (id) => get().odpOrders.find(order => order.id === id),
  
  // Custom order-specific selectors
  getScheduledOrders: () => {
    return get().odpOrders.filter(order => order.status === 'SCHEDULED');
  },
  
  getUnscheduledOrders: () => {
    return get().odpOrders.filter(order => order.status === 'NOT SCHEDULED');
  },

  getOdpOrdersByWorkCenter: (workCenter) => {
    if (workCenter === 'BOTH') {
      return get().odpOrders;
    }
    return get().odpOrders.filter(order => order.work_center === workCenter);
  },

  // Actions - only for client-side state management
  setOdpOrders: (orders) => set({ odpOrders: orders || [] }),

  // Utility actions
  cleanupDuplicateOrders: () => {
    const state = get();
    
    // Remove duplicate orders (keep first occurrence)
    const uniqueOrders = [];
    const seenIds = new Set();
    state.odpOrders.forEach(order => {
      if (!seenIds.has(order.id)) {
        seenIds.add(order.id);
        uniqueOrders.push(order);
      }
    });
    
    set({ odpOrders: uniqueOrders });
  },

  reset: () => set({ odpOrders: [] }),
}));
