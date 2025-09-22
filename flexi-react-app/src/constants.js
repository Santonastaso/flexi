/**
 * Application Constants
 * Centralized location for all hardcoded values used throughout the application
 */

// ===== DEPARTMENT TYPES =====
export const DEPARTMENT_TYPES = {
  PRINTING: 'STAMPA',
  PACKAGING: 'CONFEZIONAMENTO'
};

// ===== WORK CENTERS =====
export const WORK_CENTERS = {
  ZANICA: 'ZANICA',
  BUSTO_GAROLFO: 'BUSTO_GAROLFO',
  BOTH: 'BOTH'
};

// ===== MACHINE STATUSES =====
export const MACHINE_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
};

// ===== PRODUCT TYPES =====
export const PRODUCT_TYPES = {
  CREMA: 'CREMA',
  LIQUIDO: 'LIQUIDO',
  POLVERI: 'POLVERI'
};

// ===== SHIFT TYPES =====
export const SHIFT_TYPES = {
  T1: 'T1',
  T2: 'T2',
  T3: 'T3'
};

// ===== SEAL SIDES =====
export const SEAL_SIDES = {
  THREE: 3,
  FOUR: 4
};

// ===== TASK STATUSES =====
export const TASK_STATUSES = {
  NOT_SCHEDULED: 'NOT SCHEDULED',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

// ===== FORM FIELD NAMES =====
export const FORM_FIELDS = {
  // Machine fields
  MACHINE_NAME: 'machine_name',
  MACHINE_TYPE: 'machine_type',
  DEPARTMENT: 'department',
  WORK_CENTER: 'work_center',
  MIN_WEB_WIDTH: 'min_web_width',
  MAX_WEB_WIDTH: 'max_web_width',
  MIN_BAG_HEIGHT: 'min_bag_height',
  MAX_BAG_HEIGHT: 'max_bag_height',
  STANDARD_SPEED: 'standard_speed',
  SETUP_TIME_STANDARD: 'setup_time_standard',
  CHANGEOVER_COLOR: 'changeover_color',
  CHANGEOVER_MATERIAL: 'changeover_material',
  ACTIVE_SHIFTS: 'active_shifts',
  STATUS: 'status',
  
  // Phase fields
  PHASE_NAME: 'name',
  NUMERO_PERSONE: 'numero_persone',
  V_STAMPA: 'v_stampa',
  T_SETUP_STAMPA: 't_setup_stampa',
  COSTO_H_STAMPA: 'costo_h_stampa',
  V_CONF: 'v_conf',
  T_SETUP_CONF: 't_setup_conf',
  COSTO_H_CONF: 'costo_h_conf',
  CONTENUTO_FASE: 'contenuto_fase',
  
  // Order fields
  ODP_NUMBER: 'odp_number',
  ARTICLE_CODE: 'article_code',
  PRODUCTION_LOT: 'production_lot',
  BAG_HEIGHT: 'bag_height',
  BAG_WIDTH: 'bag_width',
  BAG_STEP: 'bag_step',
  SEAL_SIDES: 'seal_sides',
  PRODUCT_TYPE: 'product_type',
  QUANTITY: 'quantity',
  QUANTITY_COMPLETED: 'quantity_completed',
  DELIVERY_DATE: 'delivery_date',
  USER_NOTES: 'user_notes',
  ASD_NOTES: 'asd_notes',
  MATERIAL_AVAILABILITY_GLOBAL: 'material_availability_global',
  
  // Off-time fields
  START_DATE: 'startDate',
  START_TIME: 'startTime',
  END_DATE: 'endDate',
  END_TIME: 'endTime'
};

// ===== VALIDATION MESSAGES =====
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  END_DATE_BEFORE_START: 'End date cannot be before start date',
  END_TIME_BEFORE_START: 'End time must be after start time when dates are the same',
  MIN_WEB_WIDTH_EXCEEDS_MAX: 'Minimum web width cannot exceed maximum web width',
  MIN_BAG_HEIGHT_EXCEEDS_MAX: 'Minimum bag height cannot exceed maximum bag height',
  BAG_WIDTH_LESS_THAN_STEP: 'Bag width cannot be less than bag step',
  QUANTITY_COMPLETED_EXCEEDS_TOTAL: 'Quantity completed cannot exceed total quantity',
  SCHEDULED_START_AFTER_DELIVERY: 'Scheduled start cannot be after delivery date'
};

