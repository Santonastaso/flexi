import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';

import { useUIStore } from '../store';
import { useErrorHandler, useMachinesByWorkCenter, useRemoveMachine } from '../hooks';
import { showError, showSuccess } from '../utils';
import { WORK_CENTERS } from '../constants';

function MachineryListPage() {
  const { selectedWorkCenter, showConfirmDialog } = useUIStore();
  const navigate = useNavigate();

  // React Query hooks
  const { data: machines = [], isLoading, error } = useMachinesByWorkCenter(selectedWorkCenter);
  const removeMachineMutation = useRemoveMachine();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('MachineryListPage');

  // Show error if query failed
  if (error) {
           return <div className="text-center py-2 text-red-600 text-[10px]">Errore nel caricamento delle macchine: {error.message}</div>;
  }

  const columns = useMemo(() => [
    // Identificazione
    { header: 'Nome Macchina', accessorKey: 'machine_name' },
    { header: 'Centro di Lavoro', accessorKey: 'work_center' },
    { header: 'Reparto', accessorKey: 'department' },
    { header: 'Stato', accessorKey: 'status' },
    // Capacità Tecniche
    { header: 'Larghezza Min (mm)', accessorKey: 'min_web_width' },
    { header: 'Larghezza Max (mm)', accessorKey: 'max_web_width' },
    { header: 'Altezza Min (mm)', accessorKey: 'min_bag_height' },
    { header: 'Altezza Max (mm)', accessorKey: 'max_bag_height' },
    // Performance
    { header: 'Velocità Std', accessorKey: 'standard_speed' },
    { header: 'Setup (h)', accessorKey: 'setup_time_standard' },
    { header: 'Cambio Colore (h)', accessorKey: 'changeover_color' },
    { header: 'Cambio Materiale (h)', accessorKey: 'changeover_material' },
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
          className="inline-flex items-center px-1 py-1 border border-gray-300 rounded shadow-sm text-[10px] font-medium text-gray-700 bg-white hover:bg-gray-50"
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
    showConfirmDialog(
      'Elimina Macchina',
      `Sei sicuro di voler eliminare "${machineToDelete.machine_name}"? Questa azione non può essere annullata.`,
      async () => {
        await handleAsync(
          async () => {
            await removeMachineMutation.mutateAsync(machineToDelete.id);
          },
          { 
            context: 'Delete Machine', 
            fallbackMessage: 'Eliminazione macchina fallita'
          }
        );
      },
      'danger'
    );
  };

  if (isLoading) {
    return <div>Caricamento dati macchine...</div>;
  }

  if (!selectedWorkCenter) {
           return <div className="text-center py-2 text-red-600 text-[10px]">Seleziona un centro di lavoro per visualizzare i dati delle macchine.</div>;
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
