import React, { useMemo, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useStore } from '../store/useStore';

// Individual Draggable Task Component - optimized
const DraggableTask = React.memo(({ task }) => {
  const [isLocked, setIsLocked] = useState(true); // Tasks start locked by default
  const [isMoving, setIsMoving] = useState(false);
  
  // Get the update function from the store
  const updateOdpOrder = useStore(state => state.updateOdpOrder);

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

  const moveTask = async (direction) => {
    if (!task.scheduled_start_time) {
      console.log('Task is not scheduled yet, cannot move');
      return;
    }

    if (isMoving) return; // Prevent multiple simultaneous moves

    setIsMoving(true);
    try {
      const currentStartTime = new Date(task.scheduled_start_time);
      const timeIncrement = 15 * 60 * 1000; // 15 minutes in milliseconds
      
      let newStartTime;
      if (direction === 'back') {
        newStartTime = new Date(currentStartTime.getTime() - timeIncrement);
      } else {
        newStartTime = new Date(currentStartTime.getTime() + timeIncrement);
      }

      // Only update the scheduled_start_time field, not the entire task
      const updates = {
        scheduled_start_time: newStartTime.toISOString()
      };

      await updateOdpOrder(task.id, updates);
      console.log(`Task moved ${direction} by 15 minutes`);
    } catch (error) {
      console.error('Failed to move task:', error);
    } finally {
      setIsMoving(false);
    }
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
          disabled={isMoving}
        >
          ℹ️
        </button>
        
        {/* Lock/Unlock Button */}
        <button 
          className={`task-btn lock-btn ${isLocked ? 'locked' : 'unlocked'}`}
          onClick={handleLockClick}
          title={isLocked ? "Unlock to enable dragging" : "Lock to disable dragging"}
          disabled={isMoving}
        >
          {isLocked ? '🔒' : '🔓'}
        </button>
        
        {/* Movement Arrows - only visible when unlocked */}
        {!isLocked && (
          <>
            {/* Left Arrow - Move back 15 minutes */}
            <button 
              className={`task-btn move-btn move-left ${isMoving ? 'moving' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                moveTask('back');
              }}
              title="Move back 15 minutes"
              disabled={isMoving}
            >
              {isMoving ? '⏳' : '⬅️'}
            </button>
            
            {/* Right Arrow - Move forward 15 minutes */}
            <button 
              className={`task-btn move-btn move-right ${isMoving ? 'moving' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                moveTask('forward');
              }}
              title="Move forward 15 minutes"
              disabled={isMoving}
            >
              {isMoving ? '⏳' : '➡️'}
            </button>
          </>
        )}
        
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
  const selectedWorkCenter = useStore(state => state.selectedWorkCenter);
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