import { create } from 'zustand';
import { apiService } from '../services';
import { toDateString, addDaysToDate } from '../utils/dateUtils';
import { handleApiError, logError, createErrorHandler, safeAsync } from '../utils/errorUtils';
import { WORK_CENTERS } from '../constants';
import { supabase } from '../services/supabase/client';
import { AppConfig } from '../services/config';



// Real-time subscription setup
const setupRealtimeSubscriptions = (set, get) => {
  if (!AppConfig.SUPABASE.ENABLE_REALTIME) {
    return null;
  }
  
  const channel = supabase.channel('table-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'odp_orders' },
      (payload) => {
        handleOdpOrdersChange(payload, set, get);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'machines' },
      (payload) => {
        handleMachinesChange(payload, set, get);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'phases' },
      (payload) => {
        handlePhasesChange(payload, set, get);
      }
    )
    .subscribe((status) => {
      // Realtime subscription status handled silently
    });

  return channel;
};

// Handle ODP Orders changes
const handleOdpOrdersChange = (payload, set, get) => {
  const { eventType, newRecord, oldRecord } = payload;
  
  switch (eventType) {
    case 'INSERT':
      set(state => ({
        odpOrders: [...state.odpOrders, newRecord]
      }));
      break;
    case 'UPDATE':
      set(state => ({
        odpOrders: state.odpOrders.map(order => 
          order.id === newRecord.id ? newRecord : order
        )
      }));
      break;
    case 'DELETE':
      set(state => ({
        odpOrders: state.odpOrders.filter(order => order.id !== oldRecord.id)
      }));
      break;
  }
};

// Handle Machines changes
const handleMachinesChange = (payload, set, get) => {
  const { eventType, newRecord, oldRecord } = payload;
  
  switch (eventType) {
    case 'INSERT':
      set(state => {
        // Check if machine already exists to prevent duplicates
        const exists = state.machines.some(machine => machine.id === newRecord.id);
        if (exists) {
          return state;
        }
        return {
          machines: [...state.machines, newRecord]
        };
      });
      break;
    case 'UPDATE':
      set(state => {
        const exists = state.machines.some(machine => machine.id === newRecord.id);
        if (!exists) {
          return state;
        }
        return {
          machines: state.machines.map(machine => 
            machine.id === newRecord.id ? newRecord : machine
          )
        };
      });
      break;
    case 'DELETE':
      set(state => {
        const exists = state.machines.some(machine => machine.id === oldRecord.id);
        if (!exists) {
          return state;
        }
        return {
          machines: state.machines.filter(machine => machine.id !== oldRecord.id)
        };
      });
      break;
  }
};

