import React, { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';

import { useUIStore } from '../store';
import { useConfirmDelete, useOrders, useMachines, usePhases, useRemoveOrder } from '../hooks';
import {
  fixedNumberColumn,
  italyDateColumn,
  materialBadgeColumn,
  normalizeOdpNumber,
  odpColumn,
  percentTextColumn,
  scheduledTimeColumn,
  showError,
  simpleColumn,
  truncatedTextColumn
} from '../utils';
import { WORK_CENTERS } from '../constants';
import { formatInItalyTimezone } from '../utils/dateFormatting';
import LoadingState from '../components/LoadingState';

function BacklogListPage() {
  const { selectedWorkCenter } = useUIStore();
  const navigate = useNavigate();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // React Query hooks
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useOrders();
  const { data: machines = [], isLoading: machinesLoading } = useMachines();
  const { data: phases = [], isLoading: phasesLoading } = usePhases();
  const removeOrderMutation = useRemoveOrder();
  const confirmDelete = useConfirmDelete();

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
    odpColumn('Numero ODP', { highlightScheduled: true }),
    simpleColumn('Codice Articolo', 'article_code'),
    truncatedTextColumn('Note ASD', 'asd_notes'),
    simpleColumn('Nome Cliente', 'nome_cliente'),
    simpleColumn('Quantità', 'quantity'),
    simpleColumn('Quantità Completata', 'quantity_completed'),
    simpleColumn('Altezza Busta (mm)', 'bag_height'),
    simpleColumn('Larghezza Busta (mm)', 'bag_width'),
    simpleColumn('Passo Busta (mm)', 'bag_step'),
    
    // Secondary columns
    simpleColumn('Lotto Produzione', 'production_lot'),
    simpleColumn('Centro di Lavoro', 'work_center'),
    simpleColumn('Reparto', 'department'),
    simpleColumn('Lati Sigillati', 'seal_sides'),
    simpleColumn('Linea di Produzione', 'product_type'),
    
    // Date e Tempi
    italyDateColumn('Data Consegna', 'delivery_date'),
    scheduledTimeColumn('Inizio Programmato', 'scheduled_start_time'),
    scheduledTimeColumn('Fine Programmata', 'scheduled_end_time'),
    
    // Codici Cliente
    simpleColumn('Codice Cliente Interno', 'internal_customer_code'),
    simpleColumn('Codice Cliente Esterno', 'external_customer_code'),
    simpleColumn('Riferimento Ordine Cliente', 'customer_order_ref'),
    simpleColumn('Note Libere', 'user_notes'),
    
    // Fase e Calcoli
    simpleColumn('Nome Fase', 'phase_name'),
    fixedNumberColumn('Durata (ore)', 'duration'),
    fixedNumberColumn('Costo (€)', 'cost'),
    simpleColumn('Stato', 'status'),
    
    // Macchina Programmata
    simpleColumn('Nome Macchina', 'machine_name'),
    
    // Campi Calcolati
    percentTextColumn('Progresso (%)', 'progress', ''),
    fixedNumberColumn('Tempo Rimanente (ore)', 'time_remaining'),
    
    // Material Availability
    materialBadgeColumn('Material ISP (%)', 'material_availability_isp'),
    materialBadgeColumn('Material Lotti (%)', 'material_availability_lotti'),
    materialBadgeColumn('Material Global (%)', 'material_availability_global'),
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
    confirmDelete({
      title: 'Elimina Ordine',
      message: `Sei sicuro di voler eliminare "${displayOdp}"? Questa azione non può essere annullata.`,
      onConfirm: () => removeOrderMutation.mutateAsync(orderToDelete.id),
      successMessage: `Ordine "${displayOdp}" eliminato con successo`,
      errorMessage: 'Eliminazione ordine fallita'
    });
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
