/**
 * Legacy validation utilities - now replaced by Yup schemas
 * This file is kept for backward compatibility but delegates to yupSchemas
 */

export { validateData, SCHEMAS } from './yupSchemas';



// Legacy validation functions - kept for backward compatibility
// These are now replaced by Yup schemas but kept for any remaining usage

export const isNotEmpty = (value) => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
};

export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default {
  isNotEmpty,
  isValidEmail
};
