import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useOrderStore, useUIStore } from '../store';
import { useErrorHandler } from '../hooks';
import { format } from 'date-fns';

// Individual Draggable Task Component - optimized
const DraggableTask = React.memo(({ task }) => {
  // Get global edit mode state and conflict dialog
  const { isEditMode, conflictDialog, schedulingLoading } = useUIStore();
  
  // Get the update function from the store
  const { updateOdpOrder: _updateOdpOrder } = useOrderStore();
  
  // Use unified error handling
  const { handleAsync: _handleAsync } = useErrorHandler('TaskPool');

  const navigate = useNavigate();

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `task-${task.id}`,
    data: { task, type: 'task' },
    disabled: !isEditMode, // Disable dragging when not in edit mode
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const isTaskBeingProcessed = schedulingLoading.taskId === task.id && 
    (schedulingLoading.isScheduling || schedulingLoading.isRescheduling || schedulingLoading.isShunting);

  return (
    <div ref={setNodeRef} style={style} className={`task-item ${!isEditMode ? 'non-draggable' : ''} ${conflictDialog.isOpen && conflictDialog.details?.draggedTask?.id === task.id ? 'conflict-pending' : ''} ${isTaskBeingProcessed ? 'processing' : ''}`}>
      <div className="task-content">
        <span className="task-label">{task.odp_number}</span>
        <span className="task-time">
          {task.time_remaining ? Number(task.time_remaining).toFixed(1) : (task.duration || 1).toFixed(1)}h
        </span>
        {isTaskBeingProcessed && (
          <div className="task-loading-indicator">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
      
      <div className="task-controls">
        {/* Info Button */}
        <button 
          className="task-btn info-btn" 
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
        ${task.scheduled_start_time ? `Inizio Programmato: ${task.scheduled_start_time.replace('+00:00', '')}` : 'Non programmato'}
        ${task.scheduled_end_time ? `Fine Programmata: ${task.scheduled_end_time.replace('+00:00', '')}` : 'Non programmato'}`}
        >
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>i</span>
        </button>
        
        {/* Edit Button */}
        <button
          className="task-btn edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            navigate(`/backlog/${task.id}/edit`);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          title="Modifica e ricalcola"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>

        {/* Drag Handle - only active when in edit mode */}
        {isEditMode && (
          <div 
            className="drag-handle" 
            {...listeners} 
            {...attributes}
            title="Trascina per programmare"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
});

// Main Task Pool Component - optimized for performance
function TaskPool() {
  const { selectedWorkCenter } = useUIStore();
  const { odpOrders: tasks } = useOrderStore();
  const { setNodeRef } = useDroppable({
    id: 'task-pool',
    data: { type: 'pool' },
  });

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
    return filtered;
  }, [tasks, selectedWorkCenter]);

  // Calculate total hours for display
  const totalHours = useMemo(() => {
    return unscheduledTasks.reduce((total, task) => {
      const hours = task.time_remaining ? Number(task.time_remaining) : (task.duration || 1);
      return total + hours;
    }, 0);
  }, [unscheduledTasks]);

  return (
    <div className="task-pool-section">
      <div className="section-controls">
        <h2 className="section-title">Pool Lavori</h2>
      </div>
      
      <div ref={setNodeRef} id="task_pool" className="task-pool-grid">
        {unscheduledTasks.length > 0 ? (
          unscheduledTasks.map(task => (
            <DraggableTask key={task.id} task={task} />
          ))
        ) : (
          <div className="empty-state">
            <h3>Nessun lavoro non programmato disponibile</h3>
            <p>I lavori devono avere durata e costo maggiori di 0 per essere visualizzati qui.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskPool;