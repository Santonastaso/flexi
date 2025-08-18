import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import CalendarViewControls from '../components/CalendarViewControls';
import OffTimeForm from '../components/OffTimeForm';
import CalendarGrid from '../components/CalendarGrid';

function MachineCalendarPage() {
  const { machineId } = useParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('Month');
  
  const machine = useStore(state => 
    state.machines.find(m => m.id === machineId)
  );
  const isLoading = useStore(state => state.isLoading);
  const isInitialized = useStore(state => state.isInitialized);
  const init = useStore(state => state.init);

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [init, isInitialized]);

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
          machineName={machine.machine_name}
          currentDate={currentDate}
        />
        
        <CalendarGrid
          machineName={machine.machine_name}
          currentDate={currentDate}
          currentView={currentView}
        />
      </div>
    </div>
  );
}

export default MachineCalendarPage;
