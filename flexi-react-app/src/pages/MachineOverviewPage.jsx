import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useMachines, useOrders, useRemoveOrder } from '../hooks/useQueries';
import { useMainStore, useSchedulerStore, useUIStore } from '../store';
import { normalizeOdpNumber, showError, showSuccess } from '../utils';
import { formatScheduledTime, formatDeliveryDate } from '../utils/dateFormatting';
import { useQueryClient } from '@tanstack/react-query';
import { arrayMove } from '@dnd-kit/sortable';

function MachineOverviewPage() {
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const navigate = useNavigate();
  
  const { data: machines = [], isLoading: machinesLoading } = useMachines();
  const { data: odpOrders = [], isLoading: ordersLoading } = useOrders();
  const { isLoading: storeLoading, isInitialized, init, cleanup } = useMainStore();
  const { showConfirmDialog } = useUIStore();
  const removeOrderMutation = useRemoveOrder();
  const { reorderTaskInQueue } = useSchedulerStore();
  const queryClient = useQueryClient();
  const [reorderingId, setReorderingId] = useState(null);
  const [orderedOdps, setOrderedOdps] = useState([]);

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

  const scheduledKey = useMemo(
    () => scheduledOdps.map(order => order.id).join('|'),
    [scheduledOdps]
  );

  useEffect(() => {
    setOrderedOdps(scheduledOdps);
  }, [scheduledKey]);

  const handleEditOrder = (order) => {
    navigate(`/backlog/${order.id}/edit`);
  };

  const handleDeleteOrder = async (orderToDelete) => {
    showConfirmDialog(
      'Elimina Ordine',
        `Sei sicuro di voler eliminare "${normalizeOdpNumber(orderToDelete.odp_number)}"? Questa azione non può essere annullata.`,
      async () => {
        try {
          await removeOrderMutation.mutateAsync(orderToDelete.id);
          showSuccess(`Ordine "${normalizeOdpNumber(orderToDelete.odp_number)}" eliminato con successo`);
        } catch (error) {
          showError(error.message || 'Eliminazione ordine fallita');
        }
      },
      'danger'
    );
  };

  const handleRowReorder = useCallback(async ({ oldIndex, newIndex, activeId }) => {
    if (!selectedMachineId || reorderingId) return;
    if (oldIndex === newIndex) return;

    setReorderingId(activeId);
    setOrderedOdps((prev) => arrayMove(prev, oldIndex, newIndex));

    try {
      await queryClient.refetchQueries({ queryKey: ['orders'], exact: true, type: 'active' });
      const freshOrders = queryClient.getQueryData(['orders']) || [];
      const result = await reorderTaskInQueue(selectedMachineId, activeId, oldIndex, newIndex, freshOrders);
      if (result?.error) {
        showError(result.error);
      } else {
        await queryClient.refetchQueries({ queryKey: ['orders'], exact: true, type: 'active' });
        showSuccess('Sequenza aggiornata');
      }
    } catch (error) {
      showError('Errore durante il riordino');
    } finally {
      setReorderingId(null);
    }
  }, [queryClient, reorderTaskInQueue, selectedMachineId, reorderingId]);

  // Reuse columns from BacklogListPage but minimal set
  const columns = useMemo(() => [
    { 
      header: 'ODP', 
      accessorKey: 'odp_number',
      cell: ({ row }) => normalizeOdpNumber(row.original.odp_number)
    },
    { header: 'Codice Articolo', accessorKey: 'article_code' },
    { header: 'Cliente', accessorKey: 'nome_cliente' },
    { header: 'Quantità', accessorKey: 'quantity' },
    { header: 'Quantità Completata', accessorKey: 'quantity_completed' },
    { header: 'Passo Busta (mm)', accessorKey: 'bag_step' },
    { header: 'Altezza Busta (mm)', accessorKey: 'bag_height' },
    { 
      header: 'Data Consegna', 
      accessorKey: 'delivery_date',
      cell: ({ row }) => row.original.delivery_date
        ? formatDeliveryDate(row.original.delivery_date)
        : 'Non impostata'
    },
    { header: '%ISP', accessorKey: 'material_availability_isp', cell: ({ row }) => row.original.material_availability_isp != null ? `${row.original.material_availability_isp}%` : 'N/A' },
    { header: '%Mat. Globale', accessorKey: 'material_availability_global', cell: ({ row }) => row.original.material_availability_global != null ? `${row.original.material_availability_global}%` : 'N/A' },
    { header: 'Durata (h)', accessorKey: 'duration', cell: ({ row }) => row.original.duration?.toFixed(1) || 'N/A' },
    { 
      header: 'Inizio Programmato', 
      accessorKey: 'scheduled_start_time',
      cell: ({ row }) => row.original.scheduled_start_time 
        ? formatScheduledTime(row.original.scheduled_start_time)
        : 'N/A'
    },
    { 
      header: 'Fine Programmata', 
      accessorKey: 'scheduled_end_time',
      cell: ({ row }) => row.original.scheduled_end_time 
        ? formatScheduledTime(row.original.scheduled_end_time)
        : 'N/A'
    },
  ], []);

  const renderRowActions = useCallback((order) => {
    return (
      <>
        <button 
          className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          title={`Codice Articolo: ${order.article_code || 'Non specificato'}
Codice Articolo Esterno: ${order.external_article_code || 'Non specificato'}
Nome Cliente: ${order.nome_cliente || 'Non specificato'}
Data Consegna: ${order.delivery_date ? formatDeliveryDate(order.delivery_date) : 'Non impostata'}
Quantità: ${order.quantity || 'Non specificata'}
Note Libere: ${order.user_notes || 'Nessuna nota'}
Note ASD: ${order.asd_notes || 'Nessuna nota'}
Material Global: ${order.material_availability_global || 'N/A'}%`}
        >
          i
        </button>
      </>
    );
  }, []);

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
            data={orderedOdps || []}
            columns={columns}
            onEditRow={handleEditOrder}
            onDeleteRow={handleDeleteOrder}
            renderRowActions={renderRowActions}
            enableRowReorder={true}
            onRowReorder={handleRowReorder}
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
