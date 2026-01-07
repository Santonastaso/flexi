import React, { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useOrderStore, useSchedulerStore } from '../store';
import { format } from 'date-fns';
import { Button } from './ui/button';
import QueueTaskCard from './QueueTaskCard';
import PauseDialog from './PauseDialog';

function MachineQueueColumn({ machine, queryClient }) {
  const { odpOrders } = useOrderStore();
  const { createPauseTask } = useSchedulerStore();
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  // Handle creating a pause
  const handleCreatePause = async (machineId, durationHours) => {
    const result = await createPauseTask(machineId, durationHours, true);
    
    if (result.error) {
      console.error('Error creating pause:', result.error);
      throw new Error(result.error);
    }
    
    // Refresh the orders list
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  };

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
        task.status === 'SCHEDULED' &&
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
          <span className="text-[10px] text-gray-500">{machine.work_center}</span>
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
            <p className="text-[10px] text-gray-400">Trascina un lavoro qui per iniziare</p>
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
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>

      {/* Add Pause Button */}
      <div className="queue-column-footer">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowPauseDialog(true)}
          className="w-full"
        >
          + Aggiungi Pausa
        </Button>
      </div>

      {/* Pause Dialog */}
      <PauseDialog
        isOpen={showPauseDialog}
        onClose={() => setShowPauseDialog(false)}
        onCreatePause={handleCreatePause}
        machineId={machine.id}
        machineName={machine.machine_name}
      />
    </div>
  );
}

export default MachineQueueColumn;

