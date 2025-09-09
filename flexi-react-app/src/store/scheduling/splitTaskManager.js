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

  setSplitTaskInfo = (taskId, segmentInfo) => {
    this.set(state => ({
      splitTasksInfo: { ...state.splitTasksInfo, [taskId]: segmentInfo }
    }));
  };

  getSplitTaskInfo = (taskId) => {
    const memoryInfo = this.get().splitTasksInfo[taskId];
    if (memoryInfo && memoryInfo.segments) {
      return memoryInfo;
    }
    
    const { getOrderById } = useOrderStore.getState();
    const task = getOrderById(taskId);
    
    if (task && task.description && task.status === 'SCHEDULED') {
      try {
        const segmentInfo = JSON.parse(task.description);
        if (segmentInfo.segments && Array.isArray(segmentInfo.segments)) {
          setTimeout(() => {
            this.setSplitTaskInfo(taskId, segmentInfo);
          }, 0);
          return segmentInfo;
        }
      } catch (_error) {
      }
    }
    
    return null;
  };

  clearSplitTaskInfo = (taskId) => {
    this.set(state => {
      const newSplitTasksInfo = { ...state.splitTasksInfo };
      delete newSplitTasksInfo[taskId];
      return { splitTasksInfo: newSplitTasksInfo };
    });
  };

  updateTaskWithSplitInfo = async (taskId, segmentInfo, startTime = null, endTime = null, machineId = null) => {
    
    const { apiService } = await import('../../services/api');
    
    if (segmentInfo) {
      this.setSplitTaskInfo(taskId, segmentInfo);
      const segmentInfoJson = JSON.stringify(segmentInfo);
      
      const updateData = { 
        description: segmentInfoJson,
        status: 'SCHEDULED'
      };
      
      if (startTime) updateData.scheduled_start_time = startTime.toISOString();
      if (endTime) updateData.scheduled_end_time = endTime.toISOString();
      if (machineId) updateData.scheduled_machine_id = machineId;
      
      
      if (updateData.scheduled_start_time && updateData.scheduled_end_time && updateData.scheduled_machine_id) {
      } else if (!updateData.scheduled_start_time && !updateData.scheduled_end_time && !updateData.scheduled_machine_id) {
        delete updateData.scheduled_start_time;
        delete updateData.scheduled_end_time;
        delete updateData.scheduled_machine_id;
        updateData.status = 'NOT SCHEDULED';
      } else {
        const { getOrderById } = useOrderStore.getState();
        const currentTask = getOrderById(taskId);
        
        if (currentTask) {
          if (!updateData.scheduled_start_time) updateData.scheduled_start_time = currentTask.scheduled_start_time;
          if (!updateData.scheduled_end_time) updateData.scheduled_end_time = currentTask.scheduled_end_time;
          if (!updateData.scheduled_machine_id) updateData.scheduled_machine_id = currentTask.scheduled_machine_id;
        }
      }
      
      const updatedTask = await apiService.updateOdpOrder(taskId, updateData);
      this.updateSplitTaskInfo(taskId, updatedTask);
    } else {
      this.clearSplitTaskInfo(taskId);
      const updatedTask = await apiService.updateOdpOrder(taskId, { description: '' });
      this.updateSplitTaskInfo(taskId, updatedTask);
    }
  };

  updateSplitTaskInfo = (taskId, order) => {
    this.clearSplitTaskInfo(taskId);
    
    if (order.description && order.status === 'SCHEDULED') {
      try {
        const segmentInfo = JSON.parse(order.description);
        if (segmentInfo.segments && Array.isArray(segmentInfo.segments)) {
          const validation = this.validateSegments(segmentInfo.segments.map(seg => ({
            start: new Date(seg.start),
            end: new Date(seg.end),
            duration: seg.duration
          })));
          
          if (validation.isValid) {
            this.setSplitTaskInfo(taskId, segmentInfo);
          } else {
            this.clearSplitTaskInfo(taskId);
          }
        } else {
          this.clearSplitTaskInfo(taskId);
        }
      } catch (_error) {
        this.clearSplitTaskInfo(taskId);
      }
    } else {
      this.clearSplitTaskInfo(taskId);
    }
  };

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
            splitTasksInfo[order.id] = segmentInfo;
            loadedCount++;
          }
        } catch (_error) {
        }
      }
    });
    
    this.set({ splitTasksInfo });
  };

  validateSegments = (segments) => {
    if (!Array.isArray(segments) || segments.length === 0) {
      return { isValid: false, error: 'Segments must be a non-empty array' };
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      if (!segment.start || !segment.end || segment.duration === undefined) {
        return { isValid: false, error: `Segment ${i} missing required properties (start, end, duration)` };
      }

      const startDate = new Date(segment.start);
      const endDate = new Date(segment.end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { isValid: false, error: `Segment ${i} has invalid date values` };
      }

      if (endDate <= startDate) {
        return { isValid: false, error: `Segment ${i} end time must be after start time` };
      }

      if (segment.duration <= 0) {
        return { isValid: false, error: `Segment ${i} duration must be positive` };
      }

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

  createSegmentInfo = (segments, originalDuration) => {
    const validation = this.validateSegments(segments);
    if (!validation.isValid) {
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

  getTaskOccupiedSegments = (task) => {
    const segmentInfo = this.getSplitTaskInfo(task.id);
    if (segmentInfo && segmentInfo.segments) {
      return segmentInfo.segments.map(seg => ({
        start: new Date(seg.start),
        end: new Date(seg.end),
        duration: seg.duration
      }));
    }

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
      }
    }

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

  doTimeRangesOverlap = (range1Start, range1End, range2Start, range2End) => {
    return range1Start < range2End && range1End > range2Start;
  };

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

  checkMachineOverlaps = (newTaskStart, newTaskEnd, machineId, excludeTaskId = null, additionalExcludeIds = []) => {
    const { getOdpOrders } = useOrderStore.getState();
    const allExcludeIds = [excludeTaskId, ...additionalExcludeIds].filter(id => id);
    
    
    const existingTasks = getOdpOrders().filter(o => 
      o.scheduled_machine_id === machineId && 
      o.status === 'SCHEDULED' &&
      !allExcludeIds.includes(o.id) &&
      o.scheduled_start_time && // Must have start time
      o.scheduled_end_time && // Must have end time
      o.scheduled_machine_id // Must have machine ID
    );


    const sortedTasks = existingTasks.sort((a, b) => {
      const aSegments = this.getTaskOccupiedSegments(a);
      const bSegments = this.getTaskOccupiedSegments(b);
      
      const aStart = aSegments.length > 0 ? aSegments[0].start : new Date(a.scheduled_start_time);
      const bStart = bSegments.length > 0 ? bSegments[0].start : new Date(b.scheduled_start_time);
      
      return aStart.getTime() - bStart.getTime();
    });

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

  migrateExistingTasksToSegmentFormat = async () => {
    const { getOdpOrders } = useOrderStore.getState();
    const orders = getOdpOrders();
    
    for (const order of orders) {
      if (order.status === 'SCHEDULED' && order.scheduled_start_time) {
        const existingSegmentInfo = this.getSplitTaskInfo(order.id);
        if (existingSegmentInfo && existingSegmentInfo.segments) {
          continue; // Already migrated
        }
        
        if (order.description) {
          try {
            const parsedDescription = JSON.parse(order.description);
            if (parsedDescription.segments && Array.isArray(parsedDescription.segments)) {
              this.setSplitTaskInfo(order.id, parsedDescription);
              continue;
            }
          } catch (_error) {
          }
        }
        
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
