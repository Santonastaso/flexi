import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { DndContext, DragOverlay, PointerSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useUIStore, useSchedulerStore, useMainStore } from '../store';
import { useMachineFilters, useOrders, useMachines } from '../hooks';
import { normalizeOdpNumber, showError, showSuccess } from '../utils';
import MachineFilterControls from '../components/MachineFilterControls';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services';
import { Button } from '../components/ui/button';

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

function SpotifySchedulerPage() {
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
  const [isRepairing, setIsRepairing] = useState(false);
  
  // Combined loading state
  const isDataLoading = ordersLoading || machinesLoading || isLoading;

  const {
    filters,
    machineData,
    filteredMachines,
    setFilter,
    clearMachineFilters
  } = useMachineFilters({
    machines,
    selectedWorkCenter,
    storageKey: 'spotifySchedulerFilters'
  });

  // Initialize store on mount
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
    
    return () => {
      cleanup();
    };
  }, [init, isInitialized, cleanup]);

  const clearFilters = useCallback(() => {
    clearMachineFilters();
  }, [clearMachineFilters]);


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
    } catch {
      showError('Errore nella creazione della pausa');
    } finally {
      setIsCreatingPause(false);
    }
  };

  // Drag handlers
  const { scheduleTaskAtEndOfQueue, repairAllQueues } = useSchedulerStore();

  const handleRepairAllQueues = async () => {
    if (!window.confirm('Ricalcolare tutte le code macchina? Questa operazione aggiornerà i tempi schedulati.')) return;
    setIsRepairing(true);
    try {
      const freshOrders = await queryClient.fetchQuery({ queryKey: ['orders'] });
      await repairAllQueues(freshOrders, machines);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showSuccess('Code ricalcolate per tutte le macchine');
    } catch {
      showError('Errore durante il ripristino delle code');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleDragStart = useCallback((event) => {
    const draggedItem = event.active.data.current;
    if (draggedItem && draggedItem.type === 'task') {
      setActiveDragItem(draggedItem.task);
    } else if (draggedItem && draggedItem.type === 'queue-task') {
      setActiveDragItem(draggedItem.task);
    }
  }, []);

  const handleDragOver = useCallback(() => {
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
      } catch {
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

  // Show loading state during initial load
  if (isDataLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-lg flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-700 font-medium">Caricamento pianificazione...</span>
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
      <SchedulingLoadingOverlay schedulingLoading={schedulingLoading} />
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="spotify-scheduler-container">
          {/* Task Pool Section */}
          <div className="task-pool-section">
            <div className="task-pool-header">
              <h2 className="text-sm font-semibold text-gray-900">Pool Lavori</h2>
            </div>
            <Suspense fallback={<LoadingFallback />}>
              <TaskPoolDataTable filterByCost={false} />
            </Suspense>
          </div>

          {/* Filters and Pause Creation Section */}
          <div className="section-controls">
            <div className="task-pool-header">
              <h2 className="text-sm font-semibold text-gray-900">Filtri Macchine & Aggiungi Pausa</h2>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRepairAllQueues}
                  disabled={isRepairing || isDataLoading}
                  title="Ricalcola tutte le code macchina"
                >
                  {isRepairing ? 'Aggiornamento...' : '↺ Aggiorna Coda'}
                </Button>
              </div>

              <MachineFilterControls
                machineData={machineData}
                filters={filters}
                onFilterChange={setFilter}
              />
            </div>
          </div>

          {/* Machine Queue Columns Section */}
          <div className="queue-columns-section">
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
