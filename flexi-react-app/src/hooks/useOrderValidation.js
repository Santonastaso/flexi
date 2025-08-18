import { useCallback } from 'react';
import { validation } from '../utils';

/**
 * Custom hook for order validation logic
 * Uses consolidated validation system to eliminate duplication
 */
export const useOrderValidation = () => {
  
  /**
   * Validate ODP order data before saving
   */
  const validateOrder = useCallback((order) => {
    // Use the consolidated validation system
    const errors = validation.validateAll(order, validation.VALIDATION_CONFIGS.ORDER);
    
    // Convert object errors to array format for backward compatibility
    return Object.values(errors);
  }, []);

  /**
   * Validate phase selection for order
   */
  const validatePhaseSelection = useCallback((phase, order) => {
    const errors = [];

    if (!phase) {
      errors.push('Please select a production phase');
      return errors;
    }

    // Check department compatibility
    if (order.department && phase.department !== order.department) {
      errors.push(`Selected phase is for ${phase.department} department, but order is for ${order.department}`);
    }

    // Check work center compatibility
    if (order.work_center && phase.work_center !== order.work_center) {
      errors.push(`Selected phase is for ${phase.work_center} work center, but order is for ${order.work_center}`);
    }

    // Check if phase has required parameters using the validation schema
    const phaseErrors = validation.validateDepartmentFields(phase, phase.department, 'PHASE');
    Object.values(phaseErrors).forEach(error => errors.push(error));

    return errors;
  }, []);

  /**
   * Validate order can be scheduled
   */
  const validateOrderScheduling = useCallback((order, machine, startTime, endTime) => {
    const errors = [];

    if (!order) {
      errors.push('Order is required');
      return errors;
    }

    if (!machine) {
      errors.push('Machine is required');
      return errors;
    }

    if (!startTime || !endTime) {
      errors.push('Start and end times are required');
      return errors;
    }

    // Check if machine is active
    if (machine.status !== 'ACTIVE') {
      errors.push(`Machine ${machine.machine_name} is not active`);
    }

    // Check if order is already scheduled
    if (order.scheduled_machine_id && order.scheduled_machine_id !== machine.id) {
      errors.push('Order is already scheduled on a different machine');
    }

    // Check if order has required phase
    if (!order.fase) {
      errors.push('Order must have a production phase selected');
    }

    // Check if order has required parameters
    if (!order.quantity || order.quantity <= 0) {
      errors.push('Order must have a valid quantity');
    }

    if (!order.duration || order.duration <= 0) {
      errors.push('Order must have calculated duration');
    }

    return errors;
  }, []);

  /**
   * Validate order can be deleted
   */
  const validateOrderDeletion = useCallback((order) => {
    const errors = [];

    if (!order) {
      errors.push('Order is required');
      return errors;
    }

    // Check if order is in progress
    if (order.quantity_completed > 0) {
      errors.push('Cannot delete order that has started production');
    }

    // Check if order is scheduled
    if (order.scheduled_machine_id) {
      errors.push('Cannot delete scheduled order. Please unschedule first.');
    }

    return errors;
  }, []);

  return {
    validateOrder,
    validatePhaseSelection,
    validateOrderScheduling,
    validateOrderDeletion
  };
};

export default useOrderValidation;
