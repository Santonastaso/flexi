import { create } from 'zustand';
import { MachineAvailabilityManager } from './scheduling/machineAvailability';
import { schedulerV2Client } from '../services/schedulerV2Client';

const queued = (snapshot, machineId) => (snapshot.queue || [])
  .filter((task) => task.machine_id === machineId)
  .sort((a, b) => a.position - b.position);

export const useSchedulerStore = create((set, get) => {
  const machineAvailabilityManager = new MachineAvailabilityManager(get, set);
  const snapshot = () => schedulerV2Client.snapshot();
  const revision = (data, machineId) => Number(data.revisions?.[machineId] ?? 0);

  return {
    machineAvailability: {},
    getMachineAvailabilityState: () => get().machineAvailability,
    setMachineAvailabilityState: (availability) => set({ machineAvailability: availability }),

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

    getQueueForMachine: (machineId, allOrders = []) => allOrders
      .filter((task) => task.scheduled_machine_id === machineId && ['SCHEDULED', 'IN PROGRESS'].includes(task.status))
      .sort((a, b) => new Date(a.scheduled_start_time || 0) - new Date(b.scheduled_start_time || 0)),

    scheduleTaskAtEndOfQueue: async (machineId, taskId) => {
      const data = await snapshot();
      return schedulerV2Client.schedule({ machineId, taskId, revision: revision(data, machineId) });
    },

    reorderTaskInQueue: async (machineId, taskId, _oldIndex, newIndex) => {
      const data = await snapshot();
      const queue = queued(data, machineId).filter((task) => task.id !== taskId);
      const beforeTaskId = queue[newIndex]?.id || null;
      return schedulerV2Client.schedule({ machineId, taskId, beforeTaskId, revision: revision(data, machineId) });
    },

    createPauseTask: async (machineId, durationHours) => {
      const data = await snapshot();
      return schedulerV2Client.createPause({ machineId, durationMinutes: Math.max(1, Math.round(Number(durationHours) * 60)), revision: revision(data, machineId) });
    },

    removeTaskFromQueue: async (_machineId, taskId) => {
      const data = await snapshot();
      const task = (data.queue || []).find((item) => item.id === taskId);
      if (!task) throw new Error('Lavoro non presente nella coda');
      return schedulerV2Client.unschedule({ taskId, revision: revision(data, task.machine_id) });
    },

    rescheduleQueueFromTask: async (machineId) => {
      const data = await snapshot();
      return schedulerV2Client.repair({ machineId, revision: revision(data, machineId) });
    },

    repairAllQueues: async (_allOrders, allMachines) => {
      const data = await snapshot();
      for (const machine of allMachines) {
        await schedulerV2Client.repair({ machineId: machine.id, revision: revision(data, machine.id) });
      }
    },

    reset: () => set({ machineAvailability: {} }),
  };
});