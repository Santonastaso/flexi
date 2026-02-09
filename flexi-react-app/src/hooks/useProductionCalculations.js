import { useCallback } from 'react';

/**
 * Custom hook for production calculations and business logic
 * Replaces the imperative BusinessLogicService class with React-idiomatic patterns
 */
export const useProductionCalculations = () => {
  
  /**
   * Validate phase parameters for calculation
   */
  const validatePhaseParameters = useCallback((phase) => {
    if (!phase || !phase.department) {
      return { isValid: false, error: 'Invalid phase data' };
    }

    const { department } = phase;
    
    if (department === 'STAMPA') {
      const vStampa = parseFloat(phase.v_stampa);
      if (isNaN(vStampa) || vStampa <= 0) {
        return { isValid: false, error: 'Velocità di stampa non valida. Inserisci un valore maggiore di zero.' };
      }
    } else if (department === 'CONFEZIONAMENTO') {
      const vConf = parseFloat(phase.v_conf);
      if (isNaN(vConf) || vConf <= 0) {
        return { isValid: false, error: 'Velocità di confezionamento non valida. Inserisci un valore maggiore di zero.' };
      }
    } else {
      return { isValid: false, error: 'Reparto non riconosciuto' };
    }
    
    return { isValid: true };
  }, []);

  /**
   * Calculate production metrics for a given phase and quantity
   */
  const calculateProductionMetrics = useCallback((phase, quantity, bagStep) => {
    if (!phase || !quantity) {
      return null;
    }
    
    // For STAMPA department, bagStep is required
    if (phase.department === 'STAMPA' && !bagStep) {
      return null;
    }

    // Validate phase parameters first
    const validation = validatePhaseParameters(phase);
    if (!validation.isValid) {
      return null;
    }

    try {
      const { department } = phase;
      
          if (department === 'STAMPA') {
      // Validate required parameters for printing
      const vStampa = parseFloat(phase.v_stampa);
      const tSetupStampa = parseFloat(phase.t_setup_stampa) || 0;
      const costoHStampa = parseFloat(phase.costo_h_stampa) || 0;
      
      if (isNaN(vStampa) || vStampa <= 0) {
        return null; // Invalid print speed
      }
      
      // Printing calculations - new formula
      // Calcolo metri lineari da stampare
      const mtDaStampare = (bagStep * quantity) / 1000;
      // Calcolo tempo stampa netto
      const tempoStampa = mtDaStampare / vStampa;
      // Calcolo tempo totale stampa
      const totalTime = tempoStampa + tSetupStampa;
      const totalCost = totalTime * costoHStampa;
        
        return {
          totals: {
            duration: totalTime,
            cost: totalCost
          },
          breakdown: {
            print: { time: tempoStampa, cost: tempoStampa * costoHStampa },
            setup: { time: tSetupStampa, cost: tSetupStampa * costoHStampa }
          }
        };
      } else if (department === 'CONFEZIONAMENTO') {
        // Validate required parameters for packaging
        const vConf = parseFloat(phase.v_conf);
        const tSetupConf = parseFloat(phase.t_setup_conf) || 0;
        const costoHConf = parseFloat(phase.costo_h_conf) || 0;
        
        if (isNaN(vConf) || vConf <= 0) {
          return null; // Invalid packaging speed
        }
        
        // Packaging calculations
        const packageTime = quantity / vConf;
        const setupTime = tSetupConf;
        const totalTime = packageTime + setupTime;
        const totalCost = totalTime * costoHConf;
        
        return {
          totals: {
            duration: totalTime,
            cost: totalCost
          },
          breakdown: {
            package: { time: packageTime, cost: packageTime * costoHConf },
            setup: { time: setupTime, cost: setupTime * costoHConf }
          }
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }, [validatePhaseParameters]);

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

  return {
    calculateProductionMetrics,
    validatePhaseParameters,
    autoDetermineWorkCenter,
    autoDetermineDepartment,
    getValidMachineTypes
  };
};

export default useProductionCalculations;
