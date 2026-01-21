import { format } from 'date-fns';
import { apiService } from '../../services/api';
import { convertCETHourToUTC } from '../../utils/dateFormatting';
import { CALENDAR_CONSTANTS } from '../../utils/calendarConstants';

/**
 * Spotify Queue Scheduler
 * Lean, simple scheduler for sequential queue-based task scheduling
 * 
 * Core principle: Tasks are ALWAYS sequential (one after another)
 * No overlaps, no conflicts, no shunting - just pure queue logic
 */
export class SpotifyQueueScheduler {
  constructor(get, set, machineAvailabilityManager) {
    this.get = get;
    this.set = set;
    this.machineAvailabilityManager = machineAvailabilityManager;
  }

  /**
   * Get the sorted queue of tasks for a machine
   * @param {string} machineId - Machine ID
   * @param {Array} allOrders - All orders from React Query
   */
  getQueue = (machineId, allOrders) => {
    return allOrders
      .filter(task => 
        task.scheduled_machine_id === machineId &&
        task.status === 'SCHEDULED' &&
        task.scheduled_start_time
      )
      .sort((a, b) => {
        const aTime = new Date(a.scheduled_start_time).getTime();
        const bTime = new Date(b.scheduled_start_time).getTime();
        return aTime - bTime;
      });
  };

  /**
   * Calculate next available start time (end of last task, rounded to 15min)
   * @param {string} machineId - Machine ID
   * @param {Array} allOrders - All orders from React Query
   * @param {string} excludeTaskId - Optional task ID to exclude from queue (to handle stale cache)
   */
  calculateNextStartTime = (machineId, allOrders, excludeTaskId = null) => {
    let queue = this.getQueue(machineId, allOrders);
    
    console.log('🟢 calculateNextStartTime - Initial queue length:', queue.length, 'excludeTaskId:', excludeTaskId?.substring(0, 8));
    console.log('🟢 Queue tasks:', queue.map(t => ({
      id: t.id.substring(0, 8),
      odp: t.odp_number,
      start: t.scheduled_start_time,
      end: t.scheduled_end_time
    })));
    
    // Exclude the task being scheduled to avoid stale cache issues
    if (excludeTaskId) {
      queue = queue.filter(t => t.id !== excludeTaskId);
      console.log('🟢 After exclude - queue length:', queue.length);
    }
    
    if (queue.length === 0) {
      // Queue is empty, start from now
      const now = new Date();
      console.log('🟢 Queue empty, starting from now:', now.toISOString());
      return this.roundToNext15Min(now);
    }
    
    // Start after the last task in queue
    const lastTask = queue[queue.length - 1];
    const lastEndTime = new Date(lastTask.scheduled_end_time);
    const nextStart = this.roundToNext15Min(lastEndTime);
    console.log('🟢 Starting after last task:', lastTask.odp_number, 'ends at:', lastEndTime.toISOString(), 'next start:', nextStart.toISOString());
    return nextStart;
  };

  /**
   * Round time to next 15-minute slot
   */
  roundToNext15Min = (date) => {
    const minutes = date.getUTCMinutes();
    const nextSlot = Math.ceil(minutes / 15) * 15;
    
    const rounded = new Date(date);
    if (nextSlot === 60) {
      rounded.setUTCHours(date.getUTCHours() + 1, 0, 0, 0);
    } else {
      rounded.setUTCMinutes(nextSlot, 0, 0);
    }
    
    return rounded;
  };

  /**
   * Get unavailable slots for a date range
   */
  getUnavailableSlots = (startTime, endTime, machineId) => {
    const unavailableSlots = [];
    const { machineAvailability } = this.get();
    
    // Loop through each day in the range
    let currentDate = new Date(startTime);
    currentDate.setUTCHours(0, 0, 0, 0);
    
    const endDate = new Date(endTime);
    endDate.setUTCHours(23, 59, 59, 999);
    
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dateAvailability = machineAvailability[dateStr];
      
      if (dateAvailability && Array.isArray(dateAvailability)) {
        const machineData = dateAvailability.find(ma => ma.machine_id === machineId);
        
        if (machineData && Array.isArray(machineData.unavailable_hours)) {
          for (const hour of machineData.unavailable_hours) {
            const hourInt = parseInt(hour);
            
            // Unavailable hours are stored as CET hours (e.g., 12 = 12:00 CET)
            // Convert to UTC using centralized utility function
            const slotStart = convertCETHourToUTC(dateStr, hourInt);
            const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
            
            unavailableSlots.push({ start: slotStart, end: slotEnd });
          }
        }
      }
      
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    return unavailableSlots;
  };

