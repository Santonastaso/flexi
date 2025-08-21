import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import MachineForm from '../components/MachineForm';
import EditableCell from '../components/EditableCell';
import { useStore } from '../store/useStore';
import { useMachineValidation } from '../hooks';
import { WORK_CENTERS } from '../constants';

function MachineryPage() {
  // Use Zustand store to select state and actions
  const machines = useStore(state => state.machines);
  const selectedWorkCenter = useStore(state => state.selectedWorkCenter);
  const isLoading = useStore(state => state.isLoading);
  const isInitialized = useStore(state => state.isInitialized);
  const init = useStore(state => state.init);
  const updateMachine = useStore(state => state.updateMachine);
  const removeMachine = useStore(state => state.removeMachine);
  const showAlert = useStore(state => state.showAlert);
  const showConfirmDialog = useStore(state => state.showConfirmDialog);

  // Filter machines by work center
  const filteredMachines = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return machines;
    
    const filtered = machines.filter(machine => machine.work_center === selectedWorkCenter);
    
    // Debug logging
    console.log('🔍 MachineryPage: Original machines count:', machines.length);
    console.log('🔍 MachineryPage: Selected work center:', selectedWorkCenter);
    console.log('🔍 MachineryPage: Filtered machines count:', filtered.length);
    
    // Check for duplicates in filtered data
    const ids = filtered.map(m => m.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      console.warn('⚠️ MachineryPage: Duplicate IDs in filtered machines:', duplicateIds);
    }
    
    return filtered;
  }, [machines, selectedWorkCenter]);

  // Use modern validation hook
  const { validateMachine } = useMachineValidation();

  // Initialize store on component mount
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [init, isInitialized]);

  const columns = useMemo(() => [
    // Identificazione
    { header: 'Machine ID', accessorKey: 'id' },
    { header: 'Machine Type', accessorKey: 'machine_type' },
    { header: 'Machine Name', accessorKey: 'machine_name', cell: EditableCell },
    { header: 'Work Center', accessorKey: 'work_center' },
    { header: 'Department', accessorKey: 'department' },
    { header: 'Status', accessorKey: 'status', cell: EditableCell },
    // Capacità Tecniche
    { header: 'Min Web (mm)', accessorKey: 'min_web_width', cell: EditableCell },
    { header: 'Max Web (mm)', accessorKey: 'max_web_width', cell: EditableCell },
    { header: 'Min Bag (mm)', accessorKey: 'min_bag_height', cell: EditableCell },
    { header: 'Max Bag (mm)', accessorKey: 'max_bag_height', cell: EditableCell },
    // Performance
    { header: 'Std Speed', accessorKey: 'standard_speed', cell: EditableCell },
    { header: 'Setup (h)', accessorKey: 'setup_time_standard', cell: EditableCell },
    { header: 'Color Change (h)', accessorKey: 'changeover_color', cell: EditableCell },
    { header: 'Material Change (h)', accessorKey: 'changeover_material', cell: EditableCell },
    // Disponibilità
    { 
      header: 'Active Shifts', 
      accessorKey: 'active_shifts',
      cell: info => Array.isArray(info.getValue()) ? info.getValue().join(', ') : ''
    },
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
    // Calendar
    {
      header: 'Calendar',
      accessorKey: 'id',
      cell: info => (
        <Link 
          to={`/machinery/${info.getValue()}/calendar`}
          className="btn btn-primary btn-sm"
        >
          View Calendar
        </Link>
      )
    }
  ], []);

  const handleSaveMachine = async (updatedMachine) => {
    // Use the new validation hook
    const validationErrors = validateMachine(updatedMachine);
    
    if (validationErrors.length > 0) {
      // Show validation errors in the store alert
      showAlert(`Validation errors:\n${validationErrors.join('\n')}`, 'error');
      return;
    }
    
    try {
      await updateMachine(updatedMachine.id, updatedMachine);
    } catch (error) {
      // Error is already handled by the store
      console.error('Failed to update machine:', error);
    }
  };

  const handleDeleteMachine = async (machineToDelete) => {
    showConfirmDialog(
      'Delete Machine',
      `Are you sure you want to delete "${machineToDelete.machine_name}"? This action cannot be undone.`,
      async () => {
        try {
          await removeMachine(machineToDelete.id);
        } catch (error) {
          // Error is already handled by the store
          console.error('Failed to delete machine:', error);
        }
      },
      'danger'
    );
  };

  if (isLoading) {
    return <div>Loading machinery data...</div>;
  }

  if (!selectedWorkCenter) {
    return <div className="error">Please select a work center to view machinery data.</div>;
  }

  return (
    <>
      <MachineForm />
      <div className="content-section">
        <h2>Machinery Catalog</h2>
        {/* Temporary debug controls - remove after fixing duplicate issue */}
        <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          <button 
            onClick={() => useStore.getState().debugData()} 
            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
          >
            Debug Data
          </button>
          <button 
            onClick={() => useStore.getState().cleanupDuplicates()} 
            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#ff6b6b', color: 'white', border: 'none', borderRadius: '2px' }}
          >
            Clean Duplicates
          </button>
          <button 
            onClick={() => {
              console.log('🔄 Manually refreshing data...');
              useStore.getState().refreshData();
            }} 
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '2px' }}
          >
            Refresh Data
          </button>
        </div>
        <DataTable
          columns={columns}
          data={filteredMachines}
          onSaveRow={handleSaveMachine}
          onDeleteRow={handleDeleteMachine}
        />
      </div>
    </>
  );
}

export default MachineryPage;
