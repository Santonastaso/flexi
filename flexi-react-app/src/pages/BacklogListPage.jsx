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
    { header: 'ODP Number', accessorKey: 'odp_number', cell: EditableCell },
    { header: 'Article Code', accessorKey: 'article_code', cell: EditableCell },
    { header: 'Production Lot', accessorKey: 'production_lot', cell: EditableCell },
    { header: 'Work Center', accessorKey: 'work_center' },
    { header: 'Department', accessorKey: 'department' },
    { header: 'Customer Name', accessorKey: 'nome_cliente', cell: EditableCell },
    { header: 'Description', accessorKey: 'description', cell: EditableCell },
    // Bag Specifications
    { header: 'Bag Height (mm)', accessorKey: 'bag_height', cell: EditableCell },
    { header: 'Bag Width (mm)', accessorKey: 'bag_width', cell: EditableCell },
    { header: 'Bag Step (mm)', accessorKey: 'bag_step', cell: EditableCell },
    { header: 'Seal Sides', accessorKey: 'seal_sides' },
    { header: 'Product Type', accessorKey: 'product_type' },
    // Quantities
    { header: 'Quantity', accessorKey: 'quantity', cell: EditableCell },
    { header: 'Quantity per Box', accessorKey: 'quantity_per_box', cell: EditableCell },
    { header: 'Quantity Completed', accessorKey: 'quantity_completed', cell: EditableCell },
    // Customer Codes
    { header: 'Internal Customer Code', accessorKey: 'internal_customer_code', cell: EditableCell },
    { header: 'External Customer Code', accessorKey: 'external_customer_code', cell: EditableCell },
    { header: 'Customer Order Ref', accessorKey: 'customer_order_ref', cell: EditableCell },
    // Dates
    { 
      header: 'Delivery Date', 
      accessorKey: 'delivery_date',
      cell: info => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'Not set'
    },
    { 
      header: 'Created At', 
      accessorKey: 'created_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },
    { 
      header: 'Updated At', 
      accessorKey: 'updated_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },

  ], []);

  const handleSaveOrder = async (updatedOrder) => {
    // Use the new validation hook
    const validationErrors = validateOrder(updatedOrder);
    
    if (validationErrors.length > 0) {
      // Show validation errors in the store alert
      showAlert(`Validation errors:\n${validationErrors.join('\n')}`, 'error');
      return;
    }
    
    await handleAsync(
      () => updateOdpOrder(updatedOrder.id, updatedOrder),
      { context: 'Update Order', fallbackMessage: 'Failed to update order' }
    );
  };

  const handleDeleteOrder = async (orderToDelete) => {
    showConfirmDialog(
      'Delete Order',
      `Are you sure you want to delete "${orderToDelete.odp_number}"? This action cannot be undone.`,
      async () => {
        await handleAsync(
          () => removeOdpOrder(orderToDelete.id),
          { context: 'Delete Order', fallbackMessage: 'Failed to delete order' }
        );
      },
      'danger'
    );
  };

  if (isLoading) {
    return <div>Loading backlog data...</div>;
  }

  if (!selectedWorkCenter) {
    return <div className="error">Please select a work center to view backlog data.</div>;
  }

  return (
    <div className="content-section">
      <StickyHeader title="Production Backlog" />
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
