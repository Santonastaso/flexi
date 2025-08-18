/**
 * Utility functions for common validation patterns
 * Pure functions that can be used anywhere in the application
 */

// ===== VALIDATION SCHEMAS =====
export const VALIDATION_SCHEMAS = {
  // Department-specific validation rules
  PHASE: {
    STAMPA: {
      v_stampa: { min: 0, message: 'Printing speed must be greater than 0' },
      t_setup_stampa: { min: 0, message: 'Setup time cannot be negative' },
      costo_h_stampa: { min: 0, message: 'Hourly cost cannot be negative' }
    },
    CONFEZIONAMENTO: {
      v_conf: { min: 0, message: 'Packaging speed must be greater than 0' },
      t_setup_conf: { min: 0, message: 'Setup time cannot be negative' },
      costo_h_conf: { min: 0, message: 'Hourly cost cannot be negative' }
    }
  },
  
  // Machine validation rules
  MACHINE: {
    min_web_width: { min: 0, message: 'Minimum web width cannot be negative' },
    max_web_width: { min: 0, message: 'Maximum web width cannot be negative' },
    min_bag_height: { min: 0, message: 'Minimum bag height cannot be negative' },
    max_bag_height: { min: 0, message: 'Maximum bag height cannot be negative' },
    standard_speed: { min: 0, message: 'Standard speed cannot be negative' },
    setup_time_standard: { min: 0, message: 'Setup time cannot be negative' },
    changeover_color: { min: 0, message: 'Color changeover time cannot be negative' },
    changeover_material: { min: 0, message: 'Material changeover time cannot be negative' }
  },
  
  // Order validation rules
  ORDER: {
    bag_height: { min: 0, message: 'Bag height must be greater than 0' },
    bag_width: { min: 0, message: 'Bag width must be greater than 0' },
    bag_step: { min: 0, message: 'Bag step must be greater than 0' },
    quantity: { min: 0, message: 'Quantity must be greater than 0' },
    quantity_per_box: { min: 0, message: 'Quantity per box cannot be negative' },
    quantity_completed: { min: 0, message: 'Quantity completed cannot be negative' }
  }
};

// ===== GENERIC VALIDATION FUNCTIONS =====

/**
 * Validate required fields and return field-specific errors
 * @param {Object} data - The data object to validate
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} Object with field names as keys and error messages as values
 */
export const validateRequiredFields = (data, requiredFields) => {
  const errors = {};
  requiredFields.forEach(field => {
    if (!isNotEmpty(data[field])) {
      // Convert field name to user-friendly label
      const label = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      errors[field] = `${label} is required`;
    }
  });
  return errors;
};

/**
 * Validate numeric fields against a schema
 * @param {Object} data - The data object to validate
 * @param {Object} schema - Validation schema with field rules
 * @returns {Object} Object with field names as keys and error messages as values
 */
export const validateNumericFields = (data, schema) => {
  const errors = {};
  Object.entries(schema).forEach(([field, rules]) => {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      if (!isValidNumber(data[field], rules.min, rules.max)) {
        errors[field] = rules.message;
      }
    }
  });
  return errors;
};

/**
 * Validate department-specific fields
 * @param {Object} data - The data object to validate
 * @param {string} department - The department to validate against
 * @param {string} schemaType - The schema type (e.g., 'PHASE')
 * @returns {Object} Object with field names as keys and error messages as values
 */
export const validateDepartmentFields = (data, department, schemaType = 'PHASE') => {
  const schema = VALIDATION_SCHEMAS[schemaType]?.[department];
  if (!schema) return {};
  
  return validateNumericFields(data, schema);
};

/**
 * Validate logical relationships between fields
 * @param {Object} data - The data object to validate
 * @param {Array} logicalRules - Array of logical validation rules
 * @returns {Object} Object with field names as keys and error messages as values
 */
