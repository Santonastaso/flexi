import { createEntityStore } from './storeFactory';
import { apiService } from '../services';

// Create order store using the factory with custom selectors
export const useOrderStore = createEntityStore(
  'Order',
  'odpOrders',
  {
    add: apiService.addOdpOrder,
    update: apiService.updateOdpOrder,
    remove: apiService.removeOdpOrder,
  },
  {
    // Custom order-specific selectors
    getScheduledOrders: () => {
      const { getOdpOrders } = useOrderStore.getState();
      return getOdpOrders().filter(order => order.status === 'SCHEDULED');
    },
    
    getUnscheduledOrders: () => {
      const { getOdpOrders } = useOrderStore.getState();
      return getOdpOrders().filter(order => order.status === 'NOT SCHEDULED');
    },
  }
);
