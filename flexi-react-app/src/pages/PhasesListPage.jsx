import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import EditableCell from '../components/EditableCell';

import { usePhaseStore, useUIStore, useMainStore } from '../store';
import { useValidation, useErrorHandler } from '../hooks';
import { showValidationError, showError } from '../utils';
import { WORK_CENTERS } from '../constants';


function PhasesListPage() {
  // Use Zustand store to select state and actions
  const { phases, updatePhase, removePhase } = usePhaseStore();
  const { selectedWorkCenter, isLoading, isInitialized, showConfirmDialog } = useUIStore();
  const { init, cleanup } = useMainStore();

  // Filter phases by work center
  const filteredPhases = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return phases;
    return phases.filter(phase => phase.work_center === selectedWorkCenter);
  }, [phases, selectedWorkCenter]);

  // Use unified validation hook
  const { validatePhase } = useValidation();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('PhasesListPage');

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

  const columns = useMemo(() => [
    // Identificazione
    { header: 'Nome Fase', accessorKey: 'name', cell: EditableCell },
    { header: 'Centro di Lavoro', accessorKey: 'work_center' },
    { header: 'Reparto', accessorKey: 'department' },
    // Capacità Tecniche
    { header: 'Numero Persone', accessorKey: 'numero_persone', cell: EditableCell },
    { header: 'V Stampa', accessorKey: 'v_stampa', cell: EditableCell },
    { header: 'T Setup Stampa (h)', accessorKey: 't_setup_stampa', cell: EditableCell },
    { header: 'Costo H Stampa', accessorKey: 'costo_h_stampa', cell: EditableCell },
    { header: 'V Conf', accessorKey: 'v_conf', cell: EditableCell },
    { header: 'T Setup Conf (h)', accessorKey: 't_setup_conf', cell: EditableCell },
    { header: 'Costo H Conf', accessorKey: 'costo_h_conf', cell: EditableCell },
    // Contenuto
    { header: 'Contenuto Fase', accessorKey: 'contenuto_fase', cell: EditableCell },
  ], []);

  const handleSavePhase = async (updatedPhase) => {
    // Use the unified validation hook
    const validation = validatePhase(updatedPhase);
    
    if (!validation.isValid) {
      showValidationError(Object.values(validation.errors));
      return;
    }
    
    try {
      await updatePhase(updatedPhase.id, updatedPhase);
    } catch (error) {
      // Show specific error message from the store
      showError(error.message);
    }
  };

  const handleDeletePhase = async (phaseToDelete) => {
    showConfirmDialog(
      'Elimina Fase',
      `Sei sicuro di voler eliminare "${phaseToDelete.name}"? Questa azione non può essere annullata.`,
      async () => {
        try {
          await removePhase(phaseToDelete.id);
        } catch (error) {
          // Show specific error message from the store
          showError(error.message);
        }
      },
      'danger'
    );
  };

  if (isLoading) {
    return <div>Caricamento dati fasi...</div>;
  }

  if (!selectedWorkCenter) {
           return <div className="text-center py-2 text-red-600 text-[10px]">Seleziona un centro di lavoro per visualizzare i dati delle fasi.</div>;
  }

  return (
    <div className="p-1 bg-white rounded shadow-sm border min-w-0">
      
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={filteredPhases}
          onSaveRow={handleSavePhase}
          onDeleteRow={handleDeletePhase}
        />
      </div>
    </div>
  );
}

export default PhasesListPage;
