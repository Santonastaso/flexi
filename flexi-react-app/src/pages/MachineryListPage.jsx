import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';

import { useUIStore } from '../store';
import { useConfirmDelete, useMachinesByWorkCenter, useRemoveMachine } from '../hooks';
import { simpleColumn } from '../utils';
import { WORK_CENTERS } from '../constants';
import LoadingState from '../components/LoadingState';

function MachineryListPage() {
  const { selectedWorkCenter } = useUIStore();
  const navigate = useNavigate();

  // React Query hooks
  const { data: machines = [], isLoading, error } = useMachinesByWorkCenter(selectedWorkCenter);
  const removeMachineMutation = useRemoveMachine();
  const confirmDelete = useConfirmDelete();

  const columns = useMemo(() => [
    // Identificazione
    simpleColumn('Nome Macchina', 'machine_name'),
    simpleColumn('Centro di Lavoro', 'work_center'),
    simpleColumn('Reparto', 'department'),
    simpleColumn('Stato', 'status'),
    // Capacità Tecniche
    simpleColumn('Larghezza Min (mm)', 'min_web_width'),
    simpleColumn('Larghezza Max (mm)', 'max_web_width'),
    simpleColumn('Altezza Min (mm)', 'min_bag_height'),
    simpleColumn('Altezza Max (mm)', 'max_bag_height'),
    // Performance
    simpleColumn('Velocità Std', 'standard_speed'),
    simpleColumn('Setup (h)', 'setup_time_standard'),
    simpleColumn('Cambio Colore (h)', 'changeover_color'),
    simpleColumn('Cambio Materiale (h)', 'changeover_material'),
    // Disponibilità
    { 
      header: 'Turni Attivi', 
      accessorKey: 'active_shifts',
      cell: info => Array.isArray(info.getValue()) ? info.getValue().join(', ') : ''
    },
    // Calendar
    {
      header: 'Calendario',
      accessorKey: 'id',
      cell: info => (
        <Link 
          to={`/machinery/${info.getValue()}/calendar`}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Visualizza Calendario
        </Link>
      )
    }
  ], []);

  const handleEditMachine = (machine) => {
    navigate(`/machinery/${machine.id}/edit`);
  };

  const handleDeleteMachine = async (machineToDelete) => {
    confirmDelete({
      title: 'Elimina Macchina',
      message: `Sei sicuro di voler eliminare "${machineToDelete.machine_name}"? Questa azione non può essere annullata.`,
      onConfirm: () => removeMachineMutation.mutateAsync(machineToDelete.id),
      successMessage: `Macchina "${machineToDelete.machine_name}" eliminata con successo`,
      errorMessage: 'Eliminazione macchina fallita'
    });
  };

  // Show error if query failed
  if (error) {
    return <div className="text-center py-2 text-red-600 text-xs">Errore nel caricamento delle macchine: {error.message}</div>;
  }

  if (isLoading) {
    return <LoadingState message="Caricamento dati macchine..." />;
  }

  if (!selectedWorkCenter) {
    return <div className="text-center py-2 text-red-600 text-xs">Seleziona un centro di lavoro per visualizzare i dati delle macchine.</div>;
  }

  return (
    <div className="p-1 bg-white rounded shadow-sm border min-w-0">
      
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={machines}
          onEditRow={handleEditMachine}
          onDeleteRow={handleDeleteMachine}
        />
      </div>
    </div>
  );
}

export default MachineryListPage;
