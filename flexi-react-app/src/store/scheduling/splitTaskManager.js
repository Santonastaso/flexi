import { useOrderStore } from '../useOrderStore';

/**
 * Split Task Manager
 * Handles all split task information storage, retrieval, and synchronization
 */
export class SplitTaskManager {
  constructor(get, set) {
    this.get = get;
    this.set = set;
  }

  // Set split task info in memory
  setSplitTaskInfo = (taskId, segmentInfo) => {
    this.set(state => ({
      splitTasksInfo: { ...state.splitTasksInfo, [taskId]: segmentInfo }
    }));
  };

  // Get split task info from memory with fallback to database
  getSplitTaskInfo = (taskId) => {
    // First try to get from memory
    const memoryInfo = this.get().splitTasksInfo[taskId];
    if (memoryInfo && memoryInfo.segments) {
      return memoryInfo;
    }
    
    // Fallback: try to get from database via order store
    const { getOdpOrderById } = useOrderStore.getState();
    const task = getOdpOrderById(taskId);
    
    if (task && task.description && task.status === 'SCHEDULED') {
      try {
        const segmentInfo = JSON.parse(task.description);
        if (segmentInfo.segments && Array.isArray(segmentInfo.segments)) {
          // Store in memory for future access
          this.setSplitTaskInfo(taskId, segmentInfo);
          return segmentInfo;
        }
      } catch (_error) {
        console.warn(`Failed to parse segment info for task ${taskId}:`, _error);
      }
    }
    
    return null;
  };

  // Clear split task info from memory
  clearSplitTaskInfo = (taskId) => {
    this.set(state => {
      const newSplitTasksInfo = { ...state.splitTasksInfo };
      delete newSplitTasksInfo[taskId];
      return { splitTasksInfo: newSplitTasksInfo };
    });
  };

