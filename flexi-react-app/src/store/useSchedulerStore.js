import { create } from 'zustand';
import { MachineAvailabilityManager } from './scheduling/machineAvailability';

export const useSchedulerStore = create((set, get) => {
  const machineAvailabilityManager = new MachineAvailabilityManager(get, set);
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

    reset: () => set({ machineAvailability: {} }),
  };
});