import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import MachineForm from '../components/MachineForm';
import EditableCell from '../components/EditableCell';
import StickyHeader from '../components/StickyHeader';
import { useMachineStore, useUIStore, useMainStore } from '../store';
import { useMachineValidation, useErrorHandler } from '../hooks';
import { WORK_CENTERS } from '../constants';

function MachineryPage() {
  // Use Zustand store to select state and actions
  const { machines, updateMachine, removeMachine } = useMachineStore();
  const { selectedWorkCenter, isLoading, isInitialized, showAlert, showConfirmDialog } = useUIStore();
  const { init, cleanup } = useMainStore();

  // Filter machines by work center
  const filteredMachines = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return machines;
    return machines.filter(machine => machine.work_center === selectedWorkCenter);
  }, [machines, selectedWorkCenter]);

  // Use modern validation hook
  const { validateMachine } = useMachineValidation();
  
  // Use unified error handling
  const { handleCrudError, handleAsync } = useErrorHandler('MachineryPage');

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
          className="nav-btn today"
          style={{ textDecoration: 'none' }}
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
    
    await handleAsync(
      () => updateMachine(updatedMachine.id, updatedMachine),
      { context: 'Update Machine', fallbackMessage: 'Failed to update machine' }
    );
  };

  const handleDeleteMachine = async (machineToDelete) => {
    showConfirmDialog(
      'Delete Machine',
      `Are you sure you want to delete "${machineToDelete.machine_name}"? This action cannot be undone.`,
      async () => {
        await handleAsync(
          () => removeMachine(machineToDelete.id),
          { context: 'Delete Machine', fallbackMessage: 'Failed to delete machine' }
        );
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
        <StickyHeader title="Machinery Catalog" />
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