// ===== DEFAULT VALUES =====
export const DEFAULT_VALUES = {
  MACHINE: {
    DEPARTMENT: DEPARTMENT_TYPES.PRINTING,
    WORK_CENTER: WORK_CENTERS.ZANICA,
    MIN_WEB_WIDTH: '100',
    MAX_WEB_WIDTH: '1000',
    MIN_BAG_HEIGHT: '50',
    MAX_BAG_HEIGHT: '500',
    SETUP_TIME_STANDARD: '0.5',
    CHANGEOVER_COLOR: '0.25',
    CHANGEOVER_MATERIAL: '0.75',
    ACTIVE_SHIFTS: [SHIFT_TYPES.T1],
    STATUS: MACHINE_STATUSES.ACTIVE
  },
  PHASE: {
    DEPARTMENT: DEPARTMENT_TYPES.PRINTING,
    NUMERO_PERSONE: 1,
    WORK_CENTER: WORK_CENTERS.ZANICA,
    V_STAMPA: 6000,
    T_SETUP_STAMPA: 0.5,
    COSTO_H_STAMPA: 50,
    V_CONF: 1000,
    T_SETUP_CONF: 0.25,
    COSTO_H_CONF: 40
  },
  ORDER: {
    SEAL_SIDES: SEAL_SIDES.THREE,
    QUANTITY_COMPLETED: 0
  },
  OFF_TIME: {
    START_TIME: '09:00',
    END_TIME: '17:00'
  }
};

// ===== FIELD CONFIGURATIONS =====
export const FIELD_CONFIGS = {
  // Decimal precision for different field types
  DECIMAL_PRECISION: {
    ONE_DECIMAL: ['setup_time_standard', 'changeover_color', 'changeover_material', 't_setup_stampa', 't_setup_conf'],
    TWO_DECIMAL: ['costo_h_stampa', 'costo_h_conf'],
    PLAIN_NUMBER: ['standard_speed', 'v_stampa', 'v_conf']
  },
  
  // Field step values
  FIELD_STEPS: {
    TIME: 0.1,
    COST: 0.01,
    QUANTITY: 1,
    DIMENSION: 1
  }
};

// ===== ALERT TYPES =====
export const ALERT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// ===== CONFIRMATION DIALOG TYPES =====
export const CONFIRMATION_TYPES = {
  DANGER: 'danger',
  WARNING: 'warning',
  INFO: 'info'
};

// ===== SCHEDULING =====
export const SCHEDULING = {
  MAX_TASK_SEGMENTS: 50 // Safety limit to prevent infinite loops in task splitting
};

// ===== TIME CONSTANTS =====
export const TIME_CONSTANTS = {
  MILLISECONDS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  DAYS_PER_WEEK: 7,
  DAYS_PER_YEAR: 365,
  MILLISECONDS_PER_MINUTE: 60 * 1000,
  MILLISECONDS_PER_HOUR: 60 * 60 * 1000,
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000
};

export default {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  MACHINE_STATUSES,
  PRODUCT_TYPES,
  SHIFT_TYPES,
  SEAL_SIDES,
  TASK_STATUSES,
  FORM_FIELDS,
  VALIDATION_MESSAGES,
  DEFAULT_VALUES,
  FIELD_CONFIGS,
  ALERT_TYPES,
  CONFIRMATION_TYPES,
  SCHEDULING,
  TIME_CONSTANTS
};
