import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMachineStore, useUIStore, useMainStore } from '../store';
import CalendarViewControls from '../components/CalendarViewControls';
import OffTimeForm from '../components/OffTimeForm';
import CalendarGrid from '../components/CalendarGrid';
import StickyHeader from '../components/StickyHeader';

function MachineCalendarPage() {
  const { machineId } = useParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('Month');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Use modern slice stores instead of legacy useStore
  const { getMachineById } = useMachineStore();
  const { isLoading, isInitialized } = useUIStore();
  const { init, cleanup } = useMainStore();
  
  const machine = getMachineById(machineId);
  
  // Debug logging (only once)
  const allMachines = useMachineStore.getState().machines;
  if (!machine) {
    console.log('MachineCalendarPage Debug:', {
      machineId,
      machine,
      isLoading,
      isInitialized,
      machinesCount: allMachines.length,
      firstFewMachines: allMachines.slice(0, 3).map(m => ({ id: m.id, name: m.machine_name }))
    });
  }

  useEffect(() => {
    // Only initialize once
    if (!isInitialized) {
      console.log('Initializing main store...');
      // Add timeout to prevent hanging
      const initPromise = init();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timeout')), 10000)
      );
      
      Promise.race([initPromise, timeoutPromise]).catch(error => {
        console.error('Initialization failed or timed out:', error);
      });
    }
    
    // Cleanup function for component unmount
    return () => {
      cleanup();
    };
  }, [init, isInitialized, cleanup]);

  // Show loading only if we're actively loading, not if just not initialized
  if (isLoading) {
    return (
      <div className="p-2 bg-white rounded shadow-sm border">
        <div className="text-center py-4 text-gray-500 text-xs">
          Caricamento calendario macchina... (Loading: {isLoading.toString()}, Initialized: {isInitialized.toString()})
        </div>
      </div>
    );
  }

  // If we have machines but not initialized, show the page anyway
  if (!isInitialized && allMachines.length > 0) {
    // Page will show despite not being initialized
  }

  if (!machine) {
    return (
      <div className="p-2 bg-white rounded shadow-sm border">
        <div className="text-center py-4 text-red-600 text-xs">
          Macchina non trovata (ID: {machineId}, Initialized: {isInitialized.toString()})
        </div>
      </div>
    );
  }

  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
  };

  const handleViewChange = (newView) => {
    setCurrentView(newView);
  };

  const handleOffTimeSuccess = () => {
    // Force calendar refresh by updating the key
    // This will trigger the useEffect in CalendarGrid to reload data
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-2 bg-white rounded shadow-sm border">
      <StickyHeader title="Calendario Disponibilità Macchina" />
      
      {/* Machine Name Display */}
      <div className="mb-2">
        <h3 className="text-xs font-semibold text-gray-900">{machine.machine_name}</h3>
      </div>
      
      {/* Debug info */}
      <div className="mb-2 p-2 bg-gray-100 rounded text-xs">
        <div>Machine ID: {machine.id}</div>
        <div>Machine Name: {machine.machine_name}</div>
        <div>Store Initialized: {isInitialized.toString()}</div>
        <div>Loading: {isLoading.toString()}</div>
      </div>
      
      <CalendarViewControls
        currentDate={currentDate}
        currentView={currentView}
        onDateChange={handleDateChange}
        onViewChange={handleViewChange}
      />
      
      <OffTimeForm
        machineId={machine.id}
        currentDate={currentDate}
        onSuccess={handleOffTimeSuccess}
      />
      
      <CalendarGrid
        machineId={machine.id}
        currentDate={currentDate}
        currentView={currentView}
        refreshTrigger={refreshKey}
      />
    </div>
  );
}

export default MachineCalendarPage;
