import { create } from 'zustand';
import { apiService } from '../services';
import { toDateString, addDaysToDate, addHoursToDate } from '../utils/dateUtils';
import { useOrderStore } from './useOrderStore';
import { useMachineStore } from './useMachineStore';

export const useSchedulerStore = create((set, get) => ({
  // State
  machineAvailability: {},

  // Selectors
  getMachineAvailability: () => get().machineAvailability,

  // Actions
  setMachineAvailability: (availability) => set({ machineAvailability: availability }),

  // Consolidated drag-and-drop methods
  scheduleTaskFromSlot: async (taskId, machine, currentDate, hour, minute) => {
    try {
      // Get task and machine data
      const { getOdpOrderById } = useOrderStore.getState();
      const { getMachineById } = useMachineStore.getState();
      const task = getOdpOrderById(taskId);
      const machineData = getMachineById(machine.id);

      if (!task || !machineData) {
        return { error: 'Task or machine not found' };
      }

      // Calculate start and end times
      const startDate = new Date(currentDate);
      startDate.setHours(hour, minute, 0, 0);
      const timeRemainingHours = task.time_remaining || task.duration || 1;
      const endDate = addHoursToDate(startDate, timeRemainingHours);

      // Create schedule data
      const scheduleData = {
        machine: machine.id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      };

      // Use existing scheduleTask method with all validations
      return await get().scheduleTask(taskId, scheduleData);
    } catch (error) {
      return { error: 'An error occurred during scheduling' };
    }
  },

  rescheduleTaskToSlot: async (eventId, machine, currentDate, hour, minute) => {
    try {
      // Get event data
      const { getOdpOrderById } = useOrderStore.getState();
      const { getMachineById } = useMachineStore.getState();
      const eventItem = getOdpOrderById(eventId);
      const machineData = getMachineById(machine.id);

      if (!eventItem || !machineData) {
        return { error: 'Event or machine not found' };
      }

      // Calculate start and end times
      const startDate = new Date(currentDate);
      startDate.setHours(hour, minute, 0, 0);
      const timeRemainingHours = eventItem.time_remaining || eventItem.duration || 1;
      const endDate = addHoursToDate(startDate, timeRemainingHours);

      // Create schedule data
      const scheduleData = {
        machine: machine.id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      };

      // Use existing scheduleTask method with all validations
      return await get().scheduleTask(eventId, scheduleData);
    } catch (error) {
      return { error: 'An error occurred during rescheduling' };
    }
  },

  validateSlotAvailability: async (machine, currentDate, hour, minute) => {
    try {
      // Check if slot is unavailable
      const dateStr = toDateString(currentDate);
      const isUnavailable = await get().isTimeSlotUnavailable(machine.id, dateStr, hour);
      
      if (isUnavailable) {
        return { error: 'Cannot schedule task on unavailable time slot' };
      }

      // Check if slot already has a scheduled task
      const { getOdpOrders } = useOrderStore.getState();
      const startDate = new Date(currentDate);
      startDate.setHours(hour, minute, 0, 0);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour slot

      const existingTasks = getOdpOrders().filter(o => 
        o.scheduled_machine_id === machine.id && 
        o.status === 'SCHEDULED' &&
        o.scheduled_start_time
      );

      for (const existingTask of existingTasks) {
        const existingStart = new Date(existingTask.scheduled_start_time);
        const existingTimeRemaining = existingTask.time_remaining || existingTask.duration || 1;
        const existingEnd = new Date(existingStart.getTime() + (existingTimeRemaining * 60 * 60 * 1000));
        
        // Check if the new time slot overlaps with existing task
        if (startDate < existingEnd && endDate > existingStart) {
          return { error: 'Cannot schedule task on occupied time slot' };
        }
      }

      return { success: true };
    } catch (error) {
      return { error: 'Error validating slot availability' };
    }
  },

  // Scheduler actions
  scheduleTask: async (taskId, eventData) => {
    // Validate work_center compatibility before scheduling
    const { getOdpOrderById } = useOrderStore.getState();
    const { getMachineById } = useMachineStore.getState();
    const task = getOdpOrderById(taskId);
    const machine = getMachineById(eventData.machine);
    if (task && machine && task.work_center && machine.work_center && task.work_center !== machine.work_center) {
      return { error: `Work center mismatch: task requires '${task.work_center}' but machine is '${machine.work_center}'` };
    }

    // Check for overlaps with existing scheduled tasks on the same machine
    const { getOdpOrders } = useOrderStore.getState();
    const existingTasks = getOdpOrders().filter(o => 
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
    const dateAvailability = get().machineAvailability[newStartDate];
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
    
    // Call the update method from the order store
    const { updateOdpOrder } = useOrderStore.getState();
    await updateOdpOrder(taskId, updates);
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
    
    // Call the update method from the order store
    const { updateOdpOrder } = useOrderStore.getState();
    await updateOdpOrder(taskId, updates);
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
      const { getOdpOrders } = useOrderStore.getState();
      const existingTasks = getOdpOrders().filter(o => 
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

  // Additional methods
  initializeEmptyMachineAvailability: () => {
    const { machines } = useMachineStore.getState();
    const { machineAvailability } = get();
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

  reset: () => set({ machineAvailability: {} }),
}));
