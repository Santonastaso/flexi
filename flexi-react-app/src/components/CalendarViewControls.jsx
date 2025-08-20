import React from 'react';
import { getStartOfWeek, getEndOfWeek, addDaysToDate } from '../utils/dateUtils';

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
      newDate = addDaysToDate(currentDate, -7);
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
      newDate = addDaysToDate(currentDate, 7);
    } else if (currentView === 'Year') {
      newDate = new Date(currentDate);
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    onDateChange(newDate);
  };

  const getCurrentPeriodLabel = () => {
    if (currentView === 'Month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (currentView === 'Week') {
      const startOfWeek = getStartOfWeek(currentDate);
      const endOfWeek = getEndOfWeek(currentDate);
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (currentView === 'Year') {
      return currentDate.getFullYear().toString();
    }
    return '';
  };

  return (
    <div className="calendar-controls-container">
      <div className="calendar-navigation">
        <button 
          className="btn btn-secondary"
          onClick={goToPrevious}
          aria-label="Previous"
        >
          ← Previous
        </button>
        
        <button 
          className="btn btn-primary"
          onClick={goToToday}
        >
          Today
        </button>
        
        <button 
          className="btn btn-secondary"
          onClick={goToNext}
          aria-label="Next"
        >
          Next →
        </button>
      </div>
      
      <div className="calendar-view-selector">
        <h3>{getCurrentPeriodLabel()}</h3>
        
        <select 
          value={currentView} 
          onChange={(e) => onViewChange(e.target.value)}
          className="form-select"
        >
          <option value="Month">Month</option>
          <option value="Week">Week</option>
          <option value="Year">Year</option>
        </select>
      </div>
    </div>
  );
}

export default CalendarViewControls;
