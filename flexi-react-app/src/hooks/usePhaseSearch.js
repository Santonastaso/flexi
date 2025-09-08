import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePhaseStore } from '../store';

export const usePhaseSearch = (department, workCenter, initialPhaseId = null) => {
  const { phases } = usePhaseStore();
  const [phaseSearch, setPhaseSearch] = useState('');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [editablePhaseParams, setEditablePhaseParams] = useState({});
  
  // Ref to store the blur timeout
  const blurTimeoutRef = useRef(null);

  // Memoize filtered phases to prevent infinite loops
  const filteredPhases = useMemo(() => {
    if (!phases || phases.length === 0) return [];
    
    if (department || workCenter) {
      const relevantPhases = phases.filter(p => 
        (!department || p.department === department) &&
        (!workCenter || p.work_center === workCenter)
      );
      return relevantPhases.filter(p => p.name.toLowerCase().includes(phaseSearch.toLowerCase()));
    }
    return [];
  }, [phaseSearch, department, workCenter, phases]);

  // Auto-populate phase search field when initial phase ID is provided (for edit mode)
  useEffect(() => {
    if (initialPhaseId && phases && phases.length > 0 && !selectedPhase) {
      const phase = phases.find(p => p.id === initialPhaseId);
      if (phase) {
        setSelectedPhase(phase);
        setPhaseSearch(phase.name);
        // Initialize editable phase parameters with current phase values
        setEditablePhaseParams({
          v_stampa: phase.v_stampa || null,
          t_setup_stampa: phase.t_setup_stampa || null,
          costo_h_stampa: phase.costo_h_stampa || null,
          v_conf: phase.v_conf || null,
          t_setup_conf: phase.t_setup_conf || null,
          costo_h_conf: phase.costo_h_conf || null,
        });
      }
    }
  }, [initialPhaseId, phases, selectedPhase]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handlePhaseParamChange = useCallback((field, value) => {
    // Convert empty string to null, otherwise convert to number
    const numericValue = value === '' ? null : parseFloat(value);
    setEditablePhaseParams(prev => ({ ...prev, [field]: numericValue }));
  }, []);

  const handlePhaseSelect = useCallback((phase, setValue, clearErrors) => {
    setValue('fase', phase.id);
    setSelectedPhase(phase);
    setPhaseSearch(phase.name);
    setIsDropdownVisible(false);
    
    // Clear phase error
    clearErrors('fase');
    
    // Initialize editable phase parameters with current phase values
    setEditablePhaseParams({
      v_stampa: phase.v_stampa || null,
      t_setup_stampa: phase.t_setup_stampa || null,
      costo_h_stampa: phase.costo_h_stampa || null,
      v_conf: phase.v_conf || null,
      t_setup_conf: phase.t_setup_conf || null,
      costo_h_conf: phase.costo_h_conf || null,
    });
  }, []);

  const resetPhaseData = useCallback(() => {
    setPhaseSearch('');
    setSelectedPhase(null);
    setEditablePhaseParams({});
  }, []);

  const handleBlur = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => setIsDropdownVisible(false), 150);
  }, []);

  // Memoize the return object to prevent unnecessary re-renders
  const hookValue = useMemo(() => ({
    phaseSearch,
    setPhaseSearch,
    isDropdownVisible,
    setIsDropdownVisible,
    selectedPhase,
    setSelectedPhase,
    filteredPhases,
    editablePhaseParams,
    setEditablePhaseParams,
    handlePhaseParamChange,
    handlePhaseSelect,
    resetPhaseData,
    handleBlur,
    blurTimeoutRef
  }), [
    phaseSearch,
    isDropdownVisible,
    selectedPhase,
    filteredPhases,
    editablePhaseParams,
    setEditablePhaseParams,
    handlePhaseParamChange,
    handlePhaseSelect,
    resetPhaseData,
    handleBlur
  ]);

  return hookValue;
};
