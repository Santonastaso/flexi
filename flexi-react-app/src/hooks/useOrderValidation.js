import { useCallback } from 'react';

/**
 * Custom hook for order validation logic
 * Replaces imperative validation methods with React-idiomatic patterns
 */
export const useOrderValidation = () => {
  
  /**
   * Validate ODP order data before saving
   */
  const validateOrder = useCallback((order) => {
    const errors = [];

    // Required field validation
    if (!order.odp_number?.trim()) {
      errors.push('ODP Number is required');
    }

    if (!order.article_code?.trim()) {
      errors.push('Article Code is required');
    }

    if (!order.production_lot?.trim()) {
      errors.push('External Article Code is required');
    }

    if (!order.bag_height || parseFloat(order.bag_height) <= 0) {
      errors.push('Bag Height must be greater than 0');
    }

    if (!order.bag_width || parseFloat(order.bag_width) <= 0) {
      errors.push('Bag Width must be greater than 0');
    }

    if (!order.bag_step || parseFloat(order.bag_step) <= 0) {
      errors.push('Bag Step must be greater than 0');
    }

    if (!order.product_type) {
      errors.push('Product Type is required');
    }

    if (!order.quantity || parseFloat(order.quantity) <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (!order.delivery_date) {
      errors.push('Delivery Date is required');
    }

    // Logical validations
    if (order.bag_width !== undefined && order.bag_step !== undefined) {
      if (parseFloat(order.bag_width) < parseFloat(order.bag_step)) {
        errors.push('Bag width cannot be less than bag step');
      }
    }

    // Quantity validations
    if (order.quantity_completed !== undefined) {
      if (order.quantity_completed < 0) {
        errors.push('Quantity completed cannot be negative');
      }
      
      if (order.quantity && order.quantity_completed > parseFloat(order.quantity)) {
        errors.push('Quantity completed cannot exceed total quantity');
      }
    }

    // Date validations
    if (order.delivery_date && order.scheduled_start_time) {
      const deliveryDate = new Date(order.delivery_date);
      const startDate = new Date(order.scheduled_start_time);
      
      if (startDate > deliveryDate) {
        errors.push('Production start cannot be after delivery date');
      }
    }

    return errors;
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

    // Check if phase has required parameters
    if (phase.department === 'STAMPA') {
      if (!phase.v_stampa || phase.v_stampa <= 0) {
        errors.push('Selected printing phase has invalid speed parameter');
      }
      if (phase.t_setup_stampa < 0) {
        errors.push('Selected printing phase has invalid setup time');
      }
      if (phase.costo_h_stampa < 0) {
        errors.push('Selected printing phase has invalid cost parameter');
      }
    }

    if (phase.department === 'CONFEZIONAMENTO') {
      if (!phase.v_conf || phase.v_conf <= 0) {
        errors.push('Selected packaging phase has invalid speed parameter');
      }
      if (phase.t_setup_conf < 0) {
        errors.push('Selected packaging phase has invalid setup time');
      }
      if (phase.costo_h_conf < 0) {
        errors.push('Selected packaging phase has invalid cost parameter');
      }
    }

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
