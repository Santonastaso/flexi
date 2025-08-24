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
    { header: 'Phase ID', accessorKey: 'id' },
    { header: 'Phase Name', accessorKey: 'name', cell: EditableCell },
    { header: 'Work Center', accessorKey: 'work_center' },
    { header: 'Department', accessorKey: 'department' },
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
      header: 'Created At', 
      accessorKey: 'created_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },
    { 
      header: 'Updated At', 
      accessorKey: 'updated_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },

  ], []);

  const handleSavePhase = async (updatedPhase) => {
    // Use the new validation hook
    const validationErrors = validatePhase(updatedPhase);
    
    if (validationErrors.length > 0) {
      // Show validation errors in the store alert
      showAlert(`Validation errors:\n${validationErrors.join('\n')}`, 'error');
      return;
    }
    
    await handleAsync(
      () => updatePhase(updatedPhase.id, updatedPhase),
      { context: 'Update Phase', fallbackMessage: 'Failed to update phase' }
    );
  };

  const handleDeletePhase = async (phaseToDelete) => {
    showConfirmDialog(
      'Delete Phase',
      `Are you sure you want to delete "${phaseToDelete.name}"? This action cannot be undone.`,
      async () => {
        await handleAsync(
          () => removePhase(phaseToDelete.id),
          { context: 'Delete Phase', fallbackMessage: 'Failed to delete phase' }
        );
      },
      'danger'
    );
  };

  if (isLoading) {
    return <div>Loading phases data...</div>;
  }

  if (!selectedWorkCenter) {
    return <div className="error">Please select a work center to view phases data.</div>;
  }

  return (
    <div className="content-section">
      <StickyHeader title="Phases Catalog" />
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
