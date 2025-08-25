import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import EditableCell from '../components/EditableCell';
import StickyHeader from '../components/StickyHeader';
import { useOrderStore, useUIStore, useMainStore } from '../store';
import { useOrderValidation, useErrorHandler } from '../hooks';
import { WORK_CENTERS } from '../constants';

function BacklogListPage() {
  // Use Zustand store to select state and actions
  const { odpOrders, updateOdpOrder, removeOdpOrder } = useOrderStore();
  const { selectedWorkCenter, isLoading, isInitialized, showAlert, showConfirmDialog } = useUIStore();
  const { init, cleanup } = useMainStore();

  // Filter orders by work center
  const filteredOrders = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return odpOrders;
    return odpOrders.filter(order => order.work_center === selectedWorkCenter);
  }, [odpOrders, selectedWorkCenter]);

  // Use modern validation hook
  const { validateOrder } = useOrderValidation();
  
  // Use unified error handling
  const { handleCrudError, handleAsync } = useErrorHandler('BacklogListPage');

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
    // Codici Cliente
    { header: 'Codice Cliente Interno', accessorKey: 'internal_customer_code', cell: EditableCell },
    { header: 'Codice Cliente Esterno', accessorKey: 'external_customer_code', cell: EditableCell },
    { header: 'Riferimento Ordine Cliente', accessorKey: 'customer_order_ref', cell: EditableCell },
    // Date
    { 
      header: 'Data Consegna', 
      accessorKey: 'delivery_date',
      cell: info => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'Non impostata'
    },
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
    
    await handleAsync(
      () => updateOdpOrder(updatedOrder.id, updatedOrder),
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
