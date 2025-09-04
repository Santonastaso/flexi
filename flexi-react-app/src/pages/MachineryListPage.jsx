import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import EditableCell from '../components/EditableCell';

import { useUIStore } from '../store';
import { useValidation, useErrorHandler, useMachinesByWorkCenter, useUpdateMachine, useRemoveMachine } from '../hooks';
import { showValidationError, showError } from '../utils';
import { WORK_CENTERS } from '../constants';

function MachineryListPage() {
  const { selectedWorkCenter, showConfirmDialog } = useUIStore();

  // React Query hooks
  const { data: machines = [], isLoading, error } = useMachinesByWorkCenter(selectedWorkCenter);
  const updateMachineMutation = useUpdateMachine();
  const removeMachineMutation = useRemoveMachine();

  // Use unified validation hook
  const { validateMachine } = useValidation();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('MachineryListPage');

  // Show error if query failed
  if (error) {
           return <div className="text-center py-4 text-red-600 text-xs">Errore nel caricamento delle macchine: {error.message}</div>;
  }

  const columns = useMemo(() => [
    // Identificazione
    { header: 'Nome Macchina', accessorKey: 'machine_name', cell: EditableCell },
    { header: 'Centro di Lavoro', accessorKey: 'work_center' },
    { header: 'Reparto', accessorKey: 'department' },
    { header: 'Stato', accessorKey: 'status', cell: EditableCell },
    // Capacità Tecniche
    { header: 'Larghezza Min (mm)', accessorKey: 'min_web_width', cell: EditableCell },
    { header: 'Larghezza Max (mm)', accessorKey: 'max_web_width', cell: EditableCell },
    { header: 'Altezza Min (mm)', accessorKey: 'min_bag_height', cell: EditableCell },
    { header: 'Altezza Max (mm)', accessorKey: 'max_bag_height', cell: EditableCell },
    // Performance
    { header: 'Velocità Std', accessorKey: 'standard_speed', cell: EditableCell },
    { header: 'Setup (h)', accessorKey: 'setup_time_standard', cell: EditableCell },
    { header: 'Cambio Colore (h)', accessorKey: 'changeover_color', cell: EditableCell },
    { header: 'Cambio Materiale (h)', accessorKey: 'changeover_material', cell: EditableCell },
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
          className="inline-flex items-center px-2 py-1 border border-gray-300 rounded shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Visualizza Calendario
        </Link>
      )
    }
  ], []);

  const handleSaveMachine = async (updatedMachine) => {
    // Use the unified validation hook
    const validation = validateMachine(updatedMachine);
    
    if (!validation.isValid) {
      showValidationError(Object.values(validation.errors));
      return;
    }
    
    await handleAsync(
      async () => {
        await updateMachineMutation.mutateAsync({ 
          id: updatedMachine.id, 
          updates: updatedMachine 
        });
      },
      { 
        context: 'Update Machine', 
        fallbackMessage: 'Aggiornamento macchina fallito'
      }
    );
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
           return <div className="text-center py-4 text-red-600 text-xs">Seleziona un centro di lavoro per visualizzare i dati delle macchine.</div>;
  }

  return (
    <div className="p-2 bg-white rounded shadow-sm border min-w-0">
      
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={machines}
          onSaveRow={handleSaveMachine}
          onDeleteRow={handleDeleteMachine}
        />
      </div>
    </div>
  );
}

export default MachineryListPage;
