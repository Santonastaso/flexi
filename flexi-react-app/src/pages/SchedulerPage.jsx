import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import TaskPool from '../components/TaskPool';
import GanttChart from '../components/GanttChart';
import { useStore } from '../store/useStore';
import { addHoursToDate } from '../utils/dateUtils';
import { MACHINE_STATUSES } from '../constants';

function SchedulerPage() {
  // Select state and actions from Zustand store
  const { odpOrders: tasks, machines, isLoading, isInitialized, init, scheduleTask, unscheduleTask, showAlert } = useStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [workCenterFilter, setWorkCenterFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Initialize store on mount
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [init, isInitialized]);

  // Use only ACTIVE machines for scheduling-related UI
  const activeMachines = useMemo(() => machines.filter(m => m.status === MACHINE_STATUSES.ACTIVE), [machines]);

  // Get unique work centers and departments for filter dropdowns
  const workCenters = useMemo(() => {
    const centers = [...new Set(activeMachines.map(m => m.work_center).filter(Boolean))].sort();
    return centers;
  }, [activeMachines]);

  const departments = useMemo(() => {
    const depts = [...new Set(activeMachines.map(m => m.department).filter(Boolean))].sort();
    return depts;
  }, [activeMachines]);

  // Apply filters to machines
  const filteredMachines = useMemo(() => {
    return activeMachines.filter(machine => {
      const workCenterMatch = !workCenterFilter || machine.work_center === workCenterFilter;
      const departmentMatch = !departmentFilter || machine.department === departmentFilter;
      return workCenterMatch && departmentMatch;
    });
  }, [activeMachines, workCenterFilter, departmentFilter]);

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

  const handleDragEnd = async (event) => {
    setActiveDragItem(null);
    const { over, active } = event;
    if (!over) return;

    const draggedItem = active.data.current;
    const dropZone = over.data.current;

    // Case 1: Dragging a task from the pool to a machine slot
    if (draggedItem.type === 'task' && dropZone.type === 'slot') {
      const task = draggedItem.task;
      const { machine, hour, minute, isUnavailable, hasScheduledTask } = dropZone;
      
      // Check constraints
      if (isUnavailable) {
        showAlert('Cannot schedule task on unavailable time slot', 'error');
        return;
      }
      
      if (hasScheduledTask) {
        showAlert('Cannot schedule task on occupied time slot', 'error');
        return;
      }
      
      const startDate = new Date(currentDate);
      startDate.setHours(hour, minute, 0, 0);
      const durationHours = task.duration || 1;
      const endDate = addHoursToDate(startDate, durationHours);

      const scheduleData = {
        machine: machine.id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      };
      const result = await scheduleTask(task.id, scheduleData);
      if (result?.error) {
        showAlert(result.error, 'error');
        return;
      }
    }

    // Case 2: Dragging an existing scheduled event to a new slot (rescheduling)
    if (draggedItem.type === 'event' && dropZone.type === 'slot') {
      const eventItem = draggedItem.event;
      const { machine, hour, minute, isUnavailable, hasScheduledTask } = dropZone;
      
      // Check constraints (allow rescheduling to same slot)
      if (isUnavailable) {
        showAlert('Cannot reschedule task to unavailable time slot', 'error');
        return;
      }
      
      if (hasScheduledTask) {
        showAlert('Cannot reschedule task to occupied time slot', 'error');
        return;
      }
      
      const startDate = new Date(currentDate);
      startDate.setHours(hour, minute, 0, 0);
      const durationHours = eventItem.duration || 1;
      const endDate = addHoursToDate(startDate, durationHours);

      const scheduleData = {
        machine: machine.id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      };
      const result = await scheduleTask(eventItem.id, scheduleData);
      if (result?.error) {
        showAlert(result.error, 'error');
        return;
      }
    }

    // Case 3: Dragging an event back to the task pool (unscheduling)
    if (draggedItem.type === 'event' && dropZone.type === 'pool') {
      const eventToUnschedule = draggedItem.event;
      unscheduleTask(eventToUnschedule.id);
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
          <div className="task-item drag-overlay" style={{ 
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
            transform: 'rotate(3deg) scale(1.05)',
            opacity: 0.9,
            zIndex: 1002
          }}>
            <span>{activeDragItem.odp_number}</span>
            <span className="task-duration">{activeDragItem.duration || 1}h</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default SchedulerPage;