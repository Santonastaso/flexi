import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import TaskPool from '../components/TaskPool';
import GanttChart from '../components/GanttChart';
import { appStore } from '../scripts/store';

function SchedulerPage() {
  const [tasks, setTasks] = useState([]);
  const [machines, setMachines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [workCenterFilter, setWorkCenterFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (!appStore.isInitialized()) {
        await appStore.init();
      }
      const state = appStore.getState();
      setTasks(state.odpOrders);
      setMachines(state.machines.filter(m => m.status === 'ACTIVE'));
      setIsLoading(false);

      const unsubscribe = appStore.subscribe((newState) => {
        setTasks(newState.odpOrders);
        setMachines(newState.machines.filter(m => m.status === 'ACTIVE'));
      });
      return () => unsubscribe();
    }
    fetchData();
  }, []);

  // Get unique work centers and departments for filter dropdowns
  const workCenters = useMemo(() => {
    const centers = [...new Set(machines.map(m => m.work_center).filter(Boolean))].sort();
    return centers;
  }, [machines]);

  const departments = useMemo(() => {
    const depts = [...new Set(machines.map(m => m.department).filter(Boolean))].sort();
    return depts;
  }, [machines]);

  // Apply filters to machines
  const filteredMachines = useMemo(() => {
    return machines.filter(machine => {
      const workCenterMatch = !workCenterFilter || machine.work_center === workCenterFilter;
      const departmentMatch = !departmentFilter || machine.department === departmentFilter;
      return workCenterMatch && departmentMatch;
    });
  }, [machines, workCenterFilter, departmentFilter]);

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (direction === 'today') {
      setCurrentDate(new Date());
    } else if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
      setCurrentDate(newDate);
    } else if (direction === 'next') {
      newDate.setDate(newDate.getDate() + 1);
      setCurrentDate(newDate);
    }
  };

  const formatDateDisplay = () => {
    const today = new Date();
    const isToday = currentDate.toDateString() === today.toDateString();
    return isToday ? 'Today' : currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  const clearFilters = () => {
    setWorkCenterFilter('');
    setDepartmentFilter('');
  };

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

    const draggedItem = active.data.current;
    const dropZone = over.data.current;

    // Case 1: Dragging a task from the pool to a machine slot
    if (draggedItem.type === 'task' && dropZone.type === 'slot') {
      const task = draggedItem.task;
      const { machine, hour } = dropZone;
      
      const startDate = new Date(currentDate);
      startDate.setHours(hour, 0, 0, 0);
      const durationHours = task.duration || 1;
      const endDate = new Date(startDate.getTime() + durationHours * 3600 * 1000);

      const scheduleData = {
        machine: machine.id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      };
      appStore.scheduleTask(task.id, scheduleData);
    }

    // Case 2: Dragging an existing scheduled event to a new slot (rescheduling)
    if (draggedItem.type === 'event' && dropZone.type === 'slot') {
      const event = draggedItem.event;
      const { machine, hour } = dropZone;
      
      const startDate = new Date(currentDate);
      startDate.setHours(hour, 0, 0, 0);
      const durationHours = event.duration || 1;
      const endDate = new Date(startDate.getTime() + durationHours * 3600 * 1000);

      const scheduleData = {
        machine: machine.id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      };
      appStore.scheduleTask(event.id, scheduleData);
    }

    // Case 3: Dragging an event back to the task pool (unscheduling)
    if (draggedItem.type === 'event' && dropZone.type === 'pool') {
      const eventToUnschedule = draggedItem.event;
      appStore.unscheduleTask(eventToUnschedule.id);
    }
  };

  if (isLoading) {
    return <div>Loading scheduler data...</div>;
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="scheduler-container">
        <TaskPool tasks={tasks} currentDate={currentDate} />
        <div className="calendar-header">
          <h2 className="calendar-title">Production Schedule</h2>
          <div className="calendar-controls">
            {/* Machine Filter */}
            <div className="machine-filter">
              <label htmlFor="work_center_filter">Work Center:</label>
              <select 
                id="work_center_filter" 
                value={workCenterFilter}
                onChange={(e) => setWorkCenterFilter(e.target.value)}
              >
                <option value="">All Work Centers</option>
                {workCenters.map(center => (
                  <option key={center} value={center}>{center}</option>
                ))}
              </select>
              
              <label htmlFor="department_filter">Department:</label>
              <select 
                id="department_filter" 
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              
              <button 
                className="btn btn-secondary" 
                onClick={clearFilters}
                title="Clear all filters"
              >
                Clear Filters
              </button>
            </div>
            
            {/* Calendar Navigation */}
            <div className="calendar-navigation">
              <button 
                className="nav-btn today" 
                onClick={() => navigateDate('today')}
              >
                Today
              </button>
              <button 
                className="nav-btn" 
                onClick={() => navigateDate('prev')}
              >
                &lt;
              </button>
              <span className="current-date">{formatDateDisplay()}</span>
              <button 
                className="nav-btn" 
                onClick={() => navigateDate('next')}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
        <GanttChart machines={filteredMachines} tasks={tasks} currentDate={currentDate} />
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