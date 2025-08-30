import { apiService } from '../../services';
import { toDateString, addDaysToDate } from '../../utils/dateUtils';
import { handleApiError } from '../../utils/errorUtils';
import { useOrderStore } from '../useOrderStore';
import { useMachineStore } from '../useMachineStore';
import { useUIStore } from '../useUIStore';

/**
 * Machine Availability Manager
 * Handles all machine availability operations including loading, caching, and updating
 */
export class MachineAvailabilityManager {
  constructor(get, set) {
    this.get = get;
    this.set = set;
  }

  // Load machine availability for a specific date
  loadMachineAvailabilityForDate = async (dateStr) => {
    const { machineAvailability } = this.get();
    if (machineAvailability[dateStr]?._loading) return;
    if (machineAvailability[dateStr] && machineAvailability[dateStr].length >= 0) return;
    
    this.set(state => ({ 
      machineAvailability: { 
        ...state.machineAvailability, 
        [dateStr]: { _loading: true } 
      } 
    }));
    
    try {
      const data = await apiService.getMachineAvailabilityForDateAllMachines(dateStr);
      this.set(state => ({ 
        machineAvailability: { 
          ...state.machineAvailability, 
          [dateStr]: data || [] 
        } 
      }));
    } catch (e) {
      this.set(state => {
        const next = { ...state.machineAvailability };
        if (next[dateStr]) delete next[dateStr]._loading;
        return { machineAvailability: next };
      });
      throw e;
    }
  };

  // Load machine availability for a date range
  loadMachineAvailabilityForDateRange = async (machineId, startDate, endDate) => {
    // Convert Date objects to date strings using toDateString for consistent timezone handling
    const startDateStr = startDate instanceof Date ? toDateString(startDate) : startDate;
    const endDateStr = endDate instanceof Date ? toDateString(endDate) : endDate;
    
    try {
      const data = await apiService.getMachineAvailabilityForDateRange(machineId, startDateStr, endDateStr);
      
      // Store the data in the proper date-based structure that the rest of the system expects
      this.set(state => {
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
  };

  // Get machine availability for a specific machine and date
  getMachineAvailability = async (machineId, dateStr) => {
    try {
      // First check if we have cached data
      const dateData = this.get().machineAvailability[dateStr];
      
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
        this.set(state => {
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
  };

  // Load machine availability for a specific machine across a date range
  loadMachineAvailabilityForMachine = async (machineId, startDate, endDate) => {
    const result = {};
    try {
      // Test if machine availability table is accessible
      try {
        await apiService.getMachineAvailabilityForDate('test', '2025-01-01');
      } catch (tableError) {
        return {};
      }
      
      let current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = toDateString(current);
        const existing = this.get().machineAvailability[dateStr];
        if (!existing) {
          await this.loadMachineAvailabilityForDate(dateStr);
        }
        const dayData = this.get().machineAvailability[dateStr];
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
  };

  // Check if a specific time slot is unavailable
  isTimeSlotUnavailable = async (machineId, dateStr, hour) => {
    const hours = await this.getMachineAvailability(machineId, dateStr);
    return hours.includes(hour.toString());
  };

  // Set machine availability for a specific date
  setMachineAvailability = async (machineId, dateStr, unavailableHours) => {
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
      this.set(state => {
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
  };

  // Toggle machine hour availability
  toggleMachineHourAvailability = async (machineId, dateStr, hour) => {
    try {
      const currentUnavailableHours = await this.getMachineAvailability(machineId, dateStr);
      
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
      this.set(state => {
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
  };

  // Set machine unavailability for a date range
  setMachineUnavailability = async (machineId, startDate, endDate, startTime, endTime) => {
    try {
      // Set the unavailable hours for the date range
      const results = await apiService.setUnavailableHoursForRange(machineId, startDate, endDate, startTime, endTime);
      
      // Refresh the local availability data for the affected date range
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Load updated availability data for the range
      const updatedData = await this.loadMachineAvailabilityForDateRange(machineId, startDateObj, endDateObj);
      
      // Update the store in the format that CalendarGrid expects
      if (updatedData && Array.isArray(updatedData)) {
        this.set(state => {
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
  };

  // Check if machine availability is accessible
  isMachineAvailabilityAccessible = async () => {
    try {
      await apiService.getMachineAvailabilityForDateAllMachines('2025-01-01');
      return true;
    } catch (e) {
      return false;
    }
  };

  // Get machine availability status
  getMachineAvailabilityStatus = async () => {
    try {
      const accessible = await this.isMachineAvailabilityAccessible();
      return { 
        accessible, 
        message: accessible ? 'Table is accessible' : 'Table is not accessible - check permissions or table existence' 
      };
    } catch (e) {
      return { accessible: false, message: `Error checking table: ${e.message}` };
    }
  };

  // Initialize empty machine availability
  initializeEmptyMachineAvailability = () => {
    const { machines } = useMachineStore.getState();
    const { machineAvailability } = this.get();
    const next = { ...machineAvailability };
    machines.forEach(machine => {
      if (!next[machine.id]) {
        next[machine.id] = {};
      }
    });
    this.set({ machineAvailability: next });
  };
}
