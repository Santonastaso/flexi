import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMachineStore, useOrderStore, useSchedulerStore, useUIStore } from '../store';
import {
  toDateString,
  isTaskOverlapping,
  getStartOfWeek
} from '../utils/dateUtils';
import { useErrorHandler } from '../hooks';

function CalendarGrid({ machineId, currentDate, currentView, refreshTrigger }) {
  const [isLoading, setIsLoading] = useState(false);
  const [updatingSlots, setUpdatingSlots] = useState({}); // State to track loading slots
  
  const { machines } = useMachineStore();
  const { odpOrders } = useOrderStore();
  const { machineAvailability, loadMachineAvailabilityForDateRange, toggleMachineHourAvailability } = useSchedulerStore();
  const { showAlert } = useUIStore();
  
  // Use unified error handling
  const { handleAsync: _handleAsync } = useErrorHandler('CalendarGrid');
  
  const machine = machines.find(m => m.id === machineId);



  // Optimized date range generation
  const dateRange = useMemo(() => {
    if (!currentDate) return { dates: [], dateStrings: [] };
    
    let dates = [];
    let dateStrings = [];
    
    if (currentView === 'Month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const currentDateObj = new Date(firstDay);
      while (currentDateObj <= lastDay) {
        dates.push(new Date(currentDateObj));
        dateStrings.push(toDateString(currentDateObj));
        currentDateObj.setDate(currentDateObj.getDate() + 1);
      }
    } else if (currentView === 'Week') {
      const startOfWeek = getStartOfWeek(currentDate);
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        dates.push(day);
        dateStrings.push(toDateString(day));
      }
    } else if (currentView === 'Year') {
      const year = currentDate.getFullYear();
      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const dateObj = new Date(year, month, day);
          dates.push(dateObj);
          dateStrings.push(toDateString(dateObj));
        }
      }
    } else {
      // Day view
      dates.push(currentDate);
      dateStrings.push(toDateString(currentDate));
    }
    
    return { dates, dateStrings };
  }, [currentDate, currentView]);

  // Simple data loading - just load what's needed from the store
  useEffect(() => {
    const loadData = async () => {
      if (!machineId || !dateRange.dateStrings.length) return;
      
      setIsLoading(true);
      try {
        const firstDateStr = dateRange.dateStrings[0];
        const lastDateStr = dateRange.dateStrings[dateRange.dateStrings.length - 1];
        
        await loadMachineAvailabilityForDateRange(machineId, firstDateStr, lastDateStr);
      } catch (error) {
        console.error('Failed to load machine availability data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [machineId, dateRange.dateStrings, loadMachineAvailabilityForDateRange, refreshTrigger]);

  // Memoized scheduled tasks for the current machine to avoid repeated filtering
  const scheduledTasksForMachine = useMemo(() => {
    if (!machine) return [];
    return odpOrders.filter(task => 
      task.status === 'SCHEDULED' && 
      task.scheduled_machine_id === machine.id
    );
  }, [machine, odpOrders]);

  // Check if a time slot has scheduled tasks
  const hasScheduledTask = useCallback((dateStr, hour) => {
    if (!machine || scheduledTasksForMachine.length === 0) return false;
    
    // Use the memoized scheduled tasks instead of filtering every time
    return scheduledTasksForMachine.some(task => isTaskOverlapping(task, dateStr, hour));
  }, [machine, scheduledTasksForMachine]);

  // Direct access to store data - no need for local state
  const getAvailabilityForDate = useCallback((dateStr) => {
    const dateData = machineAvailability[dateStr];
    if (Array.isArray(dateData)) {
      const machineData = dateData.find(item => item.machine_id === machineId);
      if (machineData && machineData.unavailable_hours) {
        // Ensure we return an array of strings for consistent comparison
        return Array.isArray(machineData.unavailable_hours) 
          ? machineData.unavailable_hours.map(h => h.toString())
          : [];
      }
    }
    return [];
  }, [machineAvailability, machineId]);

  const handleTimeSlotClick = useCallback(async (dateStr, hour) => {
    if (hasScheduledTask(dateStr, hour)) {
      showAlert('Cannot mark time slot as unavailable - it has scheduled tasks', 'error');
      return;
    }
    
    if (!machine) {
      return;
    }

    const slotKey = `${dateStr}-${hour}`;
    setUpdatingSlots(prev => ({ ...prev, [slotKey]: true })); // Show loading for this slot

    try {
      await toggleMachineHourAvailability(machine.id, dateStr, hour);
      // On success, the store update will trigger a re-render automatically.
    } catch (error) {
      console.error('Failed to toggle machine hour availability:', error);
      showAlert('An unexpected error occurred.', 'error');
    } finally {
      setUpdatingSlots(prev => ({ ...prev, [slotKey]: false })); // Hide loading for this slot
    }
  }, [hasScheduledTask, showAlert, machine, toggleMachineHourAvailability]);

  const renderMonthView = useCallback(() => {
    const { dates } = dateRange;
    if (dates.length === 0) return null;
    
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return (
      <div className="calendar-month-grid">
        <div className="calendar-week-header">
          {weekDays.map(day => (
            <div key={day} className="week-day-header">{day}</div>
          ))}
        </div>
        
        <div className="calendar-days-grid">
          {dates.map((date) => {
            const dateStr = toDateString(date);
            const unavailableHours = getAvailabilityForDate(dateStr);
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isToday = date.toDateString() === new Date().toDateString();
            
            // Check if any hours on this day have scheduled tasks
            const hasScheduledTasks = Array.from({ length: 24 }, (_, hour) => hour).some(hour => 
              hasScheduledTask(dateStr, hour)
            );
            
            let dayClass = 'calendar-day';
            if (!isCurrentMonth) dayClass += ' other-month';
            if (isToday) dayClass += ' today';
            if (unavailableHours.length > 0) {
              dayClass += unavailableHours.length === 24 ? ' unavailable' : ' partially-unavailable';
            }
            if (hasScheduledTasks) {
              dayClass += ' has-scheduled-tasks';
            }
            
            return (
              <div key={dateStr} className={dayClass}>
                <span className="day-number">{date.getDate()}</span>
                {unavailableHours.length > 0 && (
                  <div className="availability-indicator">
                    {unavailableHours.length === 24 ? 'All Day' : `${unavailableHours.length}h`}
                  </div>
                )}
                {hasScheduledTasks && (
                  <div className="scheduled-tasks-indicator">
                    📋
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [dateRange, getAvailabilityForDate, currentDate, hasScheduledTask]);

  const renderWeekView = useCallback(() => {
    const { dates } = dateRange;
    if (dates.length === 0) return null;
    
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="calendar-week-grid">
        <div className="time-column-header">
          <div className="time-header-cell">Time</div>
          {dates.map(day => (
            <div key={day.toISOString()} className="day-header-cell">
              {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
        
        {hours.map(hour => (
          <div key={hour} className="time-row">
            <div className="time-label">{hour.toString().padStart(2, '0')}:00</div>
            {dates.map(day => {
              const dateStr = toDateString(day);
              const unavailableHours = getAvailabilityForDate(dateStr);
              const hourStr = hour.toString();
              const isUnavailable = unavailableHours.includes(hourStr);
              const hasScheduled = hasScheduledTask(dateStr, hour);
              const slotKey = `${dateStr}-${hour}`;
              const isUpdating = updatingSlots[slotKey];
              
              let slotClass = 'time-slot';
              if (isUnavailable) slotClass += ' unavailable';
              if (hasScheduled) slotClass += ' has-scheduled-task';
              if (isUpdating) slotClass += ' updating'; // Style for the loading state

              return (
                <div
                  key={`${dateStr}-${hour}`}
                  className={slotClass}
                  onClick={() => !isUpdating && handleTimeSlotClick(dateStr, hour)} // Prevent clicks while updating
                >
                  <div className="time-slot-content">
                    {isUpdating ? '...' : isUnavailable ? '❌' : hasScheduled ? '📋' : '✓'}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }, [dateRange, getAvailabilityForDate, hasScheduledTask, handleTimeSlotClick, updatingSlots]);

  const renderYearView = useCallback(() => {
    const year = currentDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i);
    
    return (
      <div className="calendar-year-grid">
        {months.map(monthIndex => {
          const monthDate = new Date(year, monthIndex, 1);
          const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          const firstDayOfMonth = new Date(year, monthIndex, 1).getDay();
          
          const days = [];
          for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(null);
          }
          for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
          }
          
          return (
            <div key={monthIndex} className="month-mini-calendar">
              <h4>{monthName}</h4>
              <div className="mini-month-grid">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, dayIndex) => (
                  <div key={`${monthIndex}-${dayIndex}-${day}`} className="mini-day-header">{day}</div>
                ))}
                {days.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${monthIndex}-${index}`} className="mini-day empty"></div>;
                  }
                  
                  const dateStr = toDateString(new Date(year, monthIndex, day));
                  const unavailableHours = getAvailabilityForDate(dateStr);
                  const hasUnavailableHours = unavailableHours.length > 0;
                  
                  return (
                    <div
                      key={dateStr}
                      className={`mini-day ${hasUnavailableHours ? 'unavailable' : ''}`}
                      title={hasUnavailableHours ? `${unavailableHours.length} unavailable hours` : 'Available'}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [currentDate, getAvailabilityForDate]);

  // Early return if machine is not found (after all hooks are called)
  if (!machine) {
    return <div className="loading">Loading machine data...</div>;
  }

  if (isLoading) {
    return <div className="loading">Loading calendar data...</div>;
  }

  return (
    <div className="calendar-grid-container">
      {currentView === 'Month' && renderMonthView()}
      {currentView === 'Week' && renderWeekView()}
      {currentView === 'Year' && renderYearView()}
    </div>
  );
}

export default CalendarGrid;
