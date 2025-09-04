import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import EditableCell from '../components/EditableCell';
import StickyHeader from '../components/StickyHeader';
import { useOrderStore, useUIStore, useMainStore, useMachineStore, usePhaseStore } from '../store';
import { useValidation, useErrorHandler } from '../hooks';
import { showValidationError, showError } from '../utils';
import { WORK_CENTERS } from '../constants';
import { format } from 'date-fns';

function BacklogListPage() {
  // Use Zustand store to select state and actions
  const { odpOrders, updateOdpOrder, removeOdpOrder } = useOrderStore();
  const { selectedWorkCenter, isLoading, isInitialized, showConfirmDialog } = useUIStore();
  const { init, cleanup } = useMainStore();
  const { machines } = useMachineStore();
  const { phases } = usePhaseStore();

  // Filter orders by work center and join with machine and phase data
  const filteredOrders = useMemo(() => {
    if (!selectedWorkCenter) return [];
    
    let orders = odpOrders;
    if (selectedWorkCenter !== WORK_CENTERS.BOTH) {
      orders = odpOrders.filter(order => order.work_center === selectedWorkCenter);
    }
    
    // Join with machine and phase data
    return orders.map(order => ({
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
  }, [odpOrders, selectedWorkCenter, machines, phases]);

  // Use unified validation hook
  const { validateOrder } = useValidation();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('BacklogListPage');

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

  const columns = useMemo(() => [
    // Identificazione
    { header: 'Numero ODP', accessorKey: 'odp_number', cell: EditableCell },
    { header: 'Codice Articolo', accessorKey: 'article_code', cell: EditableCell },
    { header: 'Lotto Produzione', accessorKey: 'production_lot', cell: EditableCell },
    { header: 'Centro di Lavoro', accessorKey: 'work_center' },
    { header: 'Reparto', accessorKey: 'department' },
    { header: 'Nome Cliente', accessorKey: 'nome_cliente', cell: EditableCell },
    
    // Specifiche Busta
    { header: 'Altezza Busta (mm)', accessorKey: 'bag_height', cell: EditableCell },
    { header: 'Larghezza Busta (mm)', accessorKey: 'bag_width', cell: EditableCell },
    { header: 'Passo Busta (mm)', accessorKey: 'bag_step', cell: EditableCell },
    { header: 'Lati Sigillati', accessorKey: 'seal_sides' },
    { header: 'Tipo Prodotto', accessorKey: 'product_type' },
    
    // Quantità
    { header: 'Quantità', accessorKey: 'quantity', cell: EditableCell },
    { header: 'Quantità per Scatola', accessorKey: 'quantity_per_box', cell: EditableCell },
    { header: 'Quantità Completata', accessorKey: 'quantity_completed', cell: EditableCell },
    { header: 'Numero Scatole', accessorKey: 'n_boxes' },
    
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
    { header: 'Codice Cliente Interno', accessorKey: 'internal_customer_code', cell: EditableCell },
    { header: 'Codice Cliente Esterno', accessorKey: 'external_customer_code', cell: EditableCell },
    { header: 'Riferimento Ordine Cliente', accessorKey: 'customer_order_ref', cell: EditableCell },
    { header: 'Note Libere', accessorKey: 'user_notes', cell: EditableCell },
    
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
  ], []);

  const handleSaveOrder = async (updatedOrder) => {
    // Use the unified validation hook
    const validation = validateOrder(updatedOrder);
    
    if (!validation.isValid) {
      showValidationError(Object.values(validation.errors));
      return;
    }
    
    // Filter out computed fields that shouldn't be sent to the API
    const { machine_name, phase_name, progress, time_remaining, ...orderDataToUpdate } = updatedOrder;
    
    try {
      await updateOdpOrder(updatedOrder.id, orderDataToUpdate);
    } catch (error) {
      // Show specific error message from the store
      showError(error.message);
    }
  };

  const handleDeleteOrder = async (orderToDelete) => {
    showConfirmDialog(
      'Elimina Ordine',
      `Sei sicuro di voler eliminare "${orderToDelete.odp_number}"? Questa azione non può essere annullata.`,
      async () => {
        try {
          await removeOdpOrder(orderToDelete.id);
        } catch (error) {
          // Show specific error message from the store
          showError(error.message);
        }
      },
      'danger'
    );
  };

  if (isLoading) {
    return <div>Caricamento dati backlog...</div>;
  }

  if (!selectedWorkCenter) {
    return <div className="error">Seleziona un centro di lavoro per visualizzare i dati del backlog.</div>;
  }

  return (
    <div className="content-section">
      <StickyHeader title="Backlog Produzione" />
      <DataTable
        columns={columns}
        data={filteredOrders}
        onSaveRow={handleSaveOrder}
        onDeleteRow={handleDeleteOrder}
      />
    </div>
  );
}

export default BacklogListPage;
