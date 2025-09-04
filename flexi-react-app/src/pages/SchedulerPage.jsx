import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy, useReducer } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useOrderStore, useMachineStore, useUIStore, useSchedulerStore, useMainStore } from '../store';
import { format } from 'date-fns';

import { MACHINE_STATUSES, WORK_CENTERS } from '../constants';
import SearchableDropdown from '../components/SearchableDropdown';

import TaskLookupInput from '../components/TaskLookupInput';

// Lazy load heavy components to improve initial load time
const TaskPool = lazy(() => import('../components/TaskPool'));
const GanttChart = lazy(() => import('../components/GanttChart'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="loading">Caricamento componenti scheduler...</div>
);

// Utility function to download Gantt chart as HTML
const downloadGanttAsHTML = (ganttElementSelector, dateDisplay) => {
  // Find the actual Gantt chart element that's currently rendered on screen
  const ganttElement = document.querySelector(ganttElementSelector);
  
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
        <title>Grafico Gantt - ${dateDisplay}</title>
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
        <div style="text-align: center; margin-bottom: 20px; font-size: 12px; font-weight: bold;">
          Grafico Gantt - ${dateDisplay}
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
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
  link.download = `grafico-gantt-${dateStr}-${timeStr}.html`;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

function SchedulerPage() {
  // Select state and actions from Zustand store
  const { machines } = useMachineStore();
  const { odpOrders, getOdpOrdersByWorkCenter, getScheduledOrders } = useOrderStore();
  const { selectedWorkCenter, isLoading, isInitialized, showAlert, isEditMode, toggleEditMode, showConflictDialog } = useUIStore();
  const { scheduleTask, unscheduleTask, scheduleTaskFromSlot, rescheduleTaskToSlot, validateSlotAvailability } = useSchedulerStore();
  const { init, cleanup } = useMainStore();

  // Initialize with UTC today
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  });
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [taskLookup, setTaskLookup] = useState('');
  const [articleCodeLookup, setArticleCodeLookup] = useState('');
  const [customerNameLookup, setCustomerNameLookup] = useState('');

  // Filter state management with useReducer
  const initialFilterState = { 
    workCenter: [], 
    department: [], 
    machineType: [], 
    machineName: [] 
  };

  function filterReducer(state, action) {
    switch (action.type) {
      case 'SET_FILTER':
        // payload: { filterName: 'workCenter', value: [...] }
        return { ...state, [action.payload.filterName]: action.payload.value };
      case 'CLEAR_FILTERS':
        return initialFilterState;
      default:
        return state;
    }
  }

  const [filters, dispatch] = useReducer(filterReducer, initialFilterState);

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

  // Get ODP orders filtered by selected work center
  const filteredOdpOrders = useMemo(() => {
    if (!selectedWorkCenter) return [];
    const filtered = getOdpOrdersByWorkCenter(selectedWorkCenter);
    return filtered;
  }, [selectedWorkCenter, getOdpOrdersByWorkCenter]);

  // Get scheduled orders filtered by selected work center
  const scheduledOrders = useMemo(() => {
    const scheduled = filteredOdpOrders.filter(order => order.status === 'SCHEDULED');
    return scheduled;
  }, [filteredOdpOrders, selectedWorkCenter]);

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
    if (filters.workCenter.length > 0) {
      filtered = filtered.filter(machine => filters.workCenter.includes(machine.work_center));
    }
    
    // Filter by department (if selected)
    if (filters.department.length > 0) {
      filtered = filtered.filter(machine => filters.department.includes(machine.department));
    }

    // Filter by machine type (if selected)
    if (filters.machineType.length > 0) {
      filtered = filtered.filter(machine => filters.machineType.includes(machine.machine_type));
    }

    // Filter by machine name (if selected)
    if (filters.machineName.length > 0) {
      filtered = filtered.filter(machine => filters.machineName.includes(machine.machine_name));
    }

    return filtered;
  }, [machineData, filters]);

  // Memoize navigation functions to prevent unnecessary re-renders
  const navigateDate = useCallback((direction) => {
    setCurrentDate(prevDate => {
      if (direction === 'today') {
        // Use UTC today
        const now = new Date();
        const utcYear = now.getUTCFullYear();
        const utcMonth = now.getUTCMonth();
        const utcDay = now.getUTCDate();
        return new Date(Date.UTC(utcYear, utcMonth, utcDay));
      } else if (direction === 'prev') {
        // Navigate to previous UTC day
        const newPrevDate = new Date(prevDate);
        newPrevDate.setUTCDate(newPrevDate.getUTCDate() - 1);
        return newPrevDate;
      } else if (direction === 'next') {
        // Navigate to next UTC day
        const newNextDate = new Date(prevDate);
        newNextDate.setUTCDate(newNextDate.getUTCDate() + 1);
        return newNextDate;
      }
      return prevDate;
    });
  }, []);

  const formatDateDisplay = useCallback(() => {
    // Use UTC today for comparison
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDay = now.getUTCDate();
    const utcToday = new Date(Date.UTC(utcYear, utcMonth, utcDay));
    
    // currentDate is already UTC, so compare directly
    const isToday = currentDate.getTime() === utcToday.getTime();
    
    if (isToday) {
      return 'Oggi';
    } else {
      // Format the UTC date for display
      return format(currentDate, 'yyyy-MM-dd');
    }
  }, [currentDate]);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
  }, []);

  // Generic lookup function that consolidates the three original lookup functions
  const handleLookup = useCallback((value, field, fieldLabel) => {
    if (!value.trim()) return;
    
    // Find the task in scheduled orders with exact match first, then partial match
    let task = scheduledOrders.find(t => t[field] === value.trim());
    
    // If no exact match, try partial match
    if (!task) {
      task = scheduledOrders.find(t => 
        t[field] && t[field].toLowerCase().includes(value.trim().toLowerCase())
      );
    }
    
    if (!task) {
      showAlert(`Lavoro non trovato per ${fieldLabel}: ${value}`, 'warning');
      return;
    }
    
    // Execute the lookup using the helper function
    executeLookupFromDropdown(task, field, fieldLabel, value);
  }, [scheduledOrders, machines, showAlert]);

  // Helper function to execute lookup from dropdown selection
  const executeLookupFromDropdown = useCallback((task, field, fieldLabel, searchValue) => {
    // Find the machine
    const machine = machines.find(m => m.id === task.scheduled_machine_id);
    if (!machine) {
      showAlert('Macchina non trovata per questo lavoro', 'error');
      return;
    }
    
    // Set machine filters to show only this machine
    dispatch({ type: 'SET_FILTER', payload: { filterName: 'machineName', value: [machine.machine_name] } });
    dispatch({ type: 'SET_FILTER', payload: { filterName: 'workCenter', value: [machine.work_center] } });
    dispatch({ type: 'SET_FILTER', payload: { filterName: 'department', value: [machine.department] } });
    dispatch({ type: 'SET_FILTER', payload: { filterName: 'machineType', value: [machine.machine_type] } });
    
    // Navigate to the start date of the task
    if (task.scheduled_start_time) {
      const taskDate = new Date(task.scheduled_start_time);
      const utcYear = taskDate.getUTCFullYear();
      const utcMonth = taskDate.getUTCMonth();
      const utcDay = taskDate.getUTCDate();
      setCurrentDate(new Date(Date.UTC(utcYear, utcMonth, utcDay)));
    }
    
    // Clear the appropriate search input based on field
    if (field === 'odp_number') {
      setTaskLookup('');
    } else if (field === 'article_code') {
    setArticleCodeLookup('');
    } else if (field === 'nome_cliente') {
      setCustomerNameLookup('');
    }
    
    // Show success message
    const fieldValue = task[field];
    showAlert(`Lavoro trovato per ${fieldLabel} "${fieldValue}" su ${machine.machine_name}`, 'success');
  }, [machines, showAlert, setTaskLookup, setArticleCodeLookup, setCustomerNameLookup, setCurrentDate]);

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
    
    if (over && over.data.current?.type === 'slot') {
      const { machine, hour, minute, isUnavailable, hasScheduledTask } = over.data.current;
      
      // Don't show indicator for unavailable or occupied slots
      if (isUnavailable || hasScheduledTask) {
        setDropTargetId(null);
        return;
      }
      
      // Create a unique ID for the drop target
      const targetId = `${machine.id}-${hour}-${minute}`;
      setDropTargetId(targetId);
    } else {
      setDropTargetId(null);
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
    setDropTargetId(null);
    
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

            // Note: Removed unavailable slot check - tasks can now be split across available slots
            // The scheduling logic will handle splitting automatically

            if (hasScheduledTask) {
              showAlert('Impossibile pianificare il lavoro su uno slot temporale occupato', 'error');
              return resolve();
            }

            // Use consolidated method from store
            const result = await scheduleTaskFromSlot(task.id, machine, currentDate, hour, minute);
            if (result?.error) {
              showAlert(result.error, 'error');
            } else if (result?.conflict) {
              // Show conflict resolution dialog
              showConflictDialog(result);
            }
          }

          // Case 2: Dragging an existing scheduled event to a new slot (rescheduling)
          else if (draggedItem.type === 'event' && dropZone.type === 'slot') {
            const eventItem = draggedItem.event;
            const { machine, hour, minute, isUnavailable, hasScheduledTask } = dropZone;

            // Note: Removed unavailable slot check - tasks can now be split across available slots
            // The rescheduling logic will handle splitting automatically

            if (hasScheduledTask) {
              showAlert('Impossibile riprogrammare il lavoro su uno slot temporale occupato', 'error');
              return resolve();
            }

            // Use consolidated method from store
            const result = await rescheduleTaskToSlot(eventItem.id, machine, currentDate, hour, minute);
            if (result?.error) {
              showAlert(result.error, 'error');
            } else if (result?.conflict) {
              // Show conflict resolution dialog
              showConflictDialog(result);
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
  }, [currentDate, scheduleTaskFromSlot, rescheduleTaskToSlot, unscheduleTask, showAlert, showConflictDialog]);

  // Show loading state during initial load
  if (isLoading) {
    return (
      <div className="p-2 bg-white rounded shadow-sm border">
        <div className="text-center py-4 text-gray-500 text-xs">Caricamento Scheduler Produzione...</div>
      </div>
    );
  }

  if (!selectedWorkCenter) {
    return (
      <div className="p-2 bg-white rounded shadow-sm border">
        <div className="text-center py-4 text-red-600 text-xs">Seleziona un centro di lavoro per visualizzare i dati dello scheduler.</div>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className={`content-section ${isEditMode ? 'edit-mode' : ''}`}>

        
        {/* Task Pool Section */}
        <div className="task-pool-section">
          <Suspense fallback={<LoadingFallback />}>
            <TaskPool />
          </Suspense>
        </div>

        {/* Task Lookup Section */}
        <div className="section-controls">
          <h2 className="section-title">Ricerca Lavoro</h2>
          <div className="task-lookup-grid">
            <div className="task-lookup-item">
              <div className="task-lookup-input-container">
                <TaskLookupInput
                  placeholder="Inserisci numero ODP per cercare..."
                  value={taskLookup}
                  onChange={(e) => setTaskLookup(e.target.value)}
                  onLookup={() => handleLookup(taskLookup, 'odp_number', 'ODP')}
                  suggestions={scheduledOrders}
                  field="odp_number"
                  fieldLabel="ODP"
                  onDropdownSelect={executeLookupFromDropdown}
                />
              </div>
              <button
                className="nav-btn"
                onClick={() => handleLookup(taskLookup, 'odp_number', 'ODP')}
              >
                Cerca ODP
              </button>
            </div>
            
            <div className="task-lookup-item">
              <div className="task-lookup-input-container">
                <TaskLookupInput
                  placeholder="Inserisci codice articolo per cercare..."
                  value={articleCodeLookup}
                  onChange={(e) => setArticleCodeLookup(e.target.value)}
                  onLookup={() => handleLookup(articleCodeLookup, 'article_code', 'codice articolo')}
                  suggestions={scheduledOrders}
                  field="article_code"
                  fieldLabel="Articolo"
                  onDropdownSelect={executeLookupFromDropdown}
                />
              </div>
              <button
                className="nav-btn"
                onClick={() => handleLookup(articleCodeLookup, 'article_code', 'codice articolo')}
              >
                Cerca Articolo
              </button>
            </div>
            
            <div className="task-lookup-item">
              <div className="task-lookup-input-container">
                <TaskLookupInput
                  placeholder="Inserisci nome cliente per cercare..."
                  value={customerNameLookup}
                  onChange={(e) => setCustomerNameLookup(e.target.value)}
                  onLookup={() => handleLookup(customerNameLookup, 'nome_cliente', 'cliente')}
                  suggestions={scheduledOrders}
                  field="nome_cliente"
                  fieldLabel="Cliente"
                  onDropdownSelect={executeLookupFromDropdown}
                />
              </div>
              <button
                className="nav-btn"
                onClick={() => handleLookup(customerNameLookup, 'nome_cliente', 'cliente')}
              >
                Cerca Cliente
              </button>
            </div>
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
                selectedOptions={filters.workCenter}
                onSelectionChange={(value) => dispatch({ type: 'SET_FILTER', payload: { filterName: 'workCenter', value } })}
                searchPlaceholder="Cerca Centri di Lavoro"
                id="work_center_filter"
              />
              
              <SearchableDropdown
                label="Reparto"
                options={machineData.departments}
                selectedOptions={filters.department}
                onSelectionChange={(value) => dispatch({ type: 'SET_FILTER', payload: { filterName: 'department', value } })}
                searchPlaceholder="Cerca Reparti"
                id="department_filter"
              />
              
              <SearchableDropdown
                label="Tipo Macchina"
                options={machineData.machineTypes}
                selectedOptions={filters.machineType}
                onSelectionChange={(value) => dispatch({ type: 'SET_FILTER', payload: { filterName: 'machineType', value } })}
                searchPlaceholder="Cerca Tipi di Macchina"
                id="machine_type_filter"
              />
              
              <SearchableDropdown
                label="Nome Macchina"
                options={machineData.machineNames}
                selectedOptions={filters.machineName}
                onSelectionChange={(value) => dispatch({ type: 'SET_FILTER', payload: { filterName: 'machineName', value } })}
                searchPlaceholder="Cerca Nomi Macchine"
                id="machine_name_filter"
              />
            </div>

            {/* Action Buttons */}
            <div className="actions-section">
              <button
                className={`nav-btn ${isEditMode ? 'danger' : 'primary'}`}
                onClick={toggleEditMode}
                title={isEditMode ? "Disabilita modalità modifica" : "Abilita modalità modifica"}
              >
                {isEditMode ? 'Disabilita Modalità Modifica' : 'Abilita Modalità Modifica'}
              </button>
              
              <button
                className="nav-btn secondary"
                onClick={clearFilters}
                title="Clear all filters"
              >
                Cancella Filtri
              </button>

              {/* Calendar Navigation */}
              <div className="calendar-navigation">
                <button
                  className="nav-btn secondary"
                  onClick={() => navigateDate('today')}
                >
                  Oggi
                </button>
                <button
                  className="nav-btn secondary"
                  onClick={() => navigateDate('prev')}
                >
                  &lt;
                </button>
                <span className="current-date">{formatDateDisplay()}</span>
                <button
                  className="nav-btn secondary"
                  onClick={() => navigateDate('next')}
                >
                  &gt;
                </button>
              </div>

              {/* PDF Download Button */}
              <button
                className="nav-btn secondary"
                onClick={() => downloadGanttAsHTML('.calendar-section .calendar-grid', formatDateDisplay())}
                title="Download exact Gantt chart as HTML file"
              >
                Scarica HTML
              </button>
            </div>
          </div>
        </div>

        {/* Gantt Chart Section */}
        <div className="calendar-section">
          <Suspense fallback={<LoadingFallback />}>
            <GanttChart machines={filteredMachines} currentDate={currentDate} dropTargetId={dropTargetId} />
          </Suspense>
        </div>
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
            <span className="task-time">
              {activeDragItem.time_remaining ? Number(activeDragItem.time_remaining).toFixed(1) : (activeDragItem.duration || 1).toFixed(1)}h
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default SchedulerPage;