import { useCallback } from 'react';
import { validateData, SCHEMAS } from '../utils/yupSchemas';

/**
 * Unified validation hook that replaces all individual validation hooks
 * Uses Yup schemas for consistent validation across forms and table edits
 */
export const useValidation = () => {
  
  /**
   * Validate any data against a specific schema
   * @param {Object} data - The data to validate
   * @param {string} schemaType - The schema type (MACHINE, PHASE, ORDER, etc.)
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validate = useCallback((data, schemaType) => {
    const schema = SCHEMAS[schemaType];
    if (!schema) {
      throw new Error(`Unknown schema type: ${schemaType}`);
    }
    return validateData(data, schema);
  }, []);

  /**
   * Validate machine data
   * @param {Object} machine - Machine data to validate
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validateMachine = useCallback((machine) => {
    return validate(machine, 'MACHINE');
  }, [validate]);

  /**
   * Validate phase data
   * @param {Object} phase - Phase data to validate
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validatePhase = useCallback((phase) => {
    return validate(phase, 'PHASE');
  }, [validate]);

  /**
   * Validate order/backlog data
   * @param {Object} order - Order data to validate
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validateOrder = useCallback((order) => {
    return validate(order, 'ORDER');
  }, [validate]);

  /**
   * Validate off-time data
   * @param {Object} offTime - Off-time data to validate
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validateOffTime = useCallback((offTime) => {
    return validate(offTime, 'OFF_TIME');
  }, [validate]);

  /**
   * Validate auth data
   * @param {Object} authData - Auth data to validate
   * @param {string} authType - Auth type (LOGIN, SIGNUP, FORGOT_PASSWORD)
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validateAuth = useCallback((authData, authType) => {
    return validate(authData, authType);
  }, [validate]);

  /**
   * Validate machine can be deleted (check for dependencies)
   * @param {string} machineId - Machine ID to check
   * @param {Array} scheduledTasks - Array of scheduled tasks
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validateMachineDeletion = useCallback((machineId, scheduledTasks) => {
    const errors = {};

    // Check if machine has scheduled tasks
    const hasScheduledTasks = scheduledTasks.some(task => 
      task.scheduled_machine_id === machineId
    );

    if (hasScheduledTasks) {
      errors.general = 'Cannot delete machine with scheduled tasks. Please unschedule all tasks first.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }, []);

  /**
   * Validate order can be deleted
   * @param {Object} order - Order to validate for deletion
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validateOrderDeletion = useCallback((order) => {
    const errors = {};

    if (!order) {
      errors.general = 'Order is required';
      return { isValid: false, errors };
    }

    // Check if order is in progress
    if (order.quantity_completed > 0) {
      errors.general = 'Cannot delete order that has started production';
    }

    // Check if order is scheduled
    if (order.scheduled_machine_id) {
      errors.general = 'Cannot delete scheduled order. Please unschedule first.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }, []);

  /**
   * Validate order can be scheduled
   * @param {Object} order - Order to validate
   * @param {Object} machine - Machine to schedule on
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validateOrderScheduling = useCallback((order, machine, startTime, endTime) => {
    const errors = {};

    if (!order) {
      errors.general = 'Order is required';
      return { isValid: false, errors };
    }

    if (!machine) {
      errors.general = 'Machine is required';
      return { isValid: false, errors };
    }

    if (!startTime || !endTime) {
      errors.general = 'Start and end times are required';
      return { isValid: false, errors };
    }

    // Check if machine is active
    if (machine.status !== 'ACTIVE') {
      errors.general = `Machine ${machine.machine_name} is not active`;
    }

    // Check if order is already scheduled
    if (order.scheduled_machine_id && order.scheduled_machine_id !== machine.id) {
      errors.general = 'Order is already scheduled on a different machine';
    }

    // Check if order has required phase
    if (!order.fase) {
      errors.general = 'Order must have a production phase selected';
    }

    // Check if order has required parameters
    if (!order.quantity || order.quantity <= 0) {
      errors.general = 'Order must have a valid quantity';
    }

    if (!order.duration || order.duration <= 0) {
      errors.general = 'Order must have calculated duration';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }, []);

  /**
   * Validate phase selection for order
   * @param {Object} phase - Phase to validate
   * @param {Object} order - Order context
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validatePhaseSelection = useCallback((phase, order) => {
    const errors = {};

    if (!phase) {
      errors.general = 'Please select a production phase';
      return { isValid: false, errors };
    }

    // Check department compatibility
    if (order.department && phase.department !== order.department) {
      errors.general = `Selected phase is for ${phase.department} department, but order is for ${order.department}`;
    }

    // Check work center compatibility
    if (order.work_center && phase.work_center !== order.work_center) {
      errors.general = `Selected phase is for ${phase.work_center} work center, but order is for ${order.work_center}`;
    }

    // Validate phase data
    const phaseValidation = validatePhase(phase);
    if (!phaseValidation.isValid) {
      Object.assign(errors, phaseValidation.errors);
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }, [validatePhase]);

  /**
   * Check if machine is available for scheduling
   * @param {Object} machine - Machine to check
   * @param {Date} date - Date to check availability for
   * @returns {boolean} True if machine is available
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

  /**
   * Get machine display information
   * @param {Object} machine - Machine object
   * @returns {Object} Display information
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

  return {
    // Core validation functions
    validate,
    validateMachine,
    validatePhase,
    validateOrder,
    validateOffTime,
    validateAuth,
    
    // Business logic validation
    validateMachineDeletion,
    validateOrderDeletion,
    validateOrderScheduling,
    validatePhaseSelection,
    
    // Utility functions
    isMachineAvailable,
    getMachineDisplayInfo
  };
};

export default useValidation;
