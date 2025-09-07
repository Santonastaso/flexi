import { create } from 'zustand';
import { apiService } from '../services';
import { format, addHours } from 'date-fns';
import { handleApiError } from '../utils/errorHandling';
import { useOrderStore } from './useOrderStore';
import { useMachineStore } from './useMachineStore';
import { useUIStore } from './useUIStore';
import { SplitTaskManager } from './scheduling/splitTaskManager';
import { SchedulingLogic } from './scheduling/schedulingLogic';
import { ConflictResolution } from './scheduling/conflictResolution';
import { MachineAvailabilityManager } from './scheduling/machineAvailability';

export const useSchedulerStore = create((set, get) => {
  // Initialize helper classes
  const splitTaskManager = new SplitTaskManager(get, set);
  const machineAvailabilityManager = new MachineAvailabilityManager(get, set);
  const schedulingLogic = new SchedulingLogic(get, set, splitTaskManager, machineAvailabilityManager);
  const conflictResolution = new ConflictResolution(get, set, schedulingLogic, splitTaskManager);

  return {
    // State
    machineAvailability: {},
    shuntPreview: null,
    splitTasksInfo: {}, // Store split task information in memory

    // Selectors
    getMachineAvailabilityState: () => get().machineAvailability,
    getSplitTaskInfo: (taskId) => splitTaskManager.getSplitTaskInfo(taskId),

    // Actions
    setMachineAvailabilityState: (availability) => set({ machineAvailability: availability }),
    setShuntPreview: (preview) => set({ shuntPreview: preview }),
    clearShuntPreview: () => set({ shuntPreview: null }),
    
    // Split task management (delegated to SplitTaskManager)
    setSplitTaskInfo: splitTaskManager.setSplitTaskInfo,
    clearSplitTaskInfo: splitTaskManager.clearSplitTaskInfo,
    updateSplitTaskInfo: splitTaskManager.updateSplitTaskInfo,
    restoreSplitTaskInfo: splitTaskManager.restoreSplitTaskInfo,
    updateTaskWithSplitInfo: splitTaskManager.updateTaskWithSplitInfo,
    
    // Bulletproof overlap detection (delegated to SplitTaskManager)
    getTaskOccupiedSegments: splitTaskManager.getTaskOccupiedSegments,
    checkTaskOverlap: splitTaskManager.checkTaskOverlap,
    checkMachineOverlaps: splitTaskManager.checkMachineOverlaps,
    migrateExistingTasksToSegmentFormat: splitTaskManager.migrateExistingTasksToSegmentFormat,
    verifyAllTasksHaveSegmentInfo: splitTaskManager.verifyAllTasksHaveSegmentInfo,

    // Scheduling logic (delegated to SchedulingLogic)
    createAbsoluteDate: schedulingLogic.createAbsoluteDate,
    splitTaskAcrossAvailableSlots: schedulingLogic.splitTaskAcrossAvailableSlots,
    collectUnavailableSlots: schedulingLogic.collectUnavailableSlots,
    scheduleTaskWithSplitting: schedulingLogic.scheduleTaskWithSplitting,

    // Consolidated drag-and-drop methods
    scheduleTaskFromSlot: async (taskId, machine, currentDate, hour, minute, overrideDuration = null) => {
      const { startSchedulingOperation, stopSchedulingOperation } = useUIStore.getState();
      
      try {
        startSchedulingOperation('schedule', taskId);
        
        // Get task and machine data from stores
        const { getOdpOrdersById, getOdpOrders, updateOrder } = useOrderStore.getState();
        const { getMachinesById } = useMachineStore.getState();
        const task = getOdpOrdersById(taskId);
        const machineData = getMachinesById(machine.id);
        const tasks = getOdpOrders();

        if (!task || !machineData) {
          return { error: 'Task or machine not found' };
        }

        // Simple date creation - no timezone bullshit
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
        const day = currentDate.getUTCDate();
        
        // Create absolute date with no timezone conversion
        const startDate = schedulingLogic.createAbsoluteDate(year, month, day, hour, minute);
        const timeRemainingHours = overrideDuration || task.time_remaining || task.duration || 1;
        
        console.log('🎯 SCHEDULER: Using duration:', timeRemainingHours, 'overrideDuration:', overrideDuration);
        


        // Create schedule data
        const scheduleData = {
          machine: machine.id,
          start_time: startDate.toISOString(),
          end_time: addHours(startDate, timeRemainingHours).toISOString(),
        };

        // Use existing scheduleTask method with all validations, passing tasks and updateOrder
        return await get().scheduleTask(taskId, scheduleData, tasks, updateOrder, overrideDuration);
      } catch (error) {
        const appError = handleApiError(error, 'SchedulerStore.scheduleTaskFromSlot');
        return { error: appError.message };
      } finally {
        stopSchedulingOperation();
      }
    },

    rescheduleTaskToSlot: async (eventId, machine, currentDate, hour, minute) => {
      const { startSchedulingOperation, stopSchedulingOperation } = useUIStore.getState();
      
      try {
        startSchedulingOperation('reschedule', eventId);
        
        // Get event data from stores
        const { getOdpOrdersById, getOdpOrders, updateOrder } = useOrderStore.getState();
        const { getMachinesById } = useMachineStore.getState();
        const eventItem = getOdpOrdersById(eventId);
        const machineData = getMachinesById(machine.id);
        const tasks = getOdpOrders();

        if (!eventItem || !machineData) {
          return { error: 'Event or machine not found' };
        }

        // Simple date creation - no timezone bullshit
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
        const day = currentDate.getUTCDate();
        
        // Create absolute date with no timezone conversion
        const startDate = schedulingLogic.createAbsoluteDate(year, month, day, hour, minute);
        const timeRemainingHours = eventItem.time_remaining || eventItem.duration || 1;
        


        // Create schedule data
        const scheduleData = {
          machine: machine.id,
          start_time: startDate.toISOString(),
          end_time: addHours(startDate, timeRemainingHours).toISOString(),
        };

        // Use existing scheduleTask method with all validations, passing tasks and updateOrder
        return await get().scheduleTask(eventId, scheduleData, tasks, updateOrder);
      } catch (error) {
        const appError = handleApiError(error, 'SchedulerStore.rescheduleTaskToSlot');
        return { error: appError.message };
      } finally {
        stopSchedulingOperation();
      }
    },

    // Main scheduler actions
    scheduleTask: async (taskId, eventData, tasks = null, updateOrder = null, overrideDuration = null) => {
      try {
        // Get data from stores if not provided
        const { getOdpOrdersById, getOdpOrders, updateOrder: defaultUpdateOrder } = useOrderStore.getState();
        const { getMachinesById } = useMachineStore.getState();
        
        const task = getOdpOrdersById(taskId);
        const machine = getMachinesById(eventData.machine);
        const tasksData = tasks || getOdpOrders();
        const updateOrderFn = updateOrder || defaultUpdateOrder;
        
        if (task && machine && task.work_center && machine.work_center && task.work_center !== machine.work_center) {
          return { error: `Work center mismatch: task requires '${task.work_center}' but machine is '${machine.work_center}'` };
        }

        // Use comprehensive scheduling with splitting (includes bulletproof overlap detection)
        const newStart = new Date(eventData.start_time);
        const timeRemainingHours = overrideDuration || task.time_remaining || task.duration || 1;
        
        console.log('🎯 SCHEDULER: scheduleTask using duration:', timeRemainingHours, 'overrideDuration:', overrideDuration);
        const schedulingResult = await schedulingLogic.scheduleTaskWithSplitting(
          taskId, 
          newStart, 
          timeRemainingHours, 
          eventData.machine
        );

        if (!schedulingResult) {
          return { error: 'No available time slots found for this task' };
        }

        // BULLETPROOF: Check if scheduling result indicates a conflict
        if (schedulingResult.conflict) {
          return { 
            conflict: true,
            conflictingTask: schedulingResult.conflictingTask,
            draggedTask: task,
            proposedStartTime: eventData.start_time,
            proposedEndTime: eventData.end_time,
            machine: machine,
            conflictingSegment: schedulingResult.conflictingSegment,
            proposedSegments: schedulingResult.proposedSegments,
            tasks: tasksData,
            updateOrder: updateOrderFn
          };
        }

        // Update the event data with the scheduling result
        eventData.start_time = schedulingResult.startTime.toISOString();
        eventData.end_time = schedulingResult.endTime.toISOString();

        // Prepare updates including split task information
        const updates = {
          scheduled_machine_id: eventData.machine,
          scheduled_start_time: eventData.start_time,
          scheduled_end_time: eventData.end_time,
          status: 'SCHEDULED',
        };

        // ALWAYS create segment information in description, even for non-split tasks
        if (schedulingResult.segments) {
          const segmentInfo = {
            segments: schedulingResult.segments,
            totalSegments: schedulingResult.segments.length,
            originalDuration: schedulingResult.originalDuration || (task.time_remaining || task.duration || 1),
            wasSplit: schedulingResult.wasSplit || false
          };
          updates.description = JSON.stringify(segmentInfo);
        }
        
        // Call the update method from the order store
        const result = await updateOrderFn(taskId, updates);
        
        // Also update the split task info in memory for immediate access
        if (schedulingResult.segments) {
          const segmentInfo = {
            segments: schedulingResult.segments,
            totalSegments: schedulingResult.segments.length,
            originalDuration: schedulingResult.originalDuration || (task.time_remaining || task.duration || 1),
            wasSplit: schedulingResult.wasSplit || false
          };
          splitTaskManager.setSplitTaskInfo(taskId, segmentInfo);
        }
        
        return { success: true };
      } catch (error) {
        const appError = handleApiError(error, 'SchedulerStore.scheduleTask');
        return { error: appError.message };
      }
    },

    unscheduleTask: async (taskId) => {
      const { startSchedulingOperation, stopSchedulingOperation } = useUIStore.getState();
      
      try {
        startSchedulingOperation('unschedule', taskId);
        
        const updates = {
          scheduled_machine_id: null,
          scheduled_start_time: null,
          scheduled_end_time: null,
          status: 'NOT SCHEDULED',
        };
        
        // Clear split task info when unscheduling
        await splitTaskManager.updateTaskWithSplitInfo(taskId, null);
        
        // Call the update method from the order store
        const { updateOrder } = useOrderStore.getState();
        const result = await updateOrder(taskId, updates);
        
        if (result?.error) {
          return { error: result.error };
        }
        
        return { success: true };
      } catch (error) {
        const appError = handleApiError(error, 'SchedulerStore.unscheduleTask');
        return { error: appError.message };
      } finally {
        stopSchedulingOperation();
      }
    },

    // Machine availability methods (delegated to MachineAvailabilityManager)
    loadMachineAvailabilityForDate: machineAvailabilityManager.loadMachineAvailabilityForDate,
    loadMachineAvailabilityForDateRange: machineAvailabilityManager.loadMachineAvailabilityForDateRange,
    getMachineAvailability: machineAvailabilityManager.getMachineAvailability,
    loadMachineAvailabilityForMachine: machineAvailabilityManager.loadMachineAvailabilityForMachine,
    isTimeSlotUnavailable: machineAvailabilityManager.isTimeSlotUnavailable,
    setMachineAvailability: machineAvailabilityManager.setMachineAvailability,
    toggleMachineHourAvailability: machineAvailabilityManager.toggleMachineHourAvailability,
    setMachineUnavailability: machineAvailabilityManager.setMachineUnavailability,
    isMachineAvailabilityAccessible: machineAvailabilityManager.isMachineAvailabilityAccessible,
    getMachineAvailabilityStatus: machineAvailabilityManager.getMachineAvailabilityStatus,
    initializeEmptyMachineAvailability: machineAvailabilityManager.initializeEmptyMachineAvailability,

    // Conflict resolution methods (delegated to ConflictResolution)
    resolveConflictByShunting: async (conflictDetails, direction) => {
      const { startSchedulingOperation, stopSchedulingOperation } = useUIStore.getState();
      
      try {
        startSchedulingOperation('shunt', conflictDetails.draggedTask?.id);
        
        const { getOdpOrders, updateOrder } = useOrderStore.getState();
        const tasks = getOdpOrders();
        return await conflictResolution.resolveConflictByShunting(conflictDetails, direction, tasks, conflictDetails.draggedTask, updateOrder);
      } finally {
        stopSchedulingOperation();
      }
    },

    // Additional utility methods
    validateSlotAvailability: async (machine, currentDate, hour, minute) => {
      try {
        // Check if slot is unavailable
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const isUnavailable = await get().isTimeSlotUnavailable(machine.id, dateStr, hour);
        
        if (isUnavailable) {
          return { error: 'Cannot schedule task on unavailable time slot' };
        }

        // Check if slot already has a scheduled task
        const { getOdpOrders } = useOrderStore.getState();
        const startDate = new Date(currentDate);
        startDate.setUTCHours(hour, minute, 0, 0);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour slot

        const existingTasks = getOdpOrders().filter(o => 
          o.scheduled_machine_id === machine.id && 
          o.status === 'SCHEDULED' &&
          o.scheduled_start_time
        );

        for (const existingTask of existingTasks) {
          const existingStart = new Date(existingTask.scheduled_start_time);
          const existingTimeRemaining = existingTask.time_remaining || existingTask.duration || 1;
          const existingEnd = new Date(existingStart.getTime() + (existingTimeRemaining * 60 * 60 * 1000));
          
          // Check if the new time slot overlaps with existing task
          if (startDate < existingEnd && endDate > existingStart) {
            return { error: 'Cannot schedule task on occupied time slot' };
          }
        }

        return { success: true };
      } catch (error) {
        const appError = handleApiError(error, 'SchedulerStore.validateSlotAvailability');
        return { error: appError.message };
      }
    },

    // Get events by date (if needed by other components)
    getEventsByDate: async (dateStr) => {
      try {
        return await apiService.getEventsByDate(dateStr);
      } catch (e) {
        return [];
      }
    },

    reset: () => set({ machineAvailability: {}, shuntPreview: null, splitTasksInfo: {} }),
  };
});
