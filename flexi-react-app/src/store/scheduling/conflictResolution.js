import { useOrderStore } from '../useOrderStore';
import { useUIStore } from '../useUIStore';
import { AppError, ERROR_TYPES } from '../../utils/errorHandling';
import { TIME_CONSTANTS } from '../../constants';
import { apiService } from '../../services/api';


/**
 * Conflict Resolution
 * Handles task shunting and conflict resolution when tasks overlap
 * 
 * IMPROVED SHUNTING METHOD:
 * Uses gap detection and directional shunting for reliable task rescheduling
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
    return Math.round((task.time_remaining || task.duration || 1) * TIME_CONSTANTS.MINUTES_PER_HOUR);
  };

  getTaskEndTime = (task) => {
    const startTime = new Date(task.scheduled_start_time);
    const durationMinutes = this.getTaskDurationMinutes(task);
    const endTime = new Date(startTime.getTime() + (durationMinutes * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE));
    return endTime;
  };

  addMinutesToDate = (date, minutes) => {
    return new Date(date.getTime() + (minutes * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE));
  };

  // Helper function to round up to the next 15-minute slot
  roundUpToNext15MinSlot = (date) => {
    const minutes = date.getUTCMinutes();
    const hours = date.getUTCHours();
    const nextSlot = Math.ceil(minutes / 15) * 15;
    const roundedDate = new Date(date);
    
    if (nextSlot === TIME_CONSTANTS.MINUTES_PER_HOUR) {
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
  scheduleTaskWithSplittingForShuntExcluding = async (task, newStartTime, machine, excludeTaskIds, maxCascadeDepth = 3) => {
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
      // Conflict detected during shunting - try cascading shunting
      console.log(`🔄 CASCADING SHUNT: Task ${task.odp_number} conflicts with ${schedulingResult.conflictingTask?.odp_number}, attempting cascading resolution`);
      
      if (maxCascadeDepth > 0) {
        return await this.handleCascadingConflict(task, newStartTime, machine, excludeTaskIds, schedulingResult, maxCascadeDepth - 1);
      } else {
        // Max cascade depth reached - return conflict info instead of throwing error
        console.warn(`⚠️ CASCADING SHUNT: Max depth reached for task ${task.odp_number}, returning conflict info`);
        return {
          conflict: true,
          conflictingTask: schedulingResult.conflictingTask,
          conflictingSegment: schedulingResult.conflictingSegment,
          proposedSegments: schedulingResult.proposedSegments
        };
      }
    } else if (!schedulingResult) {
      // No available slots found - return null to indicate failure
      return null;
    }

    // Fallback: schedule without splitting (shouldn't reach here in normal operation)
    return {
      startTime: newStartTime,
      endTime: this.addMinutesToDate(newStartTime, this.getTaskDurationMinutes(task)),
      wasSplit: false
    };
  };

  // Handle cascading conflicts by recursively shunting conflicting tasks
  handleCascadingConflict = async (originalTask, originalStartTime, machine, excludeTaskIds, conflictResult, maxCascadeDepth) => {
    const conflictingTask = conflictResult.conflictingTask;
    const conflictingSegment = conflictResult.conflictingSegment;
    
    console.log(`🔄 CASCADING SHUNT: Attempting to shunt conflicting task ${conflictingTask?.odp_number} to resolve conflict with ${originalTask.odp_number}`);
    
    // Calculate new start time for the conflicting task (after the original task would end)
    const originalTaskEndTime = new Date(originalStartTime.getTime() + (this.getTaskDurationMinutes(originalTask) * 60 * 1000));
    const newConflictingStartTime = this.roundUpToNext15MinSlot(originalTaskEndTime);
    
    // Add the conflicting task to the exclude list to prevent infinite loops
    const updatedExcludeIds = [...excludeTaskIds, conflictingTask.id];
    
    try {
      // Try to shunt the conflicting task
      const conflictingTaskResult = await this.scheduleTaskWithSplittingForShuntExcluding(
        conflictingTask,
        newConflictingStartTime,
        machine,
        updatedExcludeIds,
        maxCascadeDepth
      );
      
      if (conflictingTaskResult && !conflictingTaskResult.conflict) {
        // Successfully shunted the conflicting task, now try to schedule the original task
        console.log(`✅ CASCADING SHUNT: Successfully shunted conflicting task ${conflictingTask.odp_number}`);
        
        // Update the conflicting task in the store
        await this.updateTaskSchedule(conflictingTask.id, conflictingTaskResult.startTime, conflictingTaskResult.endTime);
        
        // Now try to schedule the original task again
        const originalTaskResult = await this.scheduleTaskWithSplittingForShuntExcluding(
          originalTask,
          originalStartTime,
          machine,
          updatedExcludeIds,
          maxCascadeDepth
        );
        
        if (originalTaskResult && !originalTaskResult.conflict) {
          console.log(`✅ CASCADING SHUNT: Successfully scheduled original task ${originalTask.odp_number} after resolving conflicts`);
          return originalTaskResult;
        } else {
          console.warn(`⚠️ CASCADING SHUNT: Original task ${originalTask.odp_number} still conflicts after shunting conflicting task`);
          return originalTaskResult || {
            conflict: true,
            conflictingTask: conflictingTask,
            conflictingSegment: conflictingSegment,
            proposedSegments: conflictResult.proposedSegments
          };
        }
      } else {
        // Could not shunt the conflicting task
        console.warn(`⚠️ CASCADING SHUNT: Could not shunt conflicting task ${conflictingTask?.odp_number}`);
        return conflictingTaskResult || {
          conflict: true,
          conflictingTask: conflictingTask,
          conflictingSegment: conflictingSegment,
          proposedSegments: conflictResult.proposedSegments
        };
      }
    } catch (error) {
      console.error(`❌ CASCADING SHUNT: Error during cascading conflict resolution:`, error);
      return {
        conflict: true,
        conflictingTask: conflictingTask,
        conflictingSegment: conflictingSegment,
        proposedSegments: conflictResult.proposedSegments
      };
    }
  };

  // Helper method to update task schedule in the store
  updateTaskSchedule = async (taskId, startTime, endTime) => {
    try {
      const { updateOrder } = useOrderStore.getState();
      await updateOrder(taskId, {
        scheduled_start_time: startTime.toISOString(),
        scheduled_end_time: endTime.toISOString()
      });
    } catch (error) {
      console.error(`❌ CASCADING SHUNT: Failed to update task ${taskId} schedule:`, error);
    }
  };

  // BULLETPROOF: Check if a task's segments would overlap with existing tasks after shunting
  checkShuntingOverlaps = (taskSegments, machineId, tasks, excludeTaskIds = []) => {
    const existingTasks = tasks.filter(o => 
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

  // IMPROVED SHUNTING METHOD: Resolve conflict by shunting tasks in the chosen direction
  resolveConflictByShunting = async (conflictDetails, direction, tasks, draggedTask) => {
    try {
      
      const { conflictingTask, proposedStartTime: proposedStartTimeRaw, machine } = conflictDetails;
      const proposedStartTime = new Date(proposedStartTimeRaw);
      
      // Get all scheduled tasks on this machine (using segment-aware sorting)
      const scheduledTasks = tasks.filter(o => 
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
      if (conflictIndex === -1) {
        throw new AppError('Conflicting task not found', ERROR_TYPES.BUSINESS_LOGIC_ERROR, 400, null, 'ConflictResolution.resolveConflictByShunting');
      }
      
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
            // Check space at beginning of working day (6 AM UTC)
            const currentSegments = this.splitTaskManager.getTaskOccupiedSegments(currentTask);
            if (currentSegments.length > 0) {
              const firstTaskStart = Math.min(...currentSegments.map(seg => seg.start.getTime()));
              const dayStart = new Date(firstTaskStart);
              dayStart.setUTCHours(6, 0, 0, 0); // Working day starts at 6 AM UTC
              const gapMinutes = Math.floor((firstTaskStart - dayStart.getTime()) / (60 * 1000));
              
              
              if (gapMinutes >= draggedDurationMinutes) {
                gapFound = true;
              } else {
                // Check if we can move tasks to previous days
                
                // Check if there's space in previous days by looking at the first task's start time
                const firstTaskStartDate = new Date(firstTaskStart);
                const workingDayStart = new Date(firstTaskStartDate);
                workingDayStart.setUTCHours(6, 0, 0, 0);
                
                // If the first task doesn't start at 6 AM, there might be space in previous days
                if (firstTaskStartDate.getTime() > workingDayStart.getTime()) {
                  gapFound = true; // Allow shunting - the algorithm will find the best position
                }
              }
            }
          }
        }
              }
        
        // IMPROVED: Iterative conflict detection and resolution
        
        // Keep track of all tasks that need to be moved
        const allTasksToMove = new Set();
        const allConflictingTasks = new Set();
        
        // Start with the initial affected tasks
        for (const task of affectedTasks) {
          allTasksToMove.add(task.id);
          allConflictingTasks.add(task.id);
        }
        
        // Add the dragged task
        allConflictingTasks.add(draggedTask.id);
        
        let iteration = 0;
        const maxIterations = 10; // Safety limit to prevent infinite loops
        
        while (iteration < maxIterations) {
          iteration++;
          
          let newConflictsFound = false;
          const tasksToCheck = Array.from(allTasksToMove);
          
          for (const taskId of tasksToCheck) {
            const task = scheduledTasks.find(t => t.id === taskId) || draggedTask;
            if (!task) continue;
            
            
            // Calculate where this task would be moved based on direction
            let newStartTime;
            if (direction === 'right') {
              // For right shunting, affected tasks start after the dragged task
              const draggedTaskEnd = new Date(proposedStartTime.getTime() + (draggedDurationMinutes * 60 * 1000));
              newStartTime = this.roundUpToNext15MinSlot(draggedTaskEnd);
              
              // If this isn't the dragged task, it starts after the previous task in the chain
              if (task.id !== draggedTask.id) {
                // Find the previous task in the chain and start after it
                const taskIndex = Array.from(allTasksToMove).indexOf(taskId);
                if (taskIndex > 0) {
                  const prevTaskId = Array.from(allTasksToMove)[taskIndex - 1];
                  const prevTask = scheduledTasks.find(t => t.id === prevTaskId) || draggedTask;
                  const prevTaskDuration = this.getTaskDurationMinutes(prevTask);
                  const prevTaskEnd = new Date(newStartTime.getTime() + (prevTaskDuration * 60 * 1000));
                  newStartTime = this.roundUpToNext15MinSlot(prevTaskEnd);
                }
              }
            } else {
              // For left shunting, affected tasks end before the dragged task
              const draggedTaskStart = proposedStartTime;
              const affectedTaskDuration = this.getTaskDurationMinutes(task);
              newStartTime = this.roundUpToNext15MinSlot(this.addMinutesToDate(draggedTaskStart, -affectedTaskDuration));
            }
            
            
            // Simulate scheduling this task to see what segments it would create
            const taskHours = this.getTaskDurationMinutes(task) / 60;
            
            // Get unavailable slots to understand potential splits
            const unavailableSlots = this.schedulingLogic.collectUnavailableSlots(newStartTime, new Date(newStartTime.getTime() + (taskHours * 60 * 60 * 1000)), machine.id);
            
            // Check if the task would be split
            const hasConflicts = unavailableSlots.some(slot => {
              return newStartTime < slot.end && new Date(newStartTime.getTime() + (taskHours * 60 * 60 * 1000)) > slot.start;
            });
            
            if (hasConflicts) {
              // Task would be split - check all potential segments against all tasks
              
              const taskSegments = this.schedulingLogic.splitTaskAcrossAvailableSlots(newStartTime, taskHours, machine.id, unavailableSlots);
              //   start: seg.start.toISOString(),
              //   end: seg.end.toISOString(),
              //   duration: seg.duration
              // })));
              
              // Check each segment against ALL tasks on the machine
              for (const segment of taskSegments) {
                for (const existingTask of scheduledTasks) {
                  if (!allConflictingTasks.has(existingTask.id) && existingTask.id !== task.id) {
                    const overlapResult = this.splitTaskManager.checkTaskOverlap(segment.start, segment.end, existingTask);
                    if (overlapResult.hasOverlap) {
                      
                      // Add this task to the conflicting tasks set
                      allConflictingTasks.add(existingTask.id);
                      allTasksToMove.add(existingTask.id);
                      newConflictsFound = true;
                      
                    }
                  }
                }
              }
            } else {
              // Task would not be split - check single time range
              
              const taskEnd = new Date(newStartTime.getTime() + (taskHours * 60 * 60 * 1000));
              for (const existingTask of scheduledTasks) {
                if (!allConflictingTasks.has(existingTask.id) && existingTask.id !== task.id) {
                  const overlapResult = this.splitTaskManager.checkTaskOverlap(newStartTime, taskEnd, existingTask);
                  if (overlapResult.hasOverlap) {
                    
                    // Add this task to the conflicting tasks set
                    allConflictingTasks.add(existingTask.id);
                    allTasksToMove.add(existingTask.id);
                    newConflictsFound = true;
                    
                  }
                }
              }
            }
          }
          
          // If no new conflicts found, we can proceed with shunting
          if (!newConflictsFound) {
            break;
          }
          
        }
        
        if (iteration >= maxIterations) {
          console.error(`🚨 SHUNTING ERROR: Maximum iterations (${maxIterations}) reached, possible infinite loop`);
          throw new AppError('Too many conflicts detected during shunting', ERROR_TYPES.BUSINESS_LOGIC_ERROR, 400, null, 'ConflictResolution.resolveConflictByShunting');
        }
        
        // Convert the sets back to arrays for the rest of the algorithm
        const finalAffectedTasks = scheduledTasks.filter(t => allTasksToMove.has(t.id));
        
        
        // Update the affectedTasks array for the rest of the algorithm
        affectedTasks.length = 0;
        affectedTasks.push(...finalAffectedTasks);
        
        // If no sufficient gap found, try to schedule at the earliest possible time
        if (!gapFound && affectedTasks.length === scheduledTasks.length) {
          const draggedTaskDuration = this.getTaskDurationMinutes(draggedTask);
          const totalAffectedTasks = affectedTasks.length;
          const machineName = machine.machine_name || 'Unknown Machine';
          
          console.warn(`⚠️ SHUNTING WARNING: No gap found for ${draggedTaskDuration} minutes on machine ${machineName}`);
          console.warn(`⚠️ All ${totalAffectedTasks} tasks on machine would need to be moved`);
          console.warn(`⚠️ Attempting to schedule at earliest possible time...`);
          
          // Try to schedule the dragged task at the earliest possible time (6 AM of the first task's day)
          const firstTask = scheduledTasks[0];
          const firstTaskSegments = this.splitTaskManager.getTaskOccupiedSegments(firstTask);
          if (firstTaskSegments.length > 0) {
            const earliestTaskStart = Math.min(...firstTaskSegments.map(seg => seg.start.getTime()));
            const earliestPossibleStart = new Date(earliestTaskStart);
            earliestPossibleStart.setUTCHours(6, 0, 0, 0); // Start of working day
            
            // Check if we can schedule at 6 AM of that day
            if (earliestPossibleStart.getTime() < earliestTaskStart) {
              gapFound = true; // Allow the algorithm to proceed
            } else {
              // No space even at 6 AM, return error
              console.error(`❌ SHUNTING FAILED: No space even at 6 AM on machine ${machineName}`);
              console.error(`❌ Consider: 1) Moving to different machine, 2) Reducing task duration, 3) Scheduling on different day`);
              
              throw new AppError(
                `Non c'è spazio sufficiente per spostare i lavori. Il task ${draggedTask.odp_number} (${draggedTaskDuration} minuti) richiederebbe di spostare tutti i ${totalAffectedTasks} lavori sulla macchina ${machineName}. Prova a: 1) Spostare su una macchina diversa, 2) Ridurre la durata del task, 3) Programmare in un giorno diverso.`, 
                ERROR_TYPES.BUSINESS_LOGIC_ERROR, 
                400, 
                null, 
                'ConflictResolution.resolveConflictByShunting'
              );
            }
          } else {
            // No segments found, return error
            throw new AppError(
              `Non c'è spazio sufficiente per spostare i lavori. Il task ${draggedTask.odp_number} (${draggedTaskDuration} minuti) richiederebbe di spostare tutti i ${totalAffectedTasks} lavori sulla macchina ${machineName}. Prova a: 1) Spostare su una macchina diversa, 2) Ridurre la durata del task, 3) Programmare in un giorno diverso.`, 
              ERROR_TYPES.BUSINESS_LOGIC_ERROR, 
              400, 
              null, 
              'ConflictResolution.resolveConflictByShunting'
            );
          }
        }
        
        
        // Calculate new positions for affected tasks with comprehensive splitting
        const updates = [];
        // Will hold the dragged task scheduling result if computed early
        let draggedSchedulingResult = null;
      
      if (direction === 'right') {
        // For right direction: schedule the dragged task FIRST (with splitting)
        // Then cascade affected tasks to start after the dragged task actually ends
        const proposedStart = new Date(proposedStartTime);
        const excludeForDragged = [...Array.from(allConflictingTasks)];
        
        
        draggedSchedulingResult = await this.scheduleTaskWithSplittingForShuntExcluding(
          draggedTask,
          proposedStart,
          machine,
          excludeForDragged
        );
        
        // Handle cascading conflict results
        if (draggedSchedulingResult && draggedSchedulingResult.conflict) {
          console.warn(`⚠️ CASCADING SHUNT: Dragged task ${draggedTask.odp_number} still has conflicts after cascading resolution`);
          // Return the conflict info instead of throwing an error
          return {
            error: `Impossibile programmare il task ${draggedTask.odp_number} alla posizione richiesta. Conflitti non risolvibili automaticamente.`,
            conflict: draggedSchedulingResult.conflict,
            conflictingTask: draggedSchedulingResult.conflictingTask,
            conflictingSegment: draggedSchedulingResult.conflictingSegment
          };
        }
        
        //   start: draggedSchedulingResult.startTime?.toISOString() || 'undefined',
        //   end: draggedSchedulingResult.endTime?.toISOString() || 'undefined',
        //   wasSplit: draggedSchedulingResult.wasSplit
        // });
        
        let currentStartTime = draggedSchedulingResult.endTime ? this.roundUpToNext15MinSlot(draggedSchedulingResult.endTime) : new Date();
        
        for (const task of affectedTasks) {
          // Exclude ALL conflicting tasks to avoid intra-batch conflicts
          // We place them sequentially in this loop, so they won't collide with each other
          const excludeTaskIds = [...Array.from(allConflictingTasks)];
          
          
          // Use comprehensive splitting logic for shunted tasks
          const schedulingResult = await this.scheduleTaskWithSplittingForShuntExcluding(
            task, 
            currentStartTime, 
            machine, 
            excludeTaskIds
          );
          
          if (!schedulingResult) {
            console.error(`❌ Failed to schedule task ${task.odp_number} at ${currentStartTime.toISOString()}`);
            throw new AppError(
              `Impossibile programmare il task ${task.odp_number} alla posizione richiesta. Non c'è spazio sufficiente.`, 
              ERROR_TYPES.BUSINESS_LOGIC_ERROR, 
              400, 
              null, 
              'ConflictResolution.resolveConflictByShunting'
            );
          }
          
          // Handle cascading conflict results for individual tasks
          if (schedulingResult && schedulingResult.conflict) {
            console.warn(`⚠️ CASCADING SHUNT: Task ${task.odp_number} still has conflicts after cascading resolution`);
            // For individual tasks, we'll continue but log the issue
            // The conflict will be handled by the overall shunting process
            continue;
          }
          
          //   start: schedulingResult.startTime?.toISOString() || 'undefined',
          //   end: schedulingResult.endTime?.toISOString() || 'undefined',
          //   wasSplit: schedulingResult.wasSplit
          // });
          
          updates.push({
            id: task.id,
            scheduled_start_time: schedulingResult.startTime?.toISOString(),
            scheduled_end_time: schedulingResult.endTime?.toISOString()
          });
          
          // Next task starts at the next 15-minute slot after this task ends
          if (schedulingResult.endTime) {
            currentStartTime = this.roundUpToNext15MinSlot(schedulingResult.endTime);
          }
        }
      } else {
        // LEFT direction: schedule dragged task LAST; first, cascade tasks to end before the dragged start
        const proposedStart = new Date(proposedStartTime);
        let currentEndTime = this.roundUpToNext15MinSlot(this.addMinutesToDate(proposedStart, -1));


        // Work backwards through affected tasks, placing each so it ENDS at currentEndTime
        for (let i = affectedTasks.length - 1; i >= 0; i--) {
          const task = affectedTasks[i];
          const excludeTaskIds = [...Array.from(allConflictingTasks)];
          
          
          // Use backward splitting to END at currentEndTime
          const schedulingResult = await this.schedulingLogic.scheduleTaskEndingAtWithSplitting(
            task.id,
            currentEndTime,
            this.getTaskDurationMinutes(task) / 60,
            machine.id,
            excludeTaskIds
          );
          
          if (!schedulingResult) {
            console.error(`❌ Failed to schedule task ${task.odp_number} ending at ${currentEndTime.toISOString()}`);
            throw new AppError(
              `Impossibile programmare il task ${task.odp_number} alla posizione richiesta. Non c'è spazio sufficiente.`, 
              ERROR_TYPES.BUSINESS_LOGIC_ERROR, 
              400, 
              null, 
              'ConflictResolution.resolveConflictByShunting'
            );
          }
          
          // Handle cascading conflict results for LEFT direction tasks
          if (schedulingResult && schedulingResult.conflict) {
            console.warn(`⚠️ CASCADING SHUNT: Task ${task.odp_number} still has conflicts after cascading resolution (LEFT direction)`);
            // For individual tasks, we'll continue but log the issue
            continue;
          }
          
          //   start: schedulingResult.startTime?.toISOString() || 'undefined',
          //   end: schedulingResult.endTime?.toISOString() || 'undefined',
          //   wasSplit: schedulingResult.wasSplit
          // });
          
          updates.push({
            id: task.id,
            scheduled_start_time: schedulingResult.startTime?.toISOString(),
            scheduled_end_time: schedulingResult.endTime?.toISOString()
          });
          
          // Next task (earlier) must end at the previous 15-min slot before this task starts
          if (schedulingResult.startTime) {
            currentEndTime = this.roundUpToNext15MinSlot(this.addMinutesToDate(schedulingResult.startTime, -1));
          }
        }
      }
      
      // Schedule the dragged task if not already scheduled above (e.g., LEFT direction)
      if (!draggedSchedulingResult) {
        const proposedStart = new Date(proposedStartTime);
        const excludeTaskIds = [...Array.from(allConflictingTasks)];
        
        
        draggedSchedulingResult = await this.scheduleTaskWithSplittingForShuntExcluding(
          draggedTask, 
          proposedStart, 
          machine, 
          excludeTaskIds
        );
      }
      
      if (!draggedSchedulingResult) {
        console.error(`❌ Failed to schedule dragged task ${draggedTask.odp_number} at ${proposedStart.toISOString()}`);
        throw new AppError(
          `Impossibile programmare il task ${draggedTask.odp_number} alla posizione richiesta. Non c'è spazio sufficiente.`, 
          ERROR_TYPES.BUSINESS_LOGIC_ERROR, 
          400, 
          null, 
          'ConflictResolution.resolveConflictByShunting'
        );
      }
      
      //   start: draggedSchedulingResult.startTime?.toISOString() || 'undefined',
      //   end: draggedSchedulingResult.endTime?.toISOString() || 'undefined',
      //   wasSplit: draggedSchedulingResult.wasSplit
      // });
      
      updates.push({
        id: draggedTask.id,
        scheduled_machine_id: machine.id,
        scheduled_start_time: draggedSchedulingResult.startTime?.toISOString(),
        scheduled_end_time: draggedSchedulingResult.endTime?.toISOString(),
        status: 'SCHEDULED'
      });
      
      // Execute all updates
      for (const update of updates) {
        await apiService.updateOdpOrder(update.id, update);
      }
      
      
      // Hide the conflict dialog
      useUIStore.getState().hideConflictDialog();
      useUIStore.getState().showAlert('Lavori riprogrammati con successo', 'success');
      
      return { success: true };
    } catch (error) {
      console.error(`❌ SHUNTING ERROR:`, error);
      const appError = error instanceof AppError ? error : new AppError(error.message || 'Errore durante la riprogrammazione', ERROR_TYPES.BUSINESS_LOGIC_ERROR, 400, error, 'ConflictResolution.resolveConflictByShunting');
      return { error: appError.message };
    }
  };
}
