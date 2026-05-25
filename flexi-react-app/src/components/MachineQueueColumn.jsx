import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useOrders } from '../hooks';
import { format } from 'date-fns';
import QueueTaskCard from './QueueTaskCard';

function MachineQueueColumn({ machine }) {
  // Use React Query for orders
  const { data: odpOrders = [] } = useOrders();

  // Set up droppable zone for this machine column
  const { setNodeRef, isOver } = useDroppable({
    id: `machine-queue-${machine.id}`,
    data: { 
      type: 'queue-column', 
      machineId: machine.id,
      machine: machine
    },
  });

  // Get all scheduled tasks for this machine, sorted by start time
  const queueTasks = useMemo(() => {
    return odpOrders
      .filter(task => 
        task.scheduled_machine_id === machine.id && 
        ['SCHEDULED', 'IN PROGRESS'].includes(task.status) &&
        task.scheduled_start_time
      )
      .sort((a, b) => {
        const aTime = new Date(a.scheduled_start_time).getTime();
        const bTime = new Date(b.scheduled_start_time).getTime();
        return aTime - bTime;
      });
  }, [odpOrders, machine.id]);

  // Calculate total queue duration
  const totalQueueDuration = useMemo(() => {
    return queueTasks.reduce((sum, task) => {
      const duration = task.time_remaining || task.duration || 0;
      return sum + duration;
    }, 0);
  }, [queueTasks]);

  // Calculate queue end time
  const queueEndTime = useMemo(() => {
    if (queueTasks.length === 0) return null;
    const lastTask = queueTasks[queueTasks.length - 1];
    if (!lastTask.scheduled_end_time) return null;
    return new Date(lastTask.scheduled_end_time);
  }, [queueTasks]);

  // Get task IDs for sortable context
  const taskIds = useMemo(() => queueTasks.map(task => `task-${task.id}`), [queueTasks]);

  return (
    <div 
      ref={setNodeRef}
      className={`machine-queue-column ${isOver ? 'is-drag-over' : ''}`}
    >
      {/* Column Header */}
      <div className="queue-column-header">
        <div className="queue-column-title">
          <h3 className="text-sm font-semibold text-gray-900">{machine.machine_name}</h3>
          <span className="text-[11px] text-gray-500">{machine.work_center}</span>
        </div>
        <div className="queue-column-stats">
          <div className="stat-item">
            <span className="stat-label">Tasks:</span>
            <span className="stat-value">{queueTasks.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Durata:</span>
            <span className="stat-value">{totalQueueDuration.toFixed(1)}h</span>
          </div>
          {queueEndTime && (
            <div className="stat-item">
              <span className="stat-label">Fine:</span>
              <span className="stat-value">{format(queueEndTime, 'dd/MM HH:mm')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Queue Tasks List */}
      <div className="queue-column-body">
        {queueTasks.length === 0 ? (
          <div className="queue-empty-state">
            <p className="text-xs text-gray-500">Nessun lavoro in coda</p>
            <p className="text-xs text-gray-400">Trascina un lavoro qui per iniziare</p>
          </div>
        ) : (
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div className="queue-tasks-list">
              {queueTasks.map((task, index) => (
                <QueueTaskCard 
                  key={task.id} 
                  task={task} 
                  index={index}
                  machineId={machine.id}
                  enableReorder={false}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export default MachineQueueColumn;
