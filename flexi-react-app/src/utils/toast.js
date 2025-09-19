import { toast } from 'sonner';

/**
 * Simplified toast notification system using Sonner directly
 * Removes unnecessary wrapper functions and uses library features directly
 */

/**
 * Show a validation error toast with formatted error messages
 * @param {string|Array} errors - Error message(s) to display
 */
export const showValidationError = (errors) => {
  if (!errors || (Array.isArray(errors) && errors.length === 0)) {
    return;
  }
  
  let errorMessage;
  
  if (Array.isArray(errors)) {
    // Filter out empty errors and format nicely
    const validErrors = errors.filter(error => error && error.trim().length > 0);
    
    if (validErrors.length === 0) {
      return;
    }
    
    if (validErrors.length === 1) {
      errorMessage = validErrors[0];
    } else {
      errorMessage = `Ci sono ${validErrors.length} errori di validazione:\n\n• ${validErrors.join('\n• ')}`;
    }
  } else {
    errorMessage = errors;
  }
  
  toast.error(errorMessage, {
    duration: 10000, // Validation errors stay longer
    position: 'top-right',
    style: {
      maxWidth: '400px',
      whiteSpace: 'pre-line'
    }
  });
};

// Re-export sonner functions directly for consistency
export const showToast = toast;
export const showSuccess = toast.success;
export const showError = toast.error;
export const showWarning = toast.warning;
export const showInfo = toast.info;
export const dismissAll = toast.dismiss;
export const dismiss = toast.dismiss;
