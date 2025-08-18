import React, { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import PhasesForm from '../components/PhasesForm';
import EditableCell from '../components/EditableCell';
import { useStore } from '../store/useStore';

function PhasesPage() {
  const [error, setError] = useState(null);
  
  // Use Zustand store to select state and actions
  const phases = useStore(state => state.phases);
  const isLoading = useStore(state => state.isLoading);
  const isInitialized = useStore(state => state.isInitialized);
  const init = useStore(state => state.init);
  const updatePhase = useStore(state => state.updatePhase);
  const removePhase = useStore(state => state.removePhase);

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

  const validatePhase = (phase) => {
    const errors = [];

    if (!phase.name?.trim()) {
      errors.push('Phase name is required');
    }

    if (!phase.department) {
      errors.push('Department is required');
    }

    if (!phase.work_center) {
      errors.push('Work center is required');
    }

    if (phase.numero_persone < 1) {
      errors.push('Number of people must be at least 1');
    }

    if (phase.department === 'STAMPA') {
      if (phase.v_stampa <= 0) {
        errors.push('Printing speed must be greater than 0');
      }
      if (phase.t_setup_stampa < 0) {
        errors.push('Setup time cannot be negative');
      }
      if (phase.costo_h_stampa < 0) {
        errors.push('Hourly cost cannot be negative');
      }
    }

    if (phase.department === 'CONFEZIONAMENTO') {
      if (phase.v_conf <= 0) {
        errors.push('Packaging speed must be greater than 0');
      }
      if (phase.t_setup_conf < 0) {
        errors.push('Setup time cannot be negative');
      }
      if (phase.costo_h_conf < 0) {
        errors.push('Hourly cost cannot be negative');
      }
    }

    return errors;
  };

  const handleSavePhase = async (updatedPhase) => {
    try {
      const validationErrors = validatePhase(updatedPhase);
      
      if (validationErrors.length > 0) {
        alert(`Validation errors:\n${validationErrors.join('\n')}`);
        return;
      }

      await updatePhase(updatedPhase.id, updatedPhase);
    } catch (error) {
      console.error('Error updating phase:', error);
      alert('Failed to update phase. Please try again.');
    }
  };

  const handleDeletePhase = async (phaseToDelete) => {
    if (window.confirm(`Are you sure you want to delete ${phaseToDelete.name}?`)) {
      try {
        await removePhase(phaseToDelete.id);
      } catch (error) {
        console.error('Error deleting phase:', error);
        alert('Failed to delete phase. Please try again.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="content-section">
        <div className="loading">Loading phases data...</div>
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
          data={phases}
          onSaveRow={handleSavePhase}
          onDeleteRow={handleDeletePhase}
        />
      </div>
    </>
  );
}

export default PhasesPage;
