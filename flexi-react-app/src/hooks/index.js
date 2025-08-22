/**
 * Custom Hooks Index
 * Centralized export for all custom hooks
 */

export { default as useProductionCalculations } from './useProductionCalculations';
export { default as useMachineValidation } from './useMachineValidation';
export { default as useOrderValidation } from './useOrderValidation';
export { default as usePhaseValidation } from './usePhaseValidation';
export { default as useErrorHandler } from './useErrorHandler';
// useFormValidation removed - forms now use React Hook Form directly

// Export all custom hooks
export * from './useProductionCalculations';
export * from './useMachineValidation';
export * from './useOrderValidation';
export * from './usePhaseValidation';
export * from './useErrorHandler';
// useFormValidation exports removed - forms now use React Hook Form directly
