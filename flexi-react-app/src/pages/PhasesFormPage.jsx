import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PhasesForm from '../components/PhasesForm';
import StickyHeader from '../components/StickyHeader';
import { useUIStore, useMainStore } from '../store';
import { usePhase } from '../hooks';

function PhasesFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedWorkCenter } = useUIStore();
  const { isLoading, isInitialized, init, cleanup } = useMainStore();

  // Check if this is edit mode (has ID) or add mode (no ID)
  const isEditMode = Boolean(id);
  const { data: phase, isLoading: phaseLoading, error: phaseError } = usePhase(id);

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
    if (isEditMode && !isLoading && !phaseLoading && !phase && !phaseError) {
      navigate('/phases', { replace: true });
    }
  }, [isEditMode, isLoading, phaseLoading, phase, phaseError, navigate]);

  if (isLoading || (isEditMode && phaseLoading)) {
    return <div>Caricamento...</div>;
  }

  if (isEditMode && phaseError) {
    return <div className="text-center py-2 text-red-600 text-[10px]">Errore nel caricamento della fase: {phaseError.message}</div>;
  }

  if (isEditMode && !phase) {
    return <div className="text-center py-2 text-red-600 text-[10px]">Fase non trovata.</div>;
  }

  // Allow access if work center is selected or if BOTH is selected (which allows any work center)
  if (!selectedWorkCenter) {
           return <div className="text-center py-2 text-red-600 text-[10px]">Seleziona un centro di lavoro per gestire le fasi.</div>;
  }

  return (
    <div className="p-1 bg-white rounded shadow-sm border">
      {isEditMode && <StickyHeader title={`Modifica Fase: ${phase?.name}`} />}
      <PhasesForm phaseToEdit={phase} />
    </div>
  );
}

export default PhasesFormPage;
