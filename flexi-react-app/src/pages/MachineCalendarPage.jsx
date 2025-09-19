import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMachineStore, useUIStore, useMainStore } from '../store';
import OffTimeForm from '../components/OffTimeForm';
import FullCalendarGrid from '../components/FullCalendarGrid';
import StickyHeader from '../components/StickyHeader';

function MachineCalendarPage() {
  const { machineId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Use modern slice stores instead of legacy useStore
  const { getMachineById } = useMachineStore();
  const { isLoading, isInitialized } = useUIStore();
  const { init, cleanup } = useMainStore();
  
  const machine = getMachineById(machineId);
  

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
      <div className="p-1 bg-white rounded shadow-sm border">
        <div className="text-center py-1 text-gray-500 text-[10px]">
          Caricamento calendario macchina... (Loading: {isLoading.toString()}, Initialized: {isInitialized.toString()})
        </div>
      </div>
    );
  }


  if (!machine) {
    return (
      <div className="p-1 bg-white rounded shadow-sm border">
        <div className="text-center py-1 text-red-600 text-[10px]">
          Macchina non trovata (ID: {machineId}, Initialized: {isInitialized.toString()})
        </div>
      </div>
    );
  }

  const handleOffTimeSuccess = () => {
    // Force calendar refresh by updating the key
    // This will trigger the useEffect in FullCalendarGrid to reload data
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-1 bg-white rounded shadow-sm border">
      <StickyHeader title="Calendario Disponibilità Macchina" />
      
      {/* Machine Name Display */}
      <div className="mb-1">
        <h3 className="text-[10px] font-semibold text-gray-900">{machine.machine_name}</h3>
      </div>
      
      {/* Debug info - only in development */}
      {import.meta.env.MODE === 'development' && (
        <div className="mb-1 p-1 bg-gray-100 rounded text-[10px]">
          <div>Machine ID: {machine.id}</div>
          <div>Machine Name: {machine.machine_name}</div>
          <div>Store Initialized: {isInitialized.toString()}</div>
          <div>Loading: {isLoading.toString()}</div>
        </div>
      )}
      
      {/* FullCalendar has its own controls, so we don't need the custom ones */}
      
      <OffTimeForm
        machineId={machine.id}
        currentDate={new Date()}
        onSuccess={handleOffTimeSuccess}
      />
      
      <FullCalendarGrid
        machineId={machine.id}
        refreshTrigger={refreshKey}
      />
    </div>
  );
}

export default MachineCalendarPage;
