/**
 * Utility functions for common validation patterns
 * Pure functions that can be used anywhere in the application
 */

/**
 * Check if value is not empty (string, array, object)
 */
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

/**
 * Check if value is a valid email
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Check if value is a valid phone number
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Check if value is a valid date
 */
export const isValidDate = (date) => {
  if (!date) return false;
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
};

/**
 * Check if value is a valid number within range
 */
export const isValidNumber = (value, min = null, max = null) => {
  if (typeof value !== 'number' || isNaN(value)) return false;
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
};

/**
 * Check if value is a valid integer
 */
export const isValidInteger = (value, min = null, max = null) => {
  if (!Number.isInteger(value)) return false;
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
};

/**
 * Check if value is a valid URL
 */
export const isValidUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if value matches a specific pattern
 */
export const matchesPattern = (value, pattern) => {
  if (!value || !pattern) return false;
  if (typeof pattern === 'string') {
    return new RegExp(pattern).test(value);
  }
  if (pattern instanceof RegExp) {
    return pattern.test(value);
  }
  return false;
};

/**
 * Check if value has minimum length
 */
export const hasMinLength = (value, minLength) => {
  if (!value || typeof value !== 'string') return false;
  return value.length >= minLength;
};

/**
 * Check if value has maximum length
 */
export const hasMaxLength = (value, maxLength) => {
  if (!value || typeof value !== 'string') return false;
  return value.length <= maxLength;
};

/**
 * Check if value is within a specific range
 */
export const isInRange = (value, min, max) => {
  if (typeof value !== 'number' || isNaN(value)) return false;
  return value >= min && value <= max;
};

/**
 * Check if value is a valid machine name
 */
export const isValidMachineName = (name) => {
  if (!name || typeof name !== 'string') return false;
  // Machine names should be 2-100 characters, alphanumeric + spaces + hyphens
  const machineNameRegex = /^[a-zA-Z0-9\s\-_]{2,100}$/;
  return machineNameRegex.test(name.trim());
};

/**
 * Check if value is a valid ODP number
 */
export const isValidOdpNumber = (odpNumber) => {
  if (!odpNumber || typeof odpNumber !== 'string') return false;
  // ODP numbers should be alphanumeric, 3-20 characters
  const odpRegex = /^[a-zA-Z0-9]{3,20}$/;
  return odpRegex.test(odpNumber.trim());
};

/**
 * Check if value is a valid article code
 */
export const isValidArticleCode = (articleCode) => {
  if (!articleCode || typeof articleCode !== 'string') return false;
  // Article codes should be alphanumeric + hyphens, 3-50 characters
  const articleRegex = /^[a-zA-Z0-9\-]{3,50}$/;
  return articleRegex.test(articleCode.trim());
};

/**
 * Check if value is a valid work center
 */
export const isValidWorkCenter = (workCenter) => {
  const validWorkCenters = ['ZANICA', 'BUSTO_GAROLFO'];
  return validWorkCenters.includes(workCenter);
};

/**
 * Check if value is a valid department
 */
export const isValidDepartment = (department) => {
  const validDepartments = ['STAMPA', 'CONFEZIONAMENTO'];
  return validDepartments.includes(department);
};

/**
 * Check if value is a valid machine status
 */
export const isValidMachineStatus = (status) => {
  const validStatuses = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
  return validStatuses.includes(status);
};

/**
 * Check if value is a valid product type
 */
export const isValidProductType = (productType) => {
  const validTypes = ['crema', 'liquido', 'polveri'];
  return validTypes.includes(productType);
};

/**
 * Check if value is a valid seal sides count
 */
export const isValidSealSides = (sealSides) => {
  const validSides = ['3', '4'];
  return validSides.includes(sealSides);
};

/**
 * Validate form data against a schema
 */
export const validateFormData = (data, schema) => {
  const errors = {};
  
  Object.keys(schema).forEach(field => {
    const value = data[field];
    const rules = schema[field];
    
    if (rules.required && !isNotEmpty(value)) {
      errors[field] = rules.required;
    } else if (value && rules.pattern && !matchesPattern(value, rules.pattern)) {
      errors[field] = rules.pattern;
    } else if (value && rules.minLength && !hasMinLength(value, rules.minLength)) {
      errors[field] = rules.minLength;
    } else if (value && rules.maxLength && !hasMaxLength(value, rules.maxLength)) {
      errors[field] = rules.maxLength;
    } else if (value && rules.min !== undefined && !isInRange(value, rules.min, rules.max || Infinity)) {
      errors[field] = rules.min;
    } else if (value && rules.custom) {
      const customError = rules.custom(value, data);
      if (customError) {
        errors[field] = customError;
      }
    }
  });
  
  return errors;
};

export default {
  isNotEmpty,
  isValidEmail,
  isValidPhone,
  isValidDate,
  isValidNumber,
  isValidInteger,
  isValidUrl,
  matchesPattern,
  hasMinLength,
  hasMaxLength,
  isInRange,
  isValidMachineName,
  isValidOdpNumber,
  isValidArticleCode,
  isValidWorkCenter,
  isValidDepartment,
  isValidMachineStatus,
  isValidProductType,
  isValidSealSides,
  validateFormData
};
