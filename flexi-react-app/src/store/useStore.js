import { create } from 'zustand';
import { storageService } from '../scripts/storageService.js';

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
    await storageService.init();
    if (isInitialized) return;
    set({ isLoading: true });
    const [machines, odpOrders, phases] = await Promise.all([
      storageService.get_machines(),
      storageService.get_odp_orders(),
      storageService.get_phases(),
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
    const added = await storageService.add_machine(newMachine);
    set(state => ({ machines: [...state.machines, added] }));
    return added;
  },
  updateMachine: async (id, updates) => {
    const updated = await storageService.update_machine(id, updates);
    set(state => ({
      machines: state.machines.map(m => (m.id === id ? { ...m, ...updated } : m)),
    }));
    return updated;
  },
  removeMachine: async (id) => {
    await storageService.remove_machine(id);
    set(state => ({ machines: state.machines.filter(m => m.id !== id) }));
    return true;
  },

  // Orders (ODP)
  addOdpOrder: async (newOrder) => {
    const added = await storageService.add_odp_order(newOrder);
    set(state => ({ odpOrders: [...state.odpOrders, added] }));
    return added;
  },
  updateOdpOrder: async (id, updates) => {
    const updated = await storageService.update_odp_order(id, updates);
    set(state => ({
      odpOrders: state.odpOrders.map(o => (o.id === id ? { ...o, ...updated } : o)),
    }));
    return updated;
  },
  removeOdpOrder: async (id) => {
    await storageService.remove_odp_order(id);
    set(state => ({ odpOrders: state.odpOrders.filter(o => o.id !== id) }));
    return true;
  },

  // Phases
  addPhase: async (newPhase) => {
    const added = await storageService.add_phase(newPhase);
    set(state => ({ phases: [...state.phases, added] }));
    return added;
  },
  updatePhase: async (id, updates) => {
    const updated = await storageService.update_phase(id, updates);
    set(state => ({
      phases: state.phases.map(p => (p.id === id ? { ...p, ...updated } : p)),
    }));
    return updated;
  },
  removePhase: async (id) => {
    await storageService.remove_phase(id);
    set(state => ({ phases: state.phases.filter(p => p.id !== id) }));
    return true;
  },

  // Scheduler actions
  scheduleTask: async (taskId, eventData) => {
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
  getMachineAvailabilityForDate: async (machineName, dateStr) => {
    try {
      return await storageService.get_machine_availability_for_date(machineName, dateStr);
    } catch (e) {
      console.error('Error get_machine_availability_for_date:', e);
      return [];
    }
  },

  setMachineAvailability: async (machineName, dateStr, hours) => {
    try {
      await storageService.set_machine_availability(machineName, dateStr, hours);
      set(state => {
        const next = { ...state.machineAvailability };
        if (!next[dateStr]) next[dateStr] = [];
        const row = next[dateStr].find(r => r.machine_name === machineName);
        if (row) row.unavailable_hours = hours;
        else next[dateStr].push({ machine_name: machineName, date: dateStr, unavailable_hours: hours });
        return { machineAvailability: next };
      });
      return true;
    } catch (e) {
      console.error('Error set_machine_availability:', e);
      throw e;
    }
  },

  loadMachineAvailabilityForDate: async (dateStr) => {
    const { machineAvailability } = get();
    if (machineAvailability[dateStr]?._loading) return;
    if (machineAvailability[dateStr] && machineAvailability[dateStr].length >= 0) return;
    set(state => ({ machineAvailability: { ...state.machineAvailability, [dateStr]: { _loading: true } } }));
    try {
      const data = await storageService.get_machine_availability_for_date_all_machines(dateStr);
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
        await storageService.get_machine_availability_for_date('test', '2025-01-01');
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

  getMachineAvailability: (machineName, dateStr) => {
    const dateData = get().machineAvailability[dateStr];
    if (!dateData || !Array.isArray(dateData)) return [];
    const row = dateData.find(r => r.machine_name === machineName);
    return row ? row.unavailable_hours || [] : [];
  },

  isTimeSlotUnavailable: (machineName, dateStr, hour) => {
    const hours = get().getMachineAvailability(machineName, dateStr);
    return hours.includes(hour);
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
      return await storageService.get_events_by_date(dateStr);
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
      await storageService.setUnavailableHoursForRange(machineName, startDate, endDate, startTime, endTime);
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
      await storageService.get_machine_availability_for_date_all_machines('2025-01-01');
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


