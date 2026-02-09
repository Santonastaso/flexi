/**
 * Simplified Error Handling with Sentry Integration
 * Replaces the complex custom error system with Sentry-based monitoring
 */

import { reportError, addBreadcrumb } from '../services/sentry';
import { showError } from './toast';

// Simple error types for user-friendly messages
export const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

// User-friendly error messages
const ERROR_MESSAGES = {
  [ERROR_TYPES.VALIDATION_ERROR]: 'I dati inseriti non sono validi. Controlla i campi evidenziati.',
  [ERROR_TYPES.NETWORK_ERROR]: 'Errore di connessione. Verifica la tua connessione internet.',
  [ERROR_TYPES.AUTHENTICATION_ERROR]: 'Sessione scaduta. Effettua nuovamente l\'accesso.',
  [ERROR_TYPES.AUTHORIZATION_ERROR]: 'Non hai i permessi per eseguire questa operazione.',
  [ERROR_TYPES.NOT_FOUND_ERROR]: 'La risorsa richiesta non è stata trovata.',
  [ERROR_TYPES.SERVER_ERROR]: 'Errore del server. Riprova più tardi.',
  [ERROR_TYPES.BUSINESS_LOGIC_ERROR]: 'Operazione non consentita dalle regole di business.',
  [ERROR_TYPES.UNKNOWN_ERROR]: 'Si è verificato un errore imprevisto.',
};

/**
 * Enhanced AppError class with Sentry integration
 */
export class AppError extends Error {
  constructor(message, type = ERROR_TYPES.UNKNOWN_ERROR, statusCode = 500, context = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.userMessage = ERROR_MESSAGES[type] || ERROR_MESSAGES[ERROR_TYPES.UNKNOWN_ERROR];
  }

  toJSON() {
    return {
      message: this.message,
      type: this.type,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      userMessage: this.userMessage,
    };
  }
}

/**
 * Handle API errors with Sentry reporting
 */
export const handleApiError = (error, context = {}) => {
  // Add breadcrumb for debugging
  addBreadcrumb('API Error occurred', 'api', 'error', {
    error: error.message,
    context,
  });

  // Report to Sentry
  reportError(error, {
    type: 'api_error',
    ...context,
  });

  // Determine error type and user message
  let errorType = ERROR_TYPES.UNKNOWN_ERROR;
  let userMessage = ERROR_MESSAGES[ERROR_TYPES.UNKNOWN_ERROR];

  if (error.response) {
    const status = error.response.status;
    switch (status) {
      case 400:
        errorType = ERROR_TYPES.VALIDATION_ERROR;
        break;
      case 401:
        errorType = ERROR_TYPES.AUTHENTICATION_ERROR;
        break;
      case 403:
        errorType = ERROR_TYPES.AUTHORIZATION_ERROR;
        break;
      case 404:
        errorType = ERROR_TYPES.NOT_FOUND_ERROR;
        break;
      case 500:
      case 502:
      case 503:
        errorType = ERROR_TYPES.SERVER_ERROR;
        break;
      default:
        errorType = ERROR_TYPES.NETWORK_ERROR;
    }
  } else if (error.request) {
    errorType = ERROR_TYPES.NETWORK_ERROR;
  }

  userMessage = ERROR_MESSAGES[errorType];

  // Show user-friendly error
  showError(userMessage);

  return new AppError(error.message, errorType, error.response?.status, context);
};

/**
 * Safe async wrapper with error handling
 */
export const safeAsync = async (asyncFn, context = {}) => {
  try {
    return await asyncFn();
  } catch (error) {
    return handleApiError(error, context);
  }
};

