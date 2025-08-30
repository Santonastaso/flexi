import { useOrderStore } from '../useOrderStore';
import { useUIStore } from '../useUIStore';
import { toDateString } from '../../utils/dateUtils';

/**
 * Conflict Resolution
 * Handles task shunting and conflict resolution when tasks overlap
 */
export class ConflictResolution {
  constructor(get, set, schedulingLogic, splitTaskManager) {
    this.get = get;
    this.set = set;
    this.schedulingLogic = schedulingLogic;
    this.splitTaskManager = splitTaskManager;
  }

  // Helper functions for precise minute-based calculations
  getTaskDurationMinutes = (task) => {
    return Math.round((task.time_remaining || task.duration || 1) * 60);
  };

  getTaskEndTime = (task) => {
    const startTime = new Date(task.scheduled_start_time);
    const durationMinutes = this.getTaskDurationMinutes(task);
    const endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
    return endTime;
  };

  addMinutesToDate = (date, minutes) => {
    return new Date(date.getTime() + (minutes * 60 * 1000));
  };

  // Helper function to round up to the next 15-minute slot
  roundUpToNext15MinSlot = (date) => {
    const minutes = date.getUTCMinutes();
    const hours = date.getUTCHours();
    const nextSlot = Math.ceil(minutes / 15) * 15;
    const roundedDate = new Date(date);
    
    if (nextSlot === 60) {
      roundedDate.setUTCHours(hours + 1, 0, 0, 0);
    } else {
      roundedDate.setUTCMinutes(nextSlot, 0, 0);
    }
    
    return roundedDate;
  };

  // Schedule task with comprehensive splitting logic (for shunted tasks)
  scheduleTaskWithSplittingForShunt = async (task, newStartTime, machine) => {
    return await this.scheduleTaskWithSplittingForShuntExcluding(task, newStartTime, machine, [task.id]);
  };

  // Schedule task with comprehensive splitting logic, excluding specific tasks from overlap detection
  scheduleTaskWithSplittingForShuntExcluding = async (task, newStartTime, machine, excludeTaskIds) => {
    const taskHours = this.getTaskDurationMinutes(task) / 60;
    
    // Filter out the current task from exclude list to avoid self-exclusion issues
    const additionalExcludeIds = excludeTaskIds.filter(id => id !== task.id);
    
    // Use comprehensive scheduling with splitting, passing exclude IDs
    const schedulingResult = await this.schedulingLogic.scheduleTaskWithSplitting(
      task.id, 
      newStartTime, 
      taskHours, 
      machine.id,
      additionalExcludeIds
    );

    if (schedulingResult && !schedulingResult.conflict) {
      // Successful scheduling result
      return {
        startTime: schedulingResult.startTime,
        endTime: schedulingResult.endTime,
        wasSplit: schedulingResult.wasSplit
      };
    } else if (schedulingResult && schedulingResult.conflict) {
      // Conflict detected during shunting - this shouldn't happen in a properly designed shunt
      console.error(`🚨 Conflict during shunting for task ${task.odp_number}:`, schedulingResult);
      throw new Error(`Cannot shunt task ${task.odp_number}: would create new conflicts`);
    }

    // Fallback: schedule without splitting (shouldn't reach here in normal operation)
    return {
      startTime: newStartTime,
      endTime: this.addMinutesToDate(newStartTime, this.getTaskDurationMinutes(task)),
      wasSplit: false
    };
  };

  // BULLETPROOF: Check if a task's segments would overlap with existing tasks after shunting
  checkShuntingOverlaps = (taskSegments, machineId, excludeTaskIds = []) => {
    const { getOdpOrders } = useOrderStore.getState();
    const existingTasks = getOdpOrders().filter(o => 
      o.scheduled_machine_id === machineId && 
      o.status === 'SCHEDULED' &&
      !excludeTaskIds.includes(o.id)
    );

    for (const segment of taskSegments) {
      for (const existingTask of existingTasks) {
        const overlapResult = this.splitTaskManager.checkTaskOverlap(
          segment.start, 
          segment.end, 
          existingTask
        );
        if (overlapResult.hasOverlap) {
          return {
            hasOverlap: true,
            conflictingTask: existingTask,
            conflictingSegment: overlapResult.conflictingSegment,
            newTaskSegment: segment
          };
        }
      }
    }
    return { hasOverlap: false };
  };

