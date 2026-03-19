import { create } from 'zustand';
import { apiService } from '../services';
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

    // Get events by date (if needed by other components)
    getEventsByDate: async (dateStr) => {
      try {
        return await apiService.getEventsByDate(dateStr);
      } catch (e) {
        return [];
      }
    },

    reset: () => set({ machineAvailability: {} }),
  };
});
