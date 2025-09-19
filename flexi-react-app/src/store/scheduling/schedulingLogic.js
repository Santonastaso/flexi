import { format } from 'date-fns';
import { useOrderStore } from '../useOrderStore';
import { useMachineStore } from '../useMachineStore';
import { SCHEDULING } from '../../constants';
import { apiService } from '../../services/api';

/**
 * Scheduling Logic
 * Handles task scheduling, splitting, and unavailable slot management
 */
export class SchedulingLogic {
  constructor(get, set, splitTaskManager, machineAvailabilityManager) {
    this.get = get;
    this.set = set;
    this.splitTaskManager = splitTaskManager;
    this.machineAvailabilityManager = machineAvailabilityManager;
  }

  // Absolute date creation - pure UTC, no timezone conversion at all
  createAbsoluteDate = (year, month, day, hour = 0, minute = 0) => {
    // Create pure UTC date - hour 15 means hour 15 UTC, period
    return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  };

  // Helper function to split tasks across available time slots
  splitTaskAcrossAvailableSlots = (startTime, durationHours, machineId, unavailableSlots) => {
    try {
      const segments = [];
      let currentStart = new Date(startTime);
      let remainingDuration = durationHours;
      

      
      // First, check if we're starting inside an unavailable slot and move past it
      // Keep checking until we find an available position (in case of consecutive unavailable slots)
      let initialMoved = true;
      while (initialMoved) {
        initialMoved = false;
        for (const slot of unavailableSlots) {
          if (currentStart >= slot.start && currentStart < slot.end) {
            currentStart = new Date(slot.end);
            initialMoved = true;
            break; // Start checking from the beginning again
          }
        }
      }
      
      while (remainingDuration > 0) {
        // Find the next unavailable slot that would conflict with current position
        let nextConflict = null;
        let conflictStart = null;
        let conflictEnd = null;
        
        for (const slot of unavailableSlots) {
          const slotStart = new Date(slot.start);
          const slotEnd = new Date(slot.end);
          
          // Check if this unavailable slot conflicts with our current segment
          if (slotStart >= currentStart) {
            if (!nextConflict || slotStart < conflictStart) {
              nextConflict = slot;
              conflictStart = slotStart;
              conflictEnd = slotEnd;
            }
          }
        }
        
        if (nextConflict) {
          // Calculate how much time we can use before hitting the unavailable slot
          const timeUntilConflict = (conflictStart.getTime() - currentStart.getTime()) / (1000 * 60 * 60);
          
          if (timeUntilConflict > 0) {
            // Create a segment for the available time before the conflict
            const segmentDuration = Math.min(timeUntilConflict, remainingDuration);
            const segmentEnd = new Date(currentStart.getTime() + (segmentDuration * 60 * 60 * 1000));
            
            segments.push({
              start: new Date(currentStart),
              end: segmentEnd,
              duration: segmentDuration
            });
            
            remainingDuration -= segmentDuration;
          }
          
          // Move past the unavailable slot
          currentStart = new Date(conflictEnd);
          
          // After moving past the conflict, check if we're now inside another unavailable slot
          // and keep moving until we find an available position
          let movedAgain = true;
          while (movedAgain) {
            movedAgain = false;
            for (const slot of unavailableSlots) {
              if (currentStart >= slot.start && currentStart < slot.end) {
                currentStart = new Date(slot.end);
                movedAgain = true;
                break; // Start checking from the beginning again
              }
            }
          }
        } else {
          // No more conflicts, schedule the remaining duration
          const segmentEnd = new Date(currentStart.getTime() + (remainingDuration * 60 * 60 * 1000));
          segments.push({
            start: new Date(currentStart),
            end: segmentEnd,
            duration: remainingDuration
          });
          
  
          remainingDuration = 0;
        }
        
        // Safety check to prevent infinite loops
        if (segments.length > SCHEDULING.MAX_TASK_SEGMENTS) {
          console.warn('Task splitting exceeded maximum segments limit');
          break;
        }
      }
      

      
      return segments;
    } catch (error) {
      console.error('Error in splitTaskAcrossAvailableSlots:', error);
      return [];
    }
  };

