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
  const [workCenterFilter, setWorkCenterFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [machineTypeFilter, setMachineTypeFilter] = useState([]);
  const [machineNameFilter, setMachineNameFilter] = useState([]);

  // State for custom dropdowns
  const [workCenterFilterOpen, setWorkCenterFilterOpen] = useState(false);
  const [departmentFilterOpen, setDepartmentFilterOpen] = useState(false);
  const [machineTypeFilterOpen, setMachineTypeFilterOpen] = useState(false);
  const [machineNameFilterOpen, setMachineNameFilterOpen] = useState(false);
  const [workCenterSearch, setWorkCenterSearch] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [machineTypeSearch, setMachineTypeSearch] = useState('');
  const [machineNameSearch, setMachineNameSearch] = useState('');

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

  // Handle clicking outside dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.searchable-dropdown')) {
        setWorkCenterFilterOpen(false);
        setDepartmentFilterOpen(false);
        setMachineTypeFilterOpen(false);
        setMachineNameFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Memoize machine filtering with optimized dependencies and early returns
  const machineData = useMemo(() => {
    const startTime = performance.now();

    if (!machines || machines.length === 0) {
      return { activeMachines: [], workCenters: [], departments: [], machineTypes: [], machineNames: [] };
    }

    // First filter by work center, then by status
    let workCenterFiltered = machines;
    if (selectedWorkCenter && selectedWorkCenter !== WORK_CENTERS.BOTH) {
      workCenterFiltered = machines.filter(m => m.work_center === selectedWorkCenter);
    }

    const activeMachines = workCenterFiltered.filter(m => m.status === MACHINE_STATUSES.ACTIVE);

    if (activeMachines.length === 0) {
      return { activeMachines: [], workCenters: [], departments: [], machineTypes: [], machineNames: [] };
    }

    // Pre-compute work centers and departments with Set for better performance
    const workCenterSet = new Set();
    const departmentSet = new Set();
    const machineTypeSet = new Set();
    const machineNameSet = new Set();

    for (const machine of activeMachines) {
      if (machine.work_center) workCenterSet.add(machine.work_center);
      if (machine.department) departmentSet.add(machine.department);
      if (machine.machine_type) machineTypeSet.add(machine.machine_type);
      if (machine.machine_name) machineNameSet.add(machine.machine_name);
    }

    const workCenters = Array.from(workCenterSet).sort();
    const departments = Array.from(departmentSet).sort();
    const machineTypes = Array.from(machineTypeSet).sort();
    const machineNames = Array.from(machineNameSet).sort();

    console.log('📋 Available filter options:', {
      workCenters,
      departments,
      machineTypes,
      machineNames
    });

    const endTime = performance.now();
    if (endTime - startTime > 5) {
      console.log(`⚡ Machine data computation took: ${(endTime - startTime).toFixed(2)}ms`);
    }

    return { activeMachines, workCenters, departments, machineTypes, machineNames };
  }, [machines, selectedWorkCenter]);

  // Apply additional filters to machines
  const filteredMachines = useMemo(() => {
    const { activeMachines } = machineData;

    // Apply filters sequentially for better performance
    let filtered = activeMachines;

    // Filter by work center (if selected)
    if (workCenterFilter.length > 0) {
      filtered = filtered.filter(machine => workCenterFilter.includes(machine.work_center));
    }
    
    // Filter by department (if selected)
    if (departmentFilter.length > 0) {
      filtered = filtered.filter(machine => departmentFilter.includes(machine.department));
    }

    // Filter by machine type (if selected)
    if (machineTypeFilter.length > 0) {
      filtered = filtered.filter(machine => machineTypeFilter.includes(machine.machine_type));
    }

    // Filter by machine name (if selected)
    if (machineNameFilter.length > 0) {
      filtered = filtered.filter(machine => machineNameFilter.includes(machine.machine_name));
    }

    return filtered;
  }, [machineData, workCenterFilter, departmentFilter, machineTypeFilter, machineNameFilter]);

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
    setWorkCenterFilter([]);
    setDepartmentFilter([]);
    setMachineTypeFilter([]);
    setMachineNameFilter([]);
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
            const timeRemainingHours = task.time_remaining || task.duration || 1;
            const endDate = addHoursToDate(startDate, timeRemainingHours);

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
            const timeRemainingHours = eventItem.time_remaining || eventItem.duration || 1;
            const endDate = addHoursToDate(startDate, timeRemainingHours);

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
              {/* Work Center Filter */}
              <div className="searchable-dropdown" style={{ width: '200px' }}>
              <label htmlFor="work_center_filter">Work Center:</label>
                <input 
                  type="text" 
                id="work_center_filter"
                  value={workCenterSearch} 
                  onChange={(e) => setWorkCenterSearch(e.target.value)} 
                  onFocus={() => setWorkCenterFilterOpen(true)} 
                  placeholder="Search Work Centers" 
                />
                {workCenterFilterOpen && machineData.workCenters.length > 0 && (
                  <div className="dropdown-options">
                    <div 
                      className={`dropdown-option ${(() => {
                        const visibleOptions = machineData.workCenters.filter(center => 
                          center.toLowerCase().includes(workCenterSearch.toLowerCase())
                        );
                        return visibleOptions.every(option => workCenterFilter.includes(option)) && workCenterFilter.length > 0;
                      })() ? 'selected' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const visibleOptions = machineData.workCenters.filter(center => 
                          center.toLowerCase().includes(workCenterSearch.toLowerCase())
                        );
                        const allVisibleSelected = visibleOptions.every(option => workCenterFilter.includes(option));
                        
                        if (allVisibleSelected) {
                          // Remove all visible options
                          setWorkCenterFilter(prev => prev.filter(option => !visibleOptions.includes(option)));
                        } else {
                          // Add all visible options
                          setWorkCenterFilter(prev => [...new Set([...prev, ...visibleOptions])]);
                        }
                      }}
                    >
                      <span className="phase-name">All Work Centers</span>
                      <span className="phase-description">Show all work centers</span>
                    </div>
                    {machineData.workCenters
                      .filter(center => center.toLowerCase().includes(workCenterSearch.toLowerCase()))
                      .map(center => (
                        <div 
                          key={center} 
                          className={`dropdown-option ${workCenterFilter.includes(center) ? 'selected' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (workCenterFilter.includes(center)) {
                              setWorkCenterFilter(prev => prev.filter(wc => wc !== center));
                            } else {
                              setWorkCenterFilter(prev => [...prev.filter(wc => wc !== ''), center]);
                            }
                          }}
                        >
                          <span className="phase-name">{center}</span>
                          <span className="phase-description">Work center</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Department Filter */}
              <div className="searchable-dropdown" style={{ width: '200px' }}>
              <label htmlFor="department_filter">Department:</label>
                <input 
                  type="text" 
                id="department_filter"
                  value={departmentSearch} 
                  onChange={(e) => setDepartmentSearch(e.target.value)} 
                  onFocus={() => setDepartmentFilterOpen(true)} 
                  placeholder="Search Departments" 
                />
                {departmentFilterOpen && machineData.departments.length > 0 && (
                  <div className="dropdown-options">
                    <div 
                      className={`dropdown-option ${(() => {
                        const visibleOptions = machineData.departments.filter(dept => 
                          dept.toLowerCase().includes(departmentSearch.toLowerCase())
                        );
                        return visibleOptions.every(option => departmentFilter.includes(option)) && departmentFilter.length > 0;
                      })() ? 'selected' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const visibleOptions = machineData.departments.filter(dept => 
                          dept.toLowerCase().includes(departmentSearch.toLowerCase())
                        );
                        const allVisibleSelected = visibleOptions.every(option => departmentFilter.includes(option));
                        
                        if (allVisibleSelected) {
                          // Remove all visible options
                          setDepartmentFilter(prev => prev.filter(option => !visibleOptions.includes(option)));
                        } else {
                          // Add all visible options
                          setDepartmentFilter(prev => [...new Set([...prev, ...visibleOptions])]);
                        }
                      }}
                    >
                      <span className="phase-name">All Departments</span>
                      <span className="phase-description">Show all departments</span>
                    </div>
                    {machineData.departments
                      .filter(dept => dept.toLowerCase().includes(departmentSearch.toLowerCase()))
                      .map(dept => (
                        <div 
                          key={dept} 
                          className={`dropdown-option ${departmentFilter.includes(dept) ? 'selected' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (departmentFilter.includes(dept)) {
                              setDepartmentFilter(prev => prev.filter(d => d !== dept));
                            } else {
                              setDepartmentFilter(prev => [...prev.filter(d => d !== ''), dept]);
                            }
                          }}
                        >
                          <span className="phase-name">{dept}</span>
                          <span className="phase-description">Department</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Machine Type Filter */}
              <div className="searchable-dropdown" style={{ width: '200px' }}>
                <label htmlFor="machine_type_filter">Machine Type:</label>
                <input 
                  type="text" 
                  id="machine_type_filter"
                  value={machineTypeSearch} 
                  onChange={(e) => setMachineTypeSearch(e.target.value)} 
                  onFocus={() => setMachineTypeFilterOpen(true)} 
                  placeholder="Search Machine Types" 
                />
                {machineTypeFilterOpen && machineData.machineTypes.length > 0 && (
                  <div className="dropdown-options">
                    <div 
                      className={`dropdown-option ${(() => {
                        const visibleOptions = machineData.machineTypes.filter(type => 
                          type.toLowerCase().includes(machineTypeSearch.toLowerCase())
                        );
                        return visibleOptions.every(option => machineTypeFilter.includes(option)) && machineTypeFilter.length > 0;
                      })() ? 'selected' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const visibleOptions = machineData.machineTypes.filter(type => 
                          type.toLowerCase().includes(machineTypeSearch.toLowerCase())
                        );
                        const allVisibleSelected = visibleOptions.every(option => machineTypeFilter.includes(option));
                        
                        if (allVisibleSelected) {
                          // Remove all visible options
                          setMachineTypeFilter(prev => prev.filter(option => !visibleOptions.includes(option)));
                        } else {
                          // Add all visible options
                          setMachineTypeFilter(prev => [...new Set([...prev, ...visibleOptions])]);
                        }
                      }}
                    >
                      <span className="phase-name">All Machine Types</span>
                      <span className="phase-description">Show all machine types</span>
                    </div>
                    {machineData.machineTypes
                      .filter(type => type.toLowerCase().includes(machineTypeSearch.toLowerCase()))
                      .map(type => (
                        <div 
                          key={type} 
                          className={`dropdown-option ${machineTypeFilter.includes(type) ? 'selected' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (machineTypeFilter.includes(type)) {
                              setMachineTypeFilter(prev => prev.filter(t => t !== type));
                            } else {
                              setMachineTypeFilter(prev => [...prev.filter(t => t !== ''), type]);
                            }
                          }}
                        >
                          <span className="phase-name">{type}</span>
                          <span className="phase-description">Machine type</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Machine Name Filter */}
              <div className="searchable-dropdown" style={{ width: '200px' }}>
                <label htmlFor="machine_name_filter">Machine Name:</label>
                <input 
                  type="text" 
                  id="machine_name_filter"
                  value={machineNameSearch} 
                  onChange={(e) => setMachineNameSearch(e.target.value)} 
                  onFocus={() => setMachineNameFilterOpen(true)} 
                  placeholder="Search Machine Names" 
                />
                {machineNameFilterOpen && machineData.machineNames.length > 0 && (
                  <div className="dropdown-options">
                    <div 
                      className={`dropdown-option ${(() => {
                        const visibleOptions = machineData.machineNames.filter(name => 
                          name.toLowerCase().includes(machineNameSearch.toLowerCase())
                        );
                        return visibleOptions.every(option => machineNameFilter.includes(option)) && machineNameFilter.length > 0;
                      })() ? 'selected' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const visibleOptions = machineData.machineNames.filter(name => 
                          name.toLowerCase().includes(machineNameSearch.toLowerCase())
                        );
                        const allVisibleSelected = visibleOptions.every(option => machineNameFilter.includes(option));
                        
                        if (allVisibleSelected) {
                          // Remove all visible options
                          setMachineNameFilter(prev => prev.filter(option => !visibleOptions.includes(option)));
                        } else {
                          // Add all visible options
                          setMachineNameFilter(prev => [...new Set([...prev, ...visibleOptions])]);
                        }
                      }}
                    >
                      <span className="phase-name">All Machine Names</span>
                      <span className="phase-description">Show all machine names</span>
                    </div>
                    {machineData.machineNames
                      .filter(name => name.toLowerCase().includes(machineNameSearch.toLowerCase()))
                      .map(name => (
                        <div 
                          key={name} 
                          className={`dropdown-option ${machineNameFilter.includes(name) ? 'selected' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (machineNameFilter.includes(name)) {
                              setMachineNameFilter(prev => prev.filter(n => n !== name));
                            } else {
                              setMachineNameFilter(prev => [...prev.filter(n => n !== ''), name]);
                            }
                          }}
                        >
                          <span className="phase-name">{name}</span>
                          <span className="phase-description">Machine name</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

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

            {/* PDF Print Button */}
            <button
              className="btn btn-primary"
              onClick={() => {
                // Get the actual Gantt chart data from the store
                const { odpOrders: tasks } = useStore.getState();
                const scheduledTasks = tasks.filter(task => task.status === 'SCHEDULED');
                
                // Use the filtered machines that are currently visible on screen
                const machinesToPrint = filteredMachines;
                
                // Create a new window for printing
                const printWindow = window.open('', '_blank', 'width=1200,height=800');
                if (!printWindow) return;
                
                // Generate the complete 24-hour time header
                const timeHeader = Array.from({ length: 24 }, (_, hour) => 
                  `<div class="hour-header" style="grid-column: ${hour * 4 + 2} / span 4">${hour.toString().padStart(2, '0')}</div>`
                ).join('');
                
                // Generate machine rows with scheduled tasks
                const machineRows = machinesToPrint.map(machine => {
                  const machineTasks = scheduledTasks.filter(task => task.machine === machine.id);
                  
                  // Generate time slots for this machine
                  const timeSlots = Array.from({ length: 96 }, (_, slotIndex) => {
                    const hour = Math.floor(slotIndex / 4);
                    const minute = (slotIndex % 4) * 15;
                    
                    // Check if this slot has a scheduled task
                    const taskInSlot = machineTasks.find(task => {
                      const startTime = new Date(task.scheduled_start_time);
                      const taskHour = startTime.getHours();
                      const taskMinute = startTime.getMinutes();
                      const slotHour = hour;
                      const slotMinute = minute;
                      
                      return taskHour === slotHour && taskMinute === slotMinute;
                    });
                    
                    if (taskInSlot) {
                      const duration = taskInSlot.time_remaining || taskInSlot.duration || 1;
                      const slotsToSpan = Math.min(duration * 4, 96 - slotIndex);
                      return `<div class="time-slot scheduled" style="grid-column: ${slotIndex + 2}; grid-column-span: ${slotsToSpan}">
                        <div class="scheduled-event">${taskInSlot.odp_number}</div>
                      </div>`;
                    }
                    
                    return `<div class="time-slot" style="grid-column: ${slotIndex + 2}"></div>`;
                  }).join('');
                  
                  return `
                    <div class="machine-row">
                      <div class="machine-label">${machine.machine_name}</div>
                      ${timeSlots}
                    </div>
                  `;
                }).join('');
                
                // Create the print content with actual Gantt chart data
                const printContent = `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Gantt Chart - Print</title>
                      <style>
                        body { 
                          margin: 0; 
                          padding: 20px; 
                          font-family: Arial, sans-serif; 
                          font-size: 12px;
                        }
                        .gantt-container {
                          width: 100%;
                          overflow: visible;
                        }
                        .calendar-grid {
                          display: grid;
                          grid-template-columns: 150px repeat(96, 20px);
                          border: 1px solid #ccc;
                          width: fit-content;
                        }
                        .calendar-header-row {
                          display: contents;
                        }
                        .machine-label-header, .time-header {
                          background: #f5f5f5;
                          padding: 8px 4px;
                          text-align: center;
                          border-bottom: 1px solid #ccc;
                          font-weight: bold;
                        }
                        .time-header {
                          display: contents;
                        }
                        .hour-header {
                          grid-column: span 4;
                          text-align: center;
                          border-right: 1px solid #ccc;
                        }
                        .calendar-body {
                          display: contents;
                        }
                        .machine-row {
                          display: contents;
                          page-break-inside: avoid;
                        }
                        .machine-label {
                          padding: 8px 4px;
                          border-right: 1px solid #ccc;
                          border-bottom: 1px solid #ccc;
                          background: #f9f9f9;
                          min-height: 40px;
                          display: flex;
                          align-items: center;
                        }
                        .time-slot {
                          border-right: 1px solid #eee;
                          border-bottom: 1px solid #eee;
                          min-height: 40px;
                          position: relative;
                        }
                        .scheduled-event {
                          position: absolute;
                          background: #007bff;
                          color: white;
                          padding: 2px 4px;
                          border-radius: 2px;
                          font-size: 10px;
                          overflow: hidden;
                          white-space: nowrap;
                          z-index: 1;
                          width: 100%;
                          text-align: center;
                        }
                        @media print {
                          body { margin: 0; }
                          .gantt-container { width: 100%; }
                        }
                      </style>
                    </head>
                    <body>
                      <div class="gantt-container">
                        <div class="calendar-grid">
                          <div class="calendar-header-row">
                            <div class="machine-label-header">Machines</div>
                            <div class="time-header">
                              ${timeHeader}
                            </div>
                          </div>
                          <div class="calendar-body">
                            ${machineRows}
                          </div>
                        </div>
                      </div>
                      <script>
                        // Force the chart to expand to full size
                        const container = document.querySelector('.gantt-container');
                        const grid = container.querySelector('.calendar-grid');
                        if (grid) {
                          grid.style.width = 'fit-content';
                          grid.style.overflow = 'visible';
                        }
                        
                        // Wait for content to render, then print
                        setTimeout(() => {
                          window.print();
                          window.close();
                        }, 500);
                      </script>
                    </body>
                  </html>
                `;
                
                printWindow.document.write(printContent);
                printWindow.document.close();
              }}
              title="Print current Gantt chart as PDF"
            >
              Print PDF
            </button>
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