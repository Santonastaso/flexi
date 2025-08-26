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
  const { odpOrders, getOdpOrdersByWorkCenter, getScheduledOrders } = useOrderStore();
  const { selectedWorkCenter, isLoading, isInitialized, showAlert, isEditMode, toggleEditMode, showConflictDialog } = useUIStore();
  const { scheduleTask, unscheduleTask, scheduleTaskFromSlot, rescheduleTaskToSlot, validateSlotAvailability } = useSchedulerStore();
  const { init, cleanup } = useMainStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [workCenterFilter, setWorkCenterFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [machineTypeFilter, setMachineTypeFilter] = useState([]);
  const [machineNameFilter, setMachineNameFilter] = useState([]);
  const [taskLookup, setTaskLookup] = useState('');
  const [articleCodeLookup, setArticleCodeLookup] = useState('');
  const [customerNameLookup, setCustomerNameLookup] = useState('');

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
    console.log(`Filtered ODP orders for work center ${selectedWorkCenter}:`, filtered.map(o => ({ id: o.id, odp_number: o.odp_number, work_center: o.work_center, status: o.status })));
    return filtered;
  }, [selectedWorkCenter, getOdpOrdersByWorkCenter]);

  // Get scheduled orders filtered by selected work center
  const scheduledOrders = useMemo(() => {
    const scheduled = filteredOdpOrders.filter(order => order.status === 'SCHEDULED');
    console.log(`Scheduled orders for work center ${selectedWorkCenter}:`, scheduled.map(o => ({ id: o.id, odp_number: o.odp_number, work_center: o.work_center })));
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
    
    console.log(`=== TASK LOOKUP DEBUG ===`);
    console.log(`Searching for ODP: "${taskLookup.trim()}"`);
    console.log(`Current taskLookup state: "${taskLookup}"`);
    console.log(`Available scheduled orders:`, scheduledOrders.map(o => ({ id: o.id, odp_number: o.odp_number, work_center: o.work_center })));
    
    // Find the task in scheduled orders with exact match first, then partial match
    let task = scheduledOrders.find(t => t.odp_number === taskLookup.trim());
    console.log(`Exact match result:`, task ? { id: task.id, odp_number: task.odp_number } : 'No exact match');
    
    // If no exact match, try partial match
    if (!task) {
      task = scheduledOrders.find(t => 
        t.odp_number.toLowerCase().includes(taskLookup.trim().toLowerCase())
      );
      console.log(`Partial match result:`, task ? { id: task.id, odp_number: task.odp_number } : 'No partial match');
    }
    
    if (!task) {
      console.log(`No task found for ODP: "${taskLookup.trim()}"`);
      showAlert('Lavoro non trovato o non programmato', 'warning');
      return;
    }
    
    console.log(`Final selected task:`, { id: task.id, odp_number: task.odp_number, work_center: task.work_center, machine_id: task.scheduled_machine_id });
    
    // Find the machine
    const machine = machines.find(m => m.id === task.scheduled_machine_id);
    if (!machine) {
      console.log(`No machine found for task machine ID: ${task.scheduled_machine_id}`);
      showAlert('Macchina non trovata per questo lavoro', 'error');
      return;
    }
    
    console.log(`Found machine:`, { id: machine.id, name: machine.machine_name, work_center: machine.work_center });
    
    // Set machine filters to show only this machine
    setMachineNameFilter([machine.machine_name]);
    setWorkCenterFilter([machine.work_center]);
    setDepartmentFilter([machine.department]);
    setMachineTypeFilter([machine.machine_type]);
    
    // Navigate to the start date of the task
    if (task.scheduled_start_time) {
      setCurrentDate(new Date(task.scheduled_start_time));
    }
    
    // Clear the search input after successful lookup
    setTaskLookup('');
    showAlert(`Lavoro "${task.odp_number}" trovato su ${machine.machine_name}`, 'success');
    console.log(`=== END TASK LOOKUP DEBUG ===`);
  }, [taskLookup, scheduledOrders, machines, showAlert]);

  const handleArticleCodeLookup = useCallback(() => {
    if (!articleCodeLookup.trim()) return;
    
    console.log(`=== ARTICLE CODE LOOKUP DEBUG ===`);
    console.log(`Searching for Article Code: "${articleCodeLookup.trim()}"`);
    console.log(`Current articleCodeLookup state: "${articleCodeLookup}"`);
    console.log(`Available scheduled orders:`, scheduledOrders.map(o => ({ id: o.id, article_code: o.article_code, work_center: o.work_center })));
    
    // Find the task in scheduled orders with exact match first, then partial match
    let task = scheduledOrders.find(t => t.article_code === articleCodeLookup.trim());
    console.log(`Exact match result:`, task ? { id: task.id, article_code: task.article_code } : 'No exact match');
    
    // If no exact match, try partial match
    if (!task) {
      task = scheduledOrders.find(t => 
        t.article_code && t.article_code.toLowerCase().includes(articleCodeLookup.trim().toLowerCase())
      );
      console.log(`Partial match result:`, task ? { id: task.id, article_code: task.article_code } : 'No partial match');
    }
    
    if (!task) {
      console.log(`No task found for Article Code: "${articleCodeLookup.trim()}"`);
      showAlert('Lavoro non trovato o non programmato', 'warning');
      return;
    }
    
    console.log(`Final selected task:`, { id: task.id, article_code: task.article_code, work_center: task.work_center, machine_id: task.scheduled_machine_id });
    
    // Find the machine
    const machine = machines.find(m => m.id === task.scheduled_machine_id);
    if (!machine) {
      console.log(`No machine found for task machine ID: ${task.scheduled_machine_id}`);
      showAlert('Macchina non trovata per questo lavoro', 'error');
      return;
    }
    
    console.log(`Found machine:`, { id: machine.id, name: machine.machine_name, work_center: machine.work_center });
    
    // Set machine filters to show only this machine
    setMachineNameFilter([machine.machine_name]);
    setWorkCenterFilter([machine.work_center]);
    setDepartmentFilter([machine.department]);
    setMachineTypeFilter([machine.machine_type]);
    
    // Navigate to the start date of the task
    if (task.scheduled_start_time) {
      setCurrentDate(new Date(task.scheduled_start_time));
    }
    
    // Clear the search input after successful lookup
    setArticleCodeLookup('');
    showAlert(`Lavoro con codice articolo "${task.article_code}" trovato su ${machine.machine_name}`, 'success');
    console.log(`=== END ARTICLE CODE LOOKUP DEBUG ===`);
  }, [articleCodeLookup, scheduledOrders, machines, showAlert]);

  const handleCustomerNameLookup = useCallback(() => {
    if (!customerNameLookup.trim()) return;
    
    console.log(`=== CUSTOMER NAME LOOKUP DEBUG ===`);
    console.log(`Searching for Customer Name: "${customerNameLookup.trim()}"`);
    console.log(`Current customerNameLookup state: "${customerNameLookup}"`);
    console.log(`Available scheduled orders:`, scheduledOrders.map(o => ({ id: o.id, nome_cliente: o.nome_cliente, work_center: o.work_center })));
    
    // Find the task in scheduled orders with exact match first, then partial match
    let task = scheduledOrders.find(t => t.nome_cliente === customerNameLookup.trim());
    console.log(`Exact match result:`, task ? { id: task.id, nome_cliente: task.nome_cliente } : 'No exact match');
    
    // If no exact match, try partial match
    if (!task) {
      task = scheduledOrders.find(t => 
        t.nome_cliente && t.nome_cliente.toLowerCase().includes(customerNameLookup.trim().toLowerCase())
      );
      console.log(`Partial match result:`, task ? { id: task.id, nome_cliente: task.nome_cliente } : 'No partial match');
    }
    
    if (!task) {
      console.log(`No task found for Customer Name: "${customerNameLookup.trim()}"`);
      showAlert('Lavoro non trovato o non programmato', 'warning');
      return;
    }
    
    console.log(`Final selected task:`, { id: task.id, nome_cliente: task.nome_cliente, work_center: task.work_center, machine_id: task.scheduled_machine_id });
    
    // Find the machine
    const machine = machines.find(m => m.id === task.scheduled_machine_id);
    if (!machine) {
      console.log(`No machine found for task machine ID: ${task.scheduled_machine_id}`);
      showAlert('Macchina non trovata per questo lavoro', 'error');
      return;
    }
    
    console.log(`Found machine:`, { id: machine.id, name: machine.machine_name, work_center: machine.work_center });
    
    // Set machine filters to show only this machine
    setMachineNameFilter([machine.machine_name]);
    setWorkCenterFilter([machine.work_center]);
    setDepartmentFilter([machine.department]);
    setMachineTypeFilter([machine.machine_type]);
    
    // Navigate to the start date of the task
    if (task.scheduled_start_time) {
      setCurrentDate(new Date(task.scheduled_start_time));
    }
    
    // Clear the search input after successful lookup
    setCustomerNameLookup('');
    showAlert(`Lavoro per cliente "${task.nome_cliente}" trovato su ${machine.machine_name}`, 'success');
    console.log(`=== END CUSTOMER NAME LOOKUP DEBUG ===`);
  }, [customerNameLookup, scheduledOrders, machines, showAlert]);

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
            } else if (result?.conflict) {
              // Show conflict resolution dialog
              showConflictDialog(result);
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
      <div className={`content-section ${isEditMode ? 'edit-mode' : ''}`}>
        <StickyHeader title="Scheduler Produzione" />
        
        <Suspense fallback={<LoadingFallback />}>
          <TaskPool />
        </Suspense>

        {/* Task Lookup Section */}
        <div className="section-controls">
          <h2 className="section-title">Ricerca Lavoro</h2>
          <div className="task-lookup-grid">
            {/* ODP Search */}
            <div className="task-lookup-item">
              <div className="task-lookup-input-container">
                <input
                  type="text"
                  placeholder="Inserisci numero ODP per cercare..."
                  value={taskLookup}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log(`ODP Search input changed to: "${value}"`);
                    setTaskLookup(value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      console.log(`Enter pressed, current taskLookup: "${taskLookup}"`);
                      handleTaskLookup();
                    }
                  }}
                  className="task-lookup-input"
                />
                {taskLookup && (
                  <div className="task-lookup-dropdown">
                    {scheduledOrders
                      .filter(order => 
                        order.odp_number.toLowerCase().includes(taskLookup.toLowerCase())
                      )
                      .sort((a, b) => {
                        // Sort by exact match first, then by relevance
                        const aExact = a.odp_number.toLowerCase() === taskLookup.toLowerCase();
                        const bExact = b.odp_number.toLowerCase() === taskLookup.toLowerCase();
                        if (aExact && !bExact) return -1;
                        if (!aExact && bExact) return 1;
                        return a.odp_number.localeCompare(b.odp_number);
                      })
                      .slice(0, 5)
                      .map(order => (
                        <div 
                          key={order.id} 
                          className="task-lookup-option"
                          onClick={() => {
                            console.log(`Clicked on ODP option: ${order.odp_number} (ID: ${order.id})`);
                            // Perform lookup directly with the selected ODP number
                            const odpNumber = order.odp_number;
                            console.log(`Performing lookup for ODP: ${odpNumber}`);
                            
                            // Find the task directly
                            const task = scheduledOrders.find(t => t.odp_number === odpNumber);
                            if (!task) {
                              console.log(`Task not found for ODP: ${odpNumber}`);
                              return;
                            }
                            
                            console.log(`Found task:`, { id: task.id, odp_number: task.odp_number, work_center: task.work_center });
                            
                            // Find the machine
                            const machine = machines.find(m => m.id === task.scheduled_machine_id);
                            if (!machine) {
                              console.log(`No machine found for task machine ID: ${task.scheduled_machine_id}`);
                              showAlert('Macchina non trovata per questo lavoro', 'error');
                              return;
                            }
                            
                            console.log(`Found machine:`, { id: machine.id, name: machine.machine_name, work_center: machine.work_center });
                            
                            // Set machine filters to show only this machine
                            setMachineNameFilter([machine.machine_name]);
                            setWorkCenterFilter([machine.work_center]);
                            setDepartmentFilter([machine.department]);
                            setMachineTypeFilter([machine.machine_type]);
                            
                            // Navigate to the start date of the task
                            if (task.scheduled_start_time) {
                              setCurrentDate(new Date(task.scheduled_start_time));
                            }
                            
                            // Clear the search input
                            setTaskLookup('');
                            showAlert(`Lavoro "${task.odp_number}" trovato su ${machine.machine_name}`, 'success');
                          }}
                        >
                          <span className="task-lookup-odp">{order.odp_number}</span>
                          <span className="task-lookup-product">{order.product_name || 'Prodotto non specificato'}</span>
                          <span className="task-lookup-workcenter">({order.work_center})</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <button onClick={() => {
                console.log(`ODP Search button clicked, current taskLookup: "${taskLookup}"`);
                handleTaskLookup();
              }} className="nav-btn today">
                Cerca ODP
              </button>
            </div>

            {/* Article Code Search */}
            <div className="task-lookup-item">
              <div className="task-lookup-input-container">
                <input
                  type="text"
                  placeholder="Inserisci codice articolo per cercare..."
                  value={articleCodeLookup}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log(`Article Code Search input changed to: "${value}"`);
                    setArticleCodeLookup(value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      console.log(`Enter pressed, current articleCodeLookup: "${articleCodeLookup}"`);
                      handleArticleCodeLookup();
                    }
                  }}
                  className="task-lookup-input"
                />
                {articleCodeLookup && (
                  <div className="task-lookup-dropdown">
                    {scheduledOrders
                      .filter(order => 
                        order.article_code && order.article_code.toLowerCase().includes(articleCodeLookup.toLowerCase())
                      )
                      .sort((a, b) => {
                        // Sort by exact match first, then by relevance
                        const aExact = a.article_code && a.article_code.toLowerCase() === articleCodeLookup.toLowerCase();
                        const bExact = b.article_code && b.article_code.toLowerCase() === articleCodeLookup.toLowerCase();
                        if (aExact && !bExact) return -1;
                        if (!aExact && bExact) return 1;
                        return (a.article_code || '').localeCompare(b.article_code || '');
                      })
                      .slice(0, 5)
                      .map(order => (
                        <div 
                          key={order.id} 
                          className="task-lookup-option"
                          onClick={() => {
                            console.log(`Clicked on Article Code option: ${order.article_code} (ID: ${order.id})`);
                            // Perform lookup directly with the selected article code
                            const articleCode = order.article_code;
                            console.log(`Performing lookup for Article Code: ${articleCode}`);
                            
                            // Find the task directly
                            const task = scheduledOrders.find(t => t.article_code === articleCode);
                            if (!task) {
                              console.log(`Task not found for Article Code: ${articleCode}`);
                              return;
                            }
                            
                            console.log(`Found task:`, { id: task.id, article_code: task.article_code, work_center: task.work_center });
                            
                            // Find the machine
                            const machine = machines.find(m => m.id === task.scheduled_machine_id);
                            if (!machine) {
                              console.log(`No machine found for task machine ID: ${task.scheduled_machine_id}`);
                              showAlert('Macchina non trovata per questo lavoro', 'error');
                              return;
                            }
                            
                            console.log(`Found machine:`, { id: machine.id, name: machine.machine_name, work_center: machine.work_center });
                            
                            // Set machine filters to show only this machine
                            setMachineNameFilter([machine.machine_name]);
                            setWorkCenterFilter([machine.work_center]);
                            setDepartmentFilter([machine.department]);
                            setMachineTypeFilter([machine.machine_type]);
                            
                            // Navigate to the start date of the task
                            if (task.scheduled_start_time) {
                              setCurrentDate(new Date(task.scheduled_start_time));
                            }
                            
                            // Clear the search input
                            setArticleCodeLookup('');
                            showAlert(`Lavoro con codice articolo "${task.article_code}" trovato su ${machine.machine_name}`, 'success');
                          }}
                        >
                          <span className="task-lookup-odp">{order.article_code}</span>
                          <span className="task-lookup-product">{order.product_name || 'Prodotto non specificato'}</span>
                          <span className="task-lookup-workcenter">({order.work_center})</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <button onClick={() => {
                console.log(`Article Code Search button clicked, current articleCodeLookup: "${articleCodeLookup}"`);
                handleArticleCodeLookup();
              }} className="nav-btn today">
                Cerca Articolo
              </button>
            </div>

            {/* Customer Name Search */}
            <div className="task-lookup-item">
              <div className="task-lookup-input-container">
                <input
                  type="text"
                  placeholder="Inserisci nome cliente per cercare..."
                  value={customerNameLookup}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log(`Customer Name Search input changed to: "${value}"`);
                    setCustomerNameLookup(value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      console.log(`Enter pressed, current customerNameLookup: "${customerNameLookup}"`);
                      handleCustomerNameLookup();
                    }
                  }}
                  className="task-lookup-input"
                />
                {customerNameLookup && (
                  <div className="task-lookup-dropdown">
                    {scheduledOrders
                      .filter(order => 
                        order.nome_cliente && order.nome_cliente.toLowerCase().includes(customerNameLookup.toLowerCase())
                      )
                      .sort((a, b) => {
                        // Sort by exact match first, then by relevance
                        const aExact = a.nome_cliente && a.nome_cliente.toLowerCase() === customerNameLookup.toLowerCase();
                        const bExact = b.nome_cliente && b.nome_cliente.toLowerCase() === customerNameLookup.toLowerCase();
                        if (aExact && !bExact) return -1;
                        if (!aExact && bExact) return 1;
                        return (a.nome_cliente || '').localeCompare(b.nome_cliente || '');
                      })
                      .slice(0, 5)
                      .map(order => (
                        <div 
                          key={order.id} 
                          className="task-lookup-option"
                          onClick={() => {
                            console.log(`Clicked on Customer Name option: ${order.nome_cliente} (ID: ${order.id})`);
                            // Perform lookup directly with the selected customer name
                            const customerName = order.nome_cliente;
                            console.log(`Performing lookup for Customer Name: ${customerName}`);
                            
                            // Find the task directly
                            const task = scheduledOrders.find(t => t.nome_cliente === customerName);
                            if (!task) {
                              console.log(`Task not found for Customer Name: ${customerName}`);
                              return;
                            }
                            
                            console.log(`Found task:`, { id: task.id, nome_cliente: task.nome_cliente, work_center: task.work_center });
                            
                            // Find the machine
                            const machine = machines.find(m => m.id === task.scheduled_machine_id);
                            if (!machine) {
                              console.log(`No machine found for task machine ID: ${task.scheduled_machine_id}`);
                              showAlert('Macchina non trovata per questo lavoro', 'error');
                              return;
                            }
                            
                            console.log(`Found machine:`, { id: machine.id, name: machine.machine_name, work_center: machine.work_center });
                            
                            // Set machine filters to show only this machine
                            setMachineNameFilter([machine.machine_name]);
                            setWorkCenterFilter([machine.work_center]);
                            setDepartmentFilter([machine.department]);
                            setMachineTypeFilter([machine.machine_type]);
                            
                            // Navigate to the start date of the task
                            if (task.scheduled_start_time) {
                              setCurrentDate(new Date(task.scheduled_start_time));
                            }
                            
                            // Clear the search input
                            setCustomerNameLookup('');
                            showAlert(`Lavoro per cliente "${task.nome_cliente}" trovato su ${machine.machine_name}`, 'success');
                          }}
                        >
                          <span className="task-lookup-odp">{order.nome_cliente}</span>
                          <span className="task-lookup-product">{order.product_name || 'Prodotto non specificato'}</span>
                          <span className="task-lookup-workcenter">({order.work_center})</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <button onClick={() => {
                console.log(`Customer Name Search button clicked, current customerNameLookup: "${customerNameLookup}"`);
                handleCustomerNameLookup();
              }} className="nav-btn today">
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
                className={`nav-btn ${isEditMode ? 'edit-mode-active' : ''}`}
                onClick={toggleEditMode}
                title={isEditMode ? "Disabilita modalità modifica" : "Abilita modalità modifica"}
                style={{
                  backgroundColor: isEditMode ? '#dc3545' : '#007bff',
                  color: 'white',
                  border: isEditMode ? '2px solid #bd2130' : '2px solid #0056b3',
                  fontWeight: 'bold'
                }}
              >
                {isEditMode ? 'Disabilita Modalità Modifica' : 'Abilita Modalità Modifica'}
              </button>
              
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