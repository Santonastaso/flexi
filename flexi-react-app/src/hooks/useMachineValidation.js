import { useCallback } from 'react';

/**
 * Custom hook for machine validation logic
 * Replaces imperative validation methods with React-idiomatic patterns
 */
export const useMachineValidation = () => {
  
  /**
   * Validate machine data before saving
   */
  const validateMachine = useCallback((machine) => {
    const errors = [];

    // Required fields
    if (!machine.machine_name?.trim()) {
      errors.push('Machine name is required');
    }

    if (!machine.machine_type) {
      errors.push('Machine type is required');
    }

    if (!machine.department) {
      errors.push('Department is required');
    }

    if (!machine.work_center) {
      errors.push('Work center is required');
    }

    // Numeric validations
    if (machine.min_web_width !== undefined && machine.min_web_width < 0) {
      errors.push('Minimum web width cannot be negative');
    }

    if (machine.max_web_width !== undefined && machine.max_web_width < 0) {
      errors.push('Maximum web width cannot be negative');
    }

    if (machine.min_bag_height !== undefined && machine.min_bag_height < 0) {
      errors.push('Minimum bag height cannot be negative');
    }

    if (machine.max_bag_height !== undefined && machine.max_bag_height < 0) {
      errors.push('Maximum bag height cannot be negative');
    }

    // Logical validations
    if (machine.min_web_width !== undefined && machine.max_web_width !== undefined) {
      if (machine.min_web_width > machine.max_web_width) {
        errors.push('Minimum web width cannot exceed maximum web width');
      }
    }

    if (machine.min_bag_height !== undefined && machine.max_bag_height !== undefined) {
      if (machine.min_bag_height > machine.max_bag_height) {
        errors.push('Minimum bag height cannot exceed maximum bag height');
      }
    }

    // Performance validations
    if (machine.standard_speed !== undefined && machine.standard_speed < 0) {
      errors.push('Standard speed cannot be negative');
    }

    if (machine.setup_time_standard !== undefined && machine.setup_time_standard < 0) {
      errors.push('Setup time cannot be negative');
    }

    if (machine.changeover_color !== undefined && machine.changeover_color < 0) {
      errors.push('Color changeover time cannot be negative');
    }

    if (machine.changeover_material !== undefined && machine.changeover_material < 0) {
      errors.push('Material changeover time cannot be negative');
    }

    return errors;
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
  const isMachineAvailable = useCallback((machine, date, hour) => {
    if (machine.status !== 'ACTIVE') {
      return false;
    }

    // Check if machine has active shifts for this hour
    const activeShifts = machine.active_shifts || [];
    if (activeShifts.length === 0) {
      return false;
    }

    // Simple shift validation (T1: 6-14, T2: 14-22, T3: 22-6)
    const currentHour = date.getHours();
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
