import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { useConfirmDelete } from '../hooks';
import { useMachines, useOrders, useRemoveOrder } from '../hooks/useQueries';
import { useMainStore, useSchedulerStore } from '../store';
import {
  deliveryDateColumn,
  fixedNumberColumn,
  formatTaskInfoTooltip,
  normalizeOdpNumber,
  odpColumn,
  percentTextColumn,
  scheduledTimeColumn,
  showError,
  showSuccess,
  simpleColumn
} from '../utils';
import { useQueryClient } from '@tanstack/react-query';
import { arrayMove } from '@dnd-kit/sortable';
import LoadingState from '../components/LoadingState';

function MachineOverviewPage() {
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const navigate = useNavigate();
  
  const { data: machines = [], isLoading: machinesLoading } = useMachines();
  const { data: odpOrders = [] } = useOrders();
  const { isLoading: storeLoading } = useMainStore();
  const removeOrderMutation = useRemoveOrder();
  const confirmDelete = useConfirmDelete();
  const { reorderTaskInQueue } = useSchedulerStore();
  const queryClient = useQueryClient();
  const [reorderingId, setReorderingId] = useState(null);
  const [orderedOdps, setOrderedOdps] = useState([]);

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
  }, [scheduledKey, scheduledOdps]);

  const handleEditOrder = (order) => {
    navigate(`/backlog/${order.id}/edit`);
  };

  const handleDeleteOrder = async (orderToDelete) => {
    const displayOdp = normalizeOdpNumber(orderToDelete.odp_number);
    confirmDelete({
      title: 'Elimina Ordine',
      message: `Sei sicuro di voler eliminare "${displayOdp}"? Questa azione non può essere annullata.`,
      onConfirm: () => removeOrderMutation.mutateAsync(orderToDelete.id),
      successMessage: `Ordine "${displayOdp}" eliminato con successo`,
      errorMessage: 'Eliminazione ordine fallita'
    });
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
    } catch {
      showError('Errore durante il riordino');
    } finally {
      setReorderingId(null);
    }
  }, [queryClient, reorderTaskInQueue, selectedMachineId, reorderingId]);

  // Reuse columns from BacklogListPage but minimal set
  const columns = useMemo(() => [
    odpColumn('ODP'),
    simpleColumn('Codice Articolo', 'article_code'),
    simpleColumn('Cliente', 'nome_cliente'),
    simpleColumn('Quantità', 'quantity'),
    simpleColumn('Quantità Completata', 'quantity_completed'),
    simpleColumn('Passo Busta (mm)', 'bag_step'),
    simpleColumn('Altezza Busta (mm)', 'bag_height'),
    deliveryDateColumn('Data Consegna', 'delivery_date'),
    percentTextColumn('%ISP', 'material_availability_isp'),
    percentTextColumn('%Mat. Globale', 'material_availability_global'),
    fixedNumberColumn('Durata (h)', 'duration', 1, 'N/A'),
    scheduledTimeColumn('Inizio Programmato', 'scheduled_start_time', 'N/A'),
    scheduledTimeColumn('Fine Programmata', 'scheduled_end_time', 'N/A'),
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
          title={formatTaskInfoTooltip(order)}
        >
          i
        </button>
      </>
    );
  }, []);

  if (machinesLoading || storeLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Panoramica Macchina</h1>
        <select
          value={selectedMachineId}
          onChange={(event) => setSelectedMachineId(event.target.value)}
          className="w-64 h-8 rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">Seleziona macchina...</option>
          {machines && Array.isArray(machines) ? machines.map(machine => (
            <option key={machine.id} value={machine.id.toString()}>
              {machine.machine_name}
            </option>
          )) : null}
        </select>
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
