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
        <span>{task.odp_number}</span>
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
          ℹ️
        </button>
        
        {/* Lock/Unlock Button */}
        <button 
          className={`task-btn lock-btn ${isLocked ? 'locked' : 'unlocked'}`}
          onClick={handleLockClick}
          title={isLocked ? "Unlock to enable dragging" : "Lock to disable dragging"}
        >
          {isLocked ? '🔒' : '🔓'}
        </button>
        
        {/* Drag Handle - only active when unlocked */}
        {!isLocked && (
          <div 
            className="drag-handle" 
            {...listeners} 
            {...attributes}
            title="Drag to schedule"
          >
            🖐️
          </div>
        )}
      </div>
      
      {/* Info Popup */}
      {/* showInfo state removed, so this block is no longer needed */}
    </div>
  );
});

// Main Task Pool Component - optimized for performance
function TaskPool({ tasks }) {
  const { selectedWorkCenter } = useUIStore();
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
      <h2>Task Pool</h2>
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