import React, { useState, useEffect, useMemo, useCallback, useReducer, Suspense, lazy } from 'react';
import { DndContext, DragOverlay, PointerSensor, MouseSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { useUIStore, useSchedulerStore, useMainStore } from '../store';
import { useOrders, useMachines } from '../hooks';
import { MACHINE_STATUSES, WORK_CENTERS } from '../constants';
import { normalizeOdpNumber, showError, showSuccess } from '../utils';
import SearchableDropdown from '../components/SearchableDropdown';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';

// Lazy load heavy components
const TaskPoolDataTable = lazy(() => import('../components/TaskPoolDataTable'));
const MachineQueueColumn = lazy(() => import('../components/MachineQueueColumn'));

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

// Password Protection Component
const PasswordPrompt = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === '1234') {
      localStorage.setItem('spotifySchedulerAuth', 'true');
      onAuthenticated();
    } else {
      setError('Password non corretta');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 shadow-2xl max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <svg className="w-16 h-16 mx-auto mb-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900">Spotify Scheduler</h2>
          <p className="text-sm text-gray-600 mt-2">Inserisci la password per accedere</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full"
              autoFocus
            />
            {error && (
              <p className="text-red-600 text-sm mt-2">{error}</p>
            )}
          </div>
          
          <Button type="submit" className="w-full">
            Accedi
          </Button>
        </form>
      </div>
    </div>
  );
};

function SpotifySchedulerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('spotifySchedulerAuth') === 'true';
  });

  // Use React Query for data fetching
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useOrders();
  const { data: machines = [], isLoading: machinesLoading, error: machinesError } = useMachines();
  
  // Use Zustand store for selectors and client state
  const { selectedWorkCenter, isLoading, isInitialized, schedulingLoading } = useUIStore();
  const { init, cleanup } = useMainStore();
  const queryClient = useQueryClient();

  // Configure drag and drop sensors with activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px threshold to prevent accidental drags
        delay: 0,
        tolerance: 0,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5, // 5px threshold
        delay: 0,
        tolerance: 0,
      },
    })
  );

  const [activeDragItem, setActiveDragItem] = useState(null);
  
  // Pause creation state
  const [pauseHours, setPauseHours] = useState('1');
  const [pauseMachine, setPauseMachine] = useState('');
  const [isCreatingPause, setIsCreatingPause] = useState(false);
  const [dismissedStaleMachines, setDismissedStaleMachines] = useState(new Set());
  
  // Combined loading state
  const isDataLoading = ordersLoading || machinesLoading || isLoading;

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
    localStorage.setItem('spotifySchedulerFilters', JSON.stringify(newState));
    return newState;
  }

  // Initialize filters from localStorage
  const getInitialFilters = () => {
    try {
      const saved = localStorage.getItem('spotifySchedulerFilters');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          workCenter: Array.isArray(parsed.workCenter) ? parsed.workCenter : [],
          department: Array.isArray(parsed.department) ? parsed.department : [],
          machineType: Array.isArray(parsed.machineType) ? parsed.machineType : [],
          machineName: Array.isArray(parsed.machineName) ? parsed.machineName : []
        };
      }
    } catch (error) {
      console.warn('Failed to parse saved filters, using defaults:', error);
      localStorage.removeItem('spotifySchedulerFilters');
    }
    return initialFilterState;
  };

  const [filters, dispatch] = useReducer(filterReducer, getInitialFilters());

  // Initialize store on mount
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
    
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

  // Memoize machine filtering with optimized dependencies
  const machineData = useMemo(() => {
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

    return { activeMachines, workCenters, departments, machineTypes, machineNames };
  }, [machines, selectedWorkCenter]);

  // Apply additional filters to machines
  const filteredMachines = useMemo(() => {
    const { activeMachines } = machineData;

    let filtered = activeMachines;

    if (filters.workCenter && Array.isArray(filters.workCenter) && filters.workCenter.length > 0) {
      filtered = filtered.filter(machine => filters.workCenter.includes(machine.work_center));
    }
    
    if (filters.department && Array.isArray(filters.department) && filters.department.length > 0) {
      filtered = filtered.filter(machine => filters.department.includes(machine.department));
    }

    if (filters.machineType && Array.isArray(filters.machineType) && filters.machineType.length > 0) {
      filtered = filtered.filter(machine => filters.machineType.includes(machine.machine_type));
    }

    if (filters.machineName && Array.isArray(filters.machineName) && filters.machineName.length > 0) {
      filtered = filtered.filter(machine => filters.machineName.includes(machine.machine_name));
    }

    return filtered;
  }, [machineData, filters]);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
  }, []);

  // Detect machines where ALL scheduled tasks have ended (stale queue)
  const staleMachines = useMemo(() => {
    const now = new Date();
    return filteredMachines.filter(machine => {
      const queue = orders.filter(o =>
        o.scheduled_machine_id === machine.id && ['SCHEDULED', 'IN PROGRESS'].includes(o.status)
      );
      return queue.length > 0 && queue.every(o => new Date(o.scheduled_end_time) < now);
    });
  }, [filteredMachines, orders]);

  // Handle pause creation
  const handleCreatePause = async () => {
    if (!pauseMachine || !pauseHours) {
      showError('Seleziona macchina e durata pausa');
      return;
    }

    const hours = parseFloat(pauseHours);
    if (isNaN(hours) || hours <= 0) {
      showError('Durata pausa non valida');
      return;
    }

    setIsCreatingPause(true);
    try {
      const { createPauseTask } = useSchedulerStore.getState();
      const result = await createPauseTask(pauseMachine, hours, machines, orders);
      
      if (result.error) {
        showError(result.error);
      } else {
        showSuccess('Pausa creata con successo');
        // Force immediate refetch to update cache
        await queryClient.refetchQueries({ 
          queryKey: ['orders'],
          exact: true,
          type: 'active'
        });
        setPauseHours('1');
        setPauseMachine('');
      }
    } catch (error) {
      showError('Errore nella creazione della pausa');
    } finally {
      setIsCreatingPause(false);
    }
  };

  // Drag handlers
  const { scheduleTaskAtEndOfQueue } = useSchedulerStore();

  const handleDragStart = useCallback((event) => {
    const draggedItem = event.active.data.current;
    if (draggedItem && draggedItem.type === 'task') {
      setActiveDragItem(draggedItem.task);
    } else if (draggedItem && draggedItem.type === 'queue-task') {
      setActiveDragItem(draggedItem.task);
    }
  }, []);

  const handleDragOver = useCallback((event) => {
    // Preview logic can be added here if needed
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const draggedData = active.data.current;
    const droppedData = over.data.current;

    const { startSchedulingOperation, stopSchedulingOperation } = useUIStore.getState();

    // Check if any scheduling operation is in progress
    const currentSchedulingState = useUIStore.getState().schedulingLoading;
    if (currentSchedulingState.isScheduling || currentSchedulingState.isRescheduling) {
      showError('Operazione in corso, attendere...');
      return;
    }
    
    // Case 1: Dragging from task pool to a queue column
    if (draggedData?.type === 'task' && droppedData?.type === 'queue-column') {
      const taskId = draggedData.task.id;
      const machineId = droppedData.machineId;
      
      try {
        startSchedulingOperation('schedule', taskId);
        
        let ordersToUse = await apiService.getOdpOrders();
        
        // If task doesn't exist in orders cache, add it temporarily for scheduling
        if (!ordersToUse.some(o => o.id === taskId)) {
          ordersToUse = [...ordersToUse, draggedData.task];
        }
        
        const result = await scheduleTaskAtEndOfQueue(machineId, taskId, ordersToUse);
        
        if (result.error) {
          showError(result.error);
        } else if (result.conflict) {
          showError('Conflitto rilevato durante la programmazione');
        } else {
          // Force immediate refetch to update cache
          await queryClient.refetchQueries({ 
            queryKey: ['orders'],
            exact: true,
            type: 'active'
          });
        }
      } catch (error) {
        showError('Errore durante la programmazione del lavoro');
      } finally {
        stopSchedulingOperation();
      }
    }
    
    // Case 2: Dropping task from pool or reordering to end of queue column
    else if (draggedData?.type === 'queue-task' && droppedData?.type === 'queue-column') {
      // This happens when dragging within queue but dropping on empty space
      // We can ignore this as it's handled by the sortable context
      return;
    }
  }, [scheduleTaskAtEndOfQueue, queryClient]);

  // Show password prompt if not authenticated
  if (!isAuthenticated) {
    return <PasswordPrompt onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  // Show loading state during initial load
  if (isDataLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-lg flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-700 font-medium">Caricamento Spotify Scheduler...</span>
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
        <div className="spotify-scheduler-container">
          {/* Task Pool Section */}
          <div className="task-pool-section">
            <div className="task-pool-header">
              <h2 className="text-[10px] font-semibold text-gray-900">Pool Lavori</h2>
            </div>
            <Suspense fallback={<LoadingFallback />}>
              <TaskPoolDataTable filterByCost={false} />
            </Suspense>
          </div>

          {/* Filters and Pause Creation Section */}
          <div className="section-controls">
            <div className="task-pool-header">
              <h2 className="text-[10px] font-semibold text-gray-900">Filtri Macchine & Aggiungi Pausa</h2>
            </div>
            <div className="filters-grid">
              {/* Pause Creation Controls */}
              <div className="pause-creation-controls">
                <select
                  value={pauseMachine}
                  onChange={(e) => setPauseMachine(e.target.value)}
                  className="pause-select"
                  disabled={isCreatingPause}
                >
                  <option value="">Seleziona Macchina</option>
                  {filteredMachines.map(machine => (
                    <option key={machine.id} value={machine.id}>
                      {machine.machine_name}
                    </option>
                  ))}
                </select>
                
                <select
                  value={pauseHours}
                  onChange={(e) => setPauseHours(e.target.value)}
                  className="pause-select"
                  disabled={isCreatingPause}
                >
                  {Array.from({ length: 100 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={String(h)}>{h}h</option>
                  ))}
                </select>
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCreatePause}
                  disabled={isCreatingPause || !pauseMachine}
                  className="pause-create-btn"
                >
                  {isCreatingPause ? 'Creazione...' : '+ Pausa'}
                </Button>
              </div>

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
            </div>
          </div>

          {/* Machine Queue Columns Section */}
          <div className="queue-columns-section">
            {/* Stale queue banners */}
            {staleMachines
              .filter(m => !dismissedStaleMachines.has(m.id))
              .map(machine => (
                <div
                  key={machine.id}
                  className="flex items-center justify-between bg-yellow-50 border border-yellow-300 rounded px-3 py-2 mb-2 text-[10px] text-yellow-800"
                >
                  <span>
                    <strong>{machine.machine_name}</strong>: tutti i task programmati sono scaduti e non completati. Aggiungi o sposta un task per riaggiornare la coda.
                  </span>
                  <button
                    className="ml-4 text-yellow-600 hover:text-yellow-900 font-bold"
                    onClick={() => setDismissedStaleMachines(prev => new Set([...prev, machine.id]))}
                    aria-label="Chiudi"
                  >
                    x
                  </button>
                </div>
              ))
            }
            {filteredMachines.length === 0 ? (
              <div className="empty-state">
                <h3>Nessuna macchina disponibile</h3>
                <p>Aggiungi macchine o modifica i filtri per visualizzare le code.</p>
              </div>
            ) : (
              <Suspense fallback={<LoadingFallback />}>
                <div className="queue-columns-container">
                  {filteredMachines.map(machine => (
                    <MachineQueueColumn 
                      key={machine.id} 
                      machine={machine}
                      queryClient={queryClient}
                    />
                  ))}
                </div>
              </Suspense>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeDragItem ? (
            <div style={{
              background: '#1e293b',
              color: '#ffffff',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '400',
              zIndex: 9999,
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(3deg) scale(1.05)',
              border: '1px solid #2d3a4b',
              boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              minHeight: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              whiteSpace: 'nowrap'
            }}>
              {normalizeOdpNumber(activeDragItem.odp_number)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

export default SpotifySchedulerPage;

