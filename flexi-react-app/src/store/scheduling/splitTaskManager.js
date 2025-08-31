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
  updateTaskWithSplitInfo = async (taskId, segmentInfo) => {
    const { updateOdpOrder } = useOrderStore.getState();
    
    if (segmentInfo) {
      // Store segment info in memory and database (for both split and non-split tasks)
      this.setSplitTaskInfo(taskId, segmentInfo);
      const segmentInfoJson = JSON.stringify(segmentInfo);
      const updatedTask = await updateOdpOrder(taskId, { description: segmentInfoJson });
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
    if (order.description && order.status === 'SCHEDULED') {
      try {
        const segmentInfo = JSON.parse(order.description);
        if (segmentInfo.segments && Array.isArray(segmentInfo.segments)) {
          // All scheduled tasks should have segment info now
          this.setSplitTaskInfo(taskId, segmentInfo);
        } else {
          this.clearSplitTaskInfo(taskId);
        }
      } catch (_error) {
        // If parsing fails, it's not segment info, clear it
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

  // Create segment info object
  createSegmentInfo = (segments, originalDuration) => {
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
    
    const existingTasks = getOdpOrders().filter(o => 
      o.scheduled_machine_id === machineId && 
      o.status === 'SCHEDULED' &&
      !allExcludeIds.includes(o.id)
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
      console.log(`🔍 Checking overlaps for machine ${machineId}, excluding:`, allExcludeIds);
      console.log(`📋 Tasks not excluded (sorted by start time):`, sortedTasks.map(t => ({ 
        id: t.id, 
        odp: t.odp_number,
        start: this.getTaskOccupiedSegments(t)[0]?.start?.toISOString() || t.scheduled_start_time
      })));
    }

    for (const existingTask of sortedTasks) {
      const overlapResult = this.checkTaskOverlap(newTaskStart, newTaskEnd, existingTask);
      if (overlapResult.hasOverlap) {
        if (allExcludeIds.length > 0) {
          console.error(`🚨 Conflict detected with task ${existingTask.odp_number} during shunting!`);
        }
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
