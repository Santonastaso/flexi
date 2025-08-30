import { useCallback } from 'react';
import { validation } from '../utils';

/**
 * Custom hook for machine validation logic
 * Uses consolidated validation system to eliminate duplication
 */
export const useMachineValidation = () => {
  
  /**
   * Validate machine data before saving
   */
  const validateMachine = useCallback((machine) => {
    // Use the consolidated validation system
    const errors = validation.validateAll(machine, validation.VALIDATION_CONFIGS.MACHINE);
    
    // Convert object errors to array format for backward compatibility
    return Object.values(errors);
  }, []);

  /**
   * Validate machine can be deleted (check for dependencies)
   */
  const validateMachineDeletion = useCallback((machineId, scheduledTasks) => {
    const errors = [];

    // Check if machine has scheduled tasks
    const hasScheduledTasks = scheduledTasks.some(task => 
      task.scheduled_machine_id === machineId
    );

    if (hasScheduledTasks) {
      errors.push('Cannot delete machine with scheduled tasks. Please unschedule all tasks first.');
    }

    return errors;
  }, []);

  /**
   * Get machine display information
   */
  const getMachineDisplayInfo = useCallback((machine) => {
    return {
      name: machine?.machine_name || 'Unknown Machine',
      type: machine?.machine_type || 'Unknown Type',
      department: machine?.department || 'Unknown Department',
      workCenter: machine?.work_center || 'Unknown Work Center',
      status: machine?.status || 'UNKNOWN',
      isActive: machine?.status === 'ACTIVE'
    };
  }, []);

  /**
   * Check if machine is available for scheduling
   */
  const isMachineAvailable = useCallback((machine, date) => {
    if (machine.status !== 'ACTIVE') {
      return false;
    }

    // Check if machine has active shifts for this hour
    const activeShifts = machine.active_shifts || [];
    if (activeShifts.length === 0) {
      return false;
    }

    // Simple shift validation (T1: 6-14, T2: 14-22, T3: 22-6) using UTC to match absolute times
    const currentHour = date.getUTCHours();
    const hasActiveShift = activeShifts.some(shift => {
      switch (shift) {
        case 'T1': return currentHour >= 6 && currentHour < 14;
        case 'T2': return currentHour >= 14 && currentHour < 22;
        case 'T3': return currentHour >= 22 || currentHour < 6;
        default: return false;
      }
    });

    return hasActiveShift;
  }, []);

  return {
    validateMachine,
    validateMachineDeletion,
    getMachineDisplayInfo,
    isMachineAvailable
  };
};

export default useMachineValidation;
