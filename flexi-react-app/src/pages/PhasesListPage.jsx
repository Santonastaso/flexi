import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';

import { useUIStore } from '../store';
import { useConfirmDelete, usePhases, useRemovePhase } from '../hooks';
import { simpleColumn } from '../utils';
import { WORK_CENTERS } from '../constants';
import LoadingState from '../components/LoadingState';


function PhasesListPage() {
  // Use React Query for data fetching
  const { data: phases = [], isLoading: phasesLoading, error: phasesError } = usePhases();
  const removePhaseMutation = useRemovePhase();
  const confirmDelete = useConfirmDelete();
  
  // Use Zustand store for client state
  const { selectedWorkCenter } = useUIStore();
  const navigate = useNavigate();

  // Filter phases by work center
  const filteredPhases = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return phases;
    return phases.filter(phase => phase.work_center === selectedWorkCenter);
  }, [phases, selectedWorkCenter]);

  const columns = useMemo(() => [
    // Identificazione
    simpleColumn('Nome Fase', 'name'),
    simpleColumn('Centro di Lavoro', 'work_center'),
    simpleColumn('Reparto', 'department'),
    // Capacità Tecniche
    simpleColumn('Numero Persone', 'numero_persone'),
    simpleColumn('V Stampa', 'v_stampa'),
    simpleColumn('T Setup Stampa (h)', 't_setup_stampa'),
    simpleColumn('Costo H Stampa', 'costo_h_stampa'),
    simpleColumn('V Conf', 'v_conf'),
    simpleColumn('T Setup Conf (h)', 't_setup_conf'),
    simpleColumn('Costo H Conf', 'costo_h_conf'),
    // Contenuto
    simpleColumn('Contenuto Fase', 'contenuto_fase'),
  ], []);

  const handleEditPhase = (phase) => {
    navigate(`/phases/${phase.id}/edit`);
  };

  const handleDeletePhase = async (phaseToDelete) => {
    confirmDelete({
      title: 'Elimina Fase',
      message: `Sei sicuro di voler eliminare "${phaseToDelete.name}"? Questa azione non può essere annullata.`,
      onConfirm: () => removePhaseMutation.mutateAsync(phaseToDelete.id),
      successMessage: `Fase "${phaseToDelete.name}" eliminata con successo`,
      errorMessage: 'Errore durante l\'eliminazione della fase'
    });
  };

  if (phasesLoading) {
    return <LoadingState message="Caricamento dati fasi..." />;
  }

  if (phasesError) {
    return <div className="text-center py-2 text-red-600 text-xs">Errore nel caricamento delle fasi: {phasesError.message}</div>;
  }

  if (!selectedWorkCenter) {
           return <div className="text-center py-2 text-red-600 text-xs">Seleziona un centro di lavoro per visualizzare i dati delle fasi.</div>;
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
