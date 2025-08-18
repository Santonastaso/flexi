import { validation } from '../utils';

/**
 * Custom hook for phase validation logic
 * Centralizes all phase-related validation rules
 */
export const usePhaseValidation = () => {
  /**
   * Validates a phase object and returns an array of error messages
   * @param {Object} phase - The phase object to validate
   * @returns {Array} Array of error messages (empty if valid)
   */
  const validatePhase = (phase) => {
    const errors = [];

    // Required field validation using utility functions
    if (!validation.isNotEmpty(phase.name)) {
      errors.push('Phase name is required');
    }

    if (!validation.isValidDepartment(phase.department)) {
      errors.push('Department is required');
    }

    if (!validation.isValidWorkCenter(phase.work_center)) {
      errors.push('Work center is required');
    }

    if (!validation.isValidInteger(phase.numero_persone, 1)) {
      errors.push('Number of people must be at least 1');
    }

    // Department-specific validation for STAMPA
    if (phase.department === 'STAMPA') {
      if (!validation.isValidNumber(phase.v_stampa, 0)) {
        errors.push('Printing speed must be greater than 0');
      }
      if (!validation.isValidNumber(phase.t_setup_stampa, 0)) {
        errors.push('Setup time cannot be negative');
      }
      if (!validation.isValidNumber(phase.costo_h_stampa, 0)) {
        errors.push('Hourly cost cannot be negative');
      }
    }

    // Department-specific validation for CONFEZIONAMENTO
    if (phase.department === 'CONFEZIONAMENTO') {
      if (!validation.isValidNumber(phase.v_conf, 0)) {
        errors.push('Packaging speed must be greater than 0');
      }
      if (!validation.isValidNumber(phase.t_setup_conf, 0)) {
        errors.push('Setup time cannot be negative');
      }
      if (!validation.isValidNumber(phase.costo_h_conf, 0)) {
        errors.push('Hourly cost cannot be negative');
      }
    }

    return errors;
  };

  /**
   * Validates form data and returns an object with field-specific errors
   * @param {Object} formData - The form data to validate
   * @returns {Object} Object with field names as keys and error messages as values
   */
  const validateForm = (formData) => {
    const errors = {};

    // Required field validation using utility functions
    if (!validation.isNotEmpty(formData.name)) {
      errors.name = 'Phase name is required';
    }

    if (!validation.isValidDepartment(formData.department)) {
      errors.department = 'Department is required';
    }

    if (!validation.isValidWorkCenter(formData.work_center)) {
      errors.work_center = 'Work center is required';
    }

    if (!validation.isValidInteger(formData.numero_persone, 1)) {
      errors.numero_persone = 'Number of people must be at least 1';
    }

    // Department-specific validation for STAMPA
    if (formData.department === 'STAMPA') {
      if (!validation.isValidNumber(formData.v_stampa, 0)) {
        errors.v_stampa = 'Printing speed must be greater than 0';
      }
      if (!validation.isValidNumber(formData.t_setup_stampa, 0)) {
        errors.t_setup_stampa = 'Setup time cannot be negative';
      }
      if (!validation.isValidNumber(formData.costo_h_stampa, 0)) {
        errors.costo_h_stampa = 'Hourly cost cannot be negative';
      }
    }

    // Department-specific validation for CONFEZIONAMENTO
    if (formData.department === 'CONFEZIONAMENTO') {
      if (!validation.isValidNumber(formData.v_conf, 0)) {
        errors.v_conf = 'Packaging speed must be greater than 0';
      }
      if (!validation.isValidNumber(formData.t_setup_conf, 0)) {
        errors.t_setup_conf = 'Setup time cannot be negative';
      }
      if (!validation.isValidNumber(formData.costo_h_conf, 0)) {
        errors.costo_h_conf = 'Hourly cost cannot be negative';
      }
    }

    return errors;
  };

  return {
    validatePhase,
    validateForm
  };
};

export default usePhaseValidation;
