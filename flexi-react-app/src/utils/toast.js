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
  const errorMessage = Array.isArray(errors) 
    ? `Errori di validazione:\n${errors.join('\n')}`
    : errors;
  
  toast.error(errorMessage, {
    duration: 8000, // Validation errors stay longer
    position: 'top-right'
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