  // Update task with segment info and sync with database (ALL TASKS NOW HAVE SEGMENTS)
  updateTaskWithSplitInfo = async (taskId, segmentInfo, startTime = null, endTime = null, machineId = null) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`💾 DATABASE UPDATE: Starting updateTaskWithSplitInfo for task ${taskId}`);
      console.log(`💾 DATABASE UPDATE: Segment info:`, segmentInfo);
      console.log(`💾 DATABASE UPDATE: Start time: ${startTime?.toISOString()}`);
      console.log(`💾 DATABASE UPDATE: End time: ${endTime?.toISOString()}`);
      console.log(`💾 DATABASE UPDATE: Machine ID: ${machineId}`);
    }
    
    const { updateOdpOrder } = useOrderStore.getState();
    
    if (segmentInfo) {
      // Store segment info in memory and database (for both split and non-split tasks)
      this.setSplitTaskInfo(taskId, segmentInfo);
      const segmentInfoJson = JSON.stringify(segmentInfo);
      
      // Prepare update object - ensure all scheduling fields are updated together to satisfy constraint
      const updateData = { 
        description: segmentInfoJson,
        status: 'SCHEDULED'
      };
      
      if (startTime) updateData.scheduled_start_time = startTime.toISOString();
      if (endTime) updateData.scheduled_end_time = endTime.toISOString();
      if (machineId) updateData.scheduled_machine_id = machineId;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 DATABASE UPDATE: Initial update data:`, updateData);
      }
      
      // Ensure we have all required scheduling fields or none of them
      if (updateData.scheduled_start_time && updateData.scheduled_end_time && updateData.scheduled_machine_id) {
        // All scheduling fields are present - this is valid
        if (process.env.NODE_ENV === 'development') {
          console.log(`💾 DATABASE UPDATE: ✅ All scheduling fields present - valid state`);
        }
      } else if (!updateData.scheduled_start_time && !updateData.scheduled_end_time && !updateData.scheduled_machine_id) {
        // No scheduling fields are present - this is also valid
        if (process.env.NODE_ENV === 'development') {
          console.log(`💾 DATABASE UPDATE: ✅ No scheduling fields present - valid state`);
        }
        delete updateData.scheduled_start_time;
        delete updateData.scheduled_end_time;
        delete updateData.scheduled_machine_id;
        updateData.status = 'NOT SCHEDULED';
      } else {
        // Partial scheduling fields - this violates the constraint, so we need to get the current task state
        if (process.env.NODE_ENV === 'development') {
          console.log(`💾 DATABASE UPDATE: ⚠️ Partial scheduling fields - need to get current task state`);
        }
        const { getOdpOrderById } = useOrderStore.getState();
        const currentTask = getOdpOrderById(taskId);
        
        if (currentTask) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`💾 DATABASE UPDATE: Current task state:`, {
              scheduled_start_time: currentTask.scheduled_start_time,
              scheduled_end_time: currentTask.scheduled_end_time,
              scheduled_machine_id: currentTask.scheduled_machine_id
            });
          }
          // Use existing values for missing fields to maintain constraint
          if (!updateData.scheduled_start_time) updateData.scheduled_start_time = currentTask.scheduled_start_time;
          if (!updateData.scheduled_end_time) updateData.scheduled_end_time = currentTask.scheduled_end_time;
          if (!updateData.scheduled_machine_id) updateData.scheduled_machine_id = currentTask.scheduled_machine_id;
        }
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 DATABASE UPDATE: Final update data:`, updateData);
        console.log(`💾 DATABASE UPDATE: Calling updateOdpOrder with data:`, updateData);
      }
      const updatedTask = await updateOdpOrder(taskId, updateData);
      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 DATABASE UPDATE: ✅ Successfully updated task ${taskId}`);
      }
      this.updateSplitTaskInfo(taskId, updatedTask);
    } else {
      // This should rarely happen now, but keep for safety
      this.clearSplitTaskInfo(taskId);
      const updatedTask = await updateOdpOrder(taskId, { description: '' });
      this.updateSplitTaskInfo(taskId, updatedTask);
    }
  };

  // Update segment info when a task is updated (from real-time updates)
  updateSplitTaskInfo = (taskId, order) => {
    // Always clear memory cache first to ensure consistency
    this.clearSplitTaskInfo(taskId);
    
    if (order.description && order.status === 'SCHEDULED') {
      try {
        const segmentInfo = JSON.parse(order.description);
        if (segmentInfo.segments && Array.isArray(segmentInfo.segments)) {
          // Validate segments before storing
          const validation = this.validateSegments(segmentInfo.segments.map(seg => ({
            start: new Date(seg.start),
            end: new Date(seg.end),
            duration: seg.duration
          })));
          
          if (validation.isValid) {
            // All scheduled tasks should have segment info now
            this.setSplitTaskInfo(taskId, segmentInfo);
          } else {
            console.warn(`⚠️ Invalid segments for task ${taskId}:`, validation.error);
            this.clearSplitTaskInfo(taskId);
          }
        } else {
          this.clearSplitTaskInfo(taskId);
        }
      } catch (_error) {
        // If parsing fails, it's not segment info, clear it
        console.warn(`⚠️ Failed to parse segment info for task ${taskId}:`, _error);
        this.clearSplitTaskInfo(taskId);
      }
    } else {
      this.clearSplitTaskInfo(taskId);
    }
  };

  // Restore split task info from database on app initialization
  restoreSplitTaskInfo = () => {
    const { getOdpOrders } = useOrderStore.getState();
    const orders = getOdpOrders();
    
    const splitTasksInfo = {};
    let loadedCount = 0;
    
    orders.forEach(order => {
      if (order.description && order.status === 'SCHEDULED') {
        try {
          const segmentInfo = JSON.parse(order.description);
          if (segmentInfo.segments && Array.isArray(segmentInfo.segments)) {
            // All scheduled tasks should have segment info now
            splitTasksInfo[order.id] = segmentInfo;
            loadedCount++;
          }
        } catch (_error) {
          // If parsing fails, it's not segment info, ignore
          console.warn(`Failed to parse segment info for task ${order.odp_number}:`, _error);
        }
      }
    });
    
    this.set({ splitTasksInfo });
    console.log(`✅ Restored split task info for ${loadedCount} tasks`);
  };

  // Validate segments for data integrity
  validateSegments = (segments) => {
    if (!Array.isArray(segments) || segments.length === 0) {
      return { isValid: false, error: 'Segments must be a non-empty array' };
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Check required properties
      if (!segment.start || !segment.end || segment.duration === undefined) {
        return { isValid: false, error: `Segment ${i} missing required properties (start, end, duration)` };
      }

      // Check if start and end are valid dates
      const startDate = new Date(segment.start);
      const endDate = new Date(segment.end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { isValid: false, error: `Segment ${i} has invalid date values` };
      }

      // Check if end is after start
      if (endDate <= startDate) {
        return { isValid: false, error: `Segment ${i} end time must be after start time` };
      }

      // Check if duration is positive
      if (segment.duration <= 0) {
        return { isValid: false, error: `Segment ${i} duration must be positive` };
      }

      // Check chronological order (segments should not overlap)
      if (i > 0) {
        const prevSegment = segments[i - 1];
        const prevEnd = new Date(prevSegment.end);
        if (startDate < prevEnd) {
          return { isValid: false, error: `Segment ${i} overlaps with previous segment` };
        }
      }
    }

    return { isValid: true };
  };

  // Create segment info object with validation
  createSegmentInfo = (segments, originalDuration) => {
    // Validate segments before creating info
    const validation = this.validateSegments(segments);
    if (!validation.isValid) {
      console.error('❌ Invalid segments detected:', validation.error);
      throw new Error(`Invalid segments: ${validation.error}`);
    }

    return {
      totalSegments: segments.length,
      segments: segments.map(seg => ({
        start: seg.start.toISOString(),
        end: seg.end.toISOString(),
        duration: seg.duration
      })),
      originalDuration,
      wasSplit: segments.length > 1
    };
  };

  // BULLETPROOF: Get all actual occupied time segments for a task
  getTaskOccupiedSegments = (task) => {
    // First try to get from memory
    const segmentInfo = this.getSplitTaskInfo(task.id);
    if (segmentInfo && segmentInfo.segments) {
      return segmentInfo.segments.map(seg => ({
        start: new Date(seg.start),
        end: new Date(seg.end),
        duration: seg.duration
      }));
    }

    // Fallback: try to parse from task description
    if (task.description) {
      try {
        const segmentInfo = JSON.parse(task.description);
        if (segmentInfo.segments && Array.isArray(segmentInfo.segments)) {
          return segmentInfo.segments.map(seg => ({
            start: new Date(seg.start),
            end: new Date(seg.end),
            duration: seg.duration
          }));
        }
      } catch (_error) {
        // Parsing failed, fall through to legacy method
      }
    }

    // Legacy fallback: create single segment from scheduled times
    if (task.scheduled_start_time) {
      const startTime = new Date(task.scheduled_start_time);
      const durationHours = task.time_remaining || task.duration || 1;
      const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000));
      
      return [{
        start: startTime,
        end: endTime,
        duration: durationHours
      }];
    }

    return [];
  };

  // BULLETPROOF: Check if two time ranges overlap
  doTimeRangesOverlap = (range1Start, range1End, range2Start, range2End) => {
    return range1Start < range2End && range1End > range2Start;
  };

  // BULLETPROOF: Check if a new task would overlap with an existing task
  checkTaskOverlap = (newTaskStart, newTaskEnd, existingTask) => {
    const existingSegments = this.getTaskOccupiedSegments(existingTask);
    

    
    for (const segment of existingSegments) {
      if (this.doTimeRangesOverlap(newTaskStart, newTaskEnd, segment.start, segment.end)) {

        return {
          hasOverlap: true,
          conflictingSegment: segment,
          existingTask: existingTask
        };
      }
    }
    
    return { hasOverlap: false };
  };

  // BULLETPROOF: Check if a new task would overlap with any existing tasks on a machine
  checkMachineOverlaps = (newTaskStart, newTaskEnd, machineId, excludeTaskId = null, additionalExcludeIds = []) => {
    const { getOdpOrders } = useOrderStore.getState();
    const allExcludeIds = [excludeTaskId, ...additionalExcludeIds].filter(id => id);
    
    
    // Filter out tasks that don't have proper scheduling information
    const existingTasks = getOdpOrders().filter(o => 
      o.scheduled_machine_id === machineId && 
      o.status === 'SCHEDULED' &&
      !allExcludeIds.includes(o.id) &&
      o.scheduled_start_time && // Must have start time
      o.scheduled_end_time && // Must have end time
      o.scheduled_machine_id // Must have machine ID
    );


    // Sort tasks by their earliest start time to find the earliest conflict first
    const sortedTasks = existingTasks.sort((a, b) => {
      const aSegments = this.getTaskOccupiedSegments(a);
      const bSegments = this.getTaskOccupiedSegments(b);
      
      const aStart = aSegments.length > 0 ? aSegments[0].start : new Date(a.scheduled_start_time);
      const bStart = bSegments.length > 0 ? bSegments[0].start : new Date(b.scheduled_start_time);
      
      return aStart.getTime() - bStart.getTime();
    });

    // Debug logging for shunting conflicts
    if (allExcludeIds.length > 0) {
      console.log(`📋 Tasks not excluded (sorted by start time):`, sortedTasks.map(t => ({ 
        id: t.id, 
        odp: t.odp_number,
        start: this.getTaskOccupiedSegments(t)[0]?.start?.toISOString() || t.scheduled_start_time,
        segments: this.getTaskOccupiedSegments(t).length
      })));
      console.log(`📋 ALL tasks on machine:`, getOdpOrders().filter(o => 
        o.scheduled_machine_id === machineId && 
        o.status === 'SCHEDULED'
      ).map(t => ({ 
        id: t.id, 
        odp: t.odp_number,
        segments: this.getTaskOccupiedSegments(t).length,
        start: t.scheduled_start_time,
        end: t.scheduled_end_time,
        machine: t.scheduled_machine_id,
        hasCompleteScheduling: !!(t.scheduled_start_time && t.scheduled_end_time && t.scheduled_machine_id)
      })));
    }

    for (const existingTask of sortedTasks) {
      
      const overlapResult = this.checkTaskOverlap(newTaskStart, newTaskEnd, existingTask);
      if (overlapResult.hasOverlap) {
        return {
          hasOverlap: true,
          conflictingTask: existingTask,
          conflictingSegment: overlapResult.conflictingSegment
        };
      }
    }

    return { hasOverlap: false };
  };

  // Migrate existing tasks to segment format (for backward compatibility)
  migrateExistingTasksToSegmentFormat = async () => {
    const { getOdpOrders } = useOrderStore.getState();
    const orders = getOdpOrders();
    
    for (const order of orders) {
      if (order.status === 'SCHEDULED' && order.scheduled_start_time) {
        // Check if task already has proper segment info
        const existingSegmentInfo = this.getSplitTaskInfo(order.id);
        if (existingSegmentInfo && existingSegmentInfo.segments) {
          continue; // Already migrated
        }
        
        // Check if description has valid segment info
        if (order.description) {
          try {
            const parsedDescription = JSON.parse(order.description);
            if (parsedDescription.segments && Array.isArray(parsedDescription.segments)) {
              // Valid segment info exists, just store in memory
              this.setSplitTaskInfo(order.id, parsedDescription);
              continue;
            }
          } catch (_error) {
            // Invalid JSON, will create new segment info
          }
        }
        
        // Create single segment for this task
        const startTime = new Date(order.scheduled_start_time);
        const durationHours = order.time_remaining || order.duration || 1;
        const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000));
        
        const singleSegment = [{
          start: startTime,
          end: endTime,
          duration: durationHours
        }];
        
        const segmentInfo = this.createSegmentInfo(singleSegment, durationHours);
        await this.updateTaskWithSplitInfo(order.id, segmentInfo);
      }
    }
  };

  // Utility method to verify all scheduled tasks have segment info
  verifyAllTasksHaveSegmentInfo = () => {
    const { getOdpOrders } = useOrderStore.getState();
    const orders = getOdpOrders();
    const scheduledTasks = orders.filter(o => o.status === 'SCHEDULED');
    
    const tasksWithoutSegments = [];
    
    for (const task of scheduledTasks) {
      const segmentInfo = this.getSplitTaskInfo(task.id);
      if (!segmentInfo || !segmentInfo.segments) {
        tasksWithoutSegments.push({
          id: task.id,
          odp_number: task.odp_number,
          description: task.description
        });
      }
    }
    
    return {
      totalScheduledTasks: scheduledTasks.length,
      tasksWithSegments: scheduledTasks.length - tasksWithoutSegments.length,
      tasksWithoutSegments: tasksWithoutSegments
    };
  };
}
