import React, { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import BacklogForm from '../components/BacklogForm';
import EditableCell from '../components/EditableCell';
import { appStore } from '../scripts/store';

function BacklogPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!appStore.isInitialized()) {
        await appStore.init();
      }
      const state = appStore.getState();
      setOrders(state.odpOrders);
      setIsLoading(false);

      const unsubscribe = appStore.subscribe((newState) => {
        setOrders(newState.odpOrders);
      });

      return () => unsubscribe();
    }
    fetchData();
  }, []);

  const columns = useMemo(() => [
    // Identificazione
    { header: 'ID', accessorKey: 'id' },
    {
      header: 'ODP Number',
      accessorKey: 'odp_number',
      cell: ({ row, table }) => (
        <EditableCell
          value={row.original.odp_number}
          isEditing={table.options.meta?.editingRowId === row.id}
          onChange={(e) => table.options.meta?.setEditedData(prev => ({ ...prev, odp_number: e.target.value }))}
        />
      )
    },
    {
      header: 'Article Code',
      accessorKey: 'article_code',
      cell: ({ row, table }) => (
        <EditableCell
          value={row.original.article_code}
          isEditing={table.options.meta?.editingRowId === row.id}
          onChange={(e) => table.options.meta?.setEditedData(prev => ({ ...prev, article_code: e.target.value }))}
        />
      )
    },
    { header: 'External Article Code', accessorKey: 'production_lot' },
    {
      header: 'Work Center',
      accessorKey: 'work_center',
      cell: ({ row, table }) => (
        <EditableCell
          value={row.original.work_center}
          isEditing={table.options.meta?.editingRowId === row.id}
          onChange={(e) => table.options.meta?.setEditedData(prev => ({ ...prev, work_center: e.target.value }))}
        />
      )
    },
    { header: 'Customer', accessorKey: 'nome_cliente' },
    
    // Specifiche Tecniche
    { header: 'Bag H (mm)', accessorKey: 'bag_height' },
    { header: 'Bag W (mm)', accessorKey: 'bag_width' },
    { header: 'Bag Step (mm)', accessorKey: 'bag_step' },
    { header: 'Seals', accessorKey: 'seal_sides' },
    { header: 'Product', accessorKey: 'product_type' },
    {
      header: 'Qty',
      accessorKey: 'quantity',
      cell: ({ row, table }) => (
        <EditableCell
          value={row.original.quantity}
          isEditing={table.options.meta?.editingRowId === row.id}
          onChange={(e) => table.options.meta?.setEditedData(prev => ({ ...prev, quantity: e.target.value }))}
        />
      )
    },
    {
      header: 'Completed',
      accessorKey: 'quantity_completed',
      cell: ({ row, table }) => (
        <EditableCell
          value={row.original.quantity_completed}
          isEditing={table.options.meta?.editingRowId === row.id}
          onChange={(e) => table.options.meta?.setEditedData(prev => ({ ...prev, quantity_completed: e.target.value }))}
        />
      )
    },
    { header: 'Qty/Box', accessorKey: 'quantity_per_box' },
    { header: 'N Boxes', accessorKey: 'n_boxes' },
    
    // Pianificazione
    { 
      header: 'Prod Start', 
      accessorKey: 'production_start', 
      cell: info => info.getValue() ? new Date(info.getValue()).toLocaleString() : '-' 
    },
    { 
      header: 'Prod End', 
      accessorKey: 'production_end', 
      cell: info => info.getValue() ? new Date(info.getValue()).toLocaleString() : '-' 
    },
    { 
      header: 'Delivery', 
      accessorKey: 'delivery_date', 
      cell: info => info.getValue() ? new Date(info.getValue()).toLocaleString() : '-' 
    },
    
    // Dati Commerciali
    { header: 'FLEXI Lot', accessorKey: 'internal_customer_code' },
    { header: 'Customer Lot', accessorKey: 'external_customer_code' },
    { header: 'Customer Ref', accessorKey: 'customer_order_ref' },
    
    // Dati Lavorazione
    {
      header: 'Department',
      accessorKey: 'department',
      cell: ({ row, table }) => (
        <EditableCell
          value={row.original.department}
          isEditing={table.options.meta?.editingRowId === row.id}
          onChange={(e) => table.options.meta?.setEditedData(prev => ({ ...prev, department: e.target.value }))}
        />
      )
    },
    { header: 'Phase', accessorKey: 'fase' },
    
    // Calcolate
    { header: 'Duration (h)', accessorKey: 'duration' },
    { header: 'Cost (€)', accessorKey: 'cost' },
    { 
      header: 'Progress', 
      accessorKey: 'progress', 
      cell: info => `${info.getValue() || 0}%` 
    },
    { header: 'Time Rem. (h)', accessorKey: 'time_remaining' },
    
    // Additional
    { header: 'Priority', accessorKey: 'priority' },
    { header: 'Status', accessorKey: 'status' },
    { 
      header: 'Machine', 
      accessorKey: 'machines.machine_name', 
      cell: info => info.getValue() || '-' 
    },
  ], []);

  const handleSaveOrder = (updatedOrder) => {
    // Here you would add validation logic before updating
    console.log("Saving order:", updatedOrder);
    appStore.updateOdpOrder(updatedOrder.id, updatedOrder);
  };

  const handleDeleteOrder = (orderToDelete) => {
    if (window.confirm(`Are you sure you want to delete ODP ${orderToDelete.odp_number}?`)) {
      console.log("Deleting order:", orderToDelete);
      appStore.removeOdpOrder(orderToDelete.id);
    }
  };

  if (isLoading) {
    return <div>Loading backlog data...</div>;
  }

  return (
    <>
      <BacklogForm />
      <div className="content-section">
        <h2>Production Backlog</h2>
        <DataTable
          columns={columns}
          data={orders}
          onSaveRow={handleSaveOrder}
          onDeleteRow={handleDeleteOrder}
        />
      </div>
    </>
  );
}

export default BacklogPage;