  // Resolve conflict by shunting tasks in the chosen direction
  resolveConflictByShunting = async (conflictDetails, direction) => {
    try {
      console.log(`🔄 Shunting ${conflictDetails.draggedTask?.odp_number} ${direction} from ${conflictDetails.conflictingTask?.odp_number}`);
      
      const { conflictingTask, draggedTask, proposedStartTime, machine } = conflictDetails;
      const { updateOdpOrder } = useOrderStore.getState();
      const { getOdpOrders } = useOrderStore.getState();
      
      // Get all scheduled tasks on this machine (using segment-aware sorting)
      const scheduledTasks = getOdpOrders().filter(o => 
        o.scheduled_machine_id === machine.id && 
        o.status === 'SCHEDULED' &&
        o.id !== draggedTask.id
      ).sort((a, b) => {
        // Sort by the earliest segment start time for each task
        const aSegments = this.splitTaskManager.getTaskOccupiedSegments(a);
        const bSegments = this.splitTaskManager.getTaskOccupiedSegments(b);
        const aStart = aSegments.length > 0 ? aSegments[0].start : new Date(a.scheduled_start_time);
        const bStart = bSegments.length > 0 ? bSegments[0].start : new Date(b.scheduled_start_time);
        return aStart - bStart;
      });
      
      // Find the conflicting task index
      const conflictIndex = scheduledTasks.findIndex(t => t.id === conflictingTask.id);
      if (conflictIndex === -1) return { error: 'Conflicting task not found' };
      
      // Calculate the duration of the dragged task in minutes
      const draggedDurationMinutes = this.getTaskDurationMinutes(draggedTask);
      
      // Find contiguous tasks that need to be shunted
      const affectedTasks = [];
      let gapFound = false;
      
      if (direction === 'right') {
        // Push tasks to the right starting from the conflicting task
        for (let i = conflictIndex; i < scheduledTasks.length && !gapFound; i++) {
          const currentTask = scheduledTasks[i];
          affectedTasks.push(currentTask);
          
          if (i < scheduledTasks.length - 1) {
            const nextTask = scheduledTasks[i + 1];
            // Use segment-aware end time calculation
            const currentSegments = this.splitTaskManager.getTaskOccupiedSegments(currentTask);
            const nextSegments = this.splitTaskManager.getTaskOccupiedSegments(nextTask);
            
            if (currentSegments.length > 0 && nextSegments.length > 0) {
              // Find the latest end time of current task and earliest start of next task
              const currentEnd = Math.max(...currentSegments.map(seg => seg.end.getTime()));
              const nextStart = Math.min(...nextSegments.map(seg => seg.start.getTime()));
              const gapMinutes = Math.floor((nextStart - currentEnd) / (60 * 1000));
              
              if (gapMinutes >= draggedDurationMinutes) {
                gapFound = true;
              }
            }
          } else {
            gapFound = true; // Last task, infinite space after
          }
        }
      } else {
        // Push tasks to the left starting from the conflicting task
        for (let i = conflictIndex; i >= 0 && !gapFound; i--) {
          const currentTask = scheduledTasks[i];
          affectedTasks.unshift(currentTask);
          
          if (i > 0) {
            const prevTask = scheduledTasks[i - 1];
            // Use segment-aware time calculation
            const prevSegments = this.splitTaskManager.getTaskOccupiedSegments(prevTask);
            const currentSegments = this.splitTaskManager.getTaskOccupiedSegments(currentTask);
            
            if (prevSegments.length > 0 && currentSegments.length > 0) {
              const prevEnd = Math.max(...prevSegments.map(seg => seg.end.getTime()));
              const currentStart = Math.min(...currentSegments.map(seg => seg.start.getTime()));
              const gapMinutes = Math.floor((currentStart - prevEnd) / (60 * 1000));
              
              if (gapMinutes >= draggedDurationMinutes) {
                gapFound = true;
              }
            }
          } else {
            // Check space at beginning of day
            const currentSegments = this.splitTaskManager.getTaskOccupiedSegments(currentTask);
            if (currentSegments.length > 0) {
              const firstTaskStart = Math.min(...currentSegments.map(seg => seg.start.getTime()));
              const dayStart = new Date(firstTaskStart);
              dayStart.setHours(0, 0, 0, 0);
              const gapMinutes = Math.floor((firstTaskStart - dayStart.getTime()) / (60 * 1000));
              
              if (gapMinutes >= draggedDurationMinutes) {
                gapFound = true;
              }
            }
          }
        }
      }
      
      // If no sufficient gap found, return error
      if (!gapFound && affectedTasks.length === scheduledTasks.length) {
        return { error: 'Non c\'è spazio sufficiente per spostare i lavori' };
      }
      
      console.log(`📋 Moving ${affectedTasks.length} tasks ${direction}`);
      
      // Calculate new positions for affected tasks with comprehensive splitting
      const updates = [];
      // Will hold the dragged task scheduling result if computed early
      let draggedSchedulingResult = null;
      
      if (direction === 'right') {
        // For right direction: schedule the dragged task FIRST (with splitting)
        // Then cascade affected tasks to start after the dragged task actually ends
        const proposedStart = new Date(proposedStartTime);
        const excludeForDragged = [...affectedTasks.map(t => t.id), draggedTask.id];
        
        console.log(`🔄 Scheduling dragged task ${draggedTask.odp_number} at ${proposedStart.toISOString()} (RIGHT first)`);
        console.log(`🔄 Excluding affected + dragged:`, excludeForDragged);
        
        draggedSchedulingResult = await this.scheduleTaskWithSplittingForShuntExcluding(
          draggedTask,
          proposedStart,
          machine,
          excludeForDragged
        );
        
        let currentStartTime = this.roundUpToNext15MinSlot(draggedSchedulingResult.endTime);
        
        for (const task of affectedTasks) {
          // Exclude ALL affected tasks and the dragged task to avoid intra-batch conflicts
          // We place them sequentially in this loop, so they won't collide with each other
          const excludeTaskIds = [...affectedTasks.map(t => t.id), draggedTask.id];
          
          console.log(`🔄 Shunting task ${task.odp_number} to ${currentStartTime.toISOString()}`);
          console.log(`🔄 Excluding affected + dragged:`, excludeTaskIds);
          
          // Use comprehensive splitting logic for shunted tasks
          const schedulingResult = await this.scheduleTaskWithSplittingForShuntExcluding(
            task, 
            currentStartTime, 
            machine, 
            excludeTaskIds
          );
          
          updates.push({
            id: task.id,
            scheduled_start_time: schedulingResult.startTime.toISOString(),
            scheduled_end_time: schedulingResult.endTime.toISOString()
          });
          
          // Next task starts at the next 15-minute slot after this task ends
          currentStartTime = this.roundUpToNext15MinSlot(schedulingResult.endTime);
        }
      } else {
        // LEFT direction: schedule dragged task LAST; first, cascade tasks to end before the dragged start
        const proposedStart = new Date(proposedStartTime);
        let currentEndTime = this.roundUpToNext15MinSlot(this.addMinutesToDate(proposedStart, -1));

        // Work backwards through affected tasks, placing each so it ENDS at currentEndTime
        for (let i = affectedTasks.length - 1; i >= 0; i--) {
          const task = affectedTasks[i];
          const excludeTaskIds = [...affectedTasks.map(t => t.id), draggedTask.id];
          
          // Use backward splitting to END at currentEndTime
          const schedulingResult = await this.schedulingLogic.scheduleTaskEndingAtWithSplitting(
            task.id,
            currentEndTime,
            this.getTaskDurationMinutes(task) / 60,
            machine.id,
            excludeTaskIds
          );
          
          console.log(`✅ Task ${task.odp_number} scheduled (LEFT):`, {
            start: schedulingResult.startTime.toISOString(),
            end: schedulingResult.endTime.toISOString(),
            wasSplit: schedulingResult.wasSplit
          });
          
          updates.push({
            id: task.id,
            scheduled_start_time: schedulingResult.startTime.toISOString(),
            scheduled_end_time: schedulingResult.endTime.toISOString()
          });
          
          // Next task (earlier) must end at the previous 15-min slot before this task starts
          currentEndTime = this.roundUpToNext15MinSlot(this.addMinutesToDate(schedulingResult.startTime, -1));
        }
      }
      
      // Schedule the dragged task if not already scheduled above (e.g., LEFT direction)
      if (!draggedSchedulingResult) {
        const proposedStart = new Date(proposedStartTime);
        const excludeTaskIds = [...affectedTasks.map(t => t.id), draggedTask.id];
        
        console.log(`🔄 Scheduling dragged task ${draggedTask.odp_number} at ${proposedStart.toISOString()}`);
        console.log(`🔄 Excluding all affected tasks:`, excludeTaskIds);
        
        draggedSchedulingResult = await this.scheduleTaskWithSplittingForShuntExcluding(
          draggedTask, 
          proposedStart, 
          machine, 
          excludeTaskIds
        );
      }
      
      console.log(`✅ Dragged task ${draggedTask.odp_number} scheduled:`, {
        start: draggedSchedulingResult.startTime.toISOString(),
        end: draggedSchedulingResult.endTime.toISOString(),
        wasSplit: draggedSchedulingResult.wasSplit
      });
      
      updates.push({
        id: draggedTask.id,
        scheduled_machine_id: machine.id,
        scheduled_start_time: draggedSchedulingResult.startTime.toISOString(),
        scheduled_end_time: draggedSchedulingResult.endTime.toISOString(),
        status: 'SCHEDULED'
      });
      
      // Execute all updates
      for (const update of updates) {
        await updateOdpOrder(update.id, update);
      }
      
      console.log(`✅ Shunting complete: ${updates.length} tasks updated`);
      
      // Hide the conflict dialog
      useUIStore.getState().hideConflictDialog();
      useUIStore.getState().showAlert('Lavori riprogrammati con successo', 'success');
      
      return { success: true };
    } catch (error) {
      console.error('Error in resolveConflictByShunting:', error);
      return { error: error.message || 'Errore durante la riprogrammazione' };
    }
  };
}
