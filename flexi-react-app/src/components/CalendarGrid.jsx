import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMachineStore, useOrderStore, useSchedulerStore, useUIStore } from '../store';
import {
  toDateString,
  isTaskOverlapping,
  getStartOfWeek,
  getEndOfWeek
} from '../utils/dateUtils';
import { useErrorHandler } from '../hooks';

function CalendarGrid({ machineId, currentDate, currentView, refreshTrigger }) {
  const [availabilityData, setAvailabilityData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { machines } = useMachineStore();
  const { odpOrders } = useOrderStore();
  const { machineAvailability, getMachineAvailability, loadMachineAvailabilityForDateRange, toggleMachineHourAvailability } = useSchedulerStore();
  const { showAlert } = useUIStore();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('CalendarGrid');
  
  const machine = machines.find(m => m.id === machineId);
  
  // Early return if machine is not found
  if (!machine) {
    return <div className="loading">Loading machine data...</div>;
  }

  // Optimized data processing with Map for O(1) lookups
  const processedAvailabilityData = useMemo(() => {
    if (!machineId || !machineAvailability) return {};
    
    const organizedData = {};
    
    // Create a Map for O(1) machine data lookups
    const machineDataMap = new Map();
    
    // Process all dates in machineAvailability once
    Object.entries(machineAvailability).forEach(([dateStr, dateData]) => {
      if (Array.isArray(dateData)) {
        // Find machine data once per date
        const machineData = dateData.find(item => item.machine_id === machineId);
        if (machineData && machineData.unavailable_hours) {
          organizedData[dateStr] = machineData.unavailable_hours;
          machineDataMap.set(dateStr, machineData);
        }
      }
    });
    
    return { organizedData, machineDataMap };
  }, [machineId, machineAvailability]);

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

  // Sync local state with store state when machineAvailability changes
  useEffect(() => {
    if (!machineId || !machineAvailability) return;
    
    // Use the optimized data processing
    const { organizedData } = processedAvailabilityData;
    setAvailabilityData(organizedData);
  }, [machineId, machineAvailability, processedAvailabilityData]);

  // Load availability data for the current view
  useEffect(() => {
    const loadData = async () => {
      if (!machineId) return;
      
      setIsLoading(true);
      
      try {
        // Use the optimized date range
        const { dateStrings } = dateRange;
        if (dateStrings.length === 0) {
          setIsLoading(false);
          return;
        }
        
        // Load data for the entire range at once
        const firstDateStr = dateStrings[0];
        const lastDateStr = dateStrings[dateStrings.length - 1];
        
        const rangeData = await loadMachineAvailabilityForDateRange(machineId, firstDateStr, lastDateStr);
        
        // Process the range data efficiently
        if (rangeData && Array.isArray(rangeData)) {
          const organizedData = {};
          
          // Process range data once
          rangeData.forEach(item => {
            if (item.date && item.unavailable_hours) {
              const dateObj = new Date(item.date);
              const dateStr = toDateString(dateObj);
              organizedData[dateStr] = item.unavailable_hours;
            }
          });
          
          // Merge with store data efficiently using the Map
          const { machineDataMap } = processedAvailabilityData;
          const mergedData = { ...organizedData };
          
          // Use the Map for O(1) lookups instead of nested loops
          dateStrings.forEach(dateStr => {
            const storeMachineData = machineDataMap.get(dateStr);
            if (storeMachineData && storeMachineData.unavailable_hours) {
              mergedData[dateStr] = storeMachineData.unavailable_hours;
            }
          });
          
          setAvailabilityData(mergedData);
        }
      } catch (error) {
        console.error('Failed to load machine availability data:', error);
        // Handle error silently for now
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [machineId, dateRange, processedAvailabilityData, loadMachineAvailabilityForDateRange]);

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

  // Memoized availability lookup for O(1) access
  const availabilityLookup = useMemo(() => {
    return new Map(Object.entries(availabilityData));
  }, [availabilityData]);

  // Optimized function to get availability for a specific date
  const getAvailabilityForDate = useCallback((dateStr) => {
    return availabilityLookup.get(dateStr) || [];
  }, [availabilityLookup]);

  const handleTimeSlotClick = useCallback(async (dateStr, hour) => {
    // Check if slot has scheduled tasks
    if (hasScheduledTask(dateStr, hour)) {
      showAlert('Cannot mark time slot as unavailable - it has scheduled tasks', 'error');
      return;
    }
    
    if (!machine) {
      return;
    }
    
    try {
      await toggleMachineHourAvailability(machine.id, dateStr, hour);
      // The store sync useEffect will automatically update the local state
      // No need to manually update local state here
    } catch (error) {
      console.error('Failed to toggle machine hour availability:', error);
      showAlert('Failed to toggle machine hour availability', 'error');
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
          {dates.map((date, index) => {
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
              // Convert hour to string for comparison since the database stores them as strings
              const hourStr = hour.toString();
              const isUnavailable = unavailableHours.includes(hourStr);
              const hasScheduled = hasScheduledTask(dateStr, hour);
              
              let slotClass = 'time-slot';
              if (isUnavailable) slotClass += ' unavailable';
              if (hasScheduled) slotClass += ' has-scheduled-task';
              
              return (
                <div
                  key={`${dateStr}-${hour}`}
                  className={slotClass}
                  onClick={() => handleTimeSlotClick(dateStr, hour)}
                >
                  <div className="time-slot-content">
                    {isUnavailable ? '❌' : hasScheduled ? '📋' : '✓'}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }, [dateRange, getAvailabilityForDate, hasScheduledTask, handleTimeSlotClick]);

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
