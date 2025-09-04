import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PhasesForm from '../components/PhasesForm';
import StickyHeader from '../components/StickyHeader';
import { usePhaseStore, useUIStore, useMainStore } from '../store';

function PhasesFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPhaseById } = usePhaseStore();
  const { selectedWorkCenter } = useUIStore();
  const { isLoading, isInitialized, init, cleanup } = useMainStore();

  // Check if this is edit mode (has ID) or add mode (no ID)
  const isEditMode = Boolean(id);
  const phase = isEditMode ? getPhaseById(id) : null;

  // Initialize store on component mount
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
    
    // Cleanup function for component unmount
    return () => {
      cleanup();
    };
  }, [init, isInitialized, cleanup]);

  // Redirect if phase not found in edit mode
  useEffect(() => {
    if (isEditMode && !isLoading && !phase) {
      navigate('/phases', { replace: true });
    }
  }, [isEditMode, isLoading, phase, navigate]);

  if (isLoading) {
    return <div>Caricamento...</div>;
  }

  if (isEditMode && !phase) {
           return <div className="text-center py-4 text-red-600 text-xs">Fase non trovata.</div>;
  }

  // Allow access if work center is selected or if BOTH is selected (which allows any work center)
  if (!selectedWorkCenter) {
           return <div className="text-center py-4 text-red-600 text-xs">Seleziona un centro di lavoro per gestire le fasi.</div>;
  }

  return (
    <div className="p-2 bg-white rounded shadow-sm border">
      {isEditMode && <StickyHeader title={`Modifica Fase: ${phase?.name}`} />}
      <PhasesForm phaseToEdit={phase} />
    </div>
  );
}

export default PhasesFormPage;
