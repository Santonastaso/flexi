import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';

import { usePhaseStore, useUIStore, useMainStore } from '../store';
import { useErrorHandler, usePhases, useRemovePhase } from '../hooks';
import { showError, showSuccess } from '../utils';
import { WORK_CENTERS } from '../constants';


function PhasesListPage() {
  // Use React Query for data fetching
  const { data: phases = [], isLoading: phasesLoading, error: phasesError } = usePhases();
  const removePhaseMutation = useRemovePhase();
  
  // Use Zustand store for client state
  const { selectedWorkCenter, isInitialized, showConfirmDialog } = useUIStore();
  const { init, cleanup } = useMainStore();
  const navigate = useNavigate();

  // Filter phases by work center
  const filteredPhases = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return phases;
    return phases.filter(phase => phase.work_center === selectedWorkCenter);
  }, [phases, selectedWorkCenter]);

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
    { header: 'Nome Fase', accessorKey: 'name' },
    { header: 'Centro di Lavoro', accessorKey: 'work_center' },
    { header: 'Reparto', accessorKey: 'department' },
    // Capacità Tecniche
    { header: 'Numero Persone', accessorKey: 'numero_persone' },
    { header: 'V Stampa', accessorKey: 'v_stampa' },
    { header: 'T Setup Stampa (h)', accessorKey: 't_setup_stampa' },
    { header: 'Costo H Stampa', accessorKey: 'costo_h_stampa' },
    { header: 'V Conf', accessorKey: 'v_conf' },
    { header: 'T Setup Conf (h)', accessorKey: 't_setup_conf' },
    { header: 'Costo H Conf', accessorKey: 'costo_h_conf' },
    // Contenuto
    { header: 'Contenuto Fase', accessorKey: 'contenuto_fase' },
  ], []);

  const handleEditPhase = (phase) => {
    navigate(`/phases/${phase.id}/edit`);
  };

  const handleDeletePhase = async (phaseToDelete) => {
    showConfirmDialog(
      'Elimina Fase',
      `Sei sicuro di voler eliminare "${phaseToDelete.name}"? Questa azione non può essere annullata.`,
      async () => {
        try {
          await removePhaseMutation.mutateAsync(phaseToDelete.id);
          showSuccess(`Fase "${phaseToDelete.name}" eliminata con successo`);
        } catch (error) {
          showError(error.message || 'Errore durante l\'eliminazione della fase');
        }
      },
      'danger'
    );
  };

  if (phasesLoading) {
    return <div>Caricamento dati fasi...</div>;
  }

  if (phasesError) {
    return <div className="text-center py-2 text-red-600 text-[10px]">Errore nel caricamento delle fasi: {phasesError.message}</div>;
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
          onEditRow={handleEditPhase}
          onDeleteRow={handleDeletePhase}
        />
      </div>
    </div>
  );
}

export default PhasesListPage;