export const validateLogicalRelations = (data, logicalRules) => {
  const errors = {};
  logicalRules.forEach(rule => {
    const { condition, errorField, message } = rule;
    if (condition(data)) {
      errors[errorField] = message;
    }
  });
  return errors;
};

/**
 * Comprehensive validation function that combines all validation types
 * @param {Object} data - The data object to validate
 * @param {Object} validationConfig - Configuration object for validation
 * @returns {Object} Object with field names as keys and error messages as values
 */
export const validateAll = (data, validationConfig) => {
  const errors = {};
  
  // Required fields
  if (validationConfig.required) {
    Object.assign(errors, validateRequiredFields(data, validationConfig.required));
  }
  
  // Numeric fields
  if (validationConfig.numeric) {
    Object.assign(errors, validateNumericFields(data, validationConfig.numeric));
  }
  
  // Department-specific fields
  if (validationConfig.department && data.department) {
    Object.assign(errors, validateDepartmentFields(data, data.department, validationConfig.departmentSchema));
  }
  
  // Logical relationships
  if (validationConfig.logical) {
    Object.assign(errors, validateLogicalRelations(data, validationConfig.logical));
  }
  
  return errors;
};

// ===== PREDEFINED VALIDATION CONFIGS =====

export const VALIDATION_CONFIGS = {
  // Phase validation configuration
  PHASE: {
    required: ['name', 'department', 'work_center'],
    numeric: {
      numero_persone: { min: 1, message: 'Number of people must be at least 1' }
    },
    departmentSchema: 'PHASE',
    logical: [
      {
        condition: (data) => data.bag_width && data.bag_step && parseFloat(data.bag_width) < parseFloat(data.bag_step),
        errorField: 'bag_width',
        message: 'Bag width cannot be less than bag step'
      }
    ]
  },
  
  // Machine validation configuration
  MACHINE: {
    required: ['machine_name', 'machine_type', 'department', 'work_center'],
    numeric: VALIDATION_SCHEMAS.MACHINE,
    logical: [
      {
        condition: (data) => data.min_web_width && data.max_web_width && parseFloat(data.min_web_width) > parseFloat(data.max_web_width),
        errorField: 'min_web_width',
        message: 'Minimum web width cannot exceed maximum web width'
      },
      {
        condition: (data) => data.min_bag_height && data.max_bag_height && parseFloat(data.min_bag_height) > parseFloat(data.max_bag_height),
        errorField: 'min_bag_height',
        message: 'Minimum bag height cannot exceed maximum bag height'
      }
    ]
  },
  
  // Order validation configuration
  ORDER: {
    required: ['odp_number', 'article_code', 'production_lot', 'bag_height', 'bag_width', 'bag_step', 'product_type', 'quantity', 'delivery_date'],
    numeric: VALIDATION_SCHEMAS.ORDER,
    logical: [
      {
        condition: (data) => data.bag_width && data.bag_step && parseFloat(data.bag_width) < parseFloat(data.bag_step),
        errorField: 'bag_width',
        message: 'Bag width cannot be less than bag step'
      },
      {
        condition: (data) => data.quantity && data.quantity_completed && parseFloat(data.quantity_completed) > parseFloat(data.quantity),
        errorField: 'quantity_completed',
        message: 'Quantity completed cannot exceed total quantity'
      },
      {
        condition: (data) => data.delivery_date && data.scheduled_start_time && new Date(data.scheduled_start_time) > new Date(data.delivery_date),
        errorField: 'scheduled_start_time',
        message: 'Production start cannot be after delivery date'
      }
    ]
  }
};

// ===== EXISTING VALIDATION FUNCTIONS (KEPT FOR BACKWARD COMPATIBILITY) =====

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
  // New consolidated validation functions
  validateRequiredFields,
  validateNumericFields,
  validateDepartmentFields,
  validateLogicalRelations,
  validateAll,
  VALIDATION_CONFIGS,
  VALIDATION_SCHEMAS,
  
  // Existing validation functions
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
