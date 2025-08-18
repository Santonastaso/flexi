import { validation } from '../utils';

/**
 * Custom hook for phase validation logic
 * Uses consolidated validation system to eliminate duplication
 */
export const usePhaseValidation = () => {
  /**
   * Validates a phase object and returns an array of error messages
   * @param {Object} phase - The phase object to validate
   * @returns {Array} Array of error messages (empty if valid)
   */
  const validatePhase = (phase) => {
    // Use the consolidated validation system
    const errors = validation.validateAll(phase, validation.VALIDATION_CONFIGS.PHASE);
    
    // Convert object errors to array format for backward compatibility
    return Object.values(errors);
  };

  /**
   * Validates form data and returns an object with field-specific errors
   * @param {Object} formData - The form data to validate
   * @returns {Object} Object with field names as keys and error messages as values
   */
  const validateForm = (formData) => {
    // Use the consolidated validation system
    return validation.validateAll(formData, validation.VALIDATION_CONFIGS.PHASE);
  };

  return {
    validatePhase,
    validateForm
  };
};

export default usePhaseValidation;
