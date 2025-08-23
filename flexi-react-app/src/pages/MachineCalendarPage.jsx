import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMachineStore, useUIStore, useMainStore } from '../store';
import CalendarViewControls from '../components/CalendarViewControls';
import OffTimeForm from '../components/OffTimeForm';
import CalendarGrid from '../components/CalendarGrid';

function MachineCalendarPage() {
  const { machineId } = useParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('Month');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Use modern slice stores instead of legacy useStore
  const { getMachineById } = useMachineStore();
  const { getLoadingState, getInitializationState } = useUIStore();
  const { init, cleanup } = useMainStore();
  
  const machine = getMachineById(machineId);
  const isLoading = getLoadingState();
  const isInitialized = getInitializationState();

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
    
    // Cleanup function for component unmount
    return () => {
      cleanup();
    };
  }, [init, isInitialized, cleanup]);

  if (isLoading || !isInitialized) {
    return <div className="loading">Loading machine calendar...</div>;
  }

  if (!machine) {
    return <div className="error">Machine not found</div>;
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
    <div className="page-container">
      <div className="content-section">
        <div className="calendar-header">
          <h1>Machine Availability Calendar</h1>
          <h2>{machine.machine_name}</h2>
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
    </div>
  );
}

export default MachineCalendarPage;
