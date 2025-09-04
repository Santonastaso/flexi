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
    <div className="flex flex-col sm:flex-row justify-between items-center mb-3 p-2 bg-gray-50 rounded-lg border">
      <div className="flex items-center space-x-2 mb-4 sm:mb-0">
        <button 
          className="inline-flex items-center px-2 py-1 border border-gray-300 rounded shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
          onClick={goToPrevious}
          aria-label="Previous"
        >
          ← Precedente
        </button>
        
        <button 
          className="inline-flex items-center px-2 py-1 border border-gray-300 rounded shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
          onClick={goToToday}
        >
          Oggi
        </button>
        
        <button 
          className="inline-flex items-center px-2 py-1 border border-gray-300 rounded shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
          onClick={goToNext}
          aria-label="Next"
        >
          Successivo →
        </button>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                     <h3 className="text-xs font-semibold text-gray-900">{getCurrentPeriodLabel()}</h3>
        
        <select 
          value={currentView} 
          onChange={(e) => onViewChange(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
