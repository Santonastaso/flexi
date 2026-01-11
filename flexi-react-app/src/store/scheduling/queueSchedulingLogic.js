import { format } from 'date-fns';
import { useOrderStore } from '../useOrderStore';
import { apiService } from '../../services/api';

/**
 * Queue Scheduling Logic
 * Handles continuous queue-based scheduling where tasks are placed back-to-back
 */
export class QueueSchedulingLogic {
  constructor(get, set, schedulingLogic, splitTaskManager) {
    this.get = get;
    this.set = set;
    this.schedulingLogic = schedulingLogic;
    this.splitTaskManager = splitTaskManager;
    // Lock mechanism to prevent concurrent queue modifications
    this.queueLocks = new Map(); // machineId -> boolean
  }

  /**
   * Acquire a lock for a specific machine queue
   * Prevents concurrent modifications
   */
  async acquireLock(machineId, timeout = 30000) {
    const startTime = Date.now();
    while (this.queueLocks.get(machineId)) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Queue operation timeout: another operation is in progress');
      }
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.queueLocks.set(machineId, true);
  }

  /**
   * Release a lock for a specific machine queue
   */
  releaseLock(machineId) {
    this.queueLocks.delete(machineId);
  }

  /**
   * Get the queue of tasks for a specific machine
   * Returns tasks sorted by scheduled_start_time
   */
  getQueueForMachine = (machineId) => {
    try {
      const { getOdpOrders } = useOrderStore.getState();
      const allOrders = getOdpOrders();
      
      if (!Array.isArray(allOrders)) {
        console.error('❌ QUEUE: getOdpOrders did not return an array');
        return [];
      }
      
      return allOrders
        .filter(task => {
          // Defensive checks
          if (!task || typeof task !== 'object') return false;
          if (task.scheduled_machine_id !== machineId) return false;
          if (task.status !== 'SCHEDULED') return false;
          if (!task.scheduled_start_time) return false;
          return true;
        })
        .sort((a, b) => {
          try {
            const aTime = new Date(a.scheduled_start_time).getTime();
            const bTime = new Date(b.scheduled_start_time).getTime();
            
            // Handle invalid dates
            if (isNaN(aTime) || isNaN(bTime)) {
              console.warn('⚠️ QUEUE: Invalid date detected', { a: a.scheduled_start_time, b: b.scheduled_start_time });
              if (isNaN(aTime)) return 1;
              if (isNaN(bTime)) return -1;
              return 0;
            }
            
            return aTime - bTime;
          } catch (error) {
            console.error('❌ QUEUE: Error sorting tasks', error);
            return 0;
          }
        });
    } catch (error) {
      console.error('❌ QUEUE: Error in getQueueForMachine', error);
      return [];
    }
  };

  /**
   * Calculate the next available start time in the queue
   * This is either NOW or the end time of the last task in queue
   */
  calculateQueueStartTime = (machineId) => {
    const queue = this.getQueueForMachine(machineId);
    
    if (queue.length === 0) {
      // Queue is empty, start from now
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;
      const day = now.getUTCDate();
      const hour = now.getUTCHours();
      const minute = now.getUTCMinutes();
      
      // Round up to next 15-minute slot
      const nextSlot = Math.ceil(minute / 15) * 15;
      if (nextSlot === 60) {
        return this.schedulingLogic.createAbsoluteDate(year, month, day, hour + 1, 0);
      } else {
        return this.schedulingLogic.createAbsoluteDate(year, month, day, hour, nextSlot);
      }
    }
    
    // Get the last task in queue
    const lastTask = queue[queue.length - 1];
    if (!lastTask.scheduled_end_time) {
      console.error('Last task in queue has no end time:', lastTask);
      // Fallback to now
      const now = new Date();
      return this.schedulingLogic.createAbsoluteDate(
        now.getUTCFullYear(), 
        now.getUTCMonth() + 1, 
        now.getUTCDate(), 
        now.getUTCHours(), 
        now.getUTCMinutes()
      );
    }
    
    // Start from the end of the last task
    const lastEndTime = new Date(lastTask.scheduled_end_time);
    
    // Round up to next 15-minute slot
    const minutes = lastEndTime.getUTCMinutes();
    const nextSlot = Math.ceil(minutes / 15) * 15;
    
    if (nextSlot === 60) {
      lastEndTime.setUTCHours(lastEndTime.getUTCHours() + 1, 0, 0, 0);
    } else {
      lastEndTime.setUTCMinutes(nextSlot, 0, 0);
    }
    
    return lastEndTime;
  };

  /**
   * Schedule a task at the end of the queue
   * Task automatically schedules starting from the last task's end time
   */
  scheduleTaskAtEndOfQueue = async (machineId, taskId) => {
    // Acquire lock to prevent concurrent modifications
    await this.acquireLock(machineId);
    
    try {
      console.log('📋 QUEUE: Scheduling task at end of queue', { machineId, taskId });
      
      const { getOrderById } = useOrderStore.getState();
      const task = getOrderById(taskId);
      
      if (!task) {
        return { error: 'Task not found' };
      }
      
      // Validate task is not already scheduled
      if (task.status === 'SCHEDULED' && task.scheduled_machine_id) {
        if (task.scheduled_machine_id === machineId) {
          return { error: 'Task already scheduled on this machine' };
        } else {
          return { error: 'Task already scheduled on another machine. Unschedule it first.' };
        }
      }
      
      // Validate task has valid duration
      const duration = task.time_remaining || task.duration || 0;
      if (duration <= 0) {
        return { error: 'Task must have a duration greater than 0' };
      }
      
      // Calculate start time
      const startTime = this.calculateQueueStartTime(machineId);
      
      console.log('📋 QUEUE: Calculated start time:', startTime.toISOString(), 'Duration:', duration);
      
      // Use existing scheduling logic with splitting support
      const schedulingResult = await this.schedulingLogic.scheduleTaskWithSplitting(
        taskId,
        startTime,
        duration,
        machineId,
        [] // No exclusions
      );
      
      if (!schedulingResult) {
        return { error: 'No available time slots found for this task' };
      }
      
      if (schedulingResult.conflict) {
        return { 
          conflict: true,
          conflictingTask: schedulingResult.conflictingTask,
          draggedTask: task,
          proposedStartTime: startTime.toISOString(),
          machine: { id: machineId }
        };
      }
      
      // Update the task with scheduling info
      const updates = {
        scheduled_machine_id: machineId,
        scheduled_start_time: schedulingResult.startTime.toISOString(),
        scheduled_end_time: schedulingResult.endTime.toISOString(),
        status: 'SCHEDULED',
      };
      
      // Store segment information
      if (schedulingResult.segments) {
        const segmentInfo = {
          segments: schedulingResult.segments,
          totalSegments: schedulingResult.segments.length,
          originalDuration: schedulingResult.originalDuration || duration,
          wasSplit: schedulingResult.wasSplit || false
        };
        updates.description = JSON.stringify(segmentInfo);
        this.splitTaskManager.setSplitTaskInfo(taskId, segmentInfo);
      }
      
      await apiService.updateOdpOrder(taskId, updates);
      
      console.log('✅ QUEUE: Task scheduled successfully at end of queue');
      
      return { 
        success: true, 
        updatedTask: { ...task, ...updates },
        schedulingResult 
      };
      
    } catch (error) {
      console.error('❌ QUEUE: Error scheduling task at end of queue:', error);
      return { error: error.message || 'Failed to schedule task' };
    } finally {
      // Always release the lock
      this.releaseLock(machineId);
    }
  };

  /**
   * Recalculate all tasks in queue starting from a specific position
   * Used after reordering or inserting tasks
   */
  recalculateQueueFromPosition = async (machineId, startPosition = 0) => {
    try {
      console.log('🔄 QUEUE: Recalculating queue from position', startPosition);
      
      // Validate inputs
      if (!machineId) {
        return { error: 'Machine ID is required' };
      }
      
      if (typeof startPosition !== 'number' || startPosition < 0) {
        return { error: 'Start position must be a non-negative number' };
      }
      
      const queue = this.getQueueForMachine(machineId);
      
      if (!Array.isArray(queue)) {
        return { error: 'Failed to retrieve queue' };
      }
      
      if (queue.length === 0 || startPosition >= queue.length) {
        console.log('🔄 QUEUE: Nothing to recalculate');
        return { success: true, rescheduledTasks: [] };
      }
      
      // Calculate start time for the first task to reschedule
      let currentStartTime;
      if (startPosition === 0) {
        // Starting from the beginning
        currentStartTime = this.calculateQueueStartTime(machineId);
      } else {
        // Starting from after a specific task
        const previousTask = queue[startPosition - 1];
        if (!previousTask.scheduled_end_time) {
          return { error: 'Previous task has no end time' };
        }
        currentStartTime = new Date(previousTask.scheduled_end_time);
        
        // Round to next 15-minute slot
        const minutes = currentStartTime.getUTCMinutes();
        const nextSlot = Math.ceil(minutes / 15) * 15;
        if (nextSlot === 60) {
          currentStartTime.setUTCHours(currentStartTime.getUTCHours() + 1, 0, 0, 0);
        } else {
          currentStartTime.setUTCMinutes(nextSlot, 0, 0);
        }
      }
      
      const rescheduledTasks = [];
      
      // Reschedule each task sequentially
      for (let i = startPosition; i < queue.length; i++) {
        const task = queue[i];
        const duration = task.time_remaining || task.duration || 1;
        
        console.log(`🔄 QUEUE: Rescheduling task ${i + 1}/${queue.length}:`, task.odp_number, 'at', currentStartTime.toISOString());
        
        // Schedule this task
        const schedulingResult = await this.schedulingLogic.scheduleTaskWithSplitting(
          task.id,
          currentStartTime,
          duration,
          machineId,
          [] // No exclusions within queue recalculation
        );
        
        if (!schedulingResult) {
          console.error('❌ QUEUE: Failed to reschedule task', task.odp_number);
          return { 
            error: `Failed to reschedule task ${task.odp_number}`,
            rescheduledTasks 
          };
        }
        
        if (schedulingResult.conflict) {
          console.error('❌ QUEUE: Conflict detected while rescheduling', task.odp_number);
          return { 
            error: `Conflict detected while rescheduling task ${task.odp_number}`,
            rescheduledTasks 
          };
        }
        
        // Update task in database
        const updates = {
          scheduled_start_time: schedulingResult.startTime.toISOString(),
          scheduled_end_time: schedulingResult.endTime.toISOString(),
        };
        
        // Store segment information
        if (schedulingResult.segments) {
          const segmentInfo = {
            segments: schedulingResult.segments,
            totalSegments: schedulingResult.segments.length,
            originalDuration: schedulingResult.originalDuration || duration,
            wasSplit: schedulingResult.wasSplit || false
          };
          updates.description = JSON.stringify(segmentInfo);
          this.splitTaskManager.setSplitTaskInfo(task.id, segmentInfo);
        }
        
        await apiService.updateOdpOrder(task.id, updates);
        
        rescheduledTasks.push({
          id: task.id,
          odp_number: task.odp_number,
          new_start_time: schedulingResult.startTime.toISOString(),
          new_end_time: schedulingResult.endTime.toISOString()
        });
        
        // Move to next slot after this task
        currentStartTime = new Date(schedulingResult.endTime);
        const nextMinutes = currentStartTime.getUTCMinutes();
        const nextSlot = Math.ceil(nextMinutes / 15) * 15;
        if (nextSlot === 60) {
          currentStartTime.setUTCHours(currentStartTime.getUTCHours() + 1, 0, 0, 0);
        } else {
          currentStartTime.setUTCMinutes(nextSlot, 0, 0);
        }
      }
      
      console.log('✅ QUEUE: Successfully rescheduled', rescheduledTasks.length, 'tasks');
      
      return { 
        success: true, 
        rescheduledTasks 
      };
      
    } catch (error) {
      console.error('❌ QUEUE: Error recalculating queue:', error);
      return { error: error.message || 'Failed to recalculate queue' };
    }
  };

  /**
   * Reorder a task within the queue
   * Moves task from oldIndex to newIndex, then recalculates affected range
   */
  reorderTaskInQueue = async (machineId, taskId, oldIndex, newIndex) => {
    // Acquire lock to prevent concurrent modifications
    await this.acquireLock(machineId);
    
    try {
      console.log('🔄 QUEUE: Reordering task', { machineId, taskId, oldIndex, newIndex });
      
      if (oldIndex === newIndex) {
        return { success: true, message: 'No change in position' };
      }
      
      // Get the queue
      const queue = this.getQueueForMachine(machineId);
      
      if (oldIndex < 0 || oldIndex >= queue.length || newIndex < 0 || newIndex >= queue.length) {
        return { error: 'Invalid position' };
      }
      
      // Determine which part of the queue needs recalculation
      const startPosition = Math.min(oldIndex, newIndex);
      const endPosition = Math.max(oldIndex, newIndex);
      
      console.log(`🔄 QUEUE: Will recalculate from position ${startPosition} to ${endPosition}`);
      
      // Create new order by moving the task
      const reorderedQueue = [...queue];
      const [movedTask] = reorderedQueue.splice(oldIndex, 1);
      reorderedQueue.splice(newIndex, 0, movedTask);
      
      // Calculate start time for first affected task
      let currentStartTime;
      if (startPosition === 0) {
        currentStartTime = this.calculateQueueStartTime(machineId);
      } else {
        const previousTask = reorderedQueue[startPosition - 1];
        if (!previousTask.scheduled_end_time) {
          return { error: 'Previous task has no end time' };
        }
        currentStartTime = new Date(previousTask.scheduled_end_time);
        const minutes = currentStartTime.getUTCMinutes();
        const nextSlot = Math.ceil(minutes / 15) * 15;
        if (nextSlot === 60) {
          currentStartTime.setUTCHours(currentStartTime.getUTCHours() + 1, 0, 0, 0);
        } else {
          currentStartTime.setUTCMinutes(nextSlot, 0, 0);
        }
      }
      
      // Reschedule tasks in new order
      const rescheduledTasks = [];
      for (let i = startPosition; i <= endPosition; i++) {
        const task = reorderedQueue[i];
        const duration = task.time_remaining || task.duration || 1;
        
        const schedulingResult = await this.schedulingLogic.scheduleTaskWithSplitting(
          task.id,
          currentStartTime,
          duration,
          machineId,
          []
        );
        
        if (!schedulingResult || schedulingResult.conflict) {
          return { 
            error: `Failed to reschedule task ${task.odp_number}`,
            rescheduledTasks 
          };
        }
        
        const updates = {
          scheduled_start_time: schedulingResult.startTime.toISOString(),
          scheduled_end_time: schedulingResult.endTime.toISOString(),
        };
        
        if (schedulingResult.segments) {
          const segmentInfo = {
            segments: schedulingResult.segments,
            totalSegments: schedulingResult.segments.length,
            originalDuration: schedulingResult.originalDuration || duration,
            wasSplit: schedulingResult.wasSplit || false
          };
          updates.description = JSON.stringify(segmentInfo);
          this.splitTaskManager.setSplitTaskInfo(task.id, segmentInfo);
        }
        
        await apiService.updateOdpOrder(task.id, updates);
        
        rescheduledTasks.push({
          id: task.id,
          odp_number: task.odp_number,
          new_start_time: schedulingResult.startTime.toISOString(),
          new_end_time: schedulingResult.endTime.toISOString()
        });
        
        currentStartTime = new Date(schedulingResult.endTime);
        const nextMinutes = currentStartTime.getUTCMinutes();
        const nextSlot = Math.ceil(nextMinutes / 15) * 15;
        if (nextSlot === 60) {
          currentStartTime.setUTCHours(currentStartTime.getUTCHours() + 1, 0, 0, 0);
        } else {
          currentStartTime.setUTCMinutes(nextSlot, 0, 0);
        }
      }
      
      // Recalculate remaining tasks if any
      if (endPosition < queue.length - 1) {
        await this.recalculateQueueFromPosition(machineId, endPosition + 1);
      }
      
      console.log('✅ QUEUE: Successfully reordered and rescheduled', rescheduledTasks.length, 'tasks');
      
      return { 
        success: true, 
        rescheduledTasks 
      };
      
    } catch (error) {
      console.error('❌ QUEUE: Error reordering task:', error);
      return { error: error.message || 'Failed to reorder task' };
    } finally {
      // Always release the lock
      this.releaseLock(machineId);
    }
  };

  /**
   * Create a fictitious pause task in the queue
   * Pause tasks are special tasks that create gaps
   */
  createPauseTask = async (machineId, durationHours, insertAtEnd = true) => {
    try {
      console.log('⏸ QUEUE: Creating pause task', { machineId, durationHours });
      
      // Validate inputs
      if (!machineId) {
        return { error: 'Machine ID is required' };
      }
      
      if (typeof durationHours !== 'number' || durationHours <= 0) {
        return { error: 'Duration must be a positive number' };
      }
      
      if (durationHours > 24) {
        return { error: 'Maximum pause duration is 24 hours' };
      }
      
      const { getOdpOrders } = useOrderStore.getState();
      
      // Calculate start time
      const startTime = this.calculateQueueStartTime(machineId);
      
      if (!startTime || isNaN(startTime.getTime())) {
        return { error: 'Failed to calculate valid start time for pause' };
      }
      
      // Create a unique pause task ID
      const pauseId = `PAUSE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate end time
      const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000));
      
      // Create pause task object
      const pauseTask = {
        odp_number: pauseId,
        article_code: 'PAUSE',
        duration: durationHours,
        time_remaining: durationHours,
        cost: 0,
        quantity: 0,
        quantity_completed: 0,
        progress: 0,
        scheduled_machine_id: machineId,
        scheduled_start_time: startTime.toISOString(),
        scheduled_end_time: endTime.toISOString(),
        status: 'SCHEDULED',
        work_center: null, // Pause doesn't have work center
        description: JSON.stringify({
          is_pause: true,
          created_at: new Date().toISOString()
        })
      };
      
      // Create the pause task in database
      const createdTask = await apiService.createOdpOrder(pauseTask);
      
      console.log('✅ QUEUE: Pause task created successfully', createdTask.id);
      
      // If not inserting at end, we might need to recalculate subsequent tasks
      // For now, we always add at end
      
      return { 
        success: true, 
        pauseTask: createdTask 
      };
      
    } catch (error) {
      console.error('❌ QUEUE: Error creating pause task:', error);
      return { error: error.message || 'Failed to create pause task' };
    }
  };

  /**
   * Remove a task from the queue (unschedule it)
   * Then recalculate all subsequent tasks
   */
  removeTaskFromQueue = async (machineId, taskId) => {
    // Acquire lock to prevent concurrent modifications
    await this.acquireLock(machineId);
    
    try {
      console.log('🗑️ QUEUE: Removing task from queue', { machineId, taskId });
      
      const queue = this.getQueueForMachine(machineId);
      const taskIndex = queue.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) {
        return { error: 'Task not found in queue' };
      }
      
      // Unschedule the task
      const updates = {
        scheduled_machine_id: null,
        scheduled_start_time: null,
        scheduled_end_time: null,
        status: 'NOT SCHEDULED',
        description: '', // Clear segment info
      };
      
      await apiService.updateOdpOrder(taskId, updates);
      this.splitTaskManager.clearSplitTaskInfo(taskId);
      
      // If there are tasks after this one, recalculate them
      if (taskIndex < queue.length - 1) {
        console.log(`🔄 QUEUE: Recalculating ${queue.length - taskIndex - 1} tasks after removal`);
        await this.recalculateQueueFromPosition(machineId, taskIndex);
      }
      
      console.log('✅ QUEUE: Task removed successfully');
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ QUEUE: Error removing task from queue:', error);
      return { error: error.message || 'Failed to remove task from queue' };
    } finally {
      // Always release the lock
      this.releaseLock(machineId);
    }
  };

  /**
   * Insert a task at a specific position in the queue
   * Then recalculate from that position onwards
   */
  insertTaskInQueue = async (machineId, taskId, position) => {
    try {
      console.log('📌 QUEUE: Inserting task at position', { machineId, taskId, position });
      
      const { getOrderById } = useOrderStore.getState();
      const task = getOrderById(taskId);
      
      if (!task) {
        return { error: 'Task not found' };
      }
      
      const queue = this.getQueueForMachine(machineId);
      
      // Calculate start time based on position
      let startTime;
      if (position === 0) {
        // Insert at beginning
        startTime = this.calculateQueueStartTime(machineId);
      } else if (position >= queue.length) {
        // Insert at end (same as scheduleTaskAtEndOfQueue)
        return await this.scheduleTaskAtEndOfQueue(machineId, taskId);
      } else {
        // Insert in middle - start after the task at position-1
        const previousTask = queue[position - 1];
        if (!previousTask.scheduled_end_time) {
          return { error: 'Previous task has no end time' };
        }
        startTime = new Date(previousTask.scheduled_end_time);
        
        // Round to next 15-minute slot
        const minutes = startTime.getUTCMinutes();
        const nextSlot = Math.ceil(minutes / 15) * 15;
        if (nextSlot === 60) {
          startTime.setUTCHours(startTime.getUTCHours() + 1, 0, 0, 0);
        } else {
          startTime.setUTCMinutes(nextSlot, 0, 0);
        }
      }
      
      const duration = task.time_remaining || task.duration || 1;
      
      // Schedule the task
      const schedulingResult = await this.schedulingLogic.scheduleTaskWithSplitting(
        taskId,
        startTime,
        duration,
        machineId,
        []
      );
      
      if (!schedulingResult) {
        return { error: 'No available time slots found' };
      }
      
      if (schedulingResult.conflict) {
        return { 
          conflict: true,
          conflictingTask: schedulingResult.conflictingTask 
        };
      }
      
      // Update the task
      const updates = {
        scheduled_machine_id: machineId,
        scheduled_start_time: schedulingResult.startTime.toISOString(),
        scheduled_end_time: schedulingResult.endTime.toISOString(),
        status: 'SCHEDULED',
      };
      
      if (schedulingResult.segments) {
        const segmentInfo = {
          segments: schedulingResult.segments,
          totalSegments: schedulingResult.segments.length,
          originalDuration: schedulingResult.originalDuration || duration,
          wasSplit: schedulingResult.wasSplit || false
        };
        updates.description = JSON.stringify(segmentInfo);
        this.splitTaskManager.setSplitTaskInfo(taskId, segmentInfo);
      }
      
      await apiService.updateOdpOrder(taskId, updates);
      
      // Recalculate all tasks after this position
      await this.recalculateQueueFromPosition(machineId, position + 1);
      
      console.log('✅ QUEUE: Task inserted successfully');
      
      return { success: true, updatedTask: { ...task, ...updates } };
      
    } catch (error) {
      console.error('❌ QUEUE: Error inserting task:', error);
      return { error: error.message || 'Failed to insert task' };
    }
  };
}

