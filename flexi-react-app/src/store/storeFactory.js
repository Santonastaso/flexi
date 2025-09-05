import { create } from 'zustand';
import { apiService } from '../services';
import { createErrorHandler, AppError, ERROR_TYPES } from '../utils/errorHandling';
import { WORK_CENTERS } from '../constants';
import { useUIStore } from './useUIStore';

/**
 * Generic Store Factory
 * Creates standardized Zustand stores with common CRUD operations and patterns
 * Eliminates duplication across Machine, Order, and Phase stores
 */

/**
 * Create CRUD actions for any entity type
 * @param {string} entityName - Name of the entity (e.g., 'Machine', 'Phase', 'Order')
 * @param {string} entityKey - Key used in state (e.g., 'machines', 'phases', 'orders')
 * @param {Object} apiMethods - API methods for this entity
 * @param {Function} set - Zustand set function
 * @param {Function} get - Zustand get function
 * @returns {Object} CRUD actions
 */
const createCrudActions = (entityName, entityKey, apiMethods, set, get) => {
  const errorHandler = createErrorHandler(entityName);

  return {
    [`add${entityName}`]: async (newEntity) => {
      try {
        // Validate work center (skip validation if BOTH is selected)
        const { selectedWorkCenter } = useUIStore.getState();
        if (selectedWorkCenter && selectedWorkCenter !== WORK_CENTERS.BOTH && newEntity.work_center && newEntity.work_center !== selectedWorkCenter) {
          throw new AppError(`Cannot add ${entityName} with different work center. Selected: ${selectedWorkCenter}, Item: ${newEntity.work_center}`, ERROR_TYPES.BUSINESS_LOGIC_ERROR, 400, null, `${entityName}Store.add${entityName}`);
        }

        const added = await apiMethods.add(newEntity);
        set(state => ({ [entityKey]: [...state[entityKey], added] }));
        return added;
      } catch (error) {
        const appError = errorHandler(error);
        throw appError;
      }
    },

    [`update${entityName}`]: async (id, updates) => {
      try {
        const updated = await apiMethods.update(id, updates);
        set(state => ({
          [entityKey]: state[entityKey].map(entity =>
            entity.id === id ? { ...entity, ...updated } : entity
          ),
        }));
        return updated;
      } catch (error) {
        const appError = errorHandler(error);
        throw appError;
      }
    },

    [`remove${entityName}`]: async (id) => {
      try {
        await apiMethods.remove(id);
        set(state => ({
          [entityKey]: state[entityKey].filter(entity => entity.id !== id)
        }));
        return true;
      } catch (error) {
        const appError = errorHandler(error);
        throw appError;
      }
    },
  };
};

/**
 * Create common selectors for any entity type
 * @param {string} entityKey - Key used in state
 * @param {Function} get - Zustand get function
 * @returns {Object} Common selectors
 */
const createSelectors = (entityKey, get) => ({
  [`get${entityKey.charAt(0).toUpperCase() + entityKey.slice(1)}`]: () => get()[entityKey],
  
  [`get${entityKey.charAt(0).toUpperCase() + entityKey.slice(1)}ById`]: (id) => get()[entityKey].find(entity => entity.id === id),
  
  [`get${entityKey.charAt(0).toUpperCase() + entityKey.slice(1)}ByWorkCenter`]: (workCenter) => {
    if (workCenter === WORK_CENTERS.BOTH) {
      return get()[entityKey];
    }
    return get()[entityKey].filter(entity => entity.work_center === workCenter);
  },
});

/**
 * Create utility actions for any entity type
 * @param {string} entityKey - Key used in state
 * @param {Function} set - Zustand set function
 * @param {Function} get - Zustand get function
 * @returns {Object} Utility actions
 */
const createUtilityActions = (entityKey, set, get) => ({
  [`set${entityKey.charAt(0).toUpperCase() + entityKey.slice(1)}`]: (entities) => set({ [entityKey]: entities || [] }),

  [`cleanupDuplicate${entityKey.charAt(0).toUpperCase() + entityKey.slice(1)}`]: () => {
    const state = get();
    
    // Remove duplicate entities (keep first occurrence)
    const uniqueEntities = [];
    const seenIds = new Set();
    state[entityKey].forEach(entity => {
      if (!seenIds.has(entity.id)) {
        seenIds.add(entity.id);
        uniqueEntities.push(entity);
      }
    });
    
    set({ [entityKey]: uniqueEntities });
  },

  reset: () => set({ [entityKey]: [] }),
});

/**
 * Create a standardized store for any entity type
 * @param {string} entityName - Name of the entity (e.g., 'Machine', 'Phase', 'Order')
 * @param {string} entityKey - Key used in state (e.g., 'machines', 'phases', 'orders')
 * @param {Object} apiMethods - API methods for this entity
 * @param {Object} customActions - Custom actions specific to this entity
 * @returns {Function} Zustand store creator
 */
export const createEntityStore = (entityName, entityKey, apiMethods, customActions = {}) => {
  return create((set, get) => ({
    // State
    [entityKey]: [],

    // Selectors
    ...createSelectors(entityKey, get),

    // Actions
    [`set${entityKey.charAt(0).toUpperCase() + entityKey.slice(1)}`]: (entities) => set({ [entityKey]: entities || [] }),

    // CRUD actions
    ...createCrudActions(entityName, entityKey, apiMethods, set, get),

    // Utility actions
    ...createUtilityActions(entityKey, set, get),

    // Custom actions specific to this entity
    ...customActions,
  }));
};

/**
 * Pre-configured store creators for common entity types
 */

// Machine store configuration
export const createMachineStore = () => createEntityStore(
  'Machine',
  'machines',
  {
    add: apiService.addMachine,
    update: apiService.updateMachine,
    remove: apiService.removeMachine,
  },
  {
    // Custom machine-specific actions can be added here
  }
);

// Order store configuration
export const createOrderStore = () => createEntityStore(
  'Order',
  'odpOrders',
  {
    add: apiService.addOdpOrder,
    update: apiService.updateOdpOrder,
    remove: apiService.removeOdpOrder,
  },
  {
    // Custom order-specific actions
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

// Phase store configuration
export const createPhaseStore = () => createEntityStore(
  'Phase',
  'phases',
  {
    add: apiService.addPhase,
    update: apiService.updatePhase,
    remove: apiService.removePhase,
  },
  {
    // Custom phase-specific actions can be added here
  }
);
