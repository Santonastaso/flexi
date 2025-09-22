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
  // Required fields (NOT NULL in DB)
  odp_number: requiredString
    .min(1, 'Il numero ODP è obbligatorio'),
  article_code: requiredString
    .min(1, 'Il codice articolo è obbligatorio'),
  work_center: requiredString
    .oneOf(['ZANICA', 'BUSTO_GAROLFO'], 'Seleziona un centro di lavoro valido'),
  nome_cliente: requiredString
    .min(1, 'Il nome del cliente è obbligatorio'),
  quantity: yup.number()
    .required('La quantità è obbligatoria')
    .min(0, 'La quantità deve essere maggiore o uguale a 0')
    .typeError('La quantità deve essere un numero valido'),
  delivery_date: yup.date()
    .required('La data di consegna è obbligatoria')
    .typeError('Inserisci una data di consegna valida'),
  customer_order_ref: requiredString
    .min(1, 'Il riferimento ordine cliente è obbligatorio'),
  department: requiredString
    .oneOf(['STAMPA', 'CONFEZIONAMENTO'], 'Seleziona un reparto valido'),
  status: yup.string()
    .oneOf(['NOT SCHEDULED', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'CANCELLED'], 'Stato non valido')
    .default('NOT SCHEDULED'),
  quantity_completed: yup.number()
    .min(0, 'La quantità completata deve essere maggiore o uguale a 0')
    .default(0),
  
  // Optional fields (NULL allowed in DB)
  production_lot: yup.string().nullable(),
  description: yup.string().nullable(),
  bag_height: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).min(0, 'L\'altezza busta deve essere maggiore o uguale a 0'),
  bag_width: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).min(0, 'La larghezza busta deve essere maggiore o uguale a 0'),
  bag_step: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).min(0, 'Il passo busta deve essere maggiore o uguale a 0'),
  seal_sides: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).oneOf([3, 4], 'I lati di sigillatura devono essere 3 o 4'),
  product_type: yup.string().nullable().oneOf(['CREMA', 'LIQUIDO', 'POLVERI'], 'Seleziona un tipo di prodotto valido'),
  internal_customer_code: yup.string().nullable().test('not-empty-if-provided', 'Il codice cliente interno non può essere vuoto', function(value) {
    return !value || value.trim().length > 0;
  }),
  external_customer_code: yup.string().nullable().test('not-empty-if-provided', 'Il codice cliente esterno non può essere vuoto', function(value) {
    return !value || value.trim().length > 0;
  }),
  fase: yup.string().nullable(),
  duration: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).min(0, 'La durata deve essere maggiore o uguale a 0'),
  cost: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).min(0, 'Il costo deve essere maggiore o uguale a 0'),
  scheduled_start_time: yup.date().nullable(),
  scheduled_end_time: yup.date().nullable(),
  scheduled_machine_id: yup.string().nullable(),
  user_notes: yup.string().nullable(),
  asd_notes: yup.string().nullable(),
  material_availability_global: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).min(0, 'Material availability must be between 0 and 100').max(100, 'Material availability must be between 0 and 100'),
  
  // Logical validations matching DB constraints
}).test('bag-width-step-logic', 'La larghezza busta non può essere minore del passo busta', function(value) {
  if (value.bag_width && value.bag_step) {
    return value.bag_width >= value.bag_step;
  }
  return true;
}).test('quantity-completed-logic', 'La quantità completata non può superare la quantità totale', function(value) {
  if (value.quantity && value.quantity_completed !== undefined) {
    return value.quantity_completed <= value.quantity;
  }
  return true;
}).test('scheduled-time-order', 'L\'ora di fine programmata deve essere dopo l\'ora di inizio', function(value) {
  if (value.scheduled_start_time && value.scheduled_end_time) {
    return new Date(value.scheduled_end_time) > new Date(value.scheduled_start_time);
  }
  return true;
}).test('scheduling-logic', 'I campi di programmazione devono essere tutti forniti o tutti nulli', function(value) {
  const hasStart = !!value.scheduled_start_time;
  const hasEnd = !!value.scheduled_end_time;
  const hasMachine = !!value.scheduled_machine_id;
  
  // Either all three are provided or none are provided
  return (hasStart && hasEnd && hasMachine) || (!hasStart && !hasEnd && !hasMachine);
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
