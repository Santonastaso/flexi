import { useCallback } from 'react';
import { validateData, SCHEMAS } from '../utils/yupSchemas';

/**
 * Unified validation hook
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
   * Validate order/backlog data
   * @param {Object} order - Order data to validate
   * @returns {Object} { isValid: boolean, errors: Object }
   */
  const validateOrder = useCallback((order) => {
    return validate(order, 'ORDER');
  }, [validate]);

  return {
    validate,
    validateOrder,
  };
};

export default useValidation;
