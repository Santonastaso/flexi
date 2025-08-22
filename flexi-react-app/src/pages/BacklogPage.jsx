import React, { useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import BacklogForm from '../components/BacklogForm';
import EditableCell from '../components/EditableCell';
import { useStore } from '../store/useStore';
import { WORK_CENTERS } from '../constants';
import { useOrderValidation } from '../hooks';

function BacklogPage() {
  // Use Zustand store to select state and actions
  const orders = useStore(state => state.odpOrders);
  const machines = useStore(state => state.machines);
  const phases = useStore(state => state.phases);
  const selectedWorkCenter = useStore(state => state.selectedWorkCenter);
  const isLoading = useStore(state => state.isLoading);
  const isInitialized = useStore(state => state.isInitialized);
  const init = useStore(state => state.init);
  const updateOdpOrder = useStore(state => state.updateOdpOrder);
  const removeOdpOrder = useStore(state => state.removeOdpOrder);
  const showAlert = useStore(state => state.showAlert);
  const showConfirmDialog = useStore(state => state.showConfirmDialog);
  const cleanup = useStore(state => state.cleanup);

  // Filter orders by work center
  const filteredOrders = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return orders;
    return orders.filter(order => order.work_center === selectedWorkCenter);
  }, [orders, selectedWorkCenter]);

  // State for forcing DataTable refresh
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Use modern validation hook
  const { validateOrder } = useOrderValidation();

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

  // Callback for when a new order is successfully added
  const handleOrderAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const columns = useMemo(() => [
    // Identificazione
    { header: 'ID', accessorKey: 'id' },
    { header: 'ODP Number', accessorKey: 'odp_number', cell: EditableCell },
    { header: 'Article Code', accessorKey: 'article_code', cell: EditableCell },
    { header: 'External Article Code', accessorKey: 'production_lot' },
    { header: 'Work Center', accessorKey: 'work_center', cell: EditableCell },
    { header: 'Customer', accessorKey: 'nome_cliente' },
    
    // Specifiche Tecniche
    { header: 'Bag H (mm)', accessorKey: 'bag_height', cell: EditableCell },
    { header: 'Bag W (mm)', accessorKey: 'bag_width', cell: EditableCell },
    { header: 'Bag Step (mm)', accessorKey: 'bag_step', cell: EditableCell },
    { header: 'Seals', accessorKey: 'seal_sides', cell: EditableCell },
    { header: 'Product', accessorKey: 'product_type', cell: EditableCell },
    { header: 'Qty', accessorKey: 'quantity', cell: EditableCell },
    { header: 'Completed', accessorKey: 'quantity_completed', cell: EditableCell },
    { header: 'Qty/Box', accessorKey: 'quantity_per_box', cell: EditableCell },
    { header: 'N Boxes', accessorKey: 'n_boxes' },
    
    // Pianificazione
    { 
      header: 'Prod Start', 
      accessorKey: 'scheduled_start_time', 
      cell: info => info.getValue() ? new Date(info.getValue()).toLocaleString() : '-' 
    },
    { 
      header: 'Prod End', 
      accessorKey: 'scheduled_start_time', 
      cell: info => {
        const startTime = info.getValue();
        if (!startTime) return '-';
        
        const row = info.row.original;
        const timeRemaining = row.time_remaining || row.duration || 0;
        
        if (timeRemaining <= 0) return '-';
        
        const endTime = new Date(startTime);
        // Use setTime with milliseconds to avoid rounding
        const endTimeMs = endTime.getTime() + (timeRemaining * 60 * 60 * 1000);
        endTime.setTime(endTimeMs);
        return endTime.toLocaleString();
      }
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
    { header: 'Department', accessorKey: 'department', cell: EditableCell },
    { 
      header: 'Phase', 
      accessorKey: 'fase',
      cell: info => {
        const phaseId = info.getValue();
        const phase = phases.find(p => p.id === phaseId);
        return phase ? phase.name : phaseId || '-';
      }
    },
    
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
      accessorKey: 'scheduled_machine_id',
      cell: info => {
        const machineId = info.getValue();
        const machine = machines.find(m => m.id === machineId);
        return machine ? machine.machine_name : machineId || '-';
      }
    },
  ], [machines, phases]);

  const handleSaveOrder = async (updatedOrder) => {
    try {
      const validationErrors = validateOrder(updatedOrder);
      
      if (validationErrors.length > 0) {
        // Show validation errors in the store alert
        showAlert(`Validation errors:\n${validationErrors.join('\n')}`, 'error');
        return;
      }

      // Handle machine assignment if the machine field was edited
      if (updatedOrder.scheduled_machine_id && updatedOrder.scheduled_machine_id !== updatedOrder.original?.scheduled_machine_id) {
        // The machine field was changed, we need to handle this properly
        // For now, we'll just save the machine ID as is
        // In a real implementation, you might want to validate that the machine exists
        // and update related scheduling information
      }

      await updateOdpOrder(updatedOrder.id, updatedOrder);
    } catch (error) {
      // Error is already handled by the store
    }
  };

  const handleDeleteOrder = async (orderToDelete) => {
    showConfirmDialog(
      'Delete Order',
      `Are you sure you want to delete ODP "${orderToDelete.odp_number || orderToDelete.id}"? This action cannot be undone.`,
      async () => {
        try {
          await removeOdpOrder(orderToDelete.id);
        } catch (error) {
          // Error is already handled by the store
        }
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
    <>
      <BacklogForm onSuccess={handleOrderAdded} />
      <div className="content-section">
        <h2>Production Backlog</h2>
        <DataTable
          columns={columns}
          data={filteredOrders}
          onSaveRow={handleSaveOrder}
          onDeleteRow={handleDeleteOrder}
        />
      </div>
    </>
  );
}

export default BacklogPage;