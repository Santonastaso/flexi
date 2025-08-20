import React, { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import PhasesForm from '../components/PhasesForm';
import EditableCell from '../components/EditableCell';
import { useStore } from '../store/useStore';
import { usePhaseValidation } from '../hooks/usePhaseValidation';
import { WORK_CENTERS } from '../constants';

function PhasesPage() {
  const [error, setError] = useState(null);
  
  // Use Zustand store to select state and actions
  const phases = useStore(state => state.phases);
  const selectedWorkCenter = useStore(state => state.selectedWorkCenter);
  const isLoading = useStore(state => state.isLoading);
  const isInitialized = useStore(state => state.isInitialized);
  const init = useStore(state => state.init);
  const updatePhase = useStore(state => state.updatePhase);
  const removePhase = useStore(state => state.removePhase);
  const showAlert = useStore(state => state.showAlert);
  const showConfirmDialog = useStore(state => state.showConfirmDialog);

  // Filter phases by work center
  const filteredPhases = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return phases;
    return phases.filter(phase => phase.work_center === selectedWorkCenter);
  }, [phases, selectedWorkCenter]);

  // Use the new phase validation hook
  const { validatePhase } = usePhaseValidation();

  // Initialize store on component mount
  useEffect(() => {
    if (!isInitialized) {
      init().catch(err => {
        setError('Failed to load phases data');
        console.error('Error loading phases:', err);
      });
    }
  }, [init, isInitialized]);

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
    try {
      const validationErrors = validatePhase(updatedPhase);
      
      if (validationErrors.length > 0) {
        // Show validation errors in the store alert
        showAlert(`Validation errors:\n${validationErrors.join('\n')}`, 'error');
        return;
      }

      await updatePhase(updatedPhase.id, updatedPhase);
    } catch (error) {
      // Error is already handled by the store
      console.error('Error updating phase:', error);
    }
  };

  const handleDeletePhase = async (phaseToDelete) => {
    showConfirmDialog(
      'Delete Phase',
      `Are you sure you want to delete "${phaseToDelete.name}"? This action cannot be undone.`,
      async () => {
        try {
          await removePhase(phaseToDelete.id);
        } catch (error) {
          // Error is already handled by the store
          console.error('Error deleting phase:', error);
        }
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

  if (error) {
    return (
      <div className="content-section">
        <div className="error-message" style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
          {error}
        </div>
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
