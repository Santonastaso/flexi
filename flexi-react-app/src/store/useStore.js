import { create } from 'zustand';
import { apiService } from '../services';
import { toDateString, addDaysToDate } from '../utils/dateUtils';
import { handleApiError, logError, createErrorHandler } from '../utils/errorUtils';
import { WORK_CENTERS } from '../constants';

// Store for work center selection
let selectedWorkCenter = null;

export const setGlobalWorkCenter = (workCenter) => {
  selectedWorkCenter = workCenter;
};

export const getGlobalWorkCenter = () => selectedWorkCenter;

// Generic CRUD helper functions with centralized error handling
const createCrudActions = (entityName, apiMethods, set, get) => {
  const errorHandler = createErrorHandler(entityName);

  return {
    [`add${entityName}`]: async (newItem) => {
      try {
                        // Validate work center (skip validation if BOTH is selected)
                const { selectedWorkCenter } = get();
                if (selectedWorkCenter && selectedWorkCenter !== WORK_CENTERS.BOTH && newItem.work_center && newItem.work_center !== selectedWorkCenter) {
                  throw new Error(`Cannot add ${entityName.toLowerCase()} with different work center. Selected: ${selectedWorkCenter}, Item: ${newItem.work_center}`);
                }

        const added = await apiMethods.add(newItem);
        set(state => ({ [getPluralKey(entityName)]: [...state[getPluralKey(entityName)], added] }));
        get().showAlert(`${entityName} "${getDisplayName(newItem, entityName)}" added successfully`, 'success');
        return added;
      } catch (error) {
        const appError = errorHandler(error);
        get().showAlert(appError.message, 'error');
        throw appError;
      }
    },

    [`update${entityName}`]: async (id, updates) => {
      try {
        const oldItem = get()[getPluralKey(entityName)].find(item => item.id === id);
        const updated = await apiMethods.update(id, updates);
        set(state => ({
          [getPluralKey(entityName)]: state[getPluralKey(entityName)].map(item =>
            item.id === id ? { ...item, ...updated } : item
          ),
        }));
        get().showAlert(`${entityName} "${getDisplayName(oldItem, entityName)}" updated successfully`, 'success');
        return updated;
      } catch (error) {
        const appError = errorHandler(error);
        get().showAlert(appError.message, 'error');
        throw appError;
      }
    },

    [`remove${entityName}`]: async (id) => {
      try {
        const item = get()[getPluralKey(entityName)].find(item => item.id === id);
        await apiMethods.remove(id);
        set(state => ({
          [getPluralKey(entityName)]: state[getPluralKey(entityName)].filter(item => item.id !== id)
        }));
        get().showAlert(`${entityName} "${getDisplayName(item, entityName)}" deleted successfully`, 'success');
        return true;
      } catch (error) {
        const appError = errorHandler(error);
        get().showAlert(appError.message, 'error');
        throw appError;
      }
    },
  };
};

const getPluralKey = (entityName) => {
  const pluralMap = {
    'Machine': 'machines',
    'OdpOrder': 'odpOrders',
    'Phase': 'phases'
  };
  return pluralMap[entityName] || `${entityName.toLowerCase()}s`;
};

const getDisplayName = (item, entityName) => {
  const displayFields = {
    'Machine': item?.machine_name || 'Unknown',
    'OdpOrder': item?.odp_number || 'Unknown',
    'Phase': item?.name || 'Unknown'
  };
  return displayFields[entityName] || 'Unknown';
};

