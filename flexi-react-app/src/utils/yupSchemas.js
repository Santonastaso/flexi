import * as yup from 'yup';

// ===== BASE SCHEMAS =====

// Common field validations
const requiredString = yup.string().required('This field is required');
const requiredNumber = yup.number().required('This field is required').min(0, 'Value must be at least 0');
const optionalNumber = yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).min(0, 'Value must be at least 0');

// Shared validation functions
const bagWidthStepValidation = (value) => {
  if (value.bag_width && value.bag_step) {
    return value.bag_width >= value.bag_step;
  }
  return true;
};

// ===== MACHINE SCHEMA =====
export const machineSchema = yup.object({
  machine_name: requiredString
    .min(2, 'Machine name must be at least 2 characters')
    .max(100, 'Machine name must be at most 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/, 'Machine name can only contain letters, numbers, spaces, hyphens, and underscores'),
  
  machine_type: requiredString,
  department: requiredString.oneOf(['STAMPA', 'CONFEZIONAMENTO'], 'Invalid department'),
  work_center: requiredString.oneOf(['ZANICA', 'BUSTO_GAROLFO'], 'Invalid work center'),
  status: requiredString.oneOf(['ACTIVE', 'INACTIVE'], 'Invalid status'),
  
  // Numeric fields
  min_web_width: optionalNumber,
  max_web_width: optionalNumber,
  min_bag_height: optionalNumber,
  max_bag_height: optionalNumber,
  standard_speed: optionalNumber,
  setup_time_standard: optionalNumber,
  changeover_color: optionalNumber,
  changeover_material: optionalNumber,
  
  // Array fields
  active_shifts: yup.array().of(yup.string().oneOf(['T1', 'T2', 'T3'])),
  
  // Logical validations
}).test('web-width-logic', 'Minimum web width cannot exceed maximum web width', function(value) {
  if (value.min_web_width && value.max_web_width) {
    return value.min_web_width <= value.max_web_width;
  }
  return true;
}).test('bag-height-logic', 'Minimum bag height cannot exceed maximum bag height', function(value) {
  if (value.min_bag_height && value.max_bag_height) {
    return value.min_bag_height <= value.max_bag_height;
  }
  return true;
});

// ===== PHASE SCHEMA =====
export const phaseSchema = yup.object({
  name: requiredString
    .min(2, 'Phase name must be at least 2 characters')
    .max(100, 'Phase name must be at most 100 characters'),
  
  department: requiredString.oneOf(['STAMPA', 'CONFEZIONAMENTO'], 'Invalid department'),
  work_center: requiredString.oneOf(['ZANICA', 'BUSTO_GAROLFO'], 'Invalid work center'),
  
  // Common numeric fields
  numero_persone: yup.number().required('Number of people is required').min(1, 'Number of people must be at least 1'),
  bag_width: optionalNumber,
  bag_step: optionalNumber,
  
  // Department-specific fields
  v_stampa: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).when('department', {
    is: 'STAMPA',
    then: (schema) => schema.min(0, 'Printing speed must be greater than 0')
  }),
  t_setup_stampa: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).when('department', {
    is: 'STAMPA',
    then: (schema) => schema.min(0, 'Setup time cannot be negative')
  }),
  costo_h_stampa: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).when('department', {
    is: 'STAMPA',
    then: (schema) => schema.min(0, 'Hourly cost cannot be negative')
  }),
  
  v_conf: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).when('department', {
    is: 'CONFEZIONAMENTO',
    then: (schema) => schema.min(0, 'Packaging speed must be greater than 0')
  }),
  t_setup_conf: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).when('department', {
    is: 'CONFEZIONAMENTO',
    then: (schema) => schema.min(0, 'Setup time cannot be negative')
  }),
  costo_h_conf: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).when('department', {
    is: 'CONFEZIONAMENTO',
    then: (schema) => schema.min(0, 'Hourly cost cannot be negative')
  }),
  
  // Logical validations
}).test('bag-width-step-logic', 'Bag width cannot be less than bag step', bagWidthStepValidation);

