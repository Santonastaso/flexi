import React, { useMemo, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useOrderStore, useUIStore } from '../store';
import { useErrorHandler } from '../hooks';

// Individual Draggable Task Component - optimized
const DraggableTask = React.memo(({ task }) => {
  const [isLocked, setIsLocked] = useState(true); // Tasks start locked by default
  
  // Get the update function from the store
  const { updateOdpOrder } = useOrderStore();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('TaskPool');

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `task-${task.id}`,
    data: { task, type: 'task' },
    disabled: isLocked, // Disable dragging when locked
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const handleLockClick = (e) => {
    e.stopPropagation(); // Prevent drag from starting
    setIsLocked(!isLocked);
  };

  return (
    <div ref={setNodeRef} style={style} className="task-item">
      <div className="task-content">
        <span className="task-label">{task.odp_number}</span>
        <span className="task-duration">{task.duration || 1}h</span>
      </div>
      
      <div className="task-controls">
        {/* Info Button */}
        <button 
          className="task-btn info-btn" 
          title={`Delivery Date: ${task.delivery_date ? new Date(task.delivery_date).toLocaleDateString() : 'Not set'}
Quantity: ${task.quantity || 'Not specified'}
${task.scheduled_start_time ? `Scheduled: ${new Date(task.scheduled_start_time).toLocaleString()}` : ''}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>
        
        {/* Lock/Unlock Button */}
        <button 
          className={`task-btn lock-btn ${isLocked ? 'locked' : 'unlocked'}`}
          onClick={handleLockClick}
          title={isLocked ? "Unlock to enable dragging" : "Lock to disable dragging"}
        >
          {isLocked ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-9h-1V6c0-2.76-2.24-5-5-5-2.28 0-4.27 1.54-4.84 3.75-.14.54.18 1.08.72 1.22.53.14 1.08-.18 1.22-.72C9.44 6.06 10.72 5 12 5c1.66 0 3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"/>
            </svg>
          )}
        </button>
        
        {/* Drag Handle - only active when unlocked */}
        {!isLocked && (
          <div 
            className="drag-handle" 
            {...listeners} 
            {...attributes}
            title="Drag to schedule"
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
      <h2 className="section-title">Task Pool</h2>
      <p>Drag tasks from here to schedule them, or drag scheduled events back here to unschedule them.</p>
      <div ref={setNodeRef} id="task_pool" className="task-pool-grid">
        {unscheduledTasks.length > 0 ? (
          unscheduledTasks.map(task => (
            <DraggableTask key={task.id} task={task} />
          ))
        ) : (
          <div className="empty-state">No unscheduled tasks available</div>
        )}
      </div>
    </div>
  );
}

export default TaskPool;