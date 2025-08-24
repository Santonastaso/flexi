import React, { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import PhasesForm from '../components/PhasesForm';
import EditableCell from '../components/EditableCell';
import { usePhaseStore, useUIStore, useMainStore } from '../store';
import { usePhaseValidation } from '../hooks/usePhaseValidation';
import { WORK_CENTERS } from '../constants';
import { useErrorHandler } from '../hooks';

function PhasesPage() {
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

  // Use the new phase validation hook
  const { validatePhase } = usePhaseValidation();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('PhasesPage');

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
    { header: 'ID', accessorKey: 'id' },
    { header: 'Phase Name', accessorKey: 'name', cell: EditableCell },
    { header: 'Department', accessorKey: 'department', cell: EditableCell },
    { header: 'Work Center', accessorKey: 'work_center', cell: EditableCell },
    { header: 'Print Speed (mt/h)', accessorKey: 'v_stampa', cell: EditableCell },
    { header: 'Print Setup (h)', accessorKey: 't_setup_stampa', cell: EditableCell },
    { header: 'Print Cost (€/h)', accessorKey: 'costo_h_stampa', cell: EditableCell },
    { header: 'Package Speed (pz/h)', accessorKey: 'v_conf', cell: EditableCell },
    { header: 'Package Setup (h)', accessorKey: 't_setup_conf', cell: EditableCell },
    { header: 'Package Cost (€/h)', accessorKey: 'costo_h_conf', cell: EditableCell },
    { header: '# People', accessorKey: 'numero_persone', cell: EditableCell },
    {
      header: 'Created At',
      accessorKey: 'created_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },
  ], []);



  const handleSavePhase = async (updatedPhase) => {
    const validationErrors = validatePhase(updatedPhase);
    
    if (validationErrors.length > 0) {
      // Show validation errors in the store alert
      showAlert(`Validation errors:\n${validationErrors.join('\n')}`, 'error');
      return;
    }

    await handleAsync(
      () => updatePhase(updatedPhase.id, updatedPhase),
      { 
        context: 'Update Phase', 
        fallbackMessage: 'Failed to update phase' 
      }
    );
  };

  const handleDeletePhase = async (phaseToDelete) => {
    showConfirmDialog(
      'Delete Phase',
      `Are you sure you want to delete "${phaseToDelete.name}"? This action cannot be undone.`,
      async () => {
        await handleAsync(
          () => removePhase(phaseToDelete.id),
          { 
            context: 'Delete Phase', 
            fallbackMessage: 'Failed to delete phase' 
          }
        );
      },
      'danger'
    );
  };

  if (isLoading) {
    return (
      <div className="content-section">
        <div className="loading">Loading phases data...</div>
      </div>
    );
  }

  if (!selectedWorkCenter) {
    return (
      <div className="content-section">
        <div className="error">Please select a work center to view phases data.</div>
      </div>
    );
  }

  return (
    <>
      <PhasesForm />
      <div className="content-section">
        <h2>Production Phases</h2>
        <DataTable
          columns={columns}
          data={filteredPhases}
          onSaveRow={handleSavePhase}
          onDeleteRow={handleDeletePhase}
        />
      </div>
    </>
  );
}

export default PhasesPage;
