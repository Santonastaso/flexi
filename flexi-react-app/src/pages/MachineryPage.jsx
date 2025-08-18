import React, { useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import MachineForm from '../components/MachineForm';
import EditableCell from '../components/EditableCell';
import { useStore } from '../store/useStore';

function MachineryPage() {
  // Use Zustand store to select state and actions
  const machines = useStore(state => state.machines);
  const isLoading = useStore(state => state.isLoading);
  const isInitialized = useStore(state => state.isInitialized);
  const init = useStore(state => state.init);
  const updateMachine = useStore(state => state.updateMachine);
  const removeMachine = useStore(state => state.removeMachine);

  // Initialize store on component mount
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [init, isInitialized]);

  const columns = useMemo(() => [
    // Identificazione
    { header: 'Machine ID', accessorKey: 'machine_id' },
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
    }
  ], []);

  const handleSaveMachine = (updatedMachine) => {
    // Here you would add validation logic before updating
    updateMachine(updatedMachine.id, updatedMachine);
  };

  const handleDeleteMachine = (machineToDelete) => {
    if (window.confirm(`Are you sure you want to delete ${machineToDelete.machine_name}?`)) {
      removeMachine(machineToDelete.id);
    }
  };

  if (isLoading) {
    return <div>Loading machinery data...</div>;
  }

  return (
    <>
      <MachineForm />
      <div className="content-section">
        <h2>Machinery Catalog</h2>
        <DataTable
          columns={columns}
          data={machines}
          onSaveRow={handleSaveMachine}
          onDeleteRow={handleDeleteMachine}
        />
      </div>
    </>
  );
}

export default MachineryPage;
