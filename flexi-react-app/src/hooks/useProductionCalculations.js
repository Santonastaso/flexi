import { useCallback } from 'react';

/**
 * Custom hook for production calculations and business logic
 * Replaces the imperative BusinessLogicService class with React-idiomatic patterns
 */
export const useProductionCalculations = () => {
  
  /**
   * Calculate production metrics for a given phase and quantity
   */
  const calculateProductionMetrics = useCallback((phase, quantity, bagStep) => {
    if (!phase || !quantity || !bagStep) {
      return null;
    }

    try {
      const { department } = phase;
      
      if (department === 'STAMPA') {
        // Printing calculations
        const printTime = quantity / (phase.v_stampa || 1);
        const setupTime = phase.t_setup_stampa || 0;
        const totalTime = printTime + setupTime;
        const totalCost = totalTime * (phase.costo_h_stampa || 0);
        
        return {
          totals: {
            duration: totalTime,
            cost: totalCost
          },
          breakdown: {
            print: { time: printTime, cost: printTime * (phase.costo_h_stampa || 0) },
            setup: { time: setupTime, cost: setupTime * (phase.costo_h_stampa || 0) }
          }
        };
      } else if (department === 'CONFEZIONAMENTO') {
        // Packaging calculations
        const packageTime = quantity / (phase.v_conf || 1);
        const setupTime = phase.t_setup_conf || 0;
        const totalTime = packageTime + setupTime;
        const totalCost = totalTime * (phase.costo_h_conf || 0);
        
        return {
          totals: {
            duration: totalTime,
            cost: totalCost
          },
          breakdown: {
            package: { time: packageTime, cost: packageTime * (phase.costo_h_conf || 0) },
            setup: { time: setupTime, cost: setupTime * (phase.costo_h_conf || 0) }
          }
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }, []);

  /**
   * Auto-determine work center based on article code
   */
  const autoDetermineWorkCenter = useCallback((articleCode) => {
    if (!articleCode) return 'ZANICA';
    return (articleCode.startsWith('P05') || articleCode.startsWith('ISP05')) ? 'BUSTO_GAROLFO' : 'ZANICA';
  }, []);

  /**
   * Auto-determine department based on article code
   */
  const autoDetermineDepartment = useCallback((articleCode) => {
    if (!articleCode) return 'STAMPA';
    return articleCode.startsWith('P0') ? 'CONFEZIONAMENTO' : 'STAMPA';
  }, []);

  /**
   * Get valid machine types for a department
   */
  const getValidMachineTypes = useCallback((department) => {
    const validTypes = {
      'STAMPA': ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE'],
      'CONFEZIONAMENTO': ['DOYPACK', 'PLURI_PIU', 'MONO_PIU', 'CONFEZIONAMENTO_TRADIZIONALE', 'CONFEZIONAMENTO_POLVERI']
    };
    return validTypes[department] || [];
  }, []);

  /**
   * Generate machine ID based on type and work center
   */
  const generateMachineId = useCallback((machineType, workCenter) => {
    const prefixes = {
      'DIGITAL_PRINT': 'DIGI',
      'FLEXO_PRINT': 'FLEX',
      'ROTOGRAVURE': 'ROTO',
      'DOYPACK': 'DOYP',
      'PLURI_PIU': 'PLUR',
      'MONO_PIU': 'MONO',
      'CONFEZIONAMENTO_TRADIZIONALE': 'CONFTRAD',
      'CONFEZIONAMENTO_POLVERI': 'CONFPOL'
    };
    
    const prefix = prefixes[machineType] || 'MACH';
    const workCenterCode = workCenter === 'BUSTO_GAROLFO' ? 'BGF' : 'ZAN';
    const timestamp = Date.now().toString(36);
    
    return `${prefix}_${workCenterCode}_${timestamp}`;
  }, []);

  /**
   * Validate quantity completed against total quantity
   */
  const validateQuantityCompleted = useCallback((quantity, quantityCompleted) => {
    if (quantityCompleted < 0) return false;
    if (quantityCompleted > quantity) return false;
    return true;
  }, []);

  /**
   * Calculate completion rate
   */
  const calculateCompletionRate = useCallback((quantity, quantityCompleted) => {
    if (!quantity || quantity === 0) return 0;
    return Math.round((quantityCompleted * 100.0) / quantity);
  }, []);

  /**
   * Calculate time remaining based on duration and progress
   */
  const calculateTimeRemaining = useCallback((duration, progressPercentage) => {
    if (!duration || duration === 0) return 0;
    if (!progressPercentage || progressPercentage === 0) return duration;
    return Math.round((duration * (1 - (progressPercentage / 100))) * 100) / 100;
  }, []);

  return {
    calculateProductionMetrics,
    autoDetermineWorkCenter,
    autoDetermineDepartment,
    getValidMachineTypes,
    generateMachineId,
    validateQuantityCompleted,
    calculateCompletionRate,
    calculateTimeRemaining
  };
};

export default useProductionCalculations;
