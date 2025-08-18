import React, { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import MachineForm from '../components/MachineForm';
import { appStore } from '../scripts/store';

// A more advanced EditableCell that handles different input types
const EditableCell = ({ row, column, table }) => {
  const initialValue = row.original[column.id];
  const isEditing = table.options.meta?.editingRowId === row.id;

  const handleInputChange = (e) => {
    table.options.meta?.setEditedData(prev => ({
      ...prev,
      [column.id]: e.target.value,
    }));
  };
  
  // Custom render logic based on column ID
  if (isEditing) {
    switch (column.id) {
        case 'status':
            return (
                <select defaultValue={initialValue} onChange={handleInputChange} style={{ width: '100%' }}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
            );
        case 'min_web_width':
        case 'max_web_width':
        case 'min_bag_height':
        case 'max_bag_height':
        case 'standard_speed':
        case 'setup_time_standard':
        case 'changeover_color':
        case 'changeover_material':
             return <input type="number" defaultValue={initialValue} onChange={handleInputChange} style={{ width: '100%' }} />;
        default:
            return <input type="text" defaultValue={initialValue} onChange={handleInputChange} style={{ width: '100%' }} />;
    }
  }

  return <span>{initialValue}</span>;
};


function MachineryPage() {
  const [machines, setMachines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!appStore.isInitialized()) await appStore.init();
      const state = appStore.getState();
      setMachines(state.machines);
      setIsLoading(false);
      const unsubscribe = appStore.subscribe((newState) => setMachines(newState.machines));
      return () => unsubscribe();
    }
    fetchData();
  }, []);

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
    },
    {
      header: 'Calendar',
      id: 'calendar',
      cell: ({ row }) => <a href={`/pages/machine-settings-page.html?machine=${encodeURIComponent(row.original.machine_name)}`} className="btn btn-secondary btn-small">📅</a>
    }
  ], []);

  const handleSaveMachine = (updatedMachine) => {
    // Here you would add validation logic before updating
    appStore.updateMachine(updatedMachine.id, updatedMachine);
  };

  const handleDeleteMachine = (machineToDelete) => {
    if (window.confirm(`Are you sure you want to delete ${machineToDelete.machine_name}?`)) {
      appStore.removeMachine(machineToDelete.id);
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
