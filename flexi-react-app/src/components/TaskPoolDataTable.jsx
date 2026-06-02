import React, { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useUIStore } from '../store';
import { useConfirmDelete, useOrders, useRemoveOrder } from '../hooks';
import {
  materialBadgeColumn,
  formatTaskInfoTooltip,
  normalizeOdpNumber,
  odpColumn,
  simpleColumn,
  truncatedTextColumn,
  truthyFixedNumberColumn
} from '../utils';
import DataTable from './DataTable';

// Gantt Actions Cell Component
const GanttActionsCell = ({ task, schedulingLoading }) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `task-${task.id}`,
    data: { task, type: 'task' },
    disabled: false, // Always enabled
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
        title={formatTaskInfoTooltip(task, {
          includeScheduledStart: true,
          includeScheduledEnd: true
        })}
      >
        i
      </button>

      {/* Drag Handle - always visible */}
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
function TaskPoolDataTable({ filterByCost = true }) {
  const navigate = useNavigate();
  const { selectedWorkCenter, schedulingLoading } = useUIStore();
  const { setNodeRef } = useDroppable({
    id: 'task-pool',
    data: { type: 'pool' },
  });

  // Use React Query to fetch orders data
  const { data: queryTasks = [], isLoading, error, refetch } = useOrders();
  const removeOrderMutation = useRemoveOrder();
  const confirmDelete = useConfirmDelete();

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

  // Use query data directly (no fallback needed after refactoring)
  const tasks = queryTasks;

  // Memoize unscheduled tasks filtering for better performance
  const unscheduledTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const isNotScheduled = task.status === 'NOT SCHEDULED';
      const hasDuration = task.duration > 0;
      const hasCost = filterByCost ? task.cost > 0 : true;
      
      const isNotComplete = (task.progress ?? 0) < 100;
      return isNotScheduled && hasDuration && hasCost && isNotComplete;
    });
    if (selectedWorkCenter && selectedWorkCenter !== 'BOTH') {
      filtered = filtered.filter(task => task.work_center === selectedWorkCenter);
    }
    // Filtered unscheduled tasks ready for display
    return filtered;
  }, [tasks, selectedWorkCenter, filterByCost]);

  // Define columns for the DataTable
  const columns = useMemo(() => [
    odpColumn('ODP'),
    simpleColumn('Codice Articolo', 'article_code'),
    simpleColumn('Nome Cliente', 'nome_cliente'),
    simpleColumn('Quantità', 'quantity'),
    simpleColumn('Quantità Completata', 'quantity_completed'),
    simpleColumn('Altezza Busta (mm)', 'bag_height'),
    simpleColumn('Passo Busta (mm)', 'bag_step'),
    truthyFixedNumberColumn('Durata (h)', 'duration'),
    truthyFixedNumberColumn('Costo (€)', 'cost', 2),
    materialBadgeColumn('Material ISP (%)', 'material_availability_isp'),
    materialBadgeColumn('Material Lotti (%)', 'material_availability_lotti'),
    materialBadgeColumn('Material Global (%)', 'material_availability_global'),
    truncatedTextColumn('Note ASD', 'asd_notes'),
    {
      header: 'Gantt',
      id: 'gantt_actions',
      cell: ({ row }) => (
        <GanttActionsCell 
          task={row.original}
          schedulingLoading={schedulingLoading}
        />
      ),
    },
  ], [schedulingLoading]);

  const handleEditRow = (task) => {
    // Ensure the task data is available before navigation
    if (!task || !task.id) {
      return;
    }
    
    // Navigate to edit page
    navigate(`/backlog/${task.id}/edit`);
  };

  const handleDeleteRow = async (taskToDelete) => {
    const displayOdp = normalizeOdpNumber(taskToDelete.odp_number);
    confirmDelete({
      title: 'Elimina Ordine',
      message: `Sei sicuro di voler eliminare "${displayOdp}"? Questa azione non può essere annullata.`,
      onConfirm: () => removeOrderMutation.mutateAsync(taskToDelete.id),
      successMessage: `Ordine "${displayOdp}" eliminato con successo`,
      errorMessage: 'Eliminazione ordine fallita'
    });
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