  /**
   * Split task around unavailable hours
   * Returns: { segments: [...], startTime, endTime }
   */
  splitTaskAroundUnavailability = async (startTime, durationHours, machineId) => {
    // Load machine availability for the date range
    const estimatedEndTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000) + (7 * 24 * 60 * 60 * 1000)); // +7 days buffer
    await this.machineAvailabilityManager.loadMachineAvailabilityForDateRange(
      machineId,
      startTime,
      estimatedEndTime
    );
    
    const unavailableSlots = this.getUnavailableSlots(startTime, estimatedEndTime, machineId);
    
    const segments = [];
    let currentTime = new Date(startTime);
    let remainingDuration = durationHours;
    
    // Skip if we start in an unavailable slot (keep checking until we find available time)
    let moved = true;
    while (moved) {
      moved = false;
      for (const slot of unavailableSlots) {
        if (currentTime >= slot.start && currentTime < slot.end) {
          currentTime = new Date(slot.end);
          moved = true;
          break;
        }
      }
    }
    
    // Build segments hour by hour
    let hoursProcessed = 0;
    const maxHours = durationHours * 100; // Safety: max iterations
    
    while (remainingDuration > 0 && hoursProcessed < maxHours) {
      const hourStart = new Date(currentTime);
      const hourEnd = new Date(currentTime.getTime() + 60 * 60 * 1000);
      
      // Check if this hour overlaps with any unavailable slot
      // Two time ranges overlap if: start1 < end2 AND end1 > start2
      const overlappingSlot = unavailableSlots.find(slot => 
        hourStart < slot.end && hourEnd > slot.start
      );
      
      if (!overlappingSlot) {
        // Fully available hour - add to current segment or create new one
        if (segments.length === 0 || segments[segments.length - 1].end.getTime() !== hourStart.getTime()) {
          // New segment
          segments.push({
            start: new Date(hourStart),
            end: new Date(hourEnd),
            duration: 1
          });
        } else {
          // Extend current segment
          segments[segments.length - 1].end = new Date(hourEnd);
          segments[segments.length - 1].duration += 1;
        }
        
        remainingDuration -= 1;
      } else {
        // Partial overlap - use only the available portion before the unavailability
        if (hourStart < overlappingSlot.start) {
          // There's available time before the unavailable slot starts
          const availableEnd = overlappingSlot.start;
          const partialDuration = (availableEnd.getTime() - hourStart.getTime()) / (60 * 60 * 1000);
          
          if (partialDuration > 0) {
            if (segments.length === 0 || segments[segments.length - 1].end.getTime() !== hourStart.getTime()) {
              // New segment
              segments.push({
                start: new Date(hourStart),
                end: new Date(availableEnd),
                duration: partialDuration
              });
            } else {
              // Extend current segment
              segments[segments.length - 1].end = new Date(availableEnd);
              segments[segments.length - 1].duration += partialDuration;
            }
            
            remainingDuration -= partialDuration;
          }
          
          // Jump to the end of the unavailable slot
          currentTime = new Date(overlappingSlot.end);
          hoursProcessed++;
          continue;
        }
      }
      
      // Move to next hour
      currentTime.setUTCHours(currentTime.getUTCHours() + 1);
      hoursProcessed++;
      
      // After moving, check if we landed in an unavailable slot and skip it
      let movedAgain = true;
      while (movedAgain) {
        movedAgain = false;
        for (const slot of unavailableSlots) {
          if (currentTime >= slot.start && currentTime < slot.end) {
            currentTime = new Date(slot.end);
            movedAgain = true;
            break;
          }
        }
      }
    }
    
    if (segments.length === 0) {
      throw new Error('No available time slots found for task');
    }
    
    if (hoursProcessed >= maxHours) {
      // Task splitting reached max iterations
    }
    
    return {
      segments,
      startTime: segments[0].start,
      endTime: segments[segments.length - 1].end
    };
  };

  /**
   * Schedule a task at the end of the queue
   * @param {string} machineId - Machine ID
   * @param {string} taskId - Task ID
   * @param {Array} allOrders - All orders from React Query
   */
  scheduleTaskAtEnd = async (machineId, taskId, allOrders) => {
    const task = allOrders.find(o => o.id === taskId);
    
    if (!task) {
      return { error: 'Task not found' };
    }
    
    // Allow scheduling/rescheduling - be tolerant of stale cache data
    // After rapid unschedule->schedule operations, React Query cache may not be up to date
    // The database is the source of truth, so we proceed and let the update handle it
    
    const duration = task.time_remaining || task.duration || 0;
    if (duration <= 0) {
      return { error: 'Task must have a duration greater than 0' };
    }
    
    // Calculate start time (exclude this task from queue to handle stale cache)
    const startTime = this.calculateNextStartTime(machineId, allOrders, taskId);
    
    console.log('🟡 scheduleTaskAtEnd - Task:', taskId.substring(0, 8), 'Duration:', duration, 'Start time:', startTime.toISOString());
    
    // Split task around unavailable hours
    const { segments, startTime: actualStart, endTime } = await this.splitTaskAroundUnavailability(
      startTime,
      duration,
      machineId
    );
    
    console.log('🟡 scheduleTaskAtEnd - After split - Actual start:', actualStart.toISOString(), 'End:', endTime.toISOString());
    
    // Prepare task update
    const updates = {
      scheduled_machine_id: machineId,
      scheduled_start_time: actualStart.toISOString(),
      scheduled_end_time: endTime.toISOString(),
      status: 'SCHEDULED',
      description: JSON.stringify({
        segments: segments.map(s => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          duration: s.duration
        })),
        is_pause: this.isPauseTask(task)
      })
    };
    
    // Update database
    await apiService.updateOdpOrder(taskId, updates);
    
    return { success: true, task: { ...task, ...updates } };
  };

  /**
   * Reorder a task in the queue
   * @param {string} machineId - Machine ID
   * @param {string} taskId - Task ID
   * @param {number} oldIndex - Old position
   * @param {number} newIndex - New position
   * @param {Array} allOrders - All orders from React Query
   */
  reorderQueue = async (machineId, taskId, oldIndex, newIndex, allOrders) => {
    const queue = this.getQueue(machineId, allOrders);
    
    // Find the actual current indices in case they've changed
    const actualOldIndex = queue.findIndex(t => t.id === taskId);
    
    if (actualOldIndex === -1) {
      // Task not in filtered queue - check if it exists in allOrders
      const task = allOrders.find(t => t.id === taskId);
      if (!task) {
        return { error: 'Task not found in orders' };
      }
      // Task exists but not in queue - likely stale cache or task state changed
      // Try to refresh from DB by returning error that UI can handle
      return { error: 'Task not found in queue - cache may be stale' };
    }
    
    // Validate new index
    if (newIndex < 0 || newIndex >= queue.length) {
      return { error: 'Invalid target position' };
    }
    
    if (actualOldIndex === newIndex) {
      return { success: true, message: 'No change in position' };
    }
    
    // Reorder the array using the actual current index
    const reordered = [...queue];
    const [movedTask] = reordered.splice(actualOldIndex, 1);
    reordered.splice(newIndex, 0, movedTask);
    
    // Recalculate from the affected position
    const startPosition = Math.min(actualOldIndex, newIndex);
    let currentStartTime = startPosition === 0 
      ? this.calculateNextStartTime(machineId, allOrders)
      : new Date(reordered[startPosition - 1].scheduled_end_time);
    
    currentStartTime = this.roundToNext15Min(currentStartTime);
    
    // Reschedule affected tasks
    for (let i = startPosition; i < reordered.length; i++) {
      const task = reordered[i];
      const duration = task.time_remaining || task.duration || 1;
      
      // Split around unavailability
      const { segments, startTime: actualStart, endTime } = await this.splitTaskAroundUnavailability(
        currentStartTime,
        duration,
        machineId
      );
      
      // Update task
      const updates = {
        scheduled_start_time: actualStart.toISOString(),
        scheduled_end_time: endTime.toISOString(),
        description: JSON.stringify({
          segments: segments.map(s => ({
            start: s.start.toISOString(),
            end: s.end.toISOString(),
            duration: s.duration
          })),
          is_pause: this.isPauseTask(task)
        })
      };
      
      await apiService.updateOdpOrder(task.id, updates);
      
      // Next task starts after this one
      currentStartTime = this.roundToNext15Min(new Date(endTime));
    }
    
    return { success: true };
  };

  /**
   * Remove a task from the queue
   * @param {string} machineId - Machine ID
   * @param {string} taskId - Task ID
   * @param {Array} allOrders - All orders from React Query
   */
  removeFromQueue = async (machineId, taskId, allOrders) => {
    const queue = this.getQueue(machineId, allOrders);
    const taskIndex = queue.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return { error: 'Task not found in queue' };
    }
    
    // Unschedule the task
    await apiService.updateOdpOrder(taskId, {
      scheduled_machine_id: null,
      scheduled_start_time: null,
      scheduled_end_time: null,
      status: 'NOT SCHEDULED',
      description: ''
    });
    
    // Recalculate remaining tasks
    if (taskIndex < queue.length - 1) {
      let currentStartTime = taskIndex === 0
        ? this.calculateNextStartTime(machineId, allOrders, taskId) // Exclude removed task from calculation
        : new Date(queue[taskIndex - 1].scheduled_end_time);
      
      currentStartTime = this.roundToNext15Min(currentStartTime);
      
      for (let i = taskIndex + 1; i < queue.length; i++) {
        const task = queue[i];
        const duration = task.time_remaining || task.duration || 1;
        
        const { segments, startTime: actualStart, endTime } = await this.splitTaskAroundUnavailability(
          currentStartTime,
          duration,
          machineId
        );
        
        await apiService.updateOdpOrder(task.id, {
          scheduled_start_time: actualStart.toISOString(),
          scheduled_end_time: endTime.toISOString(),
          description: JSON.stringify({
            segments: segments.map(s => ({
              start: s.start.toISOString(),
              end: s.end.toISOString(),
              duration: s.duration
            })),
            is_pause: this.isPauseTask(task)
          })
        });
        
        currentStartTime = this.roundToNext15Min(new Date(endTime));
      }
    }
    
    return { success: true };
  };

  /**
   * Create a pause task (fictitious task)
   * @param {string} machineId - Machine ID
   * @param {number} durationHours - Duration in hours
   * @param {Array} allMachines - All machines from React Query
   * @param {Array} allOrders - All orders from React Query
   */
  createPauseTask = async (machineId, durationHours, allMachines, allOrders) => {
    if (!machineId) {
      return { error: 'Machine ID is required' };
    }
    
    if (durationHours <= 0 || durationHours > 24) {
      return { error: 'Duration must be between 0 and 24 hours' };
    }
    
    const machine = allMachines.find(m => m.id === machineId);
    
    if (!machine) {
      return { error: 'Machine not found' };
    }
    
    // Create pause task object
    const pauseId = `PAUSE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const pauseTask = {
      odp_number: pauseId,
      article_code: 'PAUSE',
      duration: durationHours,
      cost: 0,
      quantity: 0,
      quantity_completed: 0,
      work_center: machine.work_center,
      nome_cliente: 'SISTEMA',
      customer_order_ref: 'PAUSE',
      department: machine.department || 'CONFEZIONAMENTO',
      delivery_date: new Date().toISOString(),
      status: 'NOT SCHEDULED' // Will be scheduled by scheduleTaskAtEnd
    };
    
    // Create in database
    const createdTask = await apiService.addOdpOrder(pauseTask);
    
    // Schedule at end of queue (need to include newly created task in orders array)
    const updatedOrders = [...allOrders, createdTask];
    const result = await this.scheduleTaskAtEnd(machineId, createdTask.id, updatedOrders);
    
    if (result.error) {
      // Clean up - delete the task if scheduling failed
      await apiService.removeOdpOrder(createdTask.id);
      return { error: result.error };
    }
    
    return { success: true, pauseTask: result.task };
  };

  /**
   * Check if a task is a pause task
   */
  isPauseTask = (task) => {
    if (!task.description) return false;
    
    try {
      const desc = JSON.parse(task.description);
      return desc.is_pause === true;
    } catch {
      return false;
    }
  };
}
