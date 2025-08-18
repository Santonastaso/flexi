import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import TaskPool from '../components/TaskPool';
import GanttChart from '../components/GanttChart';
import { appStore } from '../scripts/store';

function SchedulerPage() {
  const [tasks, setTasks] = useState([]);
  const [machines, setMachines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    async function fetchData() {
      if (!appStore.isInitialized()) {
        await appStore.init();
      }
      const state = appStore.getState();
      setTasks(state.odpOrders);
      setMachines(state.machines); // MODIFIED: Removed the .filter()
      setIsLoading(false);

      const unsubscribe = appStore.subscribe((newState) => {
        setTasks(newState.odpOrders);
        setMachines(newState.machines); // MODIFIED: Removed the .filter()
      });
      return () => unsubscribe();
    }
    fetchData();
  }, []);

  const handleDragStart = (event) => {
    const draggedItem = event.active.data.current;
    if (draggedItem.type === 'task') {
      setActiveDragItem(draggedItem.task);
    } else if (draggedItem.type === 'event') {
      setActiveDragItem(draggedItem.event);
    }
  };

  const handleDragEnd = (event) => {
    setActiveDragItem(null);
    const { over, active } = event;
    if (!over) return;

    const draggedItemData = active.data.current;
    const dropZoneData = over.data.current;

    // SCENARIO 1: Drop an event back into the task pool to unschedule it
    if (draggedItemData.type === 'event' && dropZoneData.type === 'pool') {
      const eventToUnschedule = draggedItemData.event;
      appStore.unscheduleTask(eventToUnschedule.id);
      return;
    }

    // SCENARIO 2: Drop a task or an event into a time slot
    if (dropZoneData.type === 'slot') {
      const taskToSchedule = draggedItemData.type === 'task' ? draggedItemData.item : draggedItemData.event;
      const { machine, hour } = dropZoneData;

      const startDate = new Date(currentDate);
      startDate.setHours(hour, 0, 0, 0);
      const durationHours = taskToSchedule.duration || 1;
      const endDate = new Date(startDate.getTime() + durationHours * 3600 * 1000);

      const scheduleData = {
        machine: machine.id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      };
      appStore.scheduleTask(taskToSchedule.id, scheduleData);
    }
  };

  if (isLoading) {
    return <div>Loading scheduler data...</div>;
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="scheduler-container">
        <TaskPool tasks={tasks} />
        <div className="calendar-header">
            <h2 className="calendar-title">Production Schedule</h2>
        </div>
        <GanttChart machines={machines} tasks={tasks} />
      </div>
      <DragOverlay>
        {activeDragItem ? (
          <div className="task-item" style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>
            <span>{activeDragItem.odp_number}</span>
            <span className="task-duration">{activeDragItem.duration || 1}h</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default SchedulerPage;