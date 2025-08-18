import React, { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import PhasesForm from '../components/PhasesForm';
import EditableCell from '../components/EditableCell';
import { appStore } from '../scripts/store';

function PhasesPage() {
  const [phases, setPhases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!appStore.isInitialized()) {
        await appStore.init();
      }
      const state = appStore.getState();
      setPhases(state.phases);
      setIsLoading(false);

      const unsubscribe = appStore.subscribe((newState) => {
        setPhases(newState.phases);
      });

      return () => unsubscribe();
    }

    fetchData();
  }, []);

  const columns = useMemo(() => [
    { header: 'ID', accessorKey: 'id' },
    {
      header: 'Phase Name',
      accessorKey: 'name',
      cell: ({ row, table }) => (
        <EditableCell
          value={row.original.name}
          isEditing={table.options.meta?.editingRowId === row.id}
          onChange={(e) => table.options.meta?.setEditedData(prev => ({ ...prev, name: e.target.value }))}
        />
      )
    },
    {
      header: 'Department',
      accessorKey: 'department',
      cell: ({ row, table }) => (
        <EditableCell
          value={row.original.department}
          isEditing={table.options.meta?.editingRowId === row.id}
          onChange={(e) => table.options.meta?.setEditedData(prev => ({ ...prev, department: e.target.value }))}
        />
      )
    },
    {
      header: 'Work Center',
      accessorKey: 'work_center',
      cell: ({ row, table }) => (
        <EditableCell
          value={row.original.work_center}
          isEditing={table.options.meta?.editingRowId === row.id}
          onChange={(e) => table.options.meta?.setEditedData(prev => ({ ...prev, work_center: e.target.value }))}
        />
      )
    },
    { header: 'Print Speed (mt/h)', accessorKey: 'v_stampa' },
    { header: 'Print Setup (h)', accessorKey: 't_setup_stampa' },
    { header: 'Print Cost (€/h)', accessorKey: 'costo_h_stampa' },
    { header: 'Package Speed (pz/h)', accessorKey: 'v_conf' },
    { header: 'Package Setup (h)', accessorKey: 't_setup_conf' },
    { header: 'Package Cost (€/h)', accessorKey: 'costo_h_conf' },
    { header: '# People', accessorKey: 'numero_persone' },
    {
      header: 'Created At',
      accessorKey: 'created_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },
  ], []);

  const handleSavePhase = (updatedPhase) => {
    // Here you would add validation logic before updating
    console.log("Saving phase:", updatedPhase);
    appStore.updatePhase(updatedPhase.id, updatedPhase);
  };

  const handleDeletePhase = (phaseToDelete) => {
    if (window.confirm(`Are you sure you want to delete ${phaseToDelete.name}?`)) {
      console.log("Deleting phase:", phaseToDelete);
      appStore.removePhase(phaseToDelete.id);
    }
  };

  if (isLoading) {
    return <div>Loading phases data...</div>;
  }

  return (
    <>
      <PhasesForm />
      <div className="content-section">
        <h2>Phases Table</h2>
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