// Zustand store that mirrors the existing appStore.js API
export const useStore = create((set, get) => ({
  // State (mirror appStore.js)
  machines: [],
  odpOrders: [],
  phases: [],
  machineAvailability: {},
  isLoading: false,
  isInitialized: false,
  selectedWorkCenter: null,
  
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

  // Selectors (optional helpers)
  getState: () => ({
    machines: get().machines,
    odpOrders: get().odpOrders,
    phases: get().phases,
    machineAvailability: get().machineAvailability,
    isLoading: get().isLoading,
    isInitialized: get().isInitialized,
  }),

  // Lifecycle
  init: async () => {
    const { isInitialized } = get();
    await apiService.init();
    if (isInitialized) return;
    set({ isLoading: true });
    const [machines, odpOrders, phases] = await Promise.all([
      apiService.getMachines(),
      apiService.getOdpOrders(),
      apiService.getPhases(),
    ]);
    set({
      machines: machines || [],
      odpOrders: odpOrders || [],
      phases: phases || [],
      isLoading: false,
      isInitialized: true,
    });
    // Initialize empty machine availability like appStore
    get().initializeEmptyMachineAvailability();
  },

  // Set selected work center
  setSelectedWorkCenter: (workCenter) => {
    setGlobalWorkCenter(workCenter);
    set({ selectedWorkCenter: workCenter });
  },

  reset: () => set({
    machines: [],
    odpOrders: [],
    phases: [],
    machineAvailability: {},
    isLoading: false,
    isInitialized: false,
    alert: { message: '', type: 'info', isVisible: false }
  }),

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

  // Machines - using generic CRUD actions
  ...createCrudActions('Machine', {
    add: apiService.addMachine,
    update: apiService.updateMachine,
    remove: apiService.removeMachine
  }, set, get),

  // Orders (ODP) - using generic CRUD actions
  ...createCrudActions('OdpOrder', {
    add: apiService.addOdpOrder,
    update: apiService.updateOdpOrder,
    remove: apiService.removeOdpOrder
  }, set, get),

  // Phases - using generic CRUD actions
  ...createCrudActions('Phase', {
    add: apiService.addPhase,
    update: apiService.updatePhase,
    remove: apiService.removePhase
  }, set, get),

  // Scheduler actions
  scheduleTask: async (taskId, eventData) => {
    // Validate work_center compatibility before scheduling
    const state = get();
    const task = state.odpOrders.find(o => o.id === taskId);
    const machine = state.machines.find(m => m.id === eventData.machine);
    if (task && machine && task.work_center && machine.work_center && task.work_center !== machine.work_center) {
      return { error: `Work center mismatch: task requires '${task.work_center}' but machine is '${machine.work_center}'` };
    }

    const updates = {
      scheduled_machine_id: eventData.machine,
      scheduled_start_time: eventData.start_time,
      scheduled_end_time: eventData.end_time,
      production_start: eventData.start_time,
      production_end: eventData.end_time,
      color: eventData.color,
      status: 'SCHEDULED',
    };
    await get().updateOdpOrder(taskId, updates);
    return { success: true };
  },
  unscheduleTask: async (taskId) => {
    const updates = {
      scheduled_machine_id: null,
      scheduled_start_time: null,
      scheduled_end_time: null,
      production_start: null,
      production_end: null,
      color: null,
      status: 'NOT SCHEDULED',
    };
    await get().updateOdpOrder(taskId, updates);
  },

  // Machine availability
  loadMachineAvailabilityForDateRange: async (machineId, startDate, endDate) => {
    // Convert Date objects to date strings using toDateString for consistent timezone handling
    const startDateStr = startDate instanceof Date ? toDateString(startDate) : startDate;
    const endDateStr = endDate instanceof Date ? toDateString(endDate) : endDate;
    
    const cacheKey = `${machineId}_${startDateStr}_${endDateStr}`;
    const { machineAvailability } = get();
    if (machineAvailability[cacheKey]) return machineAvailability[cacheKey];
    
    set(state => ({ 
      machineAvailability: { 
        ...state.machineAvailability, 
        [cacheKey]: { _loading: true } 
      } 
    }));
    
    try {
      const data = await apiService.getMachineAvailabilityForDateRange(machineId, startDateStr, endDateStr);
      
      set(state => ({ 
        machineAvailability: { 
          ...state.machineAvailability, 
          [cacheKey]: data || [] 
        } 
      }));
      
      return data;
    } catch (e) {
      console.error('Error loadMachineAvailabilityForDateRange:', e);
      throw e;
    }
  },

  getMachineAvailabilityForDate: async (machineId, dateStr) => {
    try {
      return await apiService.getMachineAvailabilityForDate(machineId, dateStr);
    } catch (e) {
      console.error('Error getMachineAvailabilityForDate:', e);
      return [];
    }
  },

  setMachineAvailability: async (machineId, dateStr, unavailableHours) => {
    try {
      await apiService.setMachineAvailability(machineId, dateStr, unavailableHours);
      set(state => {
        const next = { ...state.machineAvailability };
        if (!next[dateStr]) next[dateStr] = [];
        const row = next[dateStr].find(r => r.machine_id === machineId);
        if (row) row.unavailable_hours = unavailableHours;
        else next[dateStr].push({ machine_id: machineId, date: dateStr, unavailable_hours: unavailableHours });
        return { machineAvailability: next };
      });
      return true;
    } catch (e) {
      console.error('Error setMachineAvailability:', e);
      throw e;
    }
  },

  toggleMachineHourAvailability: async (machineId, dateStr, hour) => {
    try {
      console.log(`Store: Toggling hour ${hour} for ${dateStr} on machine ${machineId}`);
      const currentUnavailableHours = await get().getMachineAvailability(machineId, dateStr);
      console.log(`Store: Current unavailable hours:`, currentUnavailableHours);
      
      // Convert hour to string for comparison since the database stores them as strings
      const hourStr = hour.toString();
      console.log(`Store: Converting hour ${hour} to string: ${hourStr}`);
      
      let newUnavailableHours;
      if (currentUnavailableHours.includes(hourStr)) {
        // Remove hour if already unavailable
        newUnavailableHours = currentUnavailableHours.filter(h => h !== hourStr);
        console.log(`Store: Removing hour ${hourStr}, new array:`, newUnavailableHours);
      } else {
        // Add hour if not unavailable
        newUnavailableHours = [...currentUnavailableHours, hourStr].sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`Store: Adding hour ${hourStr}, new array:`, newUnavailableHours);
      }
      
      await get().setMachineAvailability(machineId, dateStr, newUnavailableHours);
      console.log(`Store: Successfully updated availability`);
      return true;
    } catch (e) {
      console.error('Error toggleMachineHourAvailability:', e);
      throw e;
    }
  },

  loadMachineAvailabilityForDate: async (dateStr) => {
    const { machineAvailability } = get();
    if (machineAvailability[dateStr]?._loading) return;
    if (machineAvailability[dateStr] && machineAvailability[dateStr].length >= 0) return;
    set(state => ({ machineAvailability: { ...state.machineAvailability, [dateStr]: { _loading: true } } }));
    try {
      const data = await apiService.getMachineAvailabilityForDateAllMachines(dateStr);
      set(state => ({ machineAvailability: { ...state.machineAvailability, [dateStr]: data || [] } }));
    } catch (e) {
      set(state => {
        const next = { ...state.machineAvailability };
        if (next[dateStr]) delete next[dateStr]._loading;
        return { machineAvailability: next };
      });
      throw e;
    }
  },

  loadMachineAvailabilityForMachine: async (machineId, startDate, endDate) => {
    const result = {};
    try {
      try {
        await apiService.getMachineAvailabilityForDate('test', '2025-01-01');
      } catch (tableError) {
        console.warn('Machine availability table not accessible:', tableError.message);
        return {};
      }
      let current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = toDateString(current);
        const existing = get().machineAvailability[dateStr];
        if (!existing) {
          await get().loadMachineAvailabilityForDate(dateStr);
        }
        const dayData = get().machineAvailability[dateStr];
        if (Array.isArray(dayData)) {
          const row = dayData.find(r => r.machine_id === machineId);
          if (row) result[dateStr] = row.unavailable_hours || [];
        }
        current = addDaysToDate(current, 1);
      }
      return result;
    } catch (e) {
      console.error('Error load_machine_availability_for_machine:', e);
      return {};
    }
  },

  getMachineAvailability: async (machineId, dateStr) => {
    try {
      console.log(`Store: Getting availability for machine ${machineId} on ${dateStr}`);
      
      // First check if we have cached data
      const dateData = get().machineAvailability[dateStr];
      console.log(`Store: Cached dateData for ${dateStr}:`, dateData);
      
      if (dateData && Array.isArray(dateData)) {
        const row = dateData.find(r => r.machine_id === machineId);
        console.log(`Store: Found cached row:`, row);
        if (row) {
          console.log(`Store: Returning cached unavailable_hours:`, row.unavailable_hours);
          console.log(`Store: Cached unavailable_hours type:`, typeof row.unavailable_hours);
          console.log(`Store: Cached unavailable_hours isArray:`, Array.isArray(row.unavailable_hours));
          console.log(`Store: Cached unavailable_hours length:`, row.unavailable_hours?.length);
          return row.unavailable_hours || [];
        }
      }
      
      console.log(`Store: No cached data, fetching from API...`);
      
      // If no cached data, fetch from API
      const data = await apiService.getMachineAvailabilityForDate(machineId, dateStr);
      console.log(`Store: API returned data:`, data);
      
      if (data) {
        // Normalize to strings to keep UI logic consistent
        const normalizedHours = (data.unavailable_hours || []).map(h => h.toString());
        // Cache the data for future use
        set(state => {
          const next = { ...state.machineAvailability };
          if (!next[dateStr]) next[dateStr] = [];
          const existingRow = next[dateStr].find(r => r.machine_id === machineId);
          
          console.log(`Store: Before cache update - data.unavailable_hours:`, data.unavailable_hours);
          console.log(`Store: Before cache update - type:`, typeof data.unavailable_hours);
          console.log(`Store: Before cache update - isArray:`, Array.isArray(data.unavailable_hours));
          
          if (existingRow) {
            existingRow.unavailable_hours = normalizedHours;
            console.log(`Store: Updated existing row - unavailable_hours:`, existingRow.unavailable_hours);
          } else {
            next[dateStr].push({
              machine_id: machineId,
              date: dateStr,
              unavailable_hours: normalizedHours
            });
            console.log(`Store: Added new row - unavailable_hours:`, next[dateStr][next[dateStr].length - 1].unavailable_hours);
          }
          
          console.log(`Store: Updated cache for ${dateStr}:`, next[dateStr]);
          console.log(`Store: Cache row unavailable_hours type:`, typeof next[dateStr].find(r => r.machine_id === machineId)?.unavailable_hours);
          console.log(`Store: Cache row unavailable_hours isArray:`, Array.isArray(next[dateStr].find(r => r.machine_id === machineId)?.unavailable_hours));
          
          return { machineAvailability: next };
        });
        return normalizedHours;
      }
      return [];
    } catch (error) {
      console.error('Error getting machine availability:', error);
      return [];
    }
  },

  isTimeSlotUnavailable: async (machineId, dateStr, hour) => {
    const hours = await get().getMachineAvailability(machineId, dateStr);
    return hours.includes(hour.toString());
  },

  // Additional methods to mirror appStore
  initializeEmptyMachineAvailability: () => {
    const { machines, machineAvailability } = get();
    const next = { ...machineAvailability };
    machines.forEach(machine => {
      if (!next[machine.id]) {
        next[machine.id] = {};
      }
    });
    set({ machineAvailability: next });
  },

  getEventsByDate: async (dateStr) => {
    try {
      return await apiService.getEventsByDate(dateStr);
    } catch (e) {
      console.error('Error getting events by date:', e);
      return [];
    }
  },

  setMachineUnavailability: async (machineId, startDate, endDate, startTime, endTime) => {
    try {
      // Set the unavailable hours for the date range
      const results = await apiService.setUnavailableHoursForRange(machineId, startDate, endDate, startTime, endTime);
      
      // Refresh the local availability data for the affected date range
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Load updated availability data for the range
      await get().loadMachineAvailabilityForDateRange(machineId, startDateObj, endDateObj);
      
      return results;
    } catch (e) {
      console.error('Error setting machine unavailability:', e);
      throw e;
    }
  },

  isMachineAvailabilityAccessible: async () => {
    try {
      await apiService.getMachineAvailabilityForDateAllMachines('2025-01-01');
      return true;
    } catch (e) {
      console.warn('Machine availability table not accessible:', e.message);
      return false;
    }
  },

  getMachineAvailabilityStatus: async () => {
    try {
      const accessible = await get().isMachineAvailabilityAccessible();
      return { accessible, message: accessible ? 'Table is accessible' : 'Table is not accessible - check permissions or table existence' };
    } catch (e) {
      return { accessible: false, message: `Error checking table: ${e.message}` };
    }
  },
}));

export default useStore;


