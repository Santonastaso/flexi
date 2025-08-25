import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import EditableCell from '../components/EditableCell';
import StickyHeader from '../components/StickyHeader';
import { usePhaseStore, useUIStore, useMainStore } from '../store';
import { usePhaseValidation, useErrorHandler } from '../hooks';
import { WORK_CENTERS } from '../constants';

function PhasesListPage() {
  // Use Zustand store to select state and actions
  const { phases, updatePhase, removePhase } = usePhaseStore();
  const { selectedWorkCenter, isLoading, isInitialized, showAlert, showConfirmDialog } = useUIStore();
  const { init, cleanup } = useMainStore();

  // Filter phases by work center
  const filteredPhases = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return phases;
    return phases.filter(phase => phase.work_center === selectedWorkCenter);
  }, [phases, selectedWorkCenter]);

  // Use modern validation hook
  const { validatePhase } = usePhaseValidation();
  
  // Use unified error handling
  const { handleCrudError, handleAsync } = useErrorHandler('PhasesListPage');

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
    { header: 'ID Fase', accessorKey: 'id' },
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
    // Additional
    { 
      header: 'Creato il', 
      accessorKey: 'created_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },
    { 
      header: 'Aggiornato il', 
      accessorKey: 'updated_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },

  ], []);

  const handleSavePhase = async (updatedPhase) => {
    // Use the new validation hook
    const validationErrors = validatePhase(updatedPhase);
    
    if (validationErrors.length > 0) {
      // Show validation errors in the store alert
      showAlert(`Errori di validazione:\n${validationErrors.join('\n')}`, 'error');
      return;
    }
    
    await handleAsync(
      () => updatePhase(updatedPhase.id, updatedPhase),
      { context: 'Aggiorna Fase', fallbackMessage: 'Aggiornamento fase fallito' }
    );
  };

  const handleDeletePhase = async (phaseToDelete) => {
    showConfirmDialog(
      'Elimina Fase',
      `Sei sicuro di voler eliminare "${phaseToDelete.name}"? Questa azione non può essere annullata.`,
      async () => {
        await handleAsync(
          () => removePhase(phaseToDelete.id),
          { context: 'Elimina Fase', fallbackMessage: 'Eliminazione fase fallita' }
        );
      },
      'danger'
    );
  };

  if (isLoading) {
    return <div>Caricamento dati fasi...</div>;
  }

  if (!selectedWorkCenter) {
    return <div className="error">Seleziona un centro di lavoro per visualizzare i dati delle fasi.</div>;
  }

  return (
    <div className="content-section">
      <StickyHeader title="Catalogo Fasi" />
      <DataTable
        columns={columns}
        data={filteredPhases}
        onSaveRow={handleSavePhase}
        onDeleteRow={handleDeletePhase}
      />
    </div>
  );
}

export default PhasesListPage;
