import { format } from 'date-fns';
import { useOrderStore } from '../useOrderStore';
import { useMachineStore } from '../useMachineStore';
import { apiService } from '../../services/api';

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
   */
  getQueue = (machineId) => {
    const { getOdpOrders } = useOrderStore.getState();
    const allOrders = getOdpOrders();
    
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
   */
  calculateNextStartTime = (machineId) => {
    const queue = this.getQueue(machineId);
    
    if (queue.length === 0) {
      // Queue is empty, start from now
      const now = new Date();
      return this.roundToNext15Min(now);
    }
    
    // Start after the last task in queue
    const lastTask = queue[queue.length - 1];
    const lastEndTime = new Date(lastTask.scheduled_end_time);
    return this.roundToNext15Min(lastEndTime);
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
          const [year, month, day] = dateStr.split('-').map(Number);
          
          for (const hour of machineData.unavailable_hours) {
            const hourInt = parseInt(hour);
            const slotStart = new Date(Date.UTC(year, month - 1, day, hourInt, 0, 0, 0));
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
      
      // Check if this hour is unavailable
      const isUnavailable = unavailableSlots.some(slot => 
        hourStart >= slot.start && hourStart < slot.end
      );
      
      if (!isUnavailable) {
        // Available hour - add to current segment or create new one
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
      console.warn('Task splitting reached max iterations - task may be very long or availability data may be incomplete');
    }
    
    return {
      segments,
      startTime: segments[0].start,
      endTime: segments[segments.length - 1].end
    };
  };

  /**
   * Schedule a task at the end of the queue
   */
  scheduleTaskAtEnd = async (machineId, taskId) => {
    const { getOrderById } = useOrderStore.getState();
    const task = getOrderById(taskId);
    
    if (!task) {
      return { error: 'Task not found' };
    }
    
    if (task.status === 'SCHEDULED') {
      return { error: 'Task is already scheduled' };
    }
    
    const duration = task.time_remaining || task.duration || 0;
    if (duration <= 0) {
      return { error: 'Task must have a duration greater than 0' };
    }
    
    // Calculate start time
    const startTime = this.calculateNextStartTime(machineId);
    
    // Split task around unavailable hours
    const { segments, startTime: actualStart, endTime } = await this.splitTaskAroundUnavailability(
      startTime,
      duration,
      machineId
    );
    
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
   */
  reorderQueue = async (machineId, taskId, oldIndex, newIndex) => {
    if (oldIndex === newIndex) {
      return { success: true, message: 'No change in position' };
    }
    
    const queue = this.getQueue(machineId);
    
    if (oldIndex < 0 || oldIndex >= queue.length || newIndex < 0 || newIndex >= queue.length) {
      return { error: 'Invalid position' };
    }
    
    // Reorder the array
    const reordered = [...queue];
    const [movedTask] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, movedTask);
    
    // Recalculate from the affected position
    const startPosition = Math.min(oldIndex, newIndex);
    let currentStartTime = startPosition === 0 
      ? this.calculateNextStartTime(machineId)
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
   */
  removeFromQueue = async (machineId, taskId) => {
    const queue = this.getQueue(machineId);
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
        ? this.calculateNextStartTime(machineId)
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
   */
  createPauseTask = async (machineId, durationHours) => {
    if (!machineId) {
      return { error: 'Machine ID is required' };
    }
    
    if (durationHours <= 0 || durationHours > 24) {
      return { error: 'Duration must be between 0 and 24 hours' };
    }
    
    const { getMachineById } = useMachineStore.getState();
    const machine = getMachineById(machineId);
    
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
    
    // Schedule at end of queue
    const result = await this.scheduleTaskAtEnd(machineId, createdTask.id);
    
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
