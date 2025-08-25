import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useOrderStore, useMachineStore, useUIStore, useSchedulerStore, useMainStore } from '../store';

import { MACHINE_STATUSES, WORK_CENTERS } from '../constants';
import SearchableDropdown from '../components/SearchableDropdown';
import StickyHeader from '../components/StickyHeader';

// Lazy load heavy components to improve initial load time
const TaskPool = lazy(() => import('../components/TaskPool'));
const GanttChart = lazy(() => import('../components/GanttChart'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="loading">Caricamento componenti scheduler...</div>
);

function SchedulerPage() {
  // Select state and actions from Zustand store
  const { machines } = useMachineStore();
  const { odpOrders, getScheduledOrders } = useOrderStore();
  const { selectedWorkCenter, isLoading, isInitialized, showAlert } = useUIStore();
  const { scheduleTask, unscheduleTask, scheduleTaskFromSlot, rescheduleTaskToSlot, validateSlotAvailability } = useSchedulerStore();
  const { init, cleanup } = useMainStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [workCenterFilter, setWorkCenterFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [machineTypeFilter, setMachineTypeFilter] = useState([]);
  const [machineNameFilter, setMachineNameFilter] = useState([]);
  const [taskLookup, setTaskLookup] = useState('');

  // Initialize store on mount
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
    
    // Cleanup function for component unmount
    return () => {
      cleanup();
    };
  }, [init, isInitialized, cleanup]);

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

    const endTime = performance.now();
    // Performance logging removed for production

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
    return isToday ? 'Oggi' : currentDate.toLocaleDateString('it-IT', { month: 'long', day: 'numeric' });
  }, [currentDate]);

  const clearFilters = useCallback(() => {
    setWorkCenterFilter([]);
    setDepartmentFilter([]);
    setMachineTypeFilter([]);
    setMachineNameFilter([]);
  }, []);

  const handleTaskLookup = useCallback(() => {
    if (!taskLookup.trim()) return;
    
    // Find the task in scheduled orders
    const task = odpOrders.find(t => t.odp_number === taskLookup.trim() && t.status === 'SCHEDULED');
    if (!task) {
      showAlert('Lavoro non trovato o non programmato', 'warning');
      return;
    }
    
    // Find the machine
    const machine = machines.find(m => m.id === task.scheduled_machine_id);
    if (!machine) {
      showAlert('Macchina non trovata per questo lavoro', 'warning');
      return;
    }
    
    // Set machine filters to show only this machine
    setMachineNameFilter([machine.machine_name]);
    setWorkCenterFilter([machine.work_center]);
    setDepartmentFilter([machine.department]);
    setMachineTypeFilter([machine.machine_type]);
    
    // Navigate to the start date of the task
    if (task.scheduled_start_time) {
      setCurrentDate(new Date(task.scheduled_start_time));
    }
    
    setTaskLookup('');
    showAlert(`Lavoro trovato su ${machine.machine_name}`, 'success');
  }, [taskLookup, odpOrders, machines, showAlert]);

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
  }, []);

  const handleDragOver = useCallback((event) => {
    const { over } = event;
    
    // Remove any existing drop indicators
    const existingIndicators = document.querySelectorAll('.drop-indicator');
    existingIndicators.forEach(indicator => indicator.remove());
    
    if (over && over.data.current?.type === 'slot') {
      const { machine, hour, minute, isUnavailable, hasScheduledTask } = over.data.current;
      
      // Don't show indicator for unavailable or occupied slots
      if (isUnavailable || hasScheduledTask) return;
      
      // Find the time slot element
      const slotElement = document.querySelector(`[data-hour="${hour}"][data-minute="${minute}"][data-machine-id="${machine.id}"]`);
      if (slotElement) {
        // Create drop indicator
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        indicator.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 3px dashed #007bff;
          background: rgba(0, 123, 255, 0.1);
          pointer-events: none;
          z-index: 1000;
          border-radius: 4px;
        `;
        
        // Position the indicator
        slotElement.style.position = 'relative';
        slotElement.appendChild(indicator);
      }
    }
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    const dragEndStartTime = performance.now();

    // Clear any pending drag operations
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    // Prevent multiple rapid drag operations
    if (isDragOperationRef.current) {
      return;
    }

    setActiveDragItem(null);
    
    // Clean up any drop indicators
    const existingIndicators = document.querySelectorAll('.drop-indicator');
    existingIndicators.forEach(indicator => indicator.remove());
    
    const { over, active } = event;

    if (!over) {
      return;
    }

    const draggedItem = active.data.current;
    const dropZone = over.data.current;

    // Quick validation before async operation
    if (!draggedItem || !dropZone) {
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
              showAlert('Impossibile pianificare il lavoro su uno slot temporale non disponibile', 'error');
              return resolve();
            }

            if (hasScheduledTask) {
              showAlert('Impossibile pianificare il lavoro su uno slot temporale occupato', 'error');
              return resolve();
            }

            // Use consolidated method from store
            const result = await scheduleTaskFromSlot(task.id, machine, currentDate, hour, minute);
            if (result?.error) {
              showAlert(result.error, 'error');
            }
          }

          // Case 2: Dragging an existing scheduled event to a new slot (rescheduling)
          else if (draggedItem.type === 'event' && dropZone.type === 'slot') {
            const eventItem = draggedItem.event;
            const { machine, hour, minute, isUnavailable, hasScheduledTask } = dropZone;

            // Immediate constraint checks
            if (isUnavailable) {
              showAlert('Impossibile riprogrammare il lavoro su uno slot temporale non disponibile', 'error');
              return resolve();
            }

            if (hasScheduledTask) {
              showAlert('Impossibile riprogrammare il lavoro su uno slot temporale occupato', 'error');
              return resolve();
            }

            // Use consolidated method from store
            const result = await rescheduleTaskToSlot(eventItem.id, machine, currentDate, hour, minute);
            if (result?.error) {
              showAlert(result.error, 'error');
            }
          }

          // Case 3: Dragging an event back to the task pool (unscheduling)
          else if (draggedItem.type === 'event' && dropZone.type === 'pool') {
            const eventToUnschedule = draggedItem.event;
            unscheduleTask(eventToUnschedule.id);
          }

          resolve();
        });
      });
    } catch (error) {
      showAlert('Si è verificato un errore durante l\'operazione di trascinamento', 'error');
    } finally {
      isDragOperationRef.current = false;
    }
  }, [currentDate, scheduleTaskFromSlot, rescheduleTaskToSlot, unscheduleTask, showAlert]);

  // Show loading state during initial load
  if (isLoading) {
    return (
      <div className="content-section">
        <div className="loading">Caricamento Scheduler Produzione...</div>
      </div>
    );
  }

  if (!selectedWorkCenter) {
    return (
      <div className="content-section">
        <div className="error">Seleziona un centro di lavoro per visualizzare i dati dello scheduler.</div>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="content-section">
        <StickyHeader title="Scheduler Produzione" />
        
        <Suspense fallback={<LoadingFallback />}>
          <TaskPool />
        </Suspense>

        {/* Task Lookup Section */}
        <div className="section-controls">
          <h2 className="section-title">Ricerca Lavoro</h2>
          <div className="task-lookup">
            <div className="task-lookup-input-container">
              <input
                type="text"
                placeholder="Inserisci numero ODP per cercare..."
                value={taskLookup}
                onChange={(e) => setTaskLookup(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTaskLookup()}
                className="task-lookup-input"
              />
              {taskLookup && (
                <div className="task-lookup-dropdown">
                  {odpOrders
                    .filter(order => 
                      order.status === 'SCHEDULED' && 
                      order.odp_number.toLowerCase().includes(taskLookup.toLowerCase())
                    )
                    .slice(0, 5)
                    .map(order => (
                      <div 
                        key={order.id} 
                        className="task-lookup-option"
                        onClick={() => {
                          setTaskLookup(order.odp_number);
                          handleTaskLookup();
                        }}
                      >
                        <span className="task-lookup-odp">{order.odp_number}</span>
                        <span className="task-lookup-product">{order.product_name || 'Prodotto non specificato'}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <button onClick={handleTaskLookup} className="nav-btn today">
              Cerca
            </button>
          </div>
        </div>

        {/* Production Schedule Controls Section */}
        <div className="section-controls">
          <h2 className="section-title">Programma Produzione</h2>
          <div className="controls-grid">
            {/* Machine Filters */}
            <div className="filters-section">
              <SearchableDropdown
                label="Centro di Lavoro"
                options={machineData.workCenters}
                selectedOptions={workCenterFilter}
                onSelectionChange={setWorkCenterFilter}
                searchPlaceholder="Cerca Centri di Lavoro"
                id="work_center_filter"
              />
              
              <SearchableDropdown
                label="Reparto"
                options={machineData.departments}
                selectedOptions={departmentFilter}
                onSelectionChange={setDepartmentFilter}
                searchPlaceholder="Cerca Reparti"
                id="department_filter"
              />
              
              <SearchableDropdown
                label="Tipo Macchina"
                options={machineData.machineTypes}
                selectedOptions={machineTypeFilter}
                onSelectionChange={setMachineTypeFilter}
                searchPlaceholder="Cerca Tipi di Macchina"
                id="machine_type_filter"
              />
              
              <SearchableDropdown
                label="Nome Macchina"
                options={machineData.machineNames}
                selectedOptions={machineNameFilter}
                onSelectionChange={setMachineNameFilter}
                searchPlaceholder="Cerca Nomi Macchine"
                id="machine_name_filter"
              />
            </div>

            {/* Action Buttons */}
            <div className="actions-section">
              <button
                className="nav-btn today"
                onClick={clearFilters}
                title="Clear all filters"
              >
                Cancella Filtri
              </button>

              {/* Calendar Navigation */}
              <div className="calendar-navigation">
                <button
                  className="nav-btn today"
                  onClick={() => navigateDate('today')}
                >
                  Oggi
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

              {/* PDF Download Button */}
              <button
                className="nav-btn today"
                onClick={() => {
                  // Find the actual Gantt chart element that's currently rendered on screen
                  const ganttElement = document.querySelector('.calendar-section .calendar-grid');
                  
                  if (!ganttElement) {
                    alert('Grafico Gantt non trovato. Assicurati che il grafico sia visibile sullo schermo.');
                    return;
                  }
                  
                  // Get all the CSS styles from the current page
                  const styleSheets = Array.from(document.styleSheets);
                  let allStyles = '';
                  
                  styleSheets.forEach(styleSheet => {
                    try {
                      const rules = Array.from(styleSheet.cssRules || styleSheet.rules || []);
                      rules.forEach(rule => {
                        allStyles += rule.cssText + '\n';
                      });
                    } catch (e) {
                      // Handle stylesheet access error silently
                    }
                  });
                  
                  // Clone the Gantt chart element with all its content
                  const clonedElement = ganttElement.cloneNode(true);
                  
                  // Create the HTML content with the exact Gantt chart that's on screen
                  const htmlContent = `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Grafico Gantt - ${formatDateDisplay()}</title>
                        <style>
                          ${allStyles}
                          body { 
                            margin: 0; 
                            padding: 20px; 
                            font-family: Arial, sans-serif;
                          }
                          .calendar-section {
                            width: 100%;
                            overflow-x: auto;
                          }
                        </style>
                      </head>
                      <body>
                        <div style="text-align: center; margin-bottom: 20px; font-size: 16px; font-weight: bold;">
                          Grafico Gantt - ${formatDateDisplay()}
                        </div>
                        <div class="calendar-section">
                          ${clonedElement.outerHTML}
                        </div>
                      </body>
                    </html>
                  `;
                  
                  // Create a blob from the HTML content
                  const blob = new Blob([htmlContent], { type: 'text/html' });
                  
                  // Create a download link
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  
                  // Generate filename with current date
                  const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                  const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
                  link.download = `grafico-gantt-${dateStr}-${timeStr}.html`;
                  
                  // Trigger download
                  document.body.appendChild(link);
                  link.click();
                  
                  // Cleanup
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                }}
                title="Download exact Gantt chart as HTML file"
              >
                Scarica HTML
              </button>
            </div>
          </div>
        </div>

        <Suspense fallback={<LoadingFallback />}>
          <GanttChart machines={filteredMachines} currentDate={currentDate} />
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