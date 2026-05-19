import { create } from 'zustand';
import { MachineAvailabilityManager } from './scheduling/machineAvailability';
import { SpotifyQueueScheduler } from './scheduling/spotifyQueueScheduler';

export const useSchedulerStore = create((set, get) => {
  // Initialize helper classes (only Spotify and Machine Availability)
  const machineAvailabilityManager = new MachineAvailabilityManager(get, set);
  const spotifyScheduler = new SpotifyQueueScheduler(get, set, machineAvailabilityManager);

  return {
    // State
    machineAvailability: {},

    // Selectors
    getMachineAvailabilityState: () => get().machineAvailability,

    // Actions
    setMachineAvailabilityState: (availability) => set({ machineAvailability: availability }),

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

    // Queue scheduling methods (delegated to SpotifyQueueScheduler)
    getQueueForMachine: spotifyScheduler.getQueue,
    scheduleTaskAtEndOfQueue: spotifyScheduler.scheduleTaskAtEnd,
    reorderTaskInQueue: spotifyScheduler.reorderQueue,
    createPauseTask: spotifyScheduler.createPauseTask,
    removeTaskFromQueue: spotifyScheduler.removeFromQueue,
    rescheduleQueueFromTask: spotifyScheduler.rescheduleFromAnchor,

    repairAllQueues: async (allOrders, allMachines) => {
      for (const machine of allMachines) {
        const { anchor, fixedPrefixLength, queue } =
          spotifyScheduler.getGreedyAnchor(machine.id, allOrders);
        const tasksToReschedule = queue.slice(fixedPrefixLength);
        if (tasksToReschedule.length > 0) {
          await spotifyScheduler.rescheduleFromAnchor(
            machine.id, tasksToReschedule, anchor
          );
        }
      }
    },

    reset: () => set({ machineAvailability: {} }),
  };
});
