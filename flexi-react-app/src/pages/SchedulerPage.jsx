import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useReducer } from 'react';
import { useUIStore, useMainStore } from '../store';
import { useOrders, useMachines } from '../hooks';
import { startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { getTodayInCET, getDateInCET, ITALY_TIMEZONE } from '../utils/dateFormatting';

import { MACHINE_STATUSES, WORK_CENTERS } from '../constants';
import { showError } from '../utils';
import SearchableDropdown from '../components/SearchableDropdown';
import { Button } from '../components/ui/button';


// Lazy load heavy components to improve initial load time
const TaskPoolDataTable = lazy(() => import('../components/TaskPoolDataTable'));
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
  
  // Use Zustand store for client state only
  const { selectedWorkCenter, isLoading, isInitialized, showAlert } = useUIStore();
  // Note: All scheduling methods removed - Gantt is now read-only, use Spotify Scheduler for task management
  const { init, cleanup } = useMainStore();

  const [currentDate, setCurrentDate] = useState(() => getTodayInCET());

  const isDataLoading = ordersLoading || machinesLoading || isLoading;
  const [taskLookup, setTaskLookup] = useState(() => localStorage.getItem('schedulerTaskLookup') || '');
  const [articleCodeLookup, setArticleCodeLookup] = useState(() => localStorage.getItem('schedulerArticleLookup') || '');
  const [customerNameLookup, setCustomerNameLookup] = useState(() => localStorage.getItem('schedulerCustomerLookup') || '');

  // Filter state management with useReducer and localStorage persistence
  const initialFilterState = { 
    workCenter: [], 
    department: [], 
    machineType: [], 
    machineName: [] 
  };

  function filterReducer(state, action) {
    let newState;
    switch (action.type) {
      case 'SET_FILTER':
        // payload: { filterName: 'workCenter', value: [...] }
        newState = { ...state, [action.payload.filterName]: action.payload.value };
        break;
      case 'CLEAR_FILTERS':
        newState = initialFilterState;
        break;
      case 'LOAD_FILTERS':
        newState = action.payload;
        break;
      default:
        return state;
    }
    // Save to localStorage whenever filters change
    localStorage.setItem('schedulerFilters', JSON.stringify(newState));
    return newState;
  }

  // Initialize filters from localStorage
  const getInitialFilters = () => {
    try {
      const saved = localStorage.getItem('schedulerFilters');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all required filter properties exist and are arrays
        return {
          workCenter: Array.isArray(parsed.workCenter) ? parsed.workCenter : [],
          department: Array.isArray(parsed.department) ? parsed.department : [],
          machineType: Array.isArray(parsed.machineType) ? parsed.machineType : [],
          machineName: Array.isArray(parsed.machineName) ? parsed.machineName : []
        };
      }
    } catch (error) {
      localStorage.removeItem('schedulerFilters');
    }
    return initialFilterState;
  };

  const [filters, dispatch] = useReducer(filterReducer, getInitialFilters());

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
    const scheduled = filteredOdpOrders.filter(order => ['SCHEDULED', 'IN PROGRESS'].includes(order.status));
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
    if (filters.workCenter && Array.isArray(filters.workCenter) && filters.workCenter.length > 0) {
      filtered = filtered.filter(machine => filters.workCenter.includes(machine.work_center));
    }
    
    // Filter by department (if selected)
    if (filters.department && Array.isArray(filters.department) && filters.department.length > 0) {
      filtered = filtered.filter(machine => filters.department.includes(machine.department));
    }

    // Filter by machine type (if selected)
    if (filters.machineType && Array.isArray(filters.machineType) && filters.machineType.length > 0) {
      filtered = filtered.filter(machine => filters.machineType.includes(machine.machine_type));
    }

    // Filter by machine name (if selected)
    if (filters.machineName && Array.isArray(filters.machineName) && filters.machineName.length > 0) {
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
          // Use CET today
          newDate = getTodayInCET();
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
    // Use CET today for comparison
    const cetToday = getTodayInCET();
    
    // currentDate represents a CET day, so compare directly
    const isToday = currentDate.getTime() === cetToday.getTime();
    
    if (isToday) {
      return 'Oggi';
    } else {
      // Format the date for display
      return formatInTimeZone(currentDate, ITALY_TIMEZONE, 'yyyy-MM-dd');
    }
  }, [currentDate]);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
    setTaskLookup('');
    setArticleCodeLookup('');
    setCustomerNameLookup('');
    localStorage.removeItem('schedulerTaskLookup');
    localStorage.removeItem('schedulerArticleLookup');
    localStorage.removeItem('schedulerCustomerLookup');
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
    
    // Navigate to the start date of the task in CET timezone
    if (task.scheduled_start_time) {
      const taskDate = new Date(task.scheduled_start_time);
      setCurrentDate(getDateInCET(taskDate));
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
        <div className="text-center py-1 text-red-600 text-xs">Seleziona un centro di lavoro per visualizzare i dati dello scheduler.</div>
      </div>
    );
  }

  return (
    <>
        <div className="content-section">
        {/* Read-Only Notice */}
        <div className="read-only-notice">
          <div className="notice-content">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>Modalità Visualizzazione: Questa pagina è di sola lettura. Usa <strong>Pianificazione</strong> per modificare la pianificazione.</span>
          </div>
        </div>
        
        {/* Task Pool Section - HIDDEN (Read-only mode) */}
        {/* <div className="task-pool-section">
          <div className="task-pool-header">
            <h2 className="text-sm font-semibold text-gray-900">Pool Lavori</h2>
          </div>
          <Suspense fallback={<LoadingFallback />}>
            <TaskPoolDataTable />
          </Suspense>
        </div> */}

        {/* Filters Section */}
        <div className="section-controls">
          <div className="task-pool-header">
            <h2 className="text-sm font-semibold text-gray-900">Filtri</h2>
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
                  localStorage.setItem('schedulerTaskLookup', value[0]);
                  handleLookup(value[0], 'odp_number', 'ODP');
                } else {
                  setTaskLookup('');
                  localStorage.removeItem('schedulerTaskLookup');
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
                  localStorage.setItem('schedulerArticleLookup', value[0]);
                  handleLookup(value[0], 'article_code', 'codice articolo');
                } else {
                  setArticleCodeLookup('');
                  localStorage.removeItem('schedulerArticleLookup');
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
                  localStorage.setItem('schedulerCustomerLookup', value[0]);
                  handleLookup(value[0], 'nome_cliente', 'cliente');
                } else {
                  setCustomerNameLookup('');
                  localStorage.removeItem('schedulerCustomerLookup');
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
              dropTargetId={null}
              dragPreview={null}
              onNavigateToNextDay={(view) => navigateDate('next', view)}
              onNavigateToPreviousDay={(view) => navigateDate('prev', view)}
              readOnly={true}
            />
          </Suspense>
        </div>
      </div>
    </>
  );
}

export default SchedulerPage;