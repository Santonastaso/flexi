import { create } from 'zustand';
import { apiService } from '../services';

// Zustand store that mirrors the existing appStore.js API
export const useStore = create((set, get) => ({
  // State (mirror appStore.js)
  machines: [],
  odpOrders: [],
  phases: [],
  machineAvailability: {},
  isLoading: false,
  isInitialized: false,

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
      apiService.get_machines(),
      apiService.get_odp_orders(),
      apiService.get_phases(),
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

  reset: () => set({
    machines: [],
    odpOrders: [],
    phases: [],
    machineAvailability: {},
    isLoading: false,
    isInitialized: false,
  }),

  // Machines
  addMachine: async (newMachine) => {
    const added = await apiService.add_machine(newMachine);
    set(state => ({ machines: [...state.machines, added] }));
    return added;
  },
  updateMachine: async (id, updates) => {
    const updated = await apiService.update_machine(id, updates);
    set(state => ({
      machines: state.machines.map(m => (m.id === id ? { ...m, ...updated } : m)),
    }));
    return updated;
  },
  removeMachine: async (id) => {
    await apiService.remove_machine(id);
    set(state => ({ machines: state.machines.filter(m => m.id !== id) }));
    return true;
  },

  // Orders (ODP)
  addOdpOrder: async (newOrder) => {
    const added = await apiService.add_odp_order(newOrder);
    set(state => ({ odpOrders: [...state.odpOrders, added] }));
    return added;
  },
  updateOdpOrder: async (id, updates) => {
    const updated = await apiService.update_odp_order(id, updates);
    set(state => ({
      odpOrders: state.odpOrders.map(o => (o.id === id ? { ...o, ...updated } : o)),
    }));
    return updated;
  },
  removeOdpOrder: async (id) => {
    await apiService.remove_odp_order(id);
    set(state => ({ odpOrders: state.odpOrders.filter(o => o.id !== id) }));
    return true;
  },

  // Phases
  addPhase: async (newPhase) => {
    const added = await apiService.add_phase(newPhase);
    set(state => ({ phases: [...state.phases, added] }));
    return added;
  },
  updatePhase: async (id, updates) => {
    const updated = await apiService.update_phase(id, updates);
    set(state => ({
      phases: state.phases.map(p => (p.id === id ? { ...p, ...updated } : p)),
    }));
    return updated;
  },
  removePhase: async (id) => {
    await apiService.remove_phase(id);
    set(state => ({ phases: state.phases.filter(p => p.id !== id) }));
    return true;
  },

  // Scheduler actions
  scheduleTask: async (taskId, eventData) => {
    // Validate work_center compatibility before scheduling
    const state = get();
    const task = state.odpOrders.find(o => o.id === taskId);
    const machine = state.machines.find(m => m.id === eventData.machine);
    if (task && machine && task.work_center && machine.work_center && task.work_center !== machine.work_center) {
      throw new Error(`Work center mismatch: task requires '${task.work_center}' but machine is '${machine.work_center}'`);
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
  loadMachineAvailabilityForDateRange: async (machineName, startDate, endDate) => {
    try {
      const { machineAvailability } = get();
      const cacheKey = `${machineName}_${startDate}_${endDate}`;
      
      // Check if we already have this data cached
      if (machineAvailability[cacheKey]?._loading) return;
      if (machineAvailability[cacheKey] && !machineAvailability[cacheKey]._loading) return;
      
      set(state => ({ 
        machineAvailability: { 
          ...state.machineAvailability, 
          [cacheKey]: { _loading: true } 
        } 
      }));
      
      const data = await apiService.get_machine_availability_for_date_range(machineName, startDate, endDate);
      
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

  getMachineAvailabilityForDate: async (machineName, dateStr) => {
    try {
      return await apiService.get_machine_availability_for_date(machineName, dateStr);
    } catch (e) {
      console.error('Error get_machine_availability_for_date:', e);
      return [];
    }
  },

  setMachineAvailability: async (machineName, dateStr, unavailableHours) => {
    try {
      await apiService.set_machine_availability(machineName, dateStr, unavailableHours);
      set(state => {
        const next = { ...state.machineAvailability };
        if (!next[dateStr]) next[dateStr] = [];
        const row = next[dateStr].find(r => r.machine_name === machineName);
        if (row) row.unavailable_hours = unavailableHours;
        else next[dateStr].push({ machine_name: machineName, date: dateStr, unavailable_hours: unavailableHours });
        return { machineAvailability: next };
      });
      return true;
    } catch (e) {
      console.error('Error set_machine_availability:', e);
      throw e;
    }
  },

  toggleMachineHourAvailability: async (machineName, dateStr, hour) => {
    try {
      console.log(`Store: Toggling hour ${hour} for ${dateStr} on machine ${machineName}`);
      const currentUnavailableHours = await get().getMachineAvailability(machineName, dateStr);
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
      
      await get().setMachineAvailability(machineName, dateStr, newUnavailableHours);
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
      const data = await apiService.get_machine_availability_for_date_all_machines(dateStr);
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

  loadMachineAvailabilityForMachine: async (machineName, startDate, endDate) => {
    const result = {};
    try {
      try {
        await apiService.get_machine_availability_for_date('test', '2025-01-01');
      } catch (tableError) {
        console.warn('Machine availability table not accessible:', tableError.message);
        return {};
      }
      const current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        const existing = get().machineAvailability[dateStr];
        if (!existing) {
          await get().loadMachineAvailabilityForDate(dateStr);
        }
        const dayData = get().machineAvailability[dateStr];
        if (Array.isArray(dayData)) {
          const row = dayData.find(r => r.machine_name === machineName);
          if (row) result[dateStr] = row.unavailable_hours || [];
        }
        current.setDate(current.getDate() + 1);
      }
      return result;
    } catch (e) {
      console.error('Error load_machine_availability_for_machine:', e);
      return {};
    }
  },

  getMachineAvailability: async (machineName, dateStr) => {
    try {
      console.log(`Store: Getting availability for ${machineName} on ${dateStr}`);
      
      // First check if we have cached data
      const dateData = get().machineAvailability[dateStr];
      console.log(`Store: Cached dateData for ${dateStr}:`, dateData);
      
      if (dateData && Array.isArray(dateData)) {
        const row = dateData.find(r => r.machine_name === machineName);
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
      const data = await apiService.get_machine_availability_for_date(machineName, dateStr);
      console.log(`Store: API returned data:`, data);
      
      if (data) {
        // Normalize to strings to keep UI logic consistent
        const normalizedHours = (data.unavailable_hours || []).map(h => h.toString());
        // Cache the data for future use
        set(state => {
          const next = { ...state.machineAvailability };
          if (!next[dateStr]) next[dateStr] = [];
          const existingRow = next[dateStr].find(r => r.machine_name === machineName);
          
          console.log(`Store: Before cache update - data.unavailable_hours:`, data.unavailable_hours);
          console.log(`Store: Before cache update - type:`, typeof data.unavailable_hours);
          console.log(`Store: Before cache update - isArray:`, Array.isArray(data.unavailable_hours));
          
          if (existingRow) {
            existingRow.unavailable_hours = normalizedHours;
            console.log(`Store: Updated existing row - unavailable_hours:`, existingRow.unavailable_hours);
          } else {
            next[dateStr].push({
              machine_name: machineName,
              date: dateStr,
              unavailable_hours: normalizedHours
            });
            console.log(`Store: Added new row - unavailable_hours:`, next[dateStr][next[dateStr].length - 1].unavailable_hours);
          }
          
          console.log(`Store: Updated cache for ${dateStr}:`, next[dateStr]);
          console.log(`Store: Cache row unavailable_hours type:`, typeof next[dateStr].find(r => r.machine_name === machineName)?.unavailable_hours);
          console.log(`Store: Cache row unavailable_hours isArray:`, Array.isArray(next[dateStr].find(r => r.machine_name === machineName)?.unavailable_hours));
          
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

  isTimeSlotUnavailable: async (machineName, dateStr, hour) => {
    const hours = await get().getMachineAvailability(machineName, dateStr);
    return hours.includes(hour.toString());
  },

  // Additional methods to mirror appStore
  initializeEmptyMachineAvailability: () => {
    const { machines, machineAvailability } = get();
    const next = { ...machineAvailability };
    machines.forEach(machine => {
      if (!next[machine.machine_name]) {
        next[machine.machine_name] = {};
      }
    });
    set({ machineAvailability: next });
  },

  getEventsByDate: async (dateStr) => {
    try {
      return await apiService.get_events_by_date(dateStr);
    } catch (e) {
      console.error('Error getting events by date:', e);
      return [];
    }
  },

  setMachineUnavailability: async (machineName, startDate, endDate, startTime, endTime) => {
    try {
      const isAccessible = await get().isMachineAvailabilityAccessible();
      if (!isAccessible) {
        throw new Error('Machine availability table is not accessible.');
      }
      await apiService.setUnavailableHoursForRange(machineName, startDate, endDate, startTime, endTime);
      const startDateObj = new Date(startDate.split('/').reverse().join('-'));
      const endDateObj = new Date(endDate.split('/').reverse().join('-'));
      await get().loadMachineAvailabilityForMachine(machineName, startDateObj, endDateObj);
      return true;
    } catch (e) {
      console.error('Error setting machine unavailability:', e);
      throw e;
    }
  },

  isMachineAvailabilityAccessible: async () => {
    try {
      await apiService.get_machine_availability_for_date_all_machines('2025-01-01');
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


