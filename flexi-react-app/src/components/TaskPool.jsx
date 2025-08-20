import React, { useMemo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

// Individual Draggable Task Component - optimized
const DraggableTask = React.memo(({ task }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `task-${task.id}`,
    data: { task, type: 'task' },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="task-item">
      <span>{task.odp_number}</span>
      <span className="task-duration">{task.duration || 1}h</span>
    </div>
  );
});

// Main Task Pool Component - optimized for performance
function TaskPool({ tasks }) {
  const { setNodeRef } = useDroppable({
    id: 'task-pool',
    data: { type: 'pool' },
  });

  // Memoize unscheduled tasks filtering for better performance
  const unscheduledTasks = useMemo(() =>
    tasks.filter(task => task.status !== 'SCHEDULED'),
    [tasks]
  );

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