  // Helper function to split tasks backwards so that they END at a given time
  splitTaskAcrossAvailableSlotsBackward = (endTime, durationHours, machineId, unavailableSlots) => {
    try {
      const segmentsReversed = [];
      let currentEnd = new Date(endTime);
      let remainingDuration = durationHours;

      // If we end inside an unavailable slot, move the end to the start of that slot
      let adjusted = true;
      while (adjusted) {
        adjusted = false;
        for (const slot of unavailableSlots) {
          if (currentEnd > slot.start && currentEnd <= slot.end) {
            currentEnd = new Date(slot.start);
            adjusted = true;
            break;
          }
        }
      }

      while (remainingDuration > 0) {
        // Find the nearest unavailable slot BEFORE currentEnd
        let prevConflict = null;
        let conflictStart = null;
        let conflictEnd = null;

        for (const slot of unavailableSlots) {
          const slotStart = new Date(slot.start);
          const slotEnd = new Date(slot.end);
          // Consider slots that end before or at currentEnd and overlap the window before it
          if (slotEnd <= currentEnd) {
            if (!prevConflict || slotEnd > conflictEnd) {
              prevConflict = slot;
              conflictStart = slotStart;
              conflictEnd = slotEnd;
            }
          }
        }

        let availableWindowStart;
        if (prevConflict) {
          // Available window is between prevConflict.end and currentEnd
          availableWindowStart = new Date(conflictEnd);
        } else {
          // No prior conflicts → window extends arbitrarily far; we'll cap by remainingDuration
          availableWindowStart = new Date(currentEnd.getTime() - (remainingDuration * 60 * 60 * 1000));
        }

        // If availableWindowStart lies inside an unavailable slot, move it forward to slot.end
        let moved = true;
        while (moved) {
          moved = false;
          for (const slot of unavailableSlots) {
            if (availableWindowStart < slot.end && availableWindowStart >= slot.start) {
              availableWindowStart = new Date(slot.end);
              moved = true;
              break;
            }
          }
        }

        const windowHours = (currentEnd.getTime() - availableWindowStart.getTime()) / (1000 * 60 * 60);
        if (windowHours <= 0) {
          // Nothing available here; move end further back
          currentEnd = prevConflict ? new Date(conflictStart) : new Date(currentEnd.getTime() - 60 * 60 * 1000);
          continue;
        }

        const segmentDuration = Math.min(windowHours, remainingDuration);
        const segmentStart = new Date(currentEnd.getTime() - (segmentDuration * 60 * 60 * 1000));
        segmentsReversed.push({ start: segmentStart, end: new Date(currentEnd), duration: segmentDuration });

        remainingDuration -= segmentDuration;
        currentEnd = new Date(segmentStart);
      }

      // Reverse to chronological order
      const segments = segmentsReversed.reverse();
      return segments;
    } catch (error) {
      console.error('Error in splitTaskAcrossAvailableSlotsBackward:', error);
      return [];
    }
  };

  // Helper function to collect all unavailable slots for a task's time range
  collectUnavailableSlots = (startTime, endTime, machineId) => {
    const unavailableSlots = [];
    // Use UTC methods consistently - no timezone conversion
    const taskStartDate = this.createAbsoluteDate(startTime.getUTCFullYear(), startTime.getUTCMonth() + 1, startTime.getUTCDate());
    const taskEndDate = this.createAbsoluteDate(endTime.getUTCFullYear(), endTime.getUTCMonth() + 1, endTime.getUTCDate());
    
    // Calculate a much wider range to account for task splitting across multiple days
    // Add 7 days buffer to ensure we capture all potential unavailable slots
    const extendedEndDate = new Date(taskEndDate);
    extendedEndDate.setUTCDate(extendedEndDate.getUTCDate() + 7);
    
    // Generate all dates between start and extended end (inclusive)
    let currentDate = new Date(taskStartDate);
    while (currentDate <= extendedEndDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dateAvailability = this.get().machineAvailability[dateStr];
      
      if (dateAvailability && Array.isArray(dateAvailability)) {
        const machineAvailability = dateAvailability.find(ma => ma.machine_id === machineId);
        
        if (machineAvailability && machineAvailability.unavailable_hours && Array.isArray(machineAvailability.unavailable_hours)) {
          // Parse the dateStr (YYYY-MM-DD format) and create simple dates
          const [year, month, day] = dateStr.split('-').map(Number);
          
          for (const hour of machineAvailability.unavailable_hours) {
            // Create absolute UTC date - hour as exact UTC value
            const hourStart = this.createAbsoluteDate(year, month, day, parseInt(hour), 0);
            const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
            
            unavailableSlots.push({
              start: hourStart,
              end: hourEnd,
              hour: parseInt(hour),
              date: dateStr
            });
          }
        }
      }
      
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    return unavailableSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
  };

  // Load machine availability for extended date range
  loadMachineAvailabilityForExtendedRange = async (startTime, durationHours, _machineId) => {
    const taskStartDate = this.createAbsoluteDate(startTime.getUTCFullYear(), startTime.getUTCMonth() + 1, startTime.getUTCDate());
    const potentialEndTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000));
    const taskEndDate = this.createAbsoluteDate(potentialEndTime.getUTCFullYear(), potentialEndTime.getUTCMonth() + 1, potentialEndTime.getUTCDate());
    
    // Add 7 days buffer to ensure we capture all potential unavailable slots
    const taskEndDateWithBuffer = new Date(taskEndDate);
    taskEndDateWithBuffer.setUTCDate(taskEndDateWithBuffer.getUTCDate() + 7);
    
