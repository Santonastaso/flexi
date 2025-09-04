import { toast } from 'sonner';

/**
 * Streamlined toast notification system using Sonner
 * Replaces the complex alert system with simple, modern toast notifications
 */

// Toast types mapping
const TOAST_TYPES = {
  success: 'success',
  error: 'error', 
  warning: 'warning',
  info: 'info'
};

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, warning, info)
 * @param {Object} options - Additional options for the toast
 */
export const showToast = (message, type = 'info', options = {}) => {
  const toastType = TOAST_TYPES[type] || 'info';
  
  const defaultOptions = {
    duration: type === 'error' ? 6000 : 4000, // Errors stay longer
    position: 'top-right',
    ...options
  };

  switch (toastType) {
    case 'success':
      toast.success(message, defaultOptions);
      break;
    case 'error':
      toast.error(message, defaultOptions);
      break;
    case 'warning':
      toast.warning(message, defaultOptions);
      break;
    case 'info':
    default:
      toast.info(message, defaultOptions);
      break;
  }
};

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

/**
 * Show a success toast
 * @param {string} message - Success message
 */
export const showSuccess = (message) => {
  toast.success(message);
};

/**
 * Show an error toast
 * @param {string} message - Error message
 */
export const showError = (message) => {
  toast.error(message, { duration: 6000 });
};

/**
 * Show a warning toast
 * @param {string} message - Warning message
 */
export const showWarning = (message) => {
  toast.warning(message);
};

/**
 * Show an info toast
 * @param {string} message - Info message
 */
export const showInfo = (message) => {
  toast.info(message);
};

/**
 * Dismiss all toasts
 */
export const dismissAll = () => {
  toast.dismiss();
};

/**
 * Dismiss a specific toast
 * @param {string} toastId - The toast ID to dismiss
 */
export const dismiss = (toastId) => {
  toast.dismiss(toastId);
};
