/**
 * Sentry Configuration
 * Replaces custom error handling with professional error monitoring
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Initialize Sentry
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  // Only initialize Sentry if DSN is provided
  if (!dsn) {
    console.log('Sentry not initialized: VITE_SENTRY_DSN not provided');
    return;
  }
  
  Sentry.init({
    dsn: dsn,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      new BrowserTracing({
        // Set sampling rate for performance monitoring
        tracingOrigins: ['localhost', '127.0.0.1', /^\//],
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    // Error Sampling
    sampleRate: 1.0,
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    // User context
    beforeSend(event) {
      // Filter out development errors in production
      if (import.meta.env.MODE === 'production' && event.exception) {
        const error = event.exception.values?.[0];
        if (error?.value?.includes('ResizeObserver loop limit exceeded')) {
          return null; // Ignore this common browser error
        }
      }
      return event;
    },
  });
};

// Enhanced error reporting with context
export const reportError = (error, context = {}) => {
  // Check if Sentry is initialized
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.warn('Sentry not configured, error not reported:', error);
    return;
  }
  
  Sentry.withScope((scope) => {
    // Add context
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });
    
    // Add user info if available
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.id) {
      scope.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    }
    
    // Capture the error
    Sentry.captureException(error);
  });
};

// Performance monitoring (using newer Sentry API)
export const startSpan = (name, op = 'navigation', callback) => {
  return Sentry.startSpan({ name, op }, callback);
};

// Breadcrumb logging for better debugging
export const addBreadcrumb = (message, category = 'user', level = 'info', data = {}) => {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return; // Skip if Sentry not configured
  }
  
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
};

// User context management
export const setUserContext = (user) => {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return; // Skip if Sentry not configured
  }
  
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
};

// Clear user context (on logout)
export const clearUserContext = () => {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return; // Skip if Sentry not configured
  }
  
  Sentry.setUser(null);
};

export default Sentry;
