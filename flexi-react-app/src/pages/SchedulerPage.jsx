import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy, useReducer } from 'react';
import { DndContext, DragOverlay, PointerSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useOrderStore, useMachineStore, useUIStore, useSchedulerStore, useMainStore } from '../store';
import { useOrders, useMachines } from '../hooks';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';

import { MACHINE_STATUSES, WORK_CENTERS } from '../constants';
import { showError } from '../utils';
import SearchableDropdown from '../components/SearchableDropdown';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';

import TaskLookupInput from '../components/TaskLookupInput';

// Lazy load heavy components to improve initial load time
const TaskPoolDataTable = lazy(() => import('../components/TaskPoolDataTable'));
const GanttChart = lazy(() => import('../components/GanttChart'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="loading">Caricamento componenti scheduler...</div>
);

// Scheduling operation loading overlay
const SchedulingLoadingOverlay = ({ schedulingLoading }) => {
  if (!schedulingLoading.isScheduling && !schedulingLoading.isRescheduling && !schedulingLoading.isShunting && !schedulingLoading.isNavigating) {
    return null;
  }

  const getOperationText = () => {
    if (schedulingLoading.isScheduling) return 'Programmazione lavoro...';
    if (schedulingLoading.isRescheduling) return 'Riprogrammazione lavoro...';
    if (schedulingLoading.isShunting) return 'Risoluzione conflitti...';
    if (schedulingLoading.isNavigating) return 'Navigazione...';
    return 'Operazione in corso...';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-lg flex items-center space-x-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="text-gray-700 font-medium">{getOperationText()}</span>
      </div>
    </div>
  );
};

// Utility function to download Gantt chart as HTML
const downloadGanttAsHTML = (ganttElementSelector, dateDisplay) => {
  // Find the actual Gantt chart element that's currently rendered on screen
  const ganttElement = document.querySelector(ganttElementSelector);
  
  if (!ganttElement) {
    showError('Grafico Gantt non trovato. Assicurati che il grafico sia visibile sullo schermo.');
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
  
  // Generate filename with current date - use UTC consistently
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const timeStr = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS format
  link.download = `grafico-gantt-${dateStr}-${timeStr}.html`;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

function SchedulerPage() {
  // Use React Query for data fetching
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useOrders();
  const { data: machines = [], isLoading: machinesLoading, error: machinesError } = useMachines();
  
  // Use Zustand store for selectors and client state
  const { getOdpOrdersByWorkCenter, getScheduledOrders } = useOrderStore();
  const { selectedWorkCenter, isLoading, isInitialized, showAlert, isEditMode, toggleEditMode, showConflictDialog, schedulingLoading, setDragPreview, clearDragPreview, dragPreview } = useUIStore();
  const { scheduleTask, unscheduleTask, scheduleTaskFromSlot, rescheduleTaskToSlot, validateSlotAvailability } = useSchedulerStore();
  const { init, cleanup } = useMainStore();
  const queryClient = useQueryClient();

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 0, // No distance required - immediate activation
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 0, // No distance required - immediate activation
      },
    })
  );

  // Initialize with pure UTC today - no timezone conversion
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  });
  const [activeDragItem, setActiveDragItem] = useState(null);
  
  
  // Combined loading state
  const isDataLoading = ordersLoading || machinesLoading || isLoading;
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
    if (selectedWorkCenter === 'BOTH') return orders;
    return orders.filter(order => order.work_center === selectedWorkCenter);
  }, [selectedWorkCenter, orders]);

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
  const navigateDate = useCallback(async (direction, view = 'Daily') => {
    const { startSchedulingOperation, stopSchedulingOperation } = useUIStore.getState();
    
    try {
      startSchedulingOperation('navigate');
      
      // Calculate the new date first
      let newDate;
      setCurrentDate(prevDate => {
        if (direction === 'today') {
          // Use pure UTC today - no timezone conversion
          const now = new Date();
          const utcYear = now.getUTCFullYear();
          const utcMonth = now.getUTCMonth();
          const utcDay = now.getUTCDate();
          newDate = new Date(Date.UTC(utcYear, utcMonth, utcDay));
          return newDate;
        } else if (direction === 'prev') {
          if (view === 'Weekly') {
            // Navigate to previous week (previous Monday)
            newDate = startOfWeek(subWeeks(prevDate, 1), { weekStartsOn: 1 }); // 1 = Monday
            return newDate;
          } else {
            // Navigate to previous UTC day - pure UTC
            const newPrevDate = new Date(prevDate);
            newPrevDate.setUTCDate(newPrevDate.getUTCDate() - 1);
            newDate = newPrevDate;
            return newDate;
          }
        } else if (direction === 'next') {
          if (view === 'Weekly') {
            // Navigate to next week (next Monday)
            newDate = startOfWeek(addWeeks(prevDate, 1), { weekStartsOn: 1 }); // 1 = Monday
            return newDate;
          } else {
            // Navigate to next UTC day - pure UTC
            const newNextDate = new Date(prevDate);
            newNextDate.setUTCDate(newNextDate.getUTCDate() + 1);
            newDate = newNextDate;
            return newNextDate;
          }
        }
        newDate = prevDate;
        return prevDate;
      });
      
      // React Query will automatically fetch machine availability data when the date changes
      // No need for manual loading or artificial delays
      
    } finally {
      stopSchedulingOperation();
    }
  }, []);

  const formatDateDisplay = useCallback(() => {
    // Use pure UTC today for comparison - no timezone conversion
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDay = now.getUTCDate();
    const utcToday = new Date(Date.UTC(utcYear, utcMonth, utcDay));
    
    // currentDate is already pure UTC, so compare directly
    const isToday = currentDate.getTime() === utcToday.getTime();
    
    if (isToday) {
      return 'Oggi';
    } else {
      // Format the pure UTC date for display
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
    
    // Navigate to the start date of the task - use pure UTC
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
    const draggedItem = event.active.data.current;

    if (draggedItem && draggedItem.type === 'task') {
      setActiveDragItem(draggedItem.task);
    } else if (draggedItem && draggedItem.type === 'event') {
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
        clearDragPreview();
        return;
      }
      
      // Create a unique ID for the drop target
      const targetId = `${machine.id}-${hour}-${minute}`;
      setDropTargetId(targetId);
      
      // Calculate drag preview if we have an active drag item
      if (activeDragItem) {
        const durationHours = activeDragItem.time_remaining || activeDragItem.duration || 1;
        const durationSlots = Math.ceil(durationHours * 4); // Convert hours to 15-minute slots
        const startSlot = (hour - 6) * 4 + Math.floor(minute / 15); // Convert to slot index (0-based from 6 AM)
        
        setDragPreview({
          isActive: true,
          startSlot,
          durationSlots,
          machineId: machine.id
        });
      }
    } else if (over && over.data.current?.type === 'next-day') {
      // Set drop target for next day zone
      setDropTargetId('next-day-drop-zone');
      clearDragPreview();
    } else if (over && over.data.current?.type === 'previous-day') {
      // Set drop target for previous day zone
      setDropTargetId('previous-day-drop-zone');
      clearDragPreview();
    } else {
      setDropTargetId(null);
      clearDragPreview();
    }
  }, [activeDragItem, setDragPreview, clearDragPreview]);

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
    clearDragPreview();
    
    const { over, active } = event;

    if (!over) {
      return;
    }

    const draggedItem = active.data.current;
    const dropZone = over.data.current;

    // Drag end processing

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
            const result = await scheduleTaskFromSlot(task.id, machine, currentDate, hour, minute, null, queryClient);
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
            const result = await rescheduleTaskToSlot(eventItem.id, machine, currentDate, hour, minute, queryClient);
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
            unscheduleTask(eventToUnschedule.id, queryClient);
          }

          // Case 4: Dragging a task or event to the next day zone
          else if ((draggedItem.type === 'task' || draggedItem.type === 'event') && dropZone.type === 'next-day') {
            // Navigation is handled by the NextDayDropZone component with timer
            // This case is now handled automatically by the drag over effect
            showAlert('Navigazione al giorno successivo completata', 'success');
          }

          // Case 5: Dragging a task or event to the previous day zone
          else if ((draggedItem.type === 'task' || draggedItem.type === 'event') && dropZone.type === 'previous-day') {
            // Navigation is handled by the PreviousDayDropZone component with timer
            // This case is now handled automatically by the drag over effect
            showAlert('Navigazione al giorno precedente completata', 'success');
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
  if (isDataLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-lg flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-700 font-medium">Caricamento Scheduler Produzione...</span>
        </div>
      </div>
    );
  }

  // Show error state if data fetching failed
  if (ordersError || machinesError) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-lg text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Errore nel caricamento dei dati</h3>
          <p className="text-gray-600 mb-4">
            {ordersError?.message || machinesError?.message || 'Errore sconosciuto'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (!selectedWorkCenter) {
    return (
      <div className="p-1 bg-white rounded shadow-sm border">
        <div className="text-center py-1 text-red-600 text-[10px]">Seleziona un centro di lavoro per visualizzare i dati dello scheduler.</div>
      </div>
    );
  }

  return (
    <>
      <SchedulingLoadingOverlay schedulingLoading={schedulingLoading} />
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className={`content-section ${isEditMode ? 'edit-mode' : ''}`}>

        
        {/* Task Pool Section */}
        <div className="task-pool-section">
          <div className="task-pool-header">
            <h2 className="text-[10px] font-semibold text-gray-900">Pool Lavori</h2>
            <Button
              variant={isEditMode ? 'destructive' : 'default'}
              size="sm"
              onClick={toggleEditMode}
              title={isEditMode ? "Disabilita modalità modifica" : "Abilita modalità modifica"}
            >
              {isEditMode ? 'Disabilita Modalità Modifica' : 'Abilita Modalità Modifica'}
            </Button>
          </div>
          <Suspense fallback={<LoadingFallback />}>
            <TaskPoolDataTable />
          </Suspense>
        </div>

        {/* Filters Section */}
        <div className="section-controls">
          <div className="task-pool-header">
            <h2 className="text-[10px] font-semibold text-gray-900">Filtri</h2>
          </div>
          <div className="filters-grid">
            {/* Action Buttons - Moved to far left */}
            <div className="filters-actions-left">
              <Button
                variant="secondary"
                size="sm"
                onClick={clearFilters}
                title="Clear all filters"
              >
                Cancella Filtri
              </Button>
            </div>

            {/* Task Lookup Filters */}
            <SearchableDropdown
              label="ODP"
              options={scheduledOrders.map(order => order.odp_number).filter(Boolean)}
              selectedOptions={taskLookup ? [taskLookup] : []}
              onSelectionChange={(value) => {
                if (value.length > 0) {
                  setTaskLookup(value[0]);
                  handleLookup(value[0], 'odp_number', 'ODP');
                } else {
                  setTaskLookup('');
                }
              }}
              searchPlaceholder="Cerca ODP..."
              id="odp_filter"
              width="150px"
            />
            
            <SearchableDropdown
              label="Codice Articolo"
              options={scheduledOrders.map(order => order.article_code).filter(Boolean)}
              selectedOptions={articleCodeLookup ? [articleCodeLookup] : []}
              onSelectionChange={(value) => {
                if (value.length > 0) {
                  setArticleCodeLookup(value[0]);
                  handleLookup(value[0], 'article_code', 'codice articolo');
                } else {
                  setArticleCodeLookup('');
                }
              }}
              searchPlaceholder="Cerca Articolo..."
              id="article_filter"
              width="150px"
            />
            
            <SearchableDropdown
              label="Nome Cliente"
              options={scheduledOrders.map(order => order.nome_cliente).filter(Boolean)}
              selectedOptions={customerNameLookup ? [customerNameLookup] : []}
              onSelectionChange={(value) => {
                if (value.length > 0) {
                  setCustomerNameLookup(value[0]);
                  handleLookup(value[0], 'nome_cliente', 'cliente');
                } else {
                  setCustomerNameLookup('');
                }
              }}
              searchPlaceholder="Cerca Cliente..."
              id="customer_filter"
              width="150px"
            />

            {/* Machine Filters */}
            <SearchableDropdown
              label="Centro di Lavoro"
              options={machineData.workCenters}
              selectedOptions={filters.workCenter}
              onSelectionChange={(value) => dispatch({ type: 'SET_FILTER', payload: { filterName: 'workCenter', value } })}
              searchPlaceholder="Cerca Centri di Lavoro"
              id="work_center_filter"
              width="150px"
            />
            
            <SearchableDropdown
              label="Reparto"
              options={machineData.departments}
              selectedOptions={filters.department}
              onSelectionChange={(value) => dispatch({ type: 'SET_FILTER', payload: { filterName: 'department', value } })}
              searchPlaceholder="Cerca Reparti"
              id="department_filter"
              width="150px"
            />
            
            <SearchableDropdown
              label="Tipo Macchina"
              options={machineData.machineTypes}
              selectedOptions={filters.machineType}
              onSelectionChange={(value) => dispatch({ type: 'SET_FILTER', payload: { filterName: 'machineType', value } })}
              searchPlaceholder="Cerca Tipi di Macchina"
              id="machine_type_filter"
              width="150px"
            />
            
            <SearchableDropdown
              label="Nome Macchina"
              options={machineData.machineNames}
              selectedOptions={filters.machineName}
              onSelectionChange={(value) => dispatch({ type: 'SET_FILTER', payload: { filterName: 'machineName', value } })}
              searchPlaceholder="Cerca Nomi Macchine"
              id="machine_name_filter"
              width="150px"
            />

            {/* Action Buttons - Right side */}
            <div className="filters-actions-right">
              {/* PDF Download Button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadGanttAsHTML('.calendar-section .calendar-grid-container', formatDateDisplay())}
                title="Download exact Gantt chart as HTML file"
              >
                Scarica HTML
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="calendar-section relative">
          <Suspense fallback={<LoadingFallback />}>
            <GanttChart 
              machines={filteredMachines} 
              currentDate={currentDate} 
              dropTargetId={dropTargetId}
              dragPreview={dragPreview}
              onNavigateToNextDay={(view) => navigateDate('next', view)}
              onNavigateToPreviousDay={(view) => navigateDate('prev', view)}
            />
          </Suspense>
          {/* White cover during loading */}
          {(schedulingLoading.isScheduling || schedulingLoading.isRescheduling || schedulingLoading.isShunting || schedulingLoading.isNavigating) && (
            <div className="absolute inset-0 bg-white z-40"></div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeDragItem ? (
          <div style={{
            background: '#1e293b', // --sap-primary
            color: '#ffffff', // --text-white
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '400',
            zIndex: 9999,
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(3deg) scale(1.05)',
            border: '1px solid #2d3a4b', // --sap-secondary
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            minHeight: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            whiteSpace: 'nowrap'
          }}>
            {activeDragItem.odp_number}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </>
  );
}

export default SchedulerPage;