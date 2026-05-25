import React, { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';

import { useUIStore } from '../store';
import { useOrders, useMachines, usePhases, useRemoveOrder } from '../hooks';
import { normalizeOdpNumber, showError, showSuccess } from '../utils';
import { WORK_CENTERS } from '../constants';
import { formatScheduledTime, formatInItalyTimezone } from '../utils/dateFormatting';
import LoadingState from '../components/LoadingState';

function BacklogListPage() {
  const { selectedWorkCenter, showConfirmDialog } = useUIStore();
  const navigate = useNavigate();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // React Query hooks
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useOrders();
  const { data: machines = [], isLoading: machinesLoading } = useMachines();
  const { data: phases = [], isLoading: phasesLoading } = usePhases();
  const removeOrderMutation = useRemoveOrder();

  // Filter orders by work center and join with machine and phase data
  const filteredOrders = useMemo(() => {
    if (!selectedWorkCenter) return [];
    
    let filteredOrders = orders;
    if (selectedWorkCenter !== WORK_CENTERS.BOTH) {
      filteredOrders = orders.filter(order => order.work_center === selectedWorkCenter);
    }
    
    // Hide orders with PAUSE in odp_number
    filteredOrders = filteredOrders.filter(order => !order.odp_number?.includes('PAUSE'));
    
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
            {normalizeOdpNumber(value)}
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
          <div className="max-w-[200px] truncate text-xs" title={value}>
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
    { header: 'Linea di Produzione', accessorKey: 'product_type' },
    
    // Date e Tempi
    { 
      header: 'Data Consegna', 
      accessorKey: 'delivery_date',
              cell: info => info.getValue() ? formatInItalyTimezone(info.getValue(), 'dd/MM/yyyy') : 'Non impostata'
    },
    { 
      header: 'Inizio Programmato', 
      accessorKey: 'scheduled_start_time',
      cell: info => info.getValue() ? formatScheduledTime(info.getValue()) : 'Non programmato'
    },
    { 
      header: 'Fine Programmata', 
      accessorKey: 'scheduled_end_time',
      cell: info => info.getValue() ? formatScheduledTime(info.getValue()) : 'Non programmato'
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
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-black text-[11px] font-medium`}>
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
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-black text-[11px] font-medium`}>
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
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-black text-[11px] font-medium`}>
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

  const handleOpenExportDialog = useCallback(() => {
    if (!filteredOrders.length) {
      showError('Nessun ordine da esportare');
      return;
    }
    setExportStartDate('');
    setExportEndDate('');
    setExportDialogOpen(true);
  }, [filteredOrders]);

  const handleExportCsv = useCallback(() => {
    const startDate = new Date(`${exportStartDate}T00:00:00`);
    const endDate = new Date(`${exportEndDate}T23:59:59`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      showError('Formato data non valido');
      return;
    }

    if (startDate > endDate) {
      showError('La data inizio deve essere precedente alla data fine');
      return;
    }

    const rowsToExport = filteredOrders.filter(order => {
      if (!order.delivery_date) return false;
      const deliveryDate = formatInItalyTimezone(order.delivery_date, 'yyyy-MM-dd');
      if (deliveryDate === '—') return false;
      return deliveryDate >= exportStartDate && deliveryDate <= exportEndDate;
    });

    if (!rowsToExport.length) {
      showError('Nessun ordine nel range selezionato');
      return;
    }

    const headers = [
      'Numero ODP',
      'Codice Articolo',
      'Nome Cliente',
      'Quantità',
      'Quantità Completata',
      'Altezza Busta (mm)',
      'Larghezza Busta (mm)',
      'Passo Busta (mm)',
      'Data Consegna',
      'Stato',
      'Centro di Lavoro',
      'Reparto',
      'Nome Macchina',
      'Nome Fase',
      'Durata (ore)',
      'Costo (€)',
      'Note Libere',
      'Note ASD'
    ];

    const toValue = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'number' && !isFinite(value)) return '';
      return value;
    };

    const rows = rowsToExport.map(order => [
      toValue(normalizeOdpNumber(order.odp_number)),
      toValue(order.article_code),
      toValue(order.nome_cliente),
      toValue(order.quantity),
      toValue(order.quantity_completed),
      toValue(order.bag_height),
      toValue(order.bag_width),
      toValue(order.bag_step),
      order.delivery_date ? formatInItalyTimezone(order.delivery_date, 'yyyy-MM-dd') : '',
      toValue(order.status),
      toValue(order.work_center),
      toValue(order.department),
      toValue(order.machine_name),
      toValue(order.phase_name),
      typeof order.duration === 'number' ? order.duration.toFixed(1) : toValue(order.duration),
      typeof order.cost === 'number' ? order.cost.toFixed(1) : toValue(order.cost),
      toValue(order.user_notes),
      toValue(order.asd_notes)
    ]);

    const escapeCsvCell = (value) => {
      const text = String(toValue(value));
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows]
      .map(row => row.map(escapeCsvCell).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `odp_backlog_${exportStartDate.replaceAll('-', '')}_${exportEndDate.replaceAll('-', '')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
  }, [filteredOrders, exportStartDate, exportEndDate]);

  const handleDeleteOrder = async (orderToDelete) => {
    const displayOdp = normalizeOdpNumber(orderToDelete.odp_number);
    showConfirmDialog(
      'Elimina Ordine',
      `Sei sicuro di voler eliminare "${displayOdp}"? Questa azione non può essere annullata.`,
      async () => {
        try {
          await removeOrderMutation.mutateAsync(orderToDelete.id);
          showSuccess(`Ordine "${displayOdp}" eliminato con successo`);
        } catch (error) {
          showError(error.message || 'Eliminazione ordine fallita');
        }
      },
      'danger'
    );
  };

  // Show error if query failed
  if (ordersError) {
    return <div className="text-center py-2 text-red-600 text-xs">Errore nel caricamento degli ordini: {ordersError.message}</div>;
  }

  if (isLoading) {
    return <LoadingState message="Caricamento dati backlog..." />;
  }

  if (!selectedWorkCenter) {
    return <div className="text-center py-2 text-red-600 text-xs">Seleziona un centro di lavoro per visualizzare i dati del backlog.</div>;
  }

  return (
    <div className="p-1 bg-white rounded shadow-sm border min-w-0">
      <div className="flex items-center justify-end mb-2">
        <Button size="sm" variant="outline" onClick={handleOpenExportDialog}>
          Export CSV
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={filteredOrders}
          onEditRow={handleEditOrder}
          onDeleteRow={handleDeleteOrder}
          stickyColumns={['odp_number', 'article_code']}
          enableFiltering={true}
          filterableColumns={filterableColumns}
          filterStorageKey="backlogListFilters"
        />
      </div>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Esporta Backlog</DialogTitle>
            <DialogDescription>
              Seleziona il range di date di consegna da esportare.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Data inizio:</label>
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Data fine:</label>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setExportDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              size="sm"
              onClick={handleExportCsv}
              disabled={!exportStartDate || !exportEndDate}
            >
              Esporta CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BacklogListPage;
