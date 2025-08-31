import { toDateString } from '../../utils/dateUtils';

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

  // Absolute date creation - no timezone conversion at all
  createAbsoluteDate = (year, month, day, hour = 0, minute = 0) => {
    // Use UTC methods to create dates that represent the EXACT time values
    // This way hour 15 means hour 15, not hour 15 in your local timezone
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
        if (segments.length > 50) {
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
    // Use UTC methods to get absolute dates without timezone conversion
    const taskStartDate = this.createAbsoluteDate(startTime.getUTCFullYear(), startTime.getUTCMonth() + 1, startTime.getUTCDate());
    const taskEndDate = this.createAbsoluteDate(endTime.getUTCFullYear(), endTime.getUTCMonth() + 1, endTime.getUTCDate());
    
    // Calculate a much wider range to account for task splitting across multiple days
    // Add 7 days buffer to ensure we capture all potential unavailable slots
    const extendedEndDate = new Date(taskEndDate);
    extendedEndDate.setUTCDate(extendedEndDate.getUTCDate() + 7);
    
    // Generate all dates between start and extended end (inclusive)
    let currentDate = new Date(taskStartDate);
    while (currentDate <= extendedEndDate) {
      const dateStr = toDateString(currentDate);
      const dateAvailability = this.get().machineAvailability[dateStr];
      
      if (dateAvailability && Array.isArray(dateAvailability)) {
        const machineAvailability = dateAvailability.find(ma => ma.machine_id === machineId);
        
        if (machineAvailability && machineAvailability.unavailable_hours && Array.isArray(machineAvailability.unavailable_hours)) {
          // Parse the dateStr (YYYY-MM-DD format) and create simple dates
          const [year, month, day] = dateStr.split('-').map(Number);
          
          for (const hour of machineAvailability.unavailable_hours) {
            // Create absolute date - hour as exact value
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
      const dateStr = toDateString(currentDate);
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
      const dateStr = toDateString(currentDate);
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
        
        // Create segment info
        const segmentInfo = this.splitTaskManager.createSegmentInfo(taskSegments, durationHours);
        
        // Update task with split info
        await this.splitTaskManager.updateTaskWithSplitInfo(taskId, segmentInfo);
        
        return {
          startTime: firstSegment.start,
          endTime: lastSegment.end,
          wasSplit: true,
          segments: taskSegments
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
      
      const segmentInfo = this.splitTaskManager.createSegmentInfo(singleSegment, durationHours);
      await this.splitTaskManager.updateTaskWithSplitInfo(taskId, segmentInfo);
      
      return {
        startTime: startTime,
        endTime: taskEnd,
        wasSplit: false,
        segments: singleSegment
      };
    }
    
    return null;
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
    await this.splitTaskManager.updateTaskWithSplitInfo(taskId, segmentInfo);

    const firstSegment = taskSegments[0];
    const lastSegment = taskSegments[taskSegments.length - 1];
    return {
      startTime: firstSegment.start,
      endTime: lastSegment.end,
      wasSplit: taskSegments.length > 1,
      segments: taskSegments
    };
  };
}
