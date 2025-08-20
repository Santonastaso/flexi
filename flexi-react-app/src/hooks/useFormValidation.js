import { useForm } from 'react-hook-form';
import { validateAll, VALIDATION_CONFIGS } from '../utils/validation';

/**
 * Custom hook that integrates React Hook Form with existing validation logic
 * @param {string} formType - The type of form (e.g., 'MACHINE', 'PHASE', 'ORDER')
 * @param {Object} defaultValues - Default values for the form
 * @param {Function} onSubmit - Function to call when form is submitted
 * @returns {Object} React Hook Form methods and form state
 */
export const useFormValidation = (formType, defaultValues = {}, onSubmit) => {
  const validationConfig = VALIDATION_CONFIGS[formType];
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    watch,
    setValue,
    reset,
    trigger,
    getValues,
    setError,
    clearErrors
  } = useForm({
    defaultValues,
    mode: 'onChange', // Validate on change for better UX
    resolver: async (values) => {
      if (!validationConfig) {
        return { values, errors: {} };
      }

      // Use existing validation logic
      const validationErrors = validateAll(values, validationConfig);
      
      // Convert validation errors to React Hook Form format
      const formattedErrors = {};
      Object.entries(validationErrors).forEach(([field, message]) => {
        formattedErrors[field] = {
          type: 'validation',
          message
        };
      });

      return {
        values,
        errors: formattedErrors
      };
    }
  });

  // Enhanced submit handler with error handling
  const handleFormSubmit = handleSubmit(async (data) => {
    try {
      if (onSubmit) {
        await onSubmit(data);
        reset(); // Reset form on successful submission
      }
    } catch (error) {
      console.error('Form submission failed:', error);
      // Set form-level error if needed
      setError('root', {
        type: 'submit',
        message: error.message || 'Form submission failed'
      });
    }
  });

  // Helper function to register a field with validation
  const registerField = (name, options = {}) => {
    return register(name, {
      required: validationConfig?.required?.includes(name) ? 'This field is required' : false,
      ...options
    });
  };

  // Helper function to get field error
  const getFieldError = (name) => {
    return errors[name];
  };

  // Helper function to check if field has error
  const hasFieldError = (name) => {
    return !!errors[name];
  };

  // Helper function to get error message
  const getErrorMessage = (name) => {
    const error = errors[name];
    return error?.message || '';
  };

  return {
    // React Hook Form methods
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting, isValid },
    watch,
    setValue,
    reset,
    trigger,
    getValues,
    setError,
    clearErrors,
    
    // Enhanced methods
    registerField,
    getFieldError,
    hasFieldError,
    getErrorMessage,
    
    // Validation config
    validationConfig
  };
};