// ===== ORDER/BACKLOG SCHEMA =====
export const orderSchema = yup.object({
  odp_number: requiredString
    .min(3, 'ODP number must be at least 3 characters')
    .max(20, 'ODP number must be at most 20 characters')
    .matches(/^[a-zA-Z0-9]+$/, 'ODP number can only contain letters and numbers'),
  
  article_code: requiredString
    .min(3, 'Article code must be at least 3 characters')
    .max(50, 'Article code must be at most 50 characters')
    .matches(/^[a-zA-Z0-9-]+$/, 'Article code can only contain letters, numbers, and hyphens'),
  
  production_lot: requiredString,
  bag_height: requiredNumber.min(0.1, 'Bag height must be greater than 0'),
  bag_width: requiredNumber.min(0.1, 'Bag width must be greater than 0'),
  bag_step: requiredNumber.min(0.1, 'Bag step must be greater than 0'),
  product_type: requiredString.oneOf(['CREMA', 'LIQUIDO', 'POLVERI'], 'Invalid product type'),
  quantity: requiredNumber.min(1, 'Quantity must be at least 1'),
  quantity_per_box: optionalNumber,
  quantity_completed: optionalNumber,
  
  // Optional fields
  delivery_date: yup.date().nullable().transform((value) => (value === '' ? null : value)),
  scheduled_start_time: yup.date().nullable().transform((value) => (value === '' ? null : value)),
  scheduled_end_time: yup.date().nullable().transform((value) => (value === '' ? null : value)),
  scheduled_machine_id: yup.string().nullable(),
  fase: yup.string().nullable(),
  
  // Logical validations
}).test('bag-width-step-logic', 'Bag width cannot be less than bag step', bagWidthStepValidation).test('quantity-completed-logic', 'Quantity completed cannot exceed total quantity', function(value) {
  if (value.quantity && value.quantity_completed) {
    return value.quantity_completed <= value.quantity;
  }
  return true;
}).test('delivery-date-logic', 'Scheduled start cannot be after delivery date', function(value) {
  if (value.delivery_date && value.scheduled_start_time) {
    return new Date(value.scheduled_start_time) <= new Date(value.delivery_date);
  }
  return true;
});

// ===== OFF-TIME SCHEMA =====
export const offTimeSchema = yup.object({
  startDate: requiredString,
  startTime: requiredString,
  endDate: requiredString,
  endTime: requiredString,
  
  // Logical validations
}).test('date-logic', 'End date cannot be before start date', function(value) {
  if (value.startDate && value.endDate) {
    return new Date(value.startDate) <= new Date(value.endDate);
  }
  return true;
}).test('time-logic', 'End time must be after start time when dates are the same', function(value) {
  if (value.startDate && value.endDate && value.startDate === value.endDate && value.startTime && value.endTime) {
    return value.startTime < value.endTime;
  }
  return true;
});

// ===== AUTH SCHEMAS =====
export const loginSchema = yup.object({
  email: requiredString.email('Please enter a valid email address'),
  password: requiredString.min(6, 'Password must be at least 6 characters')
});

export const signupSchema = yup.object({
  email: requiredString.email('Please enter a valid email address'),
  password: requiredString.min(6, 'Password must be at least 6 characters'),
  confirmPassword: yup.string().required('Please confirm your password')
}).test('passwords-match', 'Passwords must match', function(value) {
  return value.password === value.confirmPassword;
});

export const forgotPasswordSchema = yup.object({
  email: requiredString.email('Please enter a valid email address')
});

// ===== VALIDATION FUNCTION =====
export const validateData = (data, schema) => {
  try {
    schema.validateSync(data, { abortEarly: false });
    return { isValid: true, errors: {} };
  } catch (validationError) {
    const errors = {};
    validationError.inner.forEach((error) => {
      errors[error.path] = error.message;
    });
    return { isValid: false, errors };
  }
};

// ===== SCHEMA MAP =====
export const SCHEMAS = {
  MACHINE: machineSchema,
  PHASE: phaseSchema,
  ORDER: orderSchema,
  BACKLOG: orderSchema, // Same as order
  OFF_TIME: offTimeSchema,
  LOGIN: loginSchema,
  SIGNUP: signupSchema,
  FORGOT_PASSWORD: forgotPasswordSchema
};
