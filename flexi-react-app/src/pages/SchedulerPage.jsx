import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useStore } from '../store/useStore';
import { addHoursToDate } from '../utils/dateUtils';
import { MACHINE_STATUSES, WORK_CENTERS } from '../constants';

// Lazy load heavy components to improve initial load time
const TaskPool = lazy(() => import('../components/TaskPool'));
const GanttChart = lazy(() => import('../components/GanttChart'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="loading-fallback" style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    fontSize: '16px',
    color: '#666'
  }}>
    Loading scheduler components...
  </div>
);

function SchedulerPage() {
  // Select state and actions from Zustand store
  const { 
    odpOrders: tasks, 
    machines, 
    selectedWorkCenter,
    isLoading, 
    isInitialized, 
    init, 
    scheduleTask, 
    unscheduleTask, 
    showAlert 
  } = useStore();



  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [workCenterFilter, setWorkCenterFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Use refs to avoid unnecessary re-renders
  const filtersRef = useRef({ workCenterFilter, departmentFilter });
  filtersRef.current = { workCenterFilter, departmentFilter };

  // Performance monitoring
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Initialize store on mount with performance tracking
  useEffect(() => {
    if (!isInitialized) {
      const startTime = performance.now();
      init().finally(() => {
        const endTime = performance.now();
        console.log(`🚀 Store initialization took: ${(endTime - startTime).toFixed(2)}ms`);
        setIsInitialLoad(false);
      });
    } else {
      setIsInitialLoad(false);
    }
  }, [init, isInitialized]);

  // Memoize machine filtering with optimized dependencies and early returns
  const machineData = useMemo(() => {
    const startTime = performance.now();

    if (!machines || machines.length === 0) {
      return { activeMachines: [], workCenters: [], departments: [] };
    }

    // First filter by work center, then by status
    let workCenterFiltered = machines;
    if (selectedWorkCenter && selectedWorkCenter !== WORK_CENTERS.BOTH) {
      workCenterFiltered = machines.filter(m => m.work_center === selectedWorkCenter);
    }

    const activeMachines = workCenterFiltered.filter(m => m.status === MACHINE_STATUSES.ACTIVE);

    if (activeMachines.length === 0) {
      return { activeMachines: [], workCenters: [], departments: [] };
    }

    // Pre-compute work centers and departments with Set for better performance
    const workCenterSet = new Set();
    const departmentSet = new Set();

    for (const machine of activeMachines) {
      if (machine.work_center) workCenterSet.add(machine.work_center);
      if (machine.department) departmentSet.add(machine.department);
    }

    const workCenters = Array.from(workCenterSet).sort();
    const departments = Array.from(departmentSet).sort();

    const endTime = performance.now();
    if (endTime - startTime > 5) {
      console.log(`⚡ Machine data computation took: ${(endTime - startTime).toFixed(2)}ms`);
    }

    return { activeMachines, workCenters, departments };
  }, [machines, selectedWorkCenter]);

  // Apply additional filters to machines
  const filteredMachines = useMemo(() => {
    const { activeMachines } = machineData;
    const { workCenterFilter, departmentFilter } = filtersRef.current;

    // Apply additional filters on top of work center filtering
    let filtered = activeMachines;

    if (workCenterFilter && workCenterFilter !== selectedWorkCenter) {
      filtered = filtered.filter(machine => machine.work_center === workCenterFilter);
    }
    
    if (departmentFilter) {
      filtered = filtered.filter(machine => machine.department === departmentFilter);
    }

    return filtered;
  }, [machineData, selectedWorkCenter]);

  // Memoize navigation functions to prevent unnecessary re-renders
  const navigateDate = useCallback((direction) => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (direction === 'today') {
        return new Date();
      } else if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 1);
        return newDate;
      } else if (direction === 'next') {
        newDate.setDate(newDate.getDate() + 1);
        return newDate;
      }
      return prevDate;
    });
  }, []);

  const formatDateDisplay = useCallback(() => {
    const today = new Date();
    const isToday = currentDate.toDateString() === today.toDateString();
    return isToday ? 'Today' : currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }, [currentDate]);

  const clearFilters = useCallback(() => {
    setWorkCenterFilter('');
    setDepartmentFilter('');
  }, []);

  // Debounce ref to prevent rapid drag operations
  const dragTimeoutRef = useRef(null);
  const isDragOperationRef = useRef(false);

  // Memoize drag handlers with performance optimizations
  const handleDragStart = useCallback((event) => {
    const startTime = performance.now();
    const draggedItem = event.active.data.current;

    if (draggedItem.type === 'task') {
      setActiveDragItem(draggedItem.task);
    } else if (draggedItem.type === 'event') {
      setActiveDragItem(draggedItem.event);
    }

    console.log(`🎯 Drag start took: ${(performance.now() - startTime).toFixed(2)}ms`);
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    const dragEndStartTime = performance.now();

    // Clear any pending drag operations
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    // Prevent multiple rapid drag operations
    if (isDragOperationRef.current) {
      console.log('🚫 Drag operation already in progress, ignoring');
      return;
    }

    setActiveDragItem(null);
    const { over, active } = event;

    if (!over) {
      console.log(`✅ Drag cancelled - no drop zone (took ${(performance.now() - dragEndStartTime).toFixed(2)}ms)`);
      return;
    }

    const draggedItem = active.data.current;
    const dropZone = over.data.current;

    // Quick validation before async operation
    if (!draggedItem || !dropZone) {
      console.log('❌ Invalid drag data');
      return;
    }

    isDragOperationRef.current = true;

    try {
      // Use requestAnimationFrame to defer heavy operations
      await new Promise(resolve => {
        requestAnimationFrame(async () => {
          const operationStartTime = performance.now();

          // Case 1: Dragging a task from the pool to a machine slot
          if (draggedItem.type === 'task' && dropZone.type === 'slot') {
            const task = draggedItem.task;
            const { machine, hour, minute, isUnavailable, hasScheduledTask } = dropZone;

            // Immediate constraint checks (no async)
            if (isUnavailable) {
              showAlert('Cannot schedule task on unavailable time slot', 'error');
              return resolve();
            }

            if (hasScheduledTask) {
              showAlert('Cannot schedule task on occupied time slot', 'error');
              return resolve();
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
            }

            console.log(`✅ Task scheduling took: ${(performance.now() - operationStartTime).toFixed(2)}ms`);
          }

          // Case 2: Dragging an existing scheduled event to a new slot (rescheduling)
          else if (draggedItem.type === 'event' && dropZone.type === 'slot') {
            const eventItem = draggedItem.event;
            const { machine, hour, minute, isUnavailable, hasScheduledTask } = dropZone;

            // Immediate constraint checks
            if (isUnavailable) {
              showAlert('Cannot reschedule task to unavailable time slot', 'error');
              return resolve();
            }

            if (hasScheduledTask) {
              showAlert('Cannot reschedule task to occupied time slot', 'error');
              return resolve();
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
            }

            console.log(`✅ Event rescheduling took: ${(performance.now() - operationStartTime).toFixed(2)}ms`);
          }

          // Case 3: Dragging an event back to the task pool (unscheduling)
          else if (draggedItem.type === 'event' && dropZone.type === 'pool') {
            const eventToUnschedule = draggedItem.event;
            unscheduleTask(eventToUnschedule.id);
            console.log(`✅ Task unscheduling took: ${(performance.now() - operationStartTime).toFixed(2)}ms`);
          }

          resolve();
        });
      });
    } catch (error) {
      console.error('❌ Drag operation failed:', error);
      showAlert('An error occurred during the drag operation', 'error');
    } finally {
      isDragOperationRef.current = false;
      console.log(`🎯 Total drag operation took: ${(performance.now() - dragEndStartTime).toFixed(2)}ms`);
    }
  }, [currentDate, scheduleTask, unscheduleTask, showAlert]);

    // Show loading state during initial load
  if (isLoading || isInitialLoad) {
    return (
      <div className="scheduler-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h3>Loading Production Scheduler...</h3>
          <p>Initializing components and data</p>
        </div>
      </div>
    );
  }

  if (!selectedWorkCenter) {
    return (
      <div className="content-section">
        <div className="error">Please select a work center to view scheduler data.</div>
      </div>
      );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="scheduler-container">
        <Suspense fallback={<LoadingFallback />}>
          <TaskPool tasks={tasks} currentDate={currentDate} />
        </Suspense>

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
                {machineData.workCenters.map(center => (
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
                {machineData.departments.map(dept => (
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

        <Suspense fallback={<LoadingFallback />}>
          <GanttChart machines={filteredMachines} tasks={tasks} currentDate={currentDate} />
        </Suspense>
      </div>

      <DragOverlay>
        {activeDragItem ? (
          <div className="task-item drag-overlay" style={{
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
            transform: 'rotate(3deg) scale(1.05)',
            opacity: 0.9,
            zIndex: 1002,
            pointerEvents: 'none' // Improve drag performance
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