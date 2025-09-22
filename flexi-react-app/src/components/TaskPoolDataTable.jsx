import React, { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { useOrderStore, useUIStore } from '../store';
import { useErrorHandler, useOrders, useRemoveOrder } from '../hooks';
import { format } from 'date-fns';
import DataTable from './DataTable';

// Gantt Actions Cell Component
const GanttActionsCell = ({ task, isEditMode, schedulingLoading, conflictDialog }) => {
  const navigate = useNavigate();
  const { updateOdpOrder: _updateOdpOrder } = useOrderStore();
  const { handleAsync: _handleAsync } = useErrorHandler('TaskPoolDataTable');

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `task-${task.id}`,
    data: { task, type: 'task' },
    disabled: !isEditMode, // Only allow dragging when edit mode is enabled
  });


  const isTaskBeingProcessed = schedulingLoading.taskId === task.id && 
    (schedulingLoading.isScheduling || schedulingLoading.isRescheduling || schedulingLoading.isShunting);

  return (
    <div className="flex items-center gap-2">
      {/* Info Button */}
      <button 
        className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors" 
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        title={`Codice Articolo: ${task.article_code || 'Non specificato'}
Codice Articolo Esterno: ${task.external_article_code || 'Non specificato'}
Nome Cliente: ${task.nome_cliente || 'Non specificato'}
Data Consegna: ${task.delivery_date ? format(new Date(task.delivery_date), 'yyyy-MM-dd') : 'Non impostata'}
Quantità: ${task.quantity || 'Non specificata'}
Note Libere: ${task.user_notes || 'Nessuna nota'}
Note ASD: ${task.asd_notes || 'Nessuna nota'}
Material Global: ${task.material_availability_global || 'N/A'}%
${task.scheduled_start_time ? `Inizio Programmato: ${task.scheduled_start_time.replace('+00:00', '')}` : 'Non programmato'}
${task.scheduled_end_time ? `Fine Programmata: ${task.scheduled_end_time.replace('+00:00', '')}` : 'Non programmato'}`}
      >
        i
      </button>

      {/* Drag Handle - only visible when edit mode is enabled */}
      {isEditMode && (
        <div 
          ref={setNodeRef}
          className="drag-handle" 
          {...listeners} 
          {...attributes}
          title="Trascina per programmare"
          style={{
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            minWidth: '30px',
            minHeight: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            borderRadius: '4px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#e5e7eb';
            e.target.style.borderColor = '#9ca3af';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#f3f4f6';
            e.target.style.borderColor = '#d1d5db';
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </div>
      )}

      {/* Loading indicator */}
      {isTaskBeingProcessed && (
        <div className="inline-flex items-center justify-center w-6 h-6">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

// Main Task Pool Data Table Component
function TaskPoolDataTable() {
  const navigate = useNavigate();
  const { selectedWorkCenter, isEditMode, conflictDialog, schedulingLoading, showConfirmDialog } = useUIStore();
  const { odpOrders: storeTasks, setOdpOrders } = useOrderStore();
  const { setNodeRef } = useDroppable({
    id: 'task-pool',
    data: { type: 'pool' },
  });

  // Use React Query to fetch orders data
  const { data: queryTasks = [], isLoading, error, refetch } = useOrders();
  const removeOrderMutation = useRemoveOrder();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('TaskPoolDataTable');

  // Sync React Query data with Zustand store
  useEffect(() => {
    if (queryTasks.length > 0) {
      setOdpOrders(queryTasks);
    }
  }, [queryTasks, setOdpOrders]);

  // Refetch data when returning from edit page (window focus)
  useEffect(() => {
    const handleFocus = () => {
      refetch();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetch]);

  // Use query data if available, fallback to store data
  const tasks = queryTasks.length > 0 ? queryTasks : storeTasks;

  // Memoize unscheduled tasks filtering for better performance
  const unscheduledTasks = useMemo(() => {
    let filtered = tasks.filter(task => 
      task.status !== 'SCHEDULED' && 
      task.duration > 0 && 
      task.cost > 0
    );
    if (selectedWorkCenter && selectedWorkCenter !== 'BOTH') {
      filtered = filtered.filter(task => task.work_center === selectedWorkCenter);
    }
    // Filtered unscheduled tasks ready for display
    return filtered;
  }, [tasks, selectedWorkCenter]);

  // Define columns for the DataTable
  const columns = useMemo(() => [
    {
      header: 'ODP',
      accessorKey: 'odp_number',
    },
    {
      header: 'Codice Articolo',
      accessorKey: 'article_code',
    },
    {
      header: 'Nome Cliente',
      accessorKey: 'nome_cliente',
    },
    {
      header: 'Durata (h)',
      accessorKey: 'duration',
      cell: ({ row }) => {
        const duration = row.original.duration;
        return duration ? Number(duration).toFixed(1) : 'N/A';
      },
    },
    {
      header: 'Costo (€)',
      accessorKey: 'cost',
      cell: ({ row }) => {
        const cost = row.original.cost;
        return cost ? Number(cost).toFixed(2) : 'N/A';
      },
    },
    {
      header: 'Material ISP (%)',
      accessorKey: 'material_availability_isp',
      cell: ({ row }) => {
        const value = row.original.material_availability_isp;
        if (typeof value !== 'number') return value || 'N/A';
        const bgColor = value <= 39 ? 'bg-gray-300' : value <= 69 ? 'bg-yellow-400' : 'bg-green-400';
        return (
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-black text-[10px] font-medium`}>
            {value}
          </div>
        );
      },
    },
    {
      header: 'Material Lotti (%)',
      accessorKey: 'material_availability_lotti',
      cell: ({ row }) => {
        const value = row.original.material_availability_lotti;
        if (typeof value !== 'number') return value || 'N/A';
        const bgColor = value <= 39 ? 'bg-gray-300' : value <= 69 ? 'bg-yellow-400' : 'bg-green-400';
        return (
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-black text-[10px] font-medium`}>
            {value}
          </div>
        );
      },
    },
    {
      header: 'Material Global (%)',
      accessorKey: 'material_availability_global',
      cell: ({ row }) => {
        const value = row.original.material_availability_global;
        if (typeof value !== 'number') return value || 'N/A';
        const bgColor = value <= 39 ? 'bg-gray-300' : value <= 69 ? 'bg-yellow-400' : 'bg-green-400';
        return (
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-black text-[10px] font-medium`}>
            {value}
          </div>
        );
      },
    },
    {
      header: 'Note ASD',
      accessorKey: 'asd_notes',
      cell: ({ row }) => {
        const value = row.original.asd_notes;
        if (!value) return 'N/A';
        return (
          <div className="max-w-[200px] truncate text-[10px]" title={value}>
            {value}
          </div>
        );
      },
    },
    {
      header: 'Gantt',
      id: 'gantt_actions',
      cell: ({ row }) => (
        <GanttActionsCell 
          task={row.original}
          isEditMode={isEditMode}
          schedulingLoading={schedulingLoading}
          conflictDialog={conflictDialog}
        />
      ),
    },
  ], [isEditMode, schedulingLoading, conflictDialog]);

  const handleEditRow = (task) => {
    // Ensure the task data is available before navigation
    if (!task || !task.id) {
      console.error('Invalid task data for editing:', task);
      return;
    }
    
    // Navigate to edit page
    navigate(`/backlog/${task.id}/edit`);
  };

  const handleDeleteRow = async (taskToDelete) => {
    showConfirmDialog(
      'Elimina Ordine',
      `Sei sicuro di voler eliminare "${taskToDelete.odp_number}"? Questa azione non può essere annullata.`,
      async () => {
        await handleAsync(
          async () => {
            await removeOrderMutation.mutateAsync(taskToDelete.id);
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

  return (
    <div ref={setNodeRef} id="task_pool" className="task-pool-table-container">
        {isLoading ? (
          <div className="empty-state">
            <h3>Caricamento...</h3>
            <p>Recupero dati dal server...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>Errore nel caricamento</h3>
            <p>Impossibile caricare i dati. Riprova più tardi.</p>
          </div>
        ) : unscheduledTasks.length > 0 ? (
          <DataTable
            data={unscheduledTasks}
            columns={columns}
            onEditRow={handleEditRow}
            onDeleteRow={handleDeleteRow}
            enableFiltering={true}
            filterableColumns={['odp_number', 'article_code', 'nome_cliente']}
          />
        ) : (
          <div className="empty-state">
            <h3>Nessun lavoro non programmato disponibile</h3>
            <p>I lavori devono avere durata e costo maggiori di 0 per essere visualizzati qui.</p>
          </div>
        )}
    </div>
  );
}

export default TaskPoolDataTable;
