import { create } from 'zustand';
import { apiService } from '../services';
import { toDateString, addDaysToDate, addHoursToDate } from '../utils/dateUtils';
import { handleApiError } from '../utils/errorUtils';
import { useOrderStore } from './useOrderStore';
import { useMachineStore } from './useMachineStore';
import { useUIStore } from './useUIStore';

export const useSchedulerStore = create((set, get) => ({
  // State
  machineAvailability: {},
  shuntPreview: null, // Stores the preview of tasks that will be shunted

  // Selectors
  getMachineAvailabilityState: () => get().machineAvailability,

  // Actions
  setMachineAvailabilityState: (availability) => set({ machineAvailability: availability }),
  setShuntPreview: (preview) => set({ shuntPreview: preview }),
  clearShuntPreview: () => set({ shuntPreview: null }),

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
        // Instead of returning an error, return a conflict object
        return { 
          conflict: true,
          conflictingTask: existingTask,
          draggedTask: task,
          proposedStartTime: eventData.start_time,
          proposedEndTime: eventData.end_time,
          machine: machine
        };
      }
    }

    // Check for overlaps with unavailable slots on the same machine across all days the task spans
    const taskStartDate = new Date(newStart.getFullYear(), newStart.getMonth(), newStart.getDate());
    const taskEndDate = new Date(newEnd.getFullYear(), newEnd.getMonth(), newEnd.getDate());
    
    // Generate all dates between start and end (inclusive)
    const datesToCheck = [];
    let currentDate = new Date(taskStartDate);
    while (currentDate <= taskEndDate) {
      datesToCheck.push(toDateString(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Check each date for unavailable slots
    for (const dateStr of datesToCheck) {
      const dateAvailability = get().machineAvailability[dateStr];
      if (dateAvailability && Array.isArray(dateAvailability)) {
        const machineAvailability = dateAvailability.find(ma => ma.machine_id === eventData.machine);
        
        if (machineAvailability && machineAvailability.unavailable_hours && Array.isArray(machineAvailability.unavailable_hours)) {
          const targetDateStart = new Date(new Date(dateStr).getFullYear(), new Date(dateStr).getMonth(), new Date(dateStr).getDate());
          
          for (const hour of machineAvailability.unavailable_hours) {
            const hourStart = new Date(targetDateStart.getTime() + parseInt(hour) * 60 * 60 * 1000);
            const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
            
            // Check if task overlaps with unavailable hour
            if (newStart < hourEnd && newEnd > hourStart) {
              const dateObj = new Date(dateStr);
              const formattedDate = dateObj.toLocaleDateString('en-GB'); // dd/mm/yyyy format
              return { error: `Task overlaps with unavailable slot at hour ${hour}:00 on ${formattedDate}` };
            }
          }
        }
      }
    }

    const updates = {
      scheduled_machine_id: eventData.machine,
      scheduled_start_time: eventData.start_time,
      scheduled_end_time: eventData.end_time,
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
    
    try {
      const data = await apiService.getMachineAvailabilityForDateRange(machineId, startDateStr, endDateStr);
      
      // Store the data in the proper date-based structure that the rest of the system expects
      set(state => {
        const next = { ...state.machineAvailability };
        
        // Process each date from the API response
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.date && item.unavailable_hours) {
              const dateStr = item.date;
              
              // Ensure the date array exists
              if (!next[dateStr]) {
                next[dateStr] = [];
              }
              
              // Find existing machine data for this date
              const existingMachineData = next[dateStr].find(r => r.machine_id === machineId);
              
              if (existingMachineData) {
                // Update existing machine data
                existingMachineData.unavailable_hours = item.unavailable_hours;
              } else {
                // Add new machine data
                next[dateStr].push({
                  machine_id: machineId,
                  date: dateStr,
                  unavailable_hours: item.unavailable_hours
                });
              }
            }
          });
        }
        
        return { machineAvailability: next };
      });
      
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
          // Check if any unavailable hour overlaps with scheduled task
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
      
      // Show success alert
      useUIStore.getState().showAlert(`Machine availability updated successfully for ${dateStr}`, 'success');
      return true;
    } catch (error) {
      // Use centralized error handling
      const appError = handleApiError(error, 'Machine Availability');
      useUIStore.getState().showAlert(appError.message, 'error');
      throw appError;
    }
  },

  toggleMachineHourAvailability: async (machineId, dateStr, hour) => {
    try {
      const currentUnavailableHours = await get().getMachineAvailability(machineId, dateStr);
      
      const hourStr = hour.toString();
      
      let newUnavailableHours;
      if (currentUnavailableHours.includes(hourStr)) {
        newUnavailableHours = currentUnavailableHours.filter(h => h !== hourStr);
      } else {
        newUnavailableHours = [...currentUnavailableHours, hourStr].sort((a, b) => parseInt(a) - parseInt(b));
      }
      
      // First, update the database via the API service.
      await apiService.setMachineAvailability(machineId, dateStr, newUnavailableHours);
      
      // After the API call succeeds, directly update the state.
      set(state => {
        const next = { ...state.machineAvailability };
        
        if (!next[dateStr]) {
          next[dateStr] = [];
        }
        
        const existingMachineData = next[dateStr].find(r => r.machine_id === machineId);
        
        if (existingMachineData) {
          existingMachineData.unavailable_hours = newUnavailableHours;
        } else {
          next[dateStr].push({
            machine_id: machineId,
            date: dateStr,
            unavailable_hours: newUnavailableHours
          });
        }
        
        return { machineAvailability: next };
      });

      // Show success alert
      useUIStore.getState().showAlert(`Time slot ${hourStr}:00 updated successfully`, 'success');
      return true;
    } catch (error) {
      // Use centralized error handling
      const appError = handleApiError(error, 'Machine Availability');
      useUIStore.getState().showAlert(appError.message, 'error');
      throw appError;
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
      const updatedData = await get().loadMachineAvailabilityForDateRange(machineId, startDateObj, endDateObj);
      
      // Update the store in the format that CalendarGrid expects
      if (updatedData && Array.isArray(updatedData)) {
        set(state => {
          const next = { ...state.machineAvailability };
          
          // Process each date in the updated data
          updatedData.forEach(item => {
            if (item.date && item.unavailable_hours) {
              const dateStr = toDateString(new Date(item.date));
              
              // Initialize the date array if it doesn't exist
              if (!next[dateStr]) {
                next[dateStr] = [];
              }
              
              // Find existing machine data for this date
              const existingMachineData = next[dateStr].find(r => r.machine_id === machineId);
              
              if (existingMachineData) {
                // Update existing machine data
                existingMachineData.unavailable_hours = item.unavailable_hours;
              } else {
                // Add new machine data
                next[dateStr].push({
                  machine_id: machineId,
                  date: dateStr,
                  unavailable_hours: item.unavailable_hours
                });
              }
            }
          });
          
          return { machineAvailability: next };
        });
      }
      
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

  // Resolve conflict by shunting tasks in the chosen direction
  resolveConflictByShunting: async (conflictDetails, direction) => {
    try {
      console.log('=== SHUNTING DEBUG START ===');
      console.log('Conflict Details:', conflictDetails);
      console.log('Direction:', direction);
      
      const { conflictingTask, draggedTask, proposedStartTime, machine } = conflictDetails;
      const { updateOdpOrder } = useOrderStore.getState();
      const { getOdpOrders } = useOrderStore.getState();
      
            // Get all scheduled tasks on this machine
      const scheduledTasks = getOdpOrders().filter(o => 
        o.scheduled_machine_id === machine.id && 
        o.status === 'SCHEDULED' &&
        o.id !== draggedTask.id
      ).sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time));
      
      console.log('All scheduled tasks on machine:', scheduledTasks.map(t => ({
        id: t.id,
        odp: t.odp_number,
        start: t.scheduled_start_time,
        duration: t.time_remaining || t.duration,
        end: new Date(new Date(t.scheduled_start_time).getTime() + ((t.time_remaining || t.duration || 1) * 60 * 60 * 1000)).toISOString()
      })));
      
      // Find the conflicting task index
      const conflictIndex = scheduledTasks.findIndex(t => t.id === conflictingTask.id);
      console.log('Conflict index:', conflictIndex);
      if (conflictIndex === -1) return { error: 'Conflicting task not found' };
        
        // Helper functions for precise minute-based calculations
        const getTaskDurationMinutes = (task) => {
          return Math.round((task.time_remaining || task.duration || 1) * 60);
        };
        
        const getTaskEndTime = (task) => {
          const startTime = new Date(task.scheduled_start_time);
          const durationMinutes = getTaskDurationMinutes(task);
          const endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
          return endTime;
        };
        
        const addMinutesToDate = (date, minutes) => {
          return new Date(date.getTime() + (minutes * 60 * 1000));
        };
        
        // Helper function to round up to the next 15-minute slot
        const roundUpToNext15MinSlot = (date) => {
          const minutes = date.getMinutes();
          const hours = date.getHours();
          const nextSlot = Math.ceil(minutes / 15) * 15;
          const roundedDate = new Date(date);
          
          if (nextSlot === 60) {
            roundedDate.setHours(hours + 1, 0, 0, 0);
          } else {
            roundedDate.setMinutes(nextSlot, 0, 0);
          }
          
          return roundedDate;
        };
        
        // Multi-day unavailable-slot adjusters for shunted tasks
        const adjustForUnavailableSlotsForward = (startTime, durationMinutes) => {
          let adjustedStartTime = new Date(startTime);
          let adjustedEndTime = addMinutesToDate(adjustedStartTime, durationMinutes);
          let attempts = 0;
          const maxAttempts = 10;
          let moved = true;
          
          while (moved && attempts < maxAttempts) {
            attempts++;
            moved = false;
            console.log(`    [UNAV-FWD] Checking shunted task span from ${adjustedStartTime.toISOString()} to ${adjustedEndTime.toISOString()}`);
            const scanStart = new Date(adjustedStartTime);
            const scanEnd = new Date(adjustedEndTime);
            // We'll jump to the earliest immediately-available time that resolves the first conflict
            let earliestAvailableStart = null;
            
            const cursor = new Date(scanStart);
            cursor.setHours(0,0,0,0);
            // Ensure we start scanning from the day of adjustedStartTime
            if (cursor < new Date(scanStart.getFullYear(), scanStart.getMonth(), scanStart.getDate())) {
              cursor.setTime(new Date(scanStart.getFullYear(), scanStart.getMonth(), scanStart.getDate()).getTime());
            }
            while (cursor <= scanEnd) {
              const dateStr = toDateString(cursor);
              const dayAvailability = get().machineAvailability[dateStr];
              console.log(`    [UNAV-FWD] Checking day: ${dateStr}`);
              if (dayAvailability && Array.isArray(dayAvailability)) {
                const machineData = dayAvailability.find(ma => ma.machine_id === machine.id);
                if (machineData && Array.isArray(machineData.unavailable_hours) && machineData.unavailable_hours.length) {
                  console.log(`    [UNAV-FWD] Unavailable hours: [${machineData.unavailable_hours.join(', ')}]`);
                  let dayStartHour = 0;
                  let dayEndHour = 24;
                  
                  if (cursor.toDateString() === scanStart.toDateString()) {
                    dayStartHour = scanStart.getHours();
                  }
                  if (cursor.toDateString() === scanEnd.toDateString()) {
                    dayEndHour = scanEnd.getHours() + (scanEnd.getMinutes() > 0 ? 1 : 0);
                  }
                  console.log(`    [UNAV-FWD] Occupied hours ${dayStartHour}-${dayEndHour}`);
                  const unavSet = new Set(machineData.unavailable_hours.map(h => h.toString()));
                  for (let hour = dayStartHour; hour < dayEndHour; hour++) {
                    if (unavSet.has(hour.toString())) {
                      // Jump to the first available hour after the consecutive unavailable block starting at this hour
                      let nextAvailableHour = hour + 1;
                      while (nextAvailableHour < 24 && unavSet.has(nextAvailableHour.toString())) {
                        nextAvailableHour++;
                      }
                      const candidate = new Date(cursor);
                      candidate.setHours(nextAvailableHour, 0, 0, 0);
                      if (!earliestAvailableStart || candidate < earliestAvailableStart) {
                        earliestAvailableStart = candidate;
                      }
                      console.log(`    [UNAV-FWD] Found unavailable hour ${hour}, candidate jump to ${candidate.toISOString()}`);
                      break;
                    }
                  }
                }
              }
              cursor.setDate(cursor.getDate() + 1);
              cursor.setHours(0,0,0,0);
            }
            if (earliestAvailableStart && earliestAvailableStart > adjustedStartTime) {
              adjustedStartTime = roundUpToNext15MinSlot(earliestAvailableStart);
              adjustedEndTime = addMinutesToDate(adjustedStartTime, durationMinutes);
              moved = true;
            }
          }
          if (attempts >= maxAttempts) {
            console.log('    [UNAV-FWD] WARNING: Max attempts reached');
          }
          return { startTime: adjustedStartTime, endTime: adjustedEndTime };
        };
        
        const adjustForUnavailableSlotsBackward = (startTime, durationMinutes) => {
          // startTime is the intended start; we'll compute end as start+duration and move backward if conflicts
          let adjustedStartTime = new Date(startTime);
          let adjustedEndTime = addMinutesToDate(adjustedStartTime, durationMinutes);
          let attempts = 0;
          const maxAttempts = 10;
          let moved = true;
          
          while (moved && attempts < maxAttempts) {
            attempts++;
            moved = false;
            console.log(`    [UNAV-BWD] Checking shunted task span from ${adjustedStartTime.toISOString()} to ${adjustedEndTime.toISOString()}`);
            const scanStart = new Date(adjustedStartTime);
            const scanEnd = new Date(adjustedEndTime);
            // We'll move the task to end right before the first conflicting hour encountered
            let earliestUnavailableStart = null;
            
            const cursor = new Date(scanStart);
            cursor.setHours(0,0,0,0);
            if (cursor < new Date(scanStart.getFullYear(), scanStart.getMonth(), scanStart.getDate())) {
              cursor.setTime(new Date(scanStart.getFullYear(), scanStart.getMonth(), scanStart.getDate()).getTime());
            }
            while (cursor <= scanEnd) {
              const dateStr = toDateString(cursor);
              const dayAvailability = get().machineAvailability[dateStr];
              console.log(`    [UNAV-BWD] Checking day: ${dateStr}`);
              if (dayAvailability && Array.isArray(dayAvailability)) {
                const machineData = dayAvailability.find(ma => ma.machine_id === machine.id);
                if (machineData && Array.isArray(machineData.unavailable_hours) && machineData.unavailable_hours.length) {
                  console.log(`    [UNAV-BWD] Unavailable hours: [${machineData.unavailable_hours.join(', ')}]`);
                  let dayStartHour = 0;
                  let dayEndHour = 24;
                  if (cursor.toDateString() === scanStart.toDateString()) dayStartHour = scanStart.getHours();
                  if (cursor.toDateString() === scanEnd.toDateString()) dayEndHour = scanEnd.getHours() + (scanEnd.getMinutes() > 0 ? 1 : 0);
                  console.log(`    [UNAV-BWD] Occupied hours ${dayStartHour}-${dayEndHour}`);
                  const unavSet = new Set(machineData.unavailable_hours.map(h => h.toString()));
                  for (let hour = dayStartHour; hour < dayEndHour; hour++) {
                    if (unavSet.has(hour.toString())) {
                      // End the task right before the first conflicting hour in this window
                      const unavailableStart = new Date(cursor);
                      unavailableStart.setHours(hour, 0, 0, 0);
                      if (!earliestUnavailableStart || unavailableStart < earliestUnavailableStart) earliestUnavailableStart = unavailableStart;
                      console.log(`    [UNAV-BWD] Found unavailable hour ${hour}, candidate end at ${unavailableStart.toISOString()}`);
                      break;
                    }
                  }
                }
              }
              cursor.setDate(cursor.getDate() + 1);
              cursor.setHours(0,0,0,0);
            }
            if (earliestUnavailableStart && earliestUnavailableStart < adjustedEndTime) {
              adjustedEndTime = earliestUnavailableStart;
              adjustedStartTime = addMinutesToDate(adjustedEndTime, -durationMinutes);
              moved = true;
            }
          }
          if (attempts >= maxAttempts) {
            console.log('    [UNAV-BWD] WARNING: Max attempts reached');
          }
          return { startTime: adjustedStartTime, endTime: adjustedEndTime };
        };
        
        // Calculate the duration of the dragged task in minutes
        const draggedDurationMinutes = getTaskDurationMinutes(draggedTask);
        console.log('Dragged task duration (minutes):', draggedDurationMinutes);
        
        // Find contiguous tasks that need to be shunted
        const affectedTasks = [];
        let gapFound = false;
        
        if (direction === 'right') {
          console.log('=== RIGHT DIRECTION ANALYSIS ===');
          // Push tasks to the right starting from the conflicting task
          for (let i = conflictIndex; i < scheduledTasks.length && !gapFound; i++) {
            const currentTask = scheduledTasks[i];
            affectedTasks.push(currentTask);
            console.log(`Adding task ${currentTask.odp_number} to affected tasks`);
            
            if (i < scheduledTasks.length - 1) {
              const nextTask = scheduledTasks[i + 1];
              const currentEnd = getTaskEndTime(currentTask);
              const nextStart = new Date(nextTask.scheduled_start_time);
              const gapMinutes = Math.floor((nextStart.getTime() - currentEnd.getTime()) / (60 * 1000));
              
              console.log(`Gap between ${currentTask.odp_number} and ${nextTask.odp_number}: ${gapMinutes} minutes`);
              console.log(`Current end: ${currentEnd.toISOString()}, Next start: ${nextStart.toISOString()}`);
              
              if (gapMinutes >= draggedDurationMinutes) {
                console.log(`Found sufficient gap: ${gapMinutes} >= ${draggedDurationMinutes}`);
                gapFound = true;
              }
            } else {
              console.log('Last task reached, infinite space after');
              gapFound = true; // Last task, infinite space after
            }
          }
        } else {
          console.log('=== LEFT DIRECTION ANALYSIS ===');
          // Push tasks to the left starting from the conflicting task
          for (let i = conflictIndex; i >= 0 && !gapFound; i--) {
            const currentTask = scheduledTasks[i];
            affectedTasks.unshift(currentTask);
            console.log(`Adding task ${currentTask.odp_number} to affected tasks (left)`);
            
            if (i > 0) {
              const prevTask = scheduledTasks[i - 1];
              const prevEnd = getTaskEndTime(prevTask);
              const currentStart = new Date(currentTask.scheduled_start_time);
              const gapMinutes = Math.floor((currentStart.getTime() - prevEnd.getTime()) / (60 * 1000));
              
              console.log(`Gap between ${prevTask.odp_number} and ${currentTask.odp_number}: ${gapMinutes} minutes`);
              console.log(`Prev end: ${prevEnd.toISOString()}, Current start: ${currentStart.toISOString()}`);
              
              if (gapMinutes >= draggedDurationMinutes) {
                console.log(`Found sufficient gap: ${gapMinutes} >= ${draggedDurationMinutes}`);
                gapFound = true;
              }
            } else {
              // Check space at beginning of day
              const firstTaskStart = new Date(currentTask.scheduled_start_time);
              const dayStart = new Date(firstTaskStart);
              dayStart.setHours(0, 0, 0, 0);
              const gapMinutes = Math.floor((firstTaskStart.getTime() - dayStart.getTime()) / (60 * 1000));
              
              console.log(`Gap from day start to ${currentTask.odp_number}: ${gapMinutes} minutes`);
              console.log(`Day start: ${dayStart.toISOString()}, First task start: ${firstTaskStart.toISOString()}`);
              
              if (gapMinutes >= draggedDurationMinutes) {
                console.log(`Found sufficient gap: ${gapMinutes} >= ${draggedDurationMinutes}`);
                gapFound = true;
              }
            }
          }
        }
        
        // If no sufficient gap found, return error
        if (!gapFound && affectedTasks.length === scheduledTasks.length) {
          console.log('ERROR: No sufficient gap found, all tasks would be affected');
          return { error: 'Non c\'è spazio sufficiente per spostare i lavori' };
        }
        
        console.log('=== AFFECTED TASKS SUMMARY ===');
        console.log('Affected tasks:', affectedTasks.map(t => ({
          id: t.id,
          odp: t.odp_number,
          start: t.scheduled_start_time,
          duration: getTaskDurationMinutes(t),
          end: getTaskEndTime(t).toISOString()
        })));
        
        // Calculate new positions for affected tasks with precise contiguous positioning
        const updates = [];
        
        if (direction === 'right') {
          console.log('=== RIGHT DIRECTION POSITIONING ===');
          // For right direction: calculate positions starting from the first task
          // The first task moves to start after the dragged task ends
          const draggedTaskEnd = addMinutesToDate(new Date(proposedStartTime), draggedDurationMinutes);
          let currentStartTime = roundUpToNext15MinSlot(draggedTaskEnd);
          console.log(`Dragged task ends at: ${draggedTaskEnd.toISOString()}`);
          console.log(`Initial currentStartTime: ${currentStartTime.toISOString()} (after dragged task ends)`);
          
          for (const task of affectedTasks) {
            const taskDurationMinutes = getTaskDurationMinutes(task);
            let newStartTime = new Date(currentStartTime);
            let newEndTime = addMinutesToDate(newStartTime, taskDurationMinutes);
            
            console.log(`Processing task ${task.odp_number}:`);
            console.log(`  Original start: ${task.scheduled_start_time}`);
            console.log(`  New start: ${newStartTime.toISOString()}`);
            console.log(`  Duration: ${taskDurationMinutes} minutes`);
            console.log(`  New end: ${newEndTime.toISOString()}`);
            
            // Multi-day unavailable check for shunted task (forward/right)
            const adjustedForward = adjustForUnavailableSlotsForward(newStartTime, taskDurationMinutes);
            newStartTime = adjustedForward.startTime;
            newEndTime = adjustedForward.endTime;
            
            updates.push({
              id: task.id,
              scheduled_start_time: newStartTime.toISOString(),
              scheduled_end_time: newEndTime.toISOString()
            });
            
            console.log(`  Final new start: ${newStartTime.toISOString()}`);
            console.log(`  Final new end: ${newEndTime.toISOString()}`);
            
            // Next task starts at the next 15-minute slot after this task ends
            currentStartTime = roundUpToNext15MinSlot(newEndTime);
            console.log(`  Next task will start at: ${currentStartTime.toISOString()} (rounded to 15-min slot)`);
          }
        } else {
          console.log('=== LEFT DIRECTION POSITIONING ===');
          // For left direction: work backwards to maintain contiguity
          // The last task in the chain moves to end before the dragged task starts
          const draggedTaskStart = new Date(proposedStartTime);
          let currentEndTime = roundUpToNext15MinSlot(addMinutesToDate(draggedTaskStart, -1)); // Subtract 1 minute then round up
          console.log(`Dragged task starts at: ${draggedTaskStart.toISOString()}`);
          console.log(`Initial currentEndTime: ${currentEndTime.toISOString()} (before dragged task starts)`);
          
          // Work backwards through the tasks
          for (let i = affectedTasks.length - 1; i >= 0; i--) {
            const task = affectedTasks[i];
            const taskDurationMinutes = getTaskDurationMinutes(task);
            
            // This task ends at currentEndTime and starts taskDurationMinutes before that
            let newEndTime = new Date(currentEndTime);
            let newStartTime = addMinutesToDate(newEndTime, -taskDurationMinutes);
            
            console.log(`Processing task ${task.odp_number} (backwards):`);
            console.log(`  Original start: ${task.scheduled_start_time}`);
            console.log(`  New start: ${newStartTime.toISOString()}`);
            console.log(`  Duration: ${taskDurationMinutes} minutes`);
            console.log(`  New end: ${newEndTime.toISOString()}`);
            
            // Multi-day unavailable check for shunted task (backward/left)
            const adjustedBackward = adjustForUnavailableSlotsBackward(newStartTime, taskDurationMinutes);
            newStartTime = adjustedBackward.startTime;
            newEndTime = adjustedBackward.endTime;
            
            updates.push({
              id: task.id,
              scheduled_start_time: newStartTime.toISOString(),
              scheduled_end_time: newEndTime.toISOString()
            });
            
            console.log(`  Final new start: ${newStartTime.toISOString()}`);
            console.log(`  Final new end: ${newEndTime.toISOString()}`);
            
            // Previous task ends at the previous 15-minute slot before this task starts
            currentEndTime = roundUpToNext15MinSlot(addMinutesToDate(newStartTime, -1)); // Subtract 1 minute then round up
            console.log(`  Previous task will end at: ${currentEndTime.toISOString()} (rounded to 15-min slot)`);
          }
        }
        
        // Update the dragged task to start at the proposed position (where user dropped it)
        // But ensure it doesn't overlap with shunted tasks
        const proposedStart = new Date(proposedStartTime);
        let finalStartTime = proposedStart;
        let finalEndTime = addMinutesToDate(proposedStart, draggedDurationMinutes);
        
        console.log('=== DRAGGED TASK UPDATE ===');
        console.log(`Dragged task ${draggedTask.odp_number}:`);
        console.log(`  Proposed start (where user dropped): ${proposedStart.toISOString()}`);
        console.log(`  Duration: ${draggedDurationMinutes} minutes`);
        
        // First, check for unavailable slots in the dragged task's proposed position
        const checkAndAdjustForUnavailableSlots = (startTime, durationMinutes) => {
          let adjustedStartTime = new Date(startTime);
          let adjustedEndTime = addMinutesToDate(adjustedStartTime, durationMinutes);
          let hasUnavailableSlots = true;
          let attempts = 0;
          const maxAttempts = 10; // Prevent infinite loops
          
          while (hasUnavailableSlots && attempts < maxAttempts) {
            hasUnavailableSlots = false;
            attempts++;
            
            console.log(`    Checking task span from ${adjustedStartTime.toISOString()} to ${adjustedEndTime.toISOString()}`);
            
            // Check all days that the task spans
            const currentDate = new Date(adjustedStartTime);
            const endDate = new Date(adjustedEndTime);
            let latestUnavailableEnd = null;
            
            while (currentDate <= endDate) {
              const dateStr = toDateString(currentDate);
              const dayAvailability = get().machineAvailability[dateStr];
              
              console.log(`    Checking day: ${dateStr}`);
              
              if (dayAvailability) {
                const machineData = dayAvailability.find(ma => ma.machine_id === machine.id);
                if (machineData && machineData.unavailable_hours) {
                  console.log(`    Unavailable hours on ${dateStr}: [${machineData.unavailable_hours.join(', ')}]`);
                  
                  // Determine which hours of this day the task occupies
                  let dayStartHour, dayEndHour;
                  
                  if (currentDate.toDateString() === adjustedStartTime.toDateString()) {
                    // First day - start from task start hour
                    dayStartHour = adjustedStartTime.getHours();
                  } else {
                    // Subsequent days - start from hour 0
                    dayStartHour = 0;
                  }
                  
                  if (currentDate.toDateString() === endDate.toDateString()) {
                    // Last day - end at task end hour
                    dayEndHour = endDate.getHours() + (endDate.getMinutes() > 0 ? 1 : 0);
                  } else {
                    // Earlier days - end at hour 24
                    dayEndHour = 24;
                  }
                  
                  console.log(`    Task occupies hours ${dayStartHour} to ${dayEndHour} on ${dateStr}`);
                  
                  // Check for conflicts in this day's range
                  for (let hour = dayStartHour; hour < dayEndHour; hour++) {
                    if (machineData.unavailable_hours.includes(hour.toString())) {
                      console.log(`    Found unavailable hour: ${hour} on ${dateStr}`);
                      hasUnavailableSlots = true;
                      
                      // Find the latest unavailable hour across all affected days
                      const maxUnavailableHour = Math.max(...machineData.unavailable_hours.map(h => parseInt(h)));
                      const unavailableEnd = new Date(currentDate);
                      unavailableEnd.setHours(maxUnavailableHour + 1, 0, 0, 0);
                      
                      if (!latestUnavailableEnd || unavailableEnd > latestUnavailableEnd) {
                        latestUnavailableEnd = unavailableEnd;
                      }
                      
                      break; // Found conflict on this day, move to next day
                    }
                  }
                  
                  if (!hasUnavailableSlots) {
                    console.log(`    No unavailable slots found in range ${dayStartHour}-${dayEndHour} on ${dateStr}`);
                  }
                } else {
                  console.log(`    No unavailable hours data for ${dateStr}`);
                }
              } else {
                console.log(`    No availability data for ${dateStr}`);
              }
              
              // Move to next day
              currentDate.setDate(currentDate.getDate() + 1);
              currentDate.setHours(0, 0, 0, 0);
            }
            
            // If we found unavailable slots, jump to after the latest unavailable period
            if (hasUnavailableSlots && latestUnavailableEnd) {
              console.log(`    Jumping to: ${latestUnavailableEnd.toISOString()}`);
              adjustedStartTime = latestUnavailableEnd;
              adjustedEndTime = addMinutesToDate(adjustedStartTime, durationMinutes);
            }
          }
          
          if (attempts >= maxAttempts) {
            console.log(`    WARNING: Max attempts reached while finding available slot`);
          }
          
          return { startTime: adjustedStartTime, endTime: adjustedEndTime };
        };
        
        // Check and adjust dragged task position for unavailable slots
        const adjustedDraggedTask = checkAndAdjustForUnavailableSlots(finalStartTime, draggedDurationMinutes);
        finalStartTime = adjustedDraggedTask.startTime;
        finalEndTime = adjustedDraggedTask.endTime;
        
        console.log(`  After unavailable slot check:`);
        console.log(`    Adjusted start: ${finalStartTime.toISOString()}`);
        console.log(`    Adjusted end: ${finalEndTime.toISOString()}`);
        
        // Check if the dragged task would overlap with any shunted tasks
        if (direction === 'right') {
          // For right direction, check if dragged task overlaps with the first shunted task
          const firstShuntedTask = updates.find(u => u.id === affectedTasks[0].id);
          if (firstShuntedTask) {
            const firstShuntedStart = new Date(firstShuntedTask.scheduled_start_time);
            const firstShuntedEnd = new Date(firstShuntedTask.scheduled_end_time);
            
            // Proper interval overlap check
            const overlaps = finalStartTime < firstShuntedEnd && finalEndTime > firstShuntedStart;
            if (overlaps) {
              console.log(`  WARNING: Dragged task would overlap with first shunted task`);
              console.log(`  Dragged: ${finalStartTime.toISOString()} - ${finalEndTime.toISOString()}`);
              console.log(`  Shunted: ${firstShuntedStart.toISOString()} - ${firstShuntedEnd.toISOString()}`);
              console.log(`  Moving dragged task to start after shunted task`);
              
              const roundedFirstShuntedEnd = roundUpToNext15MinSlot(firstShuntedEnd);
              finalStartTime = roundedFirstShuntedEnd;
              finalEndTime = addMinutesToDate(finalStartTime, draggedDurationMinutes);
            } else {
              console.log(`  No overlap detected - dragged task (${finalStartTime.toISOString()} - ${finalEndTime.toISOString()}) vs shunted (${firstShuntedStart.toISOString()} - ${firstShuntedEnd.toISOString()})`);
            }
          }
        } else {
          // For left direction, check if dragged task overlaps with the last shunted task
          const lastShuntedTask = updates.find(u => u.id === affectedTasks[affectedTasks.length - 1].id);
          if (lastShuntedTask) {
            const lastShuntedEnd = new Date(lastShuntedTask.scheduled_end_time);
            
            // Check for actual overlap: dragged task start < shunted task end
            if (finalStartTime < lastShuntedEnd) {
              console.log(`  WARNING: Dragged task would overlap with last shunted task`);
              console.log(`  Dragged task start: ${finalStartTime.toISOString()}`);
              console.log(`  Last shunted task ends at: ${lastShuntedEnd.toISOString()}`);
              console.log(`  Moving dragged task to start before shunted task`);
              
              // Calculate position before the last shunted task
              const lastShuntedStart = new Date(lastShuntedTask.scheduled_start_time);
              const positionBeforeLast = addMinutesToDate(lastShuntedStart, -draggedDurationMinutes);
              finalStartTime = positionBeforeLast;
              finalEndTime = lastShuntedStart;
            } else {
              console.log(`  No overlap detected - dragged task starts at ${finalStartTime.toISOString()}, shunted task ends at ${lastShuntedEnd.toISOString()}`);
            }
          }
        }
        
        console.log(`  Final start: ${finalStartTime.toISOString()}`);
        console.log(`  Final end: ${finalEndTime.toISOString()}`);
        
        updates.push({
          id: draggedTask.id,
          scheduled_machine_id: machine.id,
          scheduled_start_time: finalStartTime.toISOString(),
          scheduled_end_time: finalEndTime.toISOString(),
          status: 'SCHEDULED'
        });

        // Final cascade to ensure no overlaps beyond initially affected tasks
        const updatedIds = new Set(updates.map(u => u.id));
        const getUpdatedRange = (task) => {
          const u = updates.find(x => x.id === task.id);
          if (u) return { start: new Date(u.scheduled_start_time), end: new Date(u.scheduled_end_time) };
          return { start: new Date(task.scheduled_start_time), end: getTaskEndTime(task) };
        };
        
        if (direction === 'right') {
          // Start from the last affected task's new end
          const lastAffected = affectedTasks[affectedTasks.length - 1];
          const lastRange = getUpdatedRange(lastAffected);
          let cascadeStartEnd = lastRange.end;
          
          // Iterate subsequent tasks on the machine and push if overlapping
          const startIndex = scheduledTasks.findIndex(t => t.id === lastAffected.id) + 1;
          for (let i = startIndex; i < scheduledTasks.length; i++) {
            const nextTask = scheduledTasks[i];
            const nextRange = getUpdatedRange(nextTask);
            if (nextRange.start < cascadeStartEnd) {
              // Push this task to after cascadeStartEnd
              let newStart = roundUpToNext15MinSlot(cascadeStartEnd);
              const duration = getTaskDurationMinutes(nextTask);
              let newEnd = addMinutesToDate(newStart, duration);
              const adjusted = adjustForUnavailableSlotsForward(newStart, duration);
              newStart = adjusted.startTime;
              newEnd = adjusted.endTime;
              updates.push({ id: nextTask.id, scheduled_start_time: newStart.toISOString(), scheduled_end_time: newEnd.toISOString() });
              cascadeStartEnd = newEnd;
            } else {
              break;
            }
          }
        } else {
          // direction left - ensure previous tasks do not overlap after shifts
          const firstAffected = affectedTasks[0];
          const firstRange = getUpdatedRange(firstAffected);
          let cascadeEndStart = firstRange.start;
          const startIndex = scheduledTasks.findIndex(t => t.id === firstAffected.id) - 1;
          for (let i = startIndex; i >= 0; i--) {
            const prevTask = scheduledTasks[i];
            const prevRange = getUpdatedRange(prevTask);
            if (prevRange.end > cascadeEndStart) {
              // Pull this task to end before cascadeEndStart
              const duration = getTaskDurationMinutes(prevTask);
              let newEnd = roundUpToNext15MinSlot(addMinutesToDate(cascadeEndStart, -1));
              let newStart = addMinutesToDate(newEnd, -duration);
              const adjusted = adjustForUnavailableSlotsBackward(newStart, duration);
              newStart = adjusted.startTime;
              newEnd = adjusted.endTime;
              updates.push({ id: prevTask.id, scheduled_start_time: newStart.toISOString(), scheduled_end_time: newEnd.toISOString() });
              cascadeEndStart = newStart;
            } else {
              break;
            }
          }
        }

        // Final safety normalization: ensure no overlaps across the entire machine timeline
        // Build a combined view of tasks with proposed updates applied
        const combined = scheduledTasks
          .concat([draggedTask])
          .map(t => {
            const u = updates.find(x => x.id === t.id);
            if (u) {
              return {
                ...t,
                scheduled_start_time: u.scheduled_start_time,
                scheduled_end_time: u.scheduled_end_time
              };
            }
            return t;
          })
          .sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time));
        
        // Sweep forward; if overlap, push minimally and respect unavailability
        let previousEnd = null;
        for (let i = 0; i < combined.length; i++) {
          const task = combined[i];
          const duration = getTaskDurationMinutes(task);
          let start = new Date(task.scheduled_start_time);
          let end = new Date(task.scheduled_end_time || addMinutesToDate(start, duration).toISOString());
          
          if (previousEnd && start < previousEnd) {
            // Push forward to immediately after previousEnd
            start = roundUpToNext15MinSlot(previousEnd);
            const adjusted = adjustForUnavailableSlotsForward(start, duration);
            start = adjusted.startTime;
            end = adjusted.endTime;
            // Record update
            const existing = updates.find(u => u.id === task.id);
            if (existing) {
              existing.scheduled_start_time = start.toISOString();
              existing.scheduled_end_time = end.toISOString();
            } else {
              updates.push({ id: task.id, scheduled_start_time: start.toISOString(), scheduled_end_time: end.toISOString() });
            }
          }
          previousEnd = end;
        }
      
              console.log('=== FINAL UPDATES SUMMARY ===');
        console.log('All updates to be applied:', updates.map(u => ({
          id: u.id,
          start: u.scheduled_start_time,
          end: u.scheduled_end_time,
          status: u.status
        })));
        
        // Execute all updates
        for (const update of updates) {
          console.log(`Applying update for task ${update.id}:`, update);
          await updateOdpOrder(update.id, update);
        }
        
        console.log('=== SHUNTING DEBUG END ===');
        
        // Hide the conflict dialog
        useUIStore.getState().hideConflictDialog();
        useUIStore.getState().showAlert('Lavori riprogrammati con successo', 'success');
        
        return { success: true };
    } catch (error) {
      return { error: error.message || 'Errore durante la riprogrammazione' };
    }
  },
  
  // Execute shunt and schedule the dragged task
  executeShuntAndSchedule: async (draggedTask, overTask, cursorPosition, machine, currentDate) => {
    try {
      const { calculateShunt } = get();
      const { updateOdpOrder } = useOrderStore.getState();
      
      // Calculate the shunt
      const shuntResult = calculateShunt(draggedTask, overTask, cursorPosition, machine.id, currentDate);
      
      if (!shuntResult.affectedTasks.length) {
        return { error: 'No valid shunt position found' };
      }
      
      // Start a batch update
      const updates = [];
      
      // Update all affected tasks with their new positions
      for (const task of shuntResult.affectedTasks) {
        // Check for unavailable slots in the new position
        const newStart = new Date(task.newStartTime);
        const newEnd = new Date(task.newEndTime);
        const dateStr = toDateString(newStart);
        
        // Check machine availability
        const dayAvailability = get().machineAvailability[dateStr];
        if (dayAvailability) {
          const machineData = dayAvailability.find(ma => ma.machine_id === machine.id);
          if (machineData && machineData.unavailable_hours) {
            // Check each hour the task spans
            const startHour = newStart.getHours();
            const endHour = newEnd.getHours() + (newEnd.getMinutes() > 0 ? 1 : 0);
            
            for (let hour = startHour; hour < endHour; hour++) {
              if (machineData.unavailable_hours.includes(hour.toString())) {
                // Task would overlap with unavailable time - need to jump over it
                const unavailableEnd = new Date(newStart);
                unavailableEnd.setHours(Math.max(...machineData.unavailable_hours.map(h => parseInt(h))) + 1, 0, 0, 0);
                
                // Adjust the task to start after the unavailable period
                const jumpAmount = unavailableEnd.getTime() - newStart.getTime();
                task.newStartTime = new Date(newStart.getTime() + jumpAmount).toISOString();
                task.newEndTime = new Date(newEnd.getTime() + jumpAmount).toISOString();
                break;
              }
            }
          }
        }
        
        updates.push({
          id: task.id,
          scheduled_start_time: task.newStartTime,
          scheduled_end_time: task.newEndTime
        });
      }
      
      // Update the dragged task to its new position
      updates.push({
        id: draggedTask.id,
        scheduled_machine_id: machine.id,
        scheduled_start_time: shuntResult.draggedTaskPosition.startTime,
        scheduled_end_time: shuntResult.draggedTaskPosition.endTime,
        status: 'SCHEDULED'
      });
      
      // Execute all updates
      for (const update of updates) {
        await updateOdpOrder(update.id, update);
      }
      
      // Clear the shunt preview
      set({ shuntPreview: null });
      
      return { success: true };
    } catch (error) {
      return { error: error.message || 'Failed to execute shunt' };
    }
  },

  // Calculate shunt for contiguous tasks
  calculateShunt: (draggedTask, overTask, cursorPosition, machineId, currentDate) => {
    const { getOdpOrders } = useOrderStore.getState();
    const { machineAvailability } = get();
    
    // Get all scheduled tasks on this machine
    const scheduledTasks = getOdpOrders().filter(o => 
      o.scheduled_machine_id === machineId && 
      o.status === 'SCHEDULED' &&
      o.id !== draggedTask.id // Exclude the dragged task
    ).sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time));
    
    if (!overTask || scheduledTasks.length === 0) return { affectedTasks: [], direction: null };
    
    // Find the over task in the scheduled tasks
    const overTaskIndex = scheduledTasks.findIndex(t => t.id === overTask.id);
    if (overTaskIndex === -1) return { affectedTasks: [], direction: null };
    
    // Determine push direction based on cursor position
    // This requires the cursor position relative to the over task element
    // For now, we'll use a simple heuristic: if cursor is in left half, push left; otherwise push right
    const direction = cursorPosition < 0.5 ? 'left' : 'right';
    
    // Calculate the duration of the dragged task
    const draggedDuration = (draggedTask.time_remaining || draggedTask.duration || 1) * 60 * 60 * 1000; // Convert hours to ms
    
    // Find contiguous tasks that need to be shunted
    const affectedTasks = [];
    let totalShiftRequired = draggedDuration;
    let gapFound = false;
    
    if (direction === 'right') {
      // Check tasks after the over task (including the over task itself)
      for (let i = overTaskIndex; i < scheduledTasks.length && !gapFound; i++) {
        const currentTask = scheduledTasks[i];
        affectedTasks.push(currentTask);
        
        // Check if there's a gap after this task
        if (i < scheduledTasks.length - 1) {
          const nextTask = scheduledTasks[i + 1];
          const currentEnd = new Date(currentTask.scheduled_start_time).getTime() + 
            (currentTask.time_remaining || currentTask.duration || 1) * 60 * 60 * 1000;
          const nextStart = new Date(nextTask.scheduled_start_time).getTime();
          const gap = nextStart - currentEnd;
          
          if (gap >= totalShiftRequired) {
            gapFound = true;
          }
        } else {
          // This is the last task, so there's infinite space after it
          gapFound = true;
        }
      }
    } else {
      // Check tasks before the over task (including the over task itself)
      for (let i = overTaskIndex; i >= 0 && !gapFound; i--) {
        const currentTask = scheduledTasks[i];
        affectedTasks.unshift(currentTask); // Add to beginning to maintain order
        
        // Check if there's a gap before this task
        if (i > 0) {
          const prevTask = scheduledTasks[i - 1];
          const prevEnd = new Date(prevTask.scheduled_start_time).getTime() + 
            (prevTask.time_remaining || prevTask.duration || 1) * 60 * 60 * 1000;
          const currentStart = new Date(currentTask.scheduled_start_time).getTime();
          const gap = currentStart - prevEnd;
          
          if (gap >= totalShiftRequired) {
            gapFound = true;
          }
        } else {
          // This is the first task, check if there's space before it
          const firstTaskStart = new Date(currentTask.scheduled_start_time);
          const dayStart = new Date(currentDate);
          dayStart.setHours(0, 0, 0, 0);
          const gap = firstTaskStart.getTime() - dayStart.getTime();
          
          if (gap >= totalShiftRequired) {
            gapFound = true;
          }
        }
      }
    }
    
    // Calculate new positions for affected tasks
    const shiftedTasks = affectedTasks.map(task => {
      const originalStart = new Date(task.scheduled_start_time);
      const shiftAmount = direction === 'right' ? draggedDuration : -draggedDuration;
      const newStart = new Date(originalStart.getTime() + shiftAmount);
      const taskDuration = (task.time_remaining || task.duration || 1) * 60 * 60 * 1000;
      const newEnd = new Date(newStart.getTime() + taskDuration);
      
      return {
        ...task,
        newStartTime: newStart.toISOString(),
        newEndTime: newEnd.toISOString(),
        shiftAmount: shiftAmount
      };
    });
    
    return {
      affectedTasks: shiftedTasks,
      direction,
      draggedTaskPosition: {
        startTime: overTask.scheduled_start_time, // The dragged task will take the over task's original position
        endTime: new Date(new Date(overTask.scheduled_start_time).getTime() + draggedDuration).toISOString()
      }
    };
  },
  
  reset: () => set({ machineAvailability: {}, shuntPreview: null }),
}));
