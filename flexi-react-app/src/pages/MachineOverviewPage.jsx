import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import DataTable from '../components/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useMachines, useRemoveOrder } from '../hooks/useQueries';
import { useOrderStore, useMainStore, useUIStore } from '../store';
import { useErrorHandler } from '../hooks';

function MachineOverviewPage() {
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const navigate = useNavigate();
  
  const { data: machines = [], isLoading: machinesLoading } = useMachines();
  const { odpOrders } = useOrderStore();
  const { isLoading: storeLoading, isInitialized, init, cleanup } = useMainStore();
  const { showConfirmDialog } = useUIStore();
  const removeOrderMutation = useRemoveOrder();
  const { handleAsync } = useErrorHandler('MachineOverviewPage');

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

  const scheduledOdps = useMemo(() => {
    if (!selectedMachineId || !odpOrders || !Array.isArray(odpOrders)) return [];
    
    return odpOrders
      .filter(order => order && order.scheduled_machine_id === selectedMachineId)
      .sort((a, b) => {
        if (a.scheduled_start_time && b.scheduled_start_time) {
          return new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time);
        }
        return (a.odp_number || '').localeCompare(b.odp_number || '');
      });
  }, [selectedMachineId, odpOrders]);

  const handleEditOrder = (order) => {
    navigate(`/backlog/${order.id}/edit`);
  };

  const handleDeleteOrder = async (orderToDelete) => {
    showConfirmDialog(
      'Elimina Ordine',
      `Sei sicuro di voler eliminare "${orderToDelete.odp_number}"? Questa azione non può essere annullata.`,
      async () => {
        await handleAsync(
          async () => {
            await removeOrderMutation.mutateAsync(orderToDelete.id);
          },
          { 
            context: 'Delete Order', 
            fallbackMessage: 'Eliminazione ordine fallita'
          }
        );
      },
      'danger'
    );
  };

  // Reuse columns from BacklogListPage but minimal set
  const columns = useMemo(() => [
    { header: 'ODP', accessorKey: 'odp_number' },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Codice Articolo', accessorKey: 'article_code' },
    { header: 'Cliente', accessorKey: 'nome_cliente' },
    { header: 'Quantità', accessorKey: 'quantity' },
    { header: 'Quantità Completata', accessorKey: 'quantity_completed' },
    { header: 'Durata (h)', accessorKey: 'duration', cell: ({ row }) => row.original.duration?.toFixed(1) || 'N/A' },
    { 
      header: 'Inizio Programmato', 
      accessorKey: 'scheduled_start_time',
      cell: ({ row }) => row.original.scheduled_start_time 
        ? format(new Date(row.original.scheduled_start_time), 'dd/MM/yyyy HH:mm')
        : 'N/A'
    },
    { 
      header: 'Fine Programmata', 
      accessorKey: 'scheduled_end_time',
      cell: ({ row }) => row.original.scheduled_end_time 
        ? format(new Date(row.original.scheduled_end_time), 'dd/MM/yyyy HH:mm')
        : 'N/A'
    },
  ], []);

  if (machinesLoading || storeLoading) {
    return <div className="text-center py-4 text-[10px]">Caricamento...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Panoramica Macchina</h1>
        <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Seleziona macchina..." />
          </SelectTrigger>
          <SelectContent>
            {machines && Array.isArray(machines) ? machines.map(machine => (
              <SelectItem key={machine.id} value={machine.id.toString()}>
                {machine.machine_name}
              </SelectItem>
            )) : null}
          </SelectContent>
        </Select>
      </div>

      {selectedMachineId ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">
            ODPs su {machines && Array.isArray(machines) ? machines.find(m => m.id.toString() === selectedMachineId)?.machine_name || 'Macchina' : 'Macchina'} ({scheduledOdps?.length || 0})
          </h2>
          <DataTable 
            data={scheduledOdps || []}
            columns={columns}
            onEditRow={handleEditOrder}
            onDeleteRow={handleDeleteOrder}
          />
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 text-sm">
          Seleziona una macchina per vedere gli ODPs programmati
        </div>
      )}
    </div>
  );
}

export default MachineOverviewPage;
