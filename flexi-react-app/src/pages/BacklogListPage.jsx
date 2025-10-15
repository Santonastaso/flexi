import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';

import { useUIStore } from '../store';
import { useErrorHandler, useOrders, useMachines, usePhases, useRemoveOrder } from '../hooks';
import { showSuccess } from '../utils';
import { WORK_CENTERS } from '../constants';
import { format } from 'date-fns';

function BacklogListPage() {
  const { selectedWorkCenter, showConfirmDialog } = useUIStore();
  const navigate = useNavigate();

  // React Query hooks
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useOrders();
  const { data: machines = [], isLoading: machinesLoading } = useMachines();
  const { data: phases = [], isLoading: phasesLoading } = usePhases();
  const removeOrderMutation = useRemoveOrder();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('BacklogListPage');

  // Show error if query failed
  if (ordersError) {
           return <div className="text-center py-2 text-red-600 text-[10px]">Errore nel caricamento degli ordini: {ordersError.message}</div>;
  }

  // Filter orders by work center and join with machine and phase data
  const filteredOrders = useMemo(() => {
    if (!selectedWorkCenter) return [];
    
    let filteredOrders = orders;
    if (selectedWorkCenter !== WORK_CENTERS.BOTH) {
      filteredOrders = orders.filter(order => order.work_center === selectedWorkCenter);
    }
    
    // Join with machine and phase data
    return filteredOrders.map(order => ({
      ...order,
      machine_name: order.scheduled_machine_id 
        ? machines.find(m => m.id === order.scheduled_machine_id)?.machine_name || 'Macchina non trovata'
        : 'Non programmato',
      phase_name: order.fase 
        ? phases.find(p => p.id === order.fase)?.name || 'Fase non trovata'
        : 'Fase non assegnata',
      // Ensure progress and time_remaining have fallback values
      progress: order.progress || 0,
      time_remaining: order.time_remaining || order.duration || 0
    }));
  }, [orders, selectedWorkCenter, machines, phases]);

  const isLoading = ordersLoading || machinesLoading || phasesLoading;

  const columns = useMemo(() => [
    // Primary columns - most important first
    { 
      header: 'Numero ODP', 
      accessorKey: 'odp_number',
      cell: info => {
        const status = info.row.original.status;
        const value = info.getValue();
        const isScheduled = status === 'SCHEDULED';
        return (
          <span className={isScheduled ? 'text-green-600 font-medium' : ''}>
            {value}
          </span>
        );
      }
    },
    { header: 'Codice Articolo', accessorKey: 'article_code' },
    { 
      header: 'Note ASD', 
      accessorKey: 'asd_notes',
      cell: info => {
        const value = info.getValue();
        if (!value) return 'N/A';
        return (
          <div className="max-w-[200px] truncate text-[10px]" title={value}>
            {value}
          </div>
        );
      }
    },
    { header: 'Nome Cliente', accessorKey: 'nome_cliente' },
    { header: 'Quantità', accessorKey: 'quantity' },
    { header: 'Quantità Completata', accessorKey: 'quantity_completed' },
    { header: 'Altezza Busta (mm)', accessorKey: 'bag_height' },
    { header: 'Larghezza Busta (mm)', accessorKey: 'bag_width' },
    { header: 'Passo Busta (mm)', accessorKey: 'bag_step' },
    
    // Secondary columns
    { header: 'Lotto Produzione', accessorKey: 'production_lot' },
    { header: 'Centro di Lavoro', accessorKey: 'work_center' },
    { header: 'Reparto', accessorKey: 'department' },
    { header: 'Lati Sigillati', accessorKey: 'seal_sides' },
    { header: 'Tipo Prodotto', accessorKey: 'product_type' },
    
    // Date e Tempi
    { 
      header: 'Data Consegna', 
      accessorKey: 'delivery_date',
              cell: info => info.getValue() ? format(new Date(info.getValue()), 'yyyy-MM-dd') : 'Non impostata'
    },
    { 
      header: 'Inizio Programmato', 
      accessorKey: 'scheduled_start_time',
      cell: info => info.getValue() ? new Date(info.getValue()).toISOString().replace('T', ' ').replace('.000Z', '') : 'Non programmato'
    },
    { 
      header: 'Fine Programmata', 
      accessorKey: 'scheduled_end_time',
      cell: info => info.getValue() ? new Date(info.getValue()).toISOString().replace('T', ' ').replace('.000Z', '') : 'Non programmato'
    },
    
    // Codici Cliente
    { header: 'Codice Cliente Interno', accessorKey: 'internal_customer_code' },
    { header: 'Codice Cliente Esterno', accessorKey: 'external_customer_code' },
    { header: 'Riferimento Ordine Cliente', accessorKey: 'customer_order_ref' },
    { header: 'Note Libere', accessorKey: 'user_notes' },
    
    // Fase e Calcoli
    { header: 'Nome Fase', accessorKey: 'phase_name' },
    { 
      header: 'Durata (ore)', 
      accessorKey: 'duration', 
      cell: info => {
        const value = info.getValue();
        return typeof value === 'number' ? value.toFixed(1) : value;
      }
    },
    { 
      header: 'Costo (€)', 
      accessorKey: 'cost', 
      cell: info => {
        const value = info.getValue();
        return typeof value === 'number' ? value.toFixed(1) : value;
      }
    },
    { header: 'Stato', accessorKey: 'status' },
    
    // Macchina Programmata
    { header: 'Nome Macchina', accessorKey: 'machine_name' },
    
    // Campi Calcolati
    { 
      header: 'Progresso (%)', 
      accessorKey: 'progress',
      cell: info => {
        const value = info.getValue();
        return typeof value === 'number' ? `${value}%` : value;
      }
    },
    { 
      header: 'Tempo Rimanente (ore)', 
      accessorKey: 'time_remaining', 
      cell: info => {
        const value = info.getValue();
        return typeof value === 'number' ? value.toFixed(1) : value;
      }
    },
    
    // Material Availability
    { 
      header: 'Material ISP (%)', 
      accessorKey: 'material_availability_isp',
      cell: info => {
        const value = info.getValue();
        if (typeof value !== 'number') return value || 'N/A';
        const bgColor = value <= 39 ? 'bg-gray-300' : value <= 69 ? 'bg-yellow-400' : 'bg-green-400';
        return (
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-black text-[10px] font-medium`}>
            {value}
          </div>
        );
      }
    },
    { 
      header: 'Material Lotti (%)', 
      accessorKey: 'material_availability_lotti',
      cell: info => {
        const value = info.getValue();
        if (typeof value !== 'number') return value || 'N/A';
        const bgColor = value <= 39 ? 'bg-gray-300' : value <= 69 ? 'bg-yellow-400' : 'bg-green-400';
        return (
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-black text-[10px] font-medium`}>
            {value}
          </div>
        );
      }
    },
    { 
      header: 'Material Global (%)', 
      accessorKey: 'material_availability_global',
      cell: info => {
        const value = info.getValue();
        if (typeof value !== 'number') return value || 'N/A';
        const bgColor = value <= 39 ? 'bg-gray-300' : value <= 69 ? 'bg-yellow-400' : 'bg-green-400';
        return (
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-black text-[10px] font-medium`}>
            {value}
          </div>
        );
      }
    },
  ], []);

  // Extract all filterable column keys
  const filterableColumns = useMemo(() => 
    columns.map(col => col.accessorKey),
    [columns]
  );

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

  if (isLoading) {
    return <div>Caricamento dati backlog...</div>;
  }

  if (!selectedWorkCenter) {
           return <div className="text-center py-2 text-red-600 text-[10px]">Seleziona un centro di lavoro per visualizzare i dati del backlog.</div>;
  }

  return (
    <div className="p-1 bg-white rounded shadow-sm border min-w-0">
      
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={filteredOrders}
          onEditRow={handleEditOrder}
          onDeleteRow={handleDeleteOrder}
          stickyColumns={['odp_number', 'article_code']}
          enableFiltering={true}
          filterableColumns={filterableColumns}
        />
      </div>
    </div>
  );
}

export default BacklogListPage;
