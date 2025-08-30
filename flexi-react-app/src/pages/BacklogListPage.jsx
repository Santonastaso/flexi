import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import EditableCell from '../components/EditableCell';
import StickyHeader from '../components/StickyHeader';
import { useOrderStore, useUIStore, useMainStore, useMachineStore, usePhaseStore } from '../store';
import { useOrderValidation, useErrorHandler } from '../hooks';
import { WORK_CENTERS } from '../constants';

function BacklogListPage() {
  // Use Zustand store to select state and actions
  const { odpOrders, updateOdpOrder, removeOdpOrder } = useOrderStore();
  const { selectedWorkCenter, isLoading, isInitialized, showAlert, showConfirmDialog } = useUIStore();
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
        : 'Fase non assegnata'
    }));
  }, [odpOrders, selectedWorkCenter, machines, phases]);

  // Use modern validation hook
  const { validateOrder } = useOrderValidation();
  
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
    { header: 'Descrizione', accessorKey: 'description', cell: EditableCell },
    
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
      cell: info => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'Non impostata'
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
    
    // Fase e Calcoli
    { header: 'ID Fase', accessorKey: 'fase' },
    { header: 'Nome Fase', accessorKey: '_phase_name' },
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
    { header: 'Priorità', accessorKey: 'priority' },
    { header: 'Stato', accessorKey: 'status' },
    
    // Macchina Programmata
    { header: 'ID Macchina Programmata', accessorKey: 'scheduled_machine_id' },
    { header: 'Nome Macchina', accessorKey: '_machine_name' },
    
    // Campi Calcolati
    { header: 'Progresso (%)', accessorKey: '_progress' },
    { 
      header: 'Tempo Rimanente (ore)', 
      accessorKey: '_time_remaining', 
      cell: info => {
        const value = info.getValue();
        return typeof value === 'number' ? value.toFixed(1) : value;
      }
    },
    
    // Timestamps
    { 
      header: 'Creato il', 
      accessorKey: 'created_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },
    { 
      header: 'Aggiornato il', 
      accessorKey: 'updated_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },

  ], []);

  const handleSaveOrder = async (updatedOrder) => {
    // Use the new validation hook
    const validationErrors = validateOrder(updatedOrder);
    
    if (validationErrors.length > 0) {
      // Show validation errors in the store alert
      showAlert(`Errori di validazione:\n${validationErrors.join('\n')}`, 'error');
      return;
    }
    
    // Filter out computed fields that shouldn't be sent to the API
    const { machine_name, phase_name, progress, time_remaining, ...orderDataToUpdate } = updatedOrder;
    
    await handleAsync(
      () => updateOdpOrder(updatedOrder.id, orderDataToUpdate),
      { context: 'Aggiorna Ordine', fallbackMessage: 'Aggiornamento ordine fallito' }
    );
  };

  const handleDeleteOrder = async (orderToDelete) => {
    showConfirmDialog(
      'Elimina Ordine',
      `Sei sicuro di voler eliminare "${orderToDelete.odp_number}"? Questa azione non può essere annullata.`,
      async () => {
        await handleAsync(
          () => removeOdpOrder(orderToDelete.id),
          { context: 'Elimina Ordine', fallbackMessage: 'Eliminazione ordine fallita' }
        );
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