// Handle Phases changes
const handlePhasesChange = (payload, set, get) => {
  const { eventType, newRecord, oldRecord } = payload;
  
  switch (eventType) {
    case 'INSERT':
      set(state => ({
        phases: [...state.phases, newRecord]
      }));
      break;
    case 'UPDATE':
      set(state => ({
        phases: state.phases.map(phase => 
          phase.id === newRecord.id ? newRecord : phase
        )
      }));
      break;
    case 'DELETE':
      set(state => ({
        phases: state.phases.filter(phase => phase.id !== oldRecord.id)
      }));
      break;
  }
};

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
    
    try {
      await apiService.init();
      if (isInitialized) {
        return;
      }
      set({ isLoading: true });
      
      const [machines, odpOrders, phases] = await Promise.all([
        apiService.getMachines(),
        apiService.getOdpOrders(),
        apiService.getPhases(),
      ]);
      
      // Remove any duplicate machines before setting state
      const uniqueMachines = [];
      const seenMachineIds = new Set();
      if (machines && machines.length > 0) {
        machines.forEach(machine => {
          if (!seenMachineIds.has(machine.id)) {
            seenMachineIds.add(machine.id);
            uniqueMachines.push(machine);
          }
        });
      }
      
      set({
        machines: uniqueMachines,
        odpOrders: odpOrders || [],
        phases: phases || [],
        isLoading: false,
        isInitialized: true,
      });
      
      // Initialize empty machine availability like appStore
      get().initializeEmptyMachineAvailability();
      
      // Setup real-time subscriptions after data is loaded (only once)
      if (!window.realtimeChannel) {
        const realtimeChannel = setupRealtimeSubscriptions(set, get);
        if (realtimeChannel) {
          // Store channel reference for cleanup
          window.realtimeChannel = realtimeChannel;
        }
      }
    } catch (error) {
      const appError = handleApiError(error, 'Store Initialization');
      logError(appError, 'Store Initialization');
      set({ isLoading: false, isInitialized: false });
      get().showAlert(appError.userMessage, 'error');
      throw appError;
    }
  },

  // Manual refresh function for debugging or when real-time fails
  refreshData: async () => {
    set({ isLoading: true });
    try {
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
      });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  // Debug function to check for duplicate data
  debugData: () => {
    const state = get();
    
    // Check for duplicate IDs
    const machineIds = state.machines.map(m => m.id);
    const duplicateMachineIds = machineIds.filter((id, index) => machineIds.indexOf(id) !== index);
    // Duplicate machine IDs handled silently
    
    const orderIds = state.odpOrders.map(o => o.id);
    const duplicateOrderIds = orderIds.filter((id, index) => orderIds.indexOf(id) !== index);
    // Duplicate order IDs handled silently
    
    const phaseIds = state.phases.map(p => p.id);
    const duplicatePhaseIds = phaseIds.filter((id, index) => phaseIds.indexOf(id) !== index);
    // Duplicate phase IDs handled silently
  },

  // Clean up duplicate data
  cleanupDuplicates: () => {
    const state = get();
    
    // Remove duplicate machines (keep first occurrence)
    const uniqueMachines = [];
    const seenMachineIds = new Set();
    state.machines.forEach(machine => {
      if (!seenMachineIds.has(machine.id)) {
        seenMachineIds.add(machine.id);
        uniqueMachines.push(machine);
      }
    });
    
    // Remove duplicate orders (keep first occurrence)
    const uniqueOrders = [];
    const seenOrderIds = new Set();
    state.odpOrders.forEach(order => {
      if (!seenOrderIds.has(order.id)) {
        seenOrderIds.add(order.id);
        uniqueOrders.push(order);
      }
    });
    
    // Remove duplicate phases (keep first occurrence)
    const uniquePhases = [];
    const seenPhaseIds = new Set();
    state.phases.forEach(phase => {
      if (!seenPhaseIds.has(phase.id)) {
        seenPhaseIds.add(phase.id);
        uniquePhases.push(phase);
      }
    });
    
    // Update state with deduplicated data
    set({
      machines: uniqueMachines,
      odpOrders: uniqueOrders,
      phases: uniquePhases
    });
  },

  // Set selected work center
  setSelectedWorkCenter: (workCenter) => {
    set({ selectedWorkCenter: workCenter });
  },

  reset: () => {
    // Cleanup real-time subscriptions
    if (window.realtimeChannel) {
      window.realtimeChannel.unsubscribe();
      window.realtimeChannel = null;
    }
    
    set({
      machines: [],
      odpOrders: [],
      phases: [],
      machineAvailability: {},
      isLoading: false,
      isInitialized: false,
      alert: { message: '', type: 'info', isVisible: false }
    });
  },

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

    // Check for overlaps with existing scheduled tasks on the same machine
    const existingTasks = state.odpOrders.filter(o => 
      o.scheduled_machine_id === eventData.machine && 
      o.status === 'SCHEDULED' &&
      o.id !== taskId
    );

    const newStart = new Date(eventData.start_time);
    const newEnd = new Date(eventData.end_time);

    for (const existingTask of existingTasks) {
      const existingStart = new Date(existingTask.scheduled_start_time);
      // Calculate actual end time based on time_remaining instead of stored scheduled_end_time
      const existingTimeRemaining = existingTask.time_remaining || existingTask.duration || 1;
      const existingEnd = new Date(existingStart.getTime() + (existingTimeRemaining * 60 * 60 * 1000));
      
      // Check if tasks overlap (any overlap is invalid)
      if (newStart < existingEnd && newEnd > existingStart) {
        return { error: `Task overlaps with existing scheduled task: ${existingTask.odp_number}` };
      }
    }

    // Check for overlaps with unavailable slots on the same machine
    const newStartDate = toDateString(newStart);
    
    // Check machine availability for the target date
    const dateAvailability = state.machineAvailability[newStartDate];
    if (dateAvailability && Array.isArray(dateAvailability)) {
      const machineAvailability = dateAvailability.find(ma => ma.machine_id === eventData.machine);
      
      if (machineAvailability && machineAvailability.unavailable_hours && Array.isArray(machineAvailability.unavailable_hours)) {
        const targetDateStart = new Date(newStart.getFullYear(), newStart.getMonth(), newStart.getDate());
        
        for (const hour of machineAvailability.unavailable_hours) {
          const hourStart = new Date(targetDateStart.getTime() + parseInt(hour) * 60 * 60 * 1000);
          const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
          
          // Check if task overlaps with unavailable hour
          if (newStart < hourEnd && newEnd > hourStart) {
            return { error: `Task overlaps with unavailable slot at hour ${hour}:00` };
          }
        }
      }
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
      throw e;
    }
  },

  getMachineAvailabilityForDate: async (machineId, dateStr) => {
    try {
      return await apiService.getMachineAvailabilityForDate(machineId, dateStr);
    } catch (e) {
      return [];
    }
  },

  setMachineAvailability: async (machineId, dateStr, unavailableHours) => {
    try {
      // Check for overlaps with existing scheduled tasks on the same machine and date
      const state = get();
      const existingTasks = state.odpOrders.filter(o => 
        o.scheduled_machine_id === machineId && 
        o.status === 'SCHEDULED' &&
        o.scheduled_start_time && 
        o.scheduled_end_time
      );

      const targetDate = new Date(dateStr);
      const targetDateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const targetDateEnd = new Date(targetDateStart.getTime() + 24 * 60 * 60 * 1000);

      for (const task of existingTasks) {
        const taskStart = new Date(task.scheduled_start_time);
        const taskEnd = new Date(task.scheduled_end_time);
        
        // Check if task is on the same date
        if (taskStart < targetDateEnd && taskEnd > targetDateStart) {
          // Check if any unavailable hour overlaps with the task
          for (const hour of unavailableHours) {
            const hourStart = new Date(targetDateStart.getTime() + parseInt(hour) * 60 * 60 * 1000);
            const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
            
            if (hourStart < taskEnd && hourEnd > taskStart) {
              throw new Error(`Cannot set machine unavailable during scheduled task: ${task.odp_number}`);
            }
          }
        }
      }

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
      throw e;
    }
  },

  toggleMachineHourAvailability: async (machineId, dateStr, hour) => {
    try {
      const currentUnavailableHours = await get().getMachineAvailability(machineId, dateStr);
      
      // Convert hour to string for comparison since the database stores them as strings
      const hourStr = hour.toString();
      
      let newUnavailableHours;
      if (currentUnavailableHours.includes(hourStr)) {
        // Remove hour if already unavailable
        newUnavailableHours = currentUnavailableHours.filter(h => h !== hourStr);
      } else {
        // Add hour if not unavailable
        newUnavailableHours = [...currentUnavailableHours, hourStr].sort((a, b) => parseInt(a) - parseInt(b));
      }
      
      await get().setMachineAvailability(machineId, dateStr, newUnavailableHours);
      return true;
    } catch (e) {
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
      return {};
    }
  },

  getMachineAvailability: async (machineId, dateStr) => {
    try {
      // First check if we have cached data
      const dateData = get().machineAvailability[dateStr];
      
      if (dateData && Array.isArray(dateData)) {
        const row = dateData.find(r => r.machine_id === machineId);
        if (row) {
          return row.unavailable_hours || [];
        }
      }
      
      // If no cached data, fetch from API
      const data = await apiService.getMachineAvailabilityForDate(machineId, dateStr);
      
      if (data) {
        // Normalize to strings to keep UI logic consistent
        const normalizedHours = (data.unavailable_hours || []).map(h => h.toString());
        // Cache the data for future use
        set(state => {
          const next = { ...state.machineAvailability };
          if (!next[dateStr]) next[dateStr] = [];
          const existingRow = next[dateStr].find(r => r.machine_id === machineId);
          
          if (existingRow) {
            existingRow.unavailable_hours = normalizedHours;
          } else {
            next[dateStr].push({
              machine_id: machineId,
              date: dateStr,
              unavailable_hours: normalizedHours
            });
          }
          
          return { machineAvailability: next };
        });
        return normalizedHours;
      }
      return [];
    } catch (error) {
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
      throw e;
    }
  },

  isMachineAvailabilityAccessible: async () => {
    try {
      await apiService.getMachineAvailabilityForDateAllMachines('2025-01-01');
      return true;
    } catch (e) {
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


