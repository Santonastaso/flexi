import React from 'react';
import { startOfWeek, endOfWeek, addDays, format } from 'date-fns';

function CalendarViewControls({ currentDate, currentView, onDateChange, onViewChange }) {
  const goToToday = () => {
    onDateChange(new Date());
  };

  const goToPrevious = () => {
    let newDate;
    if (currentView === 'Month') {
      newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (currentView === 'Week') {
      newDate = addDays(currentDate, -7);
    } else if (currentView === 'Year') {
      newDate = new Date(currentDate);
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    onDateChange(newDate);
  };

  const goToNext = () => {
    let newDate;
    if (currentView === 'Month') {
      newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (currentView === 'Week') {
      newDate = addDays(currentDate, 7);
    } else if (currentView === 'Year') {
      newDate = new Date(currentDate);
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    onDateChange(newDate);
  };

  const getCurrentPeriodLabel = () => {
    if (currentView === 'Month') {
              return format(currentDate, 'yyyy-MM');
    } else if (currentView === 'Week') {
          const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
              return `${format(weekStart, 'yyyy-MM-dd')} - ${format(weekEnd, 'yyyy-MM-dd')}`;
    } else if (currentView === 'Year') {
      return currentDate.getUTCFullYear().toString();
    }
    return '';
  };

  return (
    <div className="calendar-controls-container">
      <div className="calendar-navigation">
        <button 
          className="nav-btn today"
          onClick={goToPrevious}
          aria-label="Previous"
        >
          ← Precedente
        </button>
        
        <button 
          className="nav-btn today"
          onClick={goToToday}
        >
          Oggi
        </button>
        
        <button 
          className="nav-btn today"
          onClick={goToNext}
          aria-label="Next"
        >
          Successivo →
        </button>
      </div>
      
      <div className="calendar-view-selector">
        <h3>{getCurrentPeriodLabel()}</h3>
        
        <select 
          value={currentView} 
          onChange={(e) => onViewChange(e.target.value)}
        >
          <option value="Month">Mese</option>
          <option value="Week">Settimana</option>
          <option value="Year">Anno</option>
        </select>
      </div>
    </div>
  );
}

export default CalendarViewControls;