    let currentDate = new Date(taskStartDate);
    while (currentDate <= taskEndDateWithBuffer) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      await this.machineAvailabilityManager.loadMachineAvailabilityForDate(dateStr);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    return taskEndDateWithBuffer;
  };

  // Load machine availability for a backward scheduling window ending at endTime
  loadMachineAvailabilityForBackwardRange = async (endTime, durationHours, _machineId) => {
    const taskEndDate = this.createAbsoluteDate(endTime.getUTCFullYear(), endTime.getUTCMonth() + 1, endTime.getUTCDate());
    const earliestStart = new Date(endTime.getTime() - (durationHours * 60 * 60 * 1000));
    const taskStartDate = this.createAbsoluteDate(earliestStart.getUTCFullYear(), earliestStart.getUTCMonth() + 1, earliestStart.getUTCDate());
    // Add 7 days buffer backwards
    const taskStartDateWithBuffer = new Date(taskStartDate);
    taskStartDateWithBuffer.setUTCDate(taskStartDateWithBuffer.getUTCDate() - 7);

    let currentDate = new Date(taskStartDateWithBuffer);
    while (currentDate <= taskEndDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      await this.machineAvailabilityManager.loadMachineAvailabilityForDate(dateStr);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return { taskStartDateWithBuffer, taskEndDate };
  };

  // BULLETPROOF: Check if segments would overlap with existing tasks
  checkSegmentsForOverlaps = (segments, machineId, excludeTaskId, additionalExcludeIds = []) => {
    const _allExcludeIds = [excludeTaskId, ...additionalExcludeIds].filter(id => id);
    
    
    for (const segment of segments) {
      
      const overlapResult = this.splitTaskManager.checkMachineOverlaps(
        segment.start, 
        segment.end, 
        machineId, 
        excludeTaskId,
        additionalExcludeIds
      );
      
      if (overlapResult.hasOverlap) {
        
        return {
          hasOverlap: true,
          conflictingSegment: segment,
          conflictingTask: overlapResult.conflictingTask,
          conflictingExistingSegment: overlapResult.conflictingSegment
        };
      }
    }
    
    return { hasOverlap: false };
  };

  // Schedule task with comprehensive splitting logic
  scheduleTaskWithSplitting = async (taskId, startTime, durationHours, machineId, additionalExcludeIds = []) => {
    // Load machine availability for extended range
    const extendedEndTime = await this.loadMachineAvailabilityForExtendedRange(startTime, durationHours, machineId);
    
    // Collect unavailable slots
    const unavailableSlots = this.collectUnavailableSlots(startTime, extendedEndTime, machineId);
    
    // Check if there are any unavailable slots that would conflict
    const taskEnd = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000));
    const hasConflicts = unavailableSlots.some(slot => {
      return startTime < slot.end && taskEnd > slot.start;
    });
    
    if (hasConflicts) {
      const taskSegments = this.splitTaskAcrossAvailableSlots(startTime, durationHours, machineId, unavailableSlots);
      
      if (taskSegments.length > 0) {
        // BULLETPROOF: Check if the split segments would overlap with existing tasks
        const segmentOverlapResult = this.checkSegmentsForOverlaps(taskSegments, machineId, taskId, additionalExcludeIds);
        
        if (segmentOverlapResult.hasOverlap) {
          // Return conflict info to trigger shunting
          return {
            conflict: true,
            conflictingTask: segmentOverlapResult.conflictingTask,
            conflictingSegment: segmentOverlapResult.conflictingExistingSegment,
            proposedSegments: taskSegments
          };
        }
        
        const firstSegment = taskSegments[0];
        const lastSegment = taskSegments[taskSegments.length - 1];
        
        // Safety check: ensure segments have valid start and end times
        if (!firstSegment?.start || !lastSegment?.end) {
          console.error('Invalid segments returned from splitTaskAcrossAvailableSlots:', taskSegments);
          return null;
        }
        
        // Create segment info and update task description
        const segmentInfo = this.splitTaskManager.createSegmentInfo(taskSegments, durationHours);
        await this.splitTaskManager.updateTaskWithSplitInfo(taskId, segmentInfo, firstSegment.start, lastSegment.end, machineId);
        
        return {
          startTime: firstSegment.start,
          endTime: lastSegment.end,
          wasSplit: true,
          segments: taskSegments,
          originalDuration: durationHours
        };
      }
    } else {
      // Create single segment info for non-split tasks
      const singleSegment = [{
        start: startTime,
        end: taskEnd,
        duration: durationHours
      }];
      
      // BULLETPROOF: Even for non-split tasks, check for overlaps
      const segmentOverlapResult = this.checkSegmentsForOverlaps(singleSegment, machineId, taskId, additionalExcludeIds);
      
      if (segmentOverlapResult.hasOverlap) {
        // Return conflict info to trigger shunting
        return {
          conflict: true,
          conflictingTask: segmentOverlapResult.conflictingTask,
          conflictingSegment: segmentOverlapResult.conflictingExistingSegment,
          proposedSegments: singleSegment
        };
      }
      
      // Create segment info and update task description for non-split tasks too
      const segmentInfo = this.splitTaskManager.createSegmentInfo(singleSegment, durationHours);
      await this.splitTaskManager.updateTaskWithSplitInfo(taskId, segmentInfo, startTime, taskEnd, machineId);
      
      return {
        startTime: startTime,
        endTime: taskEnd,
        wasSplit: false,
        segments: singleSegment,
        originalDuration: durationHours
      };
    }
    
    return null; // No available slots found
  };

  // Schedule task so that it ENDS at endTime, using backward splitting
  scheduleTaskEndingAtWithSplitting = async (taskId, endTime, durationHours, machineId, additionalExcludeIds = []) => {
    // Load machine availability for backward range
    const { taskStartDateWithBuffer, taskEndDate } = await this.loadMachineAvailabilityForBackwardRange(endTime, durationHours, machineId);
    // Collect unavailable slots across the backward window
    const unavailableSlots = this.collectUnavailableSlots(taskStartDateWithBuffer, taskEndDate, machineId);

    // Create segments backwards ending at endTime
    const taskSegments = this.splitTaskAcrossAvailableSlotsBackward(endTime, durationHours, machineId, unavailableSlots);

    if (taskSegments.length === 0) {
      return null;
    }

    // Check for overlaps using the actual segments
    const segmentOverlapResult = this.checkSegmentsForOverlaps(taskSegments, machineId, taskId, additionalExcludeIds);
    if (segmentOverlapResult.hasOverlap) {
      return {
        conflict: true,
        conflictingTask: segmentOverlapResult.conflictingTask,
        conflictingSegment: segmentOverlapResult.conflictingExistingSegment,
        proposedSegments: taskSegments
      };
    }

    const segmentInfo = this.splitTaskManager.createSegmentInfo(taskSegments, durationHours);
    
    // Update task description with segment info
    const firstSegment = taskSegments[0];
    const lastSegment = taskSegments[taskSegments.length - 1];
    
    // Safety check: ensure segments have valid start and end times
    if (!firstSegment?.start || !lastSegment?.end) {
      console.error('Invalid segments returned from splitTaskAcrossAvailableSlotsBackward:', taskSegments);
      return null;
    }
    
    await this.splitTaskManager.updateTaskWithSplitInfo(taskId, segmentInfo, firstSegment.start, lastSegment.end, machineId);
    return {
      startTime: firstSegment.start,
      endTime: lastSegment.end,
      wasSplit: taskSegments.length > 1,
      segments: taskSegments,
      originalDuration: durationHours
    };
  };

  // Handle task duration shrinking with cascading rescheduling
  handleTaskDurationShrinking = async (taskId, newDuration, machineId, additionalFields = {}) => {
    try {
      console.log('🔄 DURATION SHRINKING: Starting cascading rescheduling for task', taskId);
      console.log('📊 DURATION SHRINKING: New duration:', newDuration, 'hours');
      
      // Get the task and machine data
      const { getOrderById, getOdpOrders } = useOrderStore.getState();
      const { getMachineById } = useMachineStore.getState();
      
      const task = getOrderById(taskId);
      const machine = getMachineById(machineId);
      const allTasks = getOdpOrders();
      
      if (!task || !machine) {
        return { success: false, error: 'Task or machine not found' };
      }
      
      if (!task.scheduled_start_time || !task.scheduled_end_time) {
        return { success: false, error: 'Task is not scheduled' };
      }
      
      // Calculate the ORIGINAL end time using pre-shrinking duration
      const originalStartTime = new Date(task.scheduled_start_time);
      const originalDuration = task.duration; // Pre-shrinking duration
      const originalEndTime = new Date(originalStartTime.getTime() + (originalDuration * 60 * 60 * 1000));
      
      console.log('📅 DURATION SHRINKING: Original end time (pre-shrinking):', originalEndTime.toISOString());
      console.log('📅 DURATION SHRINKING: Original duration:', originalDuration, 'New duration:', newDuration);
      
      // Find the cascading chain of tasks that need to be rescheduled
      const chainTasks = this.findCascadingChain(taskId, originalEndTime, machineId, allTasks);
      
      console.log('🔄 DURATION SHRINKING: Found cascading chain of', chainTasks.length, 'tasks to reschedule');
      console.log('📋 DURATION SHRINKING: Chain tasks:', chainTasks.map(t => t.odp_number));
      
      // Calculate time_remaining from new duration and progress (like expansion flow)
      const progress = (task.quantity_completed / task.quantity) || 0;
      const newTimeRemaining = newDuration * (1 - progress);
      
      console.log('📊 DURATION SHRINKING: Calculated time_remaining:', newTimeRemaining, 'from new duration:', newDuration, 'and progress:', progress);
      console.log('📊 DURATION SHRINKING: Progress calculation:', task.quantity_completed, '/', task.quantity, '=', progress);
      
      // Now reschedule the original task using the new time_remaining
      console.log('🔄 DURATION SHRINKING: Rescheduling original task with new time_remaining');
      const originalTaskSchedulingResult = await this.scheduleTaskWithSplitting(
        taskId,
        originalStartTime,
        newTimeRemaining,
        machineId,
        [] // No exclusions for the original task
      );
      
      if (!originalTaskSchedulingResult) {
        console.error('❌ DURATION SHRINKING: Failed to reschedule original task');
        return { 
          success: false, 
          error: 'Failed to reschedule original task. Not enough space available.',
          rescheduledTasks: []
        };
      }
      
      if (originalTaskSchedulingResult.conflict) {
        console.error('❌ DURATION SHRINKING: Conflict detected while rescheduling original task');
        return { 
          success: false, 
          error: 'Conflict detected while rescheduling original task. Consider using conflict resolution.',
          rescheduledTasks: []
        };
      }
      
      // Update the original task with the new scheduling information and additional fields
      // First update with scheduling info and description (segment info)
      await this.splitTaskManager.updateTaskWithSplitInfo(
        taskId, 
        originalTaskSchedulingResult.segments ? {
          segments: originalTaskSchedulingResult.segments,
          totalSegments: originalTaskSchedulingResult.segments.length,
          originalDuration: originalTaskSchedulingResult.originalDuration || newTimeRemaining,
          wasSplit: originalTaskSchedulingResult.wasSplit || false
        } : null,
        originalTaskSchedulingResult.startTime,
        originalTaskSchedulingResult.endTime,
        machineId
      );
      
      // Then update with additional fields like duration, time_remaining, cost, etc.
      const finalUpdateData = {
        duration: newDuration,
        time_remaining: newTimeRemaining,
        ...additionalFields // Include any additional fields like cost, etc.
      };
      
      console.log('💾 DURATION SHRINKING: Final update data:', finalUpdateData);
      await apiService.updateOdpOrder(taskId, finalUpdateData);
      
      const rescheduledTasks = [{
        id: taskId,
        odp_number: task.odp_number,
        new_start_time: originalTaskSchedulingResult.startTime.toISOString(),
        new_end_time: originalTaskSchedulingResult.endTime.toISOString(),
        was_split: originalTaskSchedulingResult.wasSplit
      }];
      
      // Now reschedule the chain tasks sequentially, starting after the rescheduled original task
      let currentStartTime = new Date(originalTaskSchedulingResult.endTime);
      
      // Round up to the next 15-minute slot
      const minutes = currentStartTime.getUTCMinutes();
      const nextSlot = Math.ceil(minutes / 15) * 15;
      if (nextSlot === 60) {
        currentStartTime.setUTCHours(currentStartTime.getUTCHours() + 1, 0, 0, 0);
      } else {
        currentStartTime.setUTCMinutes(nextSlot, 0, 0);
      }
      
      for (const chainTask of chainTasks) {
        console.log('🔄 DURATION SHRINKING: Rescheduling task', chainTask.odp_number, 'to start at', currentStartTime.toISOString());
        
        // Use the existing scheduling logic with splitting
        const schedulingResult = await this.scheduleTaskWithSplitting(
          chainTask.id,
          currentStartTime,
          chainTask.time_remaining || chainTask.duration || 1,
          machineId,
          [taskId] // Exclude the original task from overlap detection
        );
        
        if (!schedulingResult) {
          console.error('❌ DURATION SHRINKING: Failed to reschedule task', chainTask.odp_number);
          return { 
            success: false, 
            error: `Failed to reschedule task ${chainTask.odp_number}. Not enough space available.`,
            rescheduledTasks: rescheduledTasks
          };
        }
        
        if (schedulingResult.conflict) {
          console.error('❌ DURATION SHRINKING: Conflict detected while rescheduling task', chainTask.odp_number);
          return { 
            success: false, 
            error: `Conflict detected while rescheduling task ${chainTask.odp_number}. Consider using conflict resolution.`,
            rescheduledTasks: rescheduledTasks
          };
        }
        
        // Update the task with the new scheduling information and description (segment info)
        await this.splitTaskManager.updateTaskWithSplitInfo(
          chainTask.id,
          schedulingResult.segments ? {
            segments: schedulingResult.segments,
            totalSegments: schedulingResult.segments.length,
            originalDuration: schedulingResult.originalDuration || (chainTask.time_remaining || chainTask.duration || 1),
            wasSplit: schedulingResult.wasSplit || false
          } : null,
          schedulingResult.startTime,
          schedulingResult.endTime,
          machineId
        );
        
        rescheduledTasks.push({
          id: chainTask.id,
          odp_number: chainTask.odp_number,
          new_start_time: schedulingResult.startTime.toISOString(),
          new_end_time: schedulingResult.endTime.toISOString(),
          was_split: schedulingResult.wasSplit
        });
        
        // Move to the next available slot after this task
        currentStartTime = new Date(schedulingResult.endTime);
        const nextMinutes = currentStartTime.getUTCMinutes();
        const nextSlot = Math.ceil(nextMinutes / 15) * 15;
        if (nextSlot === 60) {
          currentStartTime.setUTCHours(currentStartTime.getUTCHours() + 1, 0, 0, 0);
        } else {
          currentStartTime.setUTCMinutes(nextSlot, 0, 0);
        }
      }
      
      console.log('✅ DURATION SHRINKING: Successfully rescheduled', rescheduledTasks.length, 'tasks');
      
      // Get the final updated task with description field
      const finalUpdatedTask = getOrderById(taskId);
      
      return { 
        success: true, 
        message: `Successfully rescheduled ${rescheduledTasks.length} tasks due to duration reduction`,
        rescheduledTasks: rescheduledTasks,
        updatedTask: finalUpdatedTask // Include the updated task with description field
      };
      
    } catch (error) {
      console.error('❌ DURATION SHRINKING ERROR:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error during duration shrinking',
        rescheduledTasks: []
      };
    }
  };

  // Find the cascading chain of tasks that need to be rescheduled
  findCascadingChain = (originalTaskId, originalEndTime, machineId, allTasks) => {
    const chain = [];
    const visited = new Set();
    
    // Find all tasks on the same machine that are scheduled after the original task
    const tasksOnMachine = allTasks.filter(t => 
      t.scheduled_machine_id === machineId && 
      t.status === 'SCHEDULED' &&
      t.id !== originalTaskId &&
      t.scheduled_start_time
    ).sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time));
    
    // Start with tasks that begin within 15 minutes of the original end time
    const initialCandidates = tasksOnMachine.filter(t => {
      const taskStart = new Date(t.scheduled_start_time);
      const timeDiffMinutes = (taskStart.getTime() - originalEndTime.getTime()) / (1000 * 60);
      return timeDiffMinutes >= 0 && timeDiffMinutes <= 15; // Within 15 minutes
    });
    
    console.log('🔍 DURATION SHRINKING: Initial candidates within 15 minutes:', initialCandidates.map(t => t.odp_number));
    
    // Build the chain by following the 15-minute rule
    const buildChain = (currentEndTime) => {
      for (const task of tasksOnMachine) {
        if (visited.has(task.id)) continue;
        
        const taskStart = new Date(task.scheduled_start_time);
        const timeDiffMinutes = (taskStart.getTime() - currentEndTime.getTime()) / (1000 * 60);
        
        // If this task starts within 15 minutes of the current end time
        if (timeDiffMinutes >= 0 && timeDiffMinutes <= 15) {
          visited.add(task.id);
          chain.push(task);
          
          // Calculate this task's end time and continue the chain
          const taskDuration = task.time_remaining || task.duration || 1;
          const taskEndTime = new Date(taskStart.getTime() + (taskDuration * 60 * 60 * 1000));
          
          console.log('🔗 DURATION SHRINKING: Added to chain:', task.odp_number, 'ends at', taskEndTime.toISOString());
          
          // Recursively find tasks that start within 15 minutes of this task's end
          buildChain(taskEndTime);
        }
      }
    };
    
    // Start building the chain from the original end time
    buildChain(originalEndTime);
    
    console.log('📋 DURATION SHRINKING: Complete chain found:', chain.map(t => t.odp_number));
    
    return chain;
  };
}
