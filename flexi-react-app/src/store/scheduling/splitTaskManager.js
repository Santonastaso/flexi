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

  // Get split task info from memory
  getSplitTaskInfo = (taskId) => {
    return this.get().splitTasksInfo[taskId];
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
    orders.forEach(order => {
      if (order.description && order.status === 'SCHEDULED') {
        try {
          const segmentInfo = JSON.parse(order.description);
          if (segmentInfo.segments && Array.isArray(segmentInfo.segments)) {
            // All scheduled tasks should have segment info now
            splitTasksInfo[order.id] = segmentInfo;
          }
        } catch (_error) {
          // If parsing fails, it's not segment info, ignore
        }
      }
    });
    
    this.set({ splitTasksInfo });
    console.log(`🔄 Restored ${Object.keys(splitTasksInfo).length} split tasks from database`);
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
    
    console.log(`🔍 Checking ${existingTask.odp_number} segments:`, existingSegments.map(s => 
      `${s.start.toISOString()} - ${s.end.toISOString()}`
    ));
    
    for (const segment of existingSegments) {
      if (this.doTimeRangesOverlap(newTaskStart, newTaskEnd, segment.start, segment.end)) {
        console.log(`🚨 SEGMENT OVERLAP: ${newTaskStart.toISOString()}-${newTaskEnd.toISOString()} vs ${segment.start.toISOString()}-${segment.end.toISOString()}`);
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

    console.log(`🔍 Checking overlaps: ${newTaskStart.toISOString()} - ${newTaskEnd.toISOString()}`);
    console.log(`🔍 Excluding tasks:`, allExcludeIds);
    console.log(`🔍 Checking against ${existingTasks.length} tasks:`, existingTasks.map(t => t.odp_number));

    for (const existingTask of existingTasks) {
      const overlapResult = this.checkTaskOverlap(newTaskStart, newTaskEnd, existingTask);
      if (overlapResult.hasOverlap) {
        console.log(`🚨 OVERLAP FOUND with ${existingTask.odp_number}:`, overlapResult.conflictingSegment);
        return {
          hasOverlap: true,
          conflictingTask: existingTask,
          conflictingSegment: overlapResult.conflictingSegment
        };
      }
    }

    console.log(`✅ No overlaps found`);
    return { hasOverlap: false };
  };

  // MIGRATION: Convert existing tasks to new segment format
  migrateExistingTasksToSegmentFormat = async () => {
    const { getOdpOrders, updateOdpOrder } = useOrderStore.getState();
    const scheduledTasks = getOdpOrders().filter(o => 
      o.status === 'SCHEDULED' && 
      o.scheduled_start_time &&
      (!o.description || o.description.trim() === '')
    );

    console.log(`🔄 Migrating ${scheduledTasks.length} existing tasks to segment format`);

    for (const task of scheduledTasks) {
      try {
        const startTime = new Date(task.scheduled_start_time);
        const durationHours = task.time_remaining || task.duration || 1;
        const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000));
        
        const singleSegment = [{
          start: startTime,
          end: endTime,
          duration: durationHours
        }];
        
        const segmentInfo = this.createSegmentInfo(singleSegment, durationHours);
        const segmentInfoJson = JSON.stringify(segmentInfo);
        
        await updateOdpOrder(task.id, { description: segmentInfoJson });
        this.setSplitTaskInfo(task.id, segmentInfo);
        
        console.log(`✅ Migrated task ${task.odp_number} to segment format`);
      } catch (error) {
        console.error(`❌ Failed to migrate task ${task.odp_number}:`, error);
      }
    }

    console.log(`🎉 Migration complete: ${scheduledTasks.length} tasks converted to segment format`);
  };
}
