import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

function DraggableTask({ task }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `task-${task.id}`,
    data: { item: task, type: 'task' },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="task-item">
      <span>{task.odp_number}</span>
      <span className="task-duration">{task.duration || 1}h</span>
    </div>
  );
}

function TaskPool({ tasks }) {
  const { setNodeRef } = useDroppable({
    id: 'task-pool',
    data: { type: 'pool' },
  });

  const unscheduledTasks = tasks.filter(task => task.status !== 'SCHEDULED');

  return (
    <div className="task-pool-section">
      <h2>Task Pool</h2>
      <p>Drag tasks from here to schedule, or drag scheduled events back here to unschedule.</p>
      <div ref={setNodeRef} id="task_pool" className="task-pool-grid">
        {unscheduledTasks.length > 0 ? (
          unscheduledTasks.map(task => <DraggableTask key={task.id} task={task} />)
        ) : (
          <div className="empty-state">No unscheduled tasks available</div>
        )}
      </div>
    </div>
  );
}

export default TaskPool;