/**
 * Custom Hooks Index
 * Centralized export for all custom hooks
 */

export { default as useProductionCalculations } from './useProductionCalculations';
export { default as useValidation } from './useValidation';
export { default as useErrorHandler } from './useErrorHandler';
export { usePhaseSearch } from './usePhaseSearch';
// useFormValidation removed - forms now use React Hook Form directly

// Export all custom hooks
export * from './useProductionCalculations';
export * from './useValidation';
export * from './useErrorHandler';
export * from './usePhaseSearch';
// useFormValidation exports removed - forms now use React Hook Form directly
