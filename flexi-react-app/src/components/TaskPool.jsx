import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useOrderStore, useUIStore } from '../store';
import { useErrorHandler } from '../hooks';

// Individual Draggable Task Component - optimized
const DraggableTask = React.memo(({ task }) => {
  // Get global edit mode state and conflict dialog
  const { isEditMode, conflictDialog } = useUIStore();
  
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



  return (
    <div ref={setNodeRef} style={style} className={`task-item ${!isEditMode ? 'non-draggable' : ''} ${conflictDialog.isOpen && conflictDialog.details?.draggedTask?.id === task.id ? 'conflict-pending' : ''}`}>
      <div className="task-content">
        <span className="task-label">{task.odp_number}</span>
        <span className="task-time">
          {task.time_remaining ? Number(task.time_remaining).toFixed(1) : (task.duration || 1).toFixed(1)}h
        </span>
      </div>
      
      <div className="task-controls">
        {/* Info Button */}
        <button 
          className="task-btn info-btn" 
          title={`Codice Articolo: ${task.article_code || 'Non specificato'}
Codice Articolo Esterno: ${task.external_article_code || 'Non specificato'}
Nome Cliente: ${task.nome_cliente || 'Non specificato'}
Data Consegna: ${task.delivery_date ? new Date(task.delivery_date).toLocaleDateString() : 'Non impostata'}
Quantità: ${task.quantity || 'Non specificata'}
${task.scheduled_start_time ? `Inizio Programmato: ${new Date(task.scheduled_start_time).toISOString().replace('T', ' ').replace('.000Z', '')}` : 'Non programmato'}
${task.scheduled_end_time ? `Fine Programmata: ${new Date(task.scheduled_end_time).toISOString().replace('T', ' ').replace('.000Z', '')}` : 'Non programmato'}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>
        
        {/* Edit Button */}
        <button
          className="task-btn edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/backlog/${task.id}/edit`);
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
      
      {/* Info Popup */}
      {/* showInfo state removed, so this block is no longer needed */}
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
    let filtered = tasks.filter(task => task.status !== 'SCHEDULED');
    if (selectedWorkCenter && selectedWorkCenter !== 'BOTH') {
      filtered = filtered.filter(task => task.work_center === selectedWorkCenter);
    }
    return filtered;
  }, [tasks, selectedWorkCenter]);

  return (
    <div className="task-pool-section">
      <h2 className="section-title">Pool Lavori</h2>
      <p>Trascina i lavori da qui per programmarli, o trascina gli eventi programmati qui per annullarli.</p>
      <div ref={setNodeRef} id="task_pool" className="task-pool-grid">
        {unscheduledTasks.length > 0 ? (
          unscheduledTasks.map(task => (
            <DraggableTask key={task.id} task={task} />
          ))
        ) : (
          <div className="empty-state">Nessun lavoro non programmato disponibile</div>
        )}
      </div>
    </div>
  );
}

export default TaskPool;