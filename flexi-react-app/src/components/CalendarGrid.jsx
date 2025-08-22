import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  toDateString,
  isTaskOverlapping,
  getStartOfWeek,
  getEndOfWeek
} from '../utils/dateUtils';

function CalendarGrid({ machineId, currentDate, currentView, refreshTrigger }) {
  const [availabilityData, setAvailabilityData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  const machines = useStore(state => state.machines);
  const odpOrders = useStore(state => state.odpOrders);
  const machineAvailability = useStore(state => state.machineAvailability);
  const getMachineAvailability = useStore(state => state.getMachineAvailability);
  const loadMachineAvailabilityForDateRange = useStore(state => state.loadMachineAvailabilityForDateRange);
  const toggleMachineHourAvailability = useStore(state => state.toggleMachineHourAvailability);
  const showAlert = useStore(state => state.showAlert);
  
  const machine = machines.find(m => m.id === machineId);

  // Sync local state with store state when machineAvailability changes
  useEffect(() => {
    if (!machineId || !machineAvailability) return;
    
    // Extract data for the current view dates from the store
    const syncDataFromStore = () => {
      const organizedData = {};
      
      if (currentView === 'Month') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Process all dates in the month view
        const currentDateObj = new Date(firstDay);
        while (currentDateObj <= lastDay) {
          const dateStr = toDateString(currentDateObj);
          const storeData = machineAvailability[dateStr];
          if (storeData && Array.isArray(storeData)) {
            const machineData = storeData.find(item => item.machine_id === machineId);
            if (machineData && machineData.unavailable_hours) {
              organizedData[dateStr] = machineData.unavailable_hours;
            }
          }
          currentDateObj.setDate(currentDateObj.getDate() + 1);
        }
      } else if (currentView === 'Week') {
        const startOfWeek = getStartOfWeek(currentDate);
        for (let i = 0; i < 7; i++) {
          const day = new Date(startOfWeek);
          day.setDate(startOfWeek.getDate() + i);
          const dateStr = toDateString(day);
          const storeData = machineAvailability[dateStr];
          if (storeData && Array.isArray(storeData)) {
            const machineData = storeData.find(item => item.machine_id === machineId);
            if (machineData && machineData.unavailable_hours) {
              organizedData[dateStr] = machineData.unavailable_hours;
            }
          }
        }
      } else if (currentView === 'Year') {
        // Year view - sync data for the entire year
        const year = currentDate.getFullYear();
        for (let month = 0; month < 12; month++) {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dateStr = toDateString(dateObj);
            const storeData = machineAvailability[dateStr];
            if (storeData && Array.isArray(storeData)) {
              const machineData = storeData.find(item => item.machine_id === machineId);
              if (machineData && machineData.unavailable_hours) {
                organizedData[dateStr] = machineData.unavailable_hours;
              }
            }
          }
        }
      } else {
        // Day view - just sync the current date
        const dateStr = toDateString(currentDate);
        const storeData = machineAvailability[dateStr];
        if (storeData && Array.isArray(storeData)) {
          const machineData = storeData.find(item => item.machine_id === machineId);
          if (machineData && machineData.unavailable_hours) {
            organizedData[dateStr] = machineData.unavailable_hours;
          }
        }
      }
      
      setAvailabilityData(organizedData);
    };
    
    syncDataFromStore();
  }, [machineId, currentDate, currentView, machineAvailability]);

  // Load availability data for the current view
  useEffect(() => {
    const loadData = async () => {
      if (!machineId) return;
      
      setIsLoading(true);
      try {
        if (currentView === 'Month') {
          // For month view, load data for the entire month
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          
          // Convert to date strings without timezone using toDateString
          const firstDayStr = toDateString(firstDay);
          const lastDayStr = toDateString(lastDay);
          
          // Load data for the month range using date strings
          const monthData = await loadMachineAvailabilityForDateRange(machineId, firstDayStr, lastDayStr);
          
          // Process the month data and organize by date
          if (monthData && Array.isArray(monthData)) {
            const organizedData = {};
            monthData.forEach(item => {
              if (item.date && item.unavailable_hours) {
                // Convert date to the format expected by toDateString
                const dateObj = new Date(item.date);
                const dateStr = toDateString(dateObj);
                organizedData[dateStr] = item.unavailable_hours;
              }
            });
            
            // Merge with store data (store data takes priority)
            const mergedData = { ...organizedData };
            if (machineAvailability) {
              Object.keys(machineAvailability).forEach(dateStr => {
                const storeData = machineAvailability[dateStr];
                if (storeData && Array.isArray(storeData)) {
                  const machineData = storeData.find(item => item.machine_id === machineId);
                  if (machineData && machineData.unavailable_hours) {
                    mergedData[dateStr] = machineData.unavailable_hours;
                  }
                }
              });
            }
            
            setAvailabilityData(mergedData);
          }
        } else if (currentView === 'Week') {
          // For week view, load data for the entire week
          const startOfWeek = getStartOfWeek(currentDate);
          const endOfWeek = getEndOfWeek(currentDate);
          
          // Convert to date strings without timezone using toDateString
          const startOfWeekStr = toDateString(startOfWeek);
          const endOfWeekStr = toDateString(endOfWeek);
          
          // Load data for the week range
          const weekData = await loadMachineAvailabilityForDateRange(machineId, startOfWeekStr, endOfWeekStr);
          
          // Process the week data and organize by date
          if (weekData && Array.isArray(weekData)) {
            const organizedData = {};
            weekData.forEach(item => {
              if (item.date && item.unavailable_hours) {
                // Convert date to the format expected by toDateString
                const dateObj = new Date(item.date);
                const dateStr = toDateString(dateObj);
                organizedData[dateStr] = item.unavailable_hours;
              }
            });
            
            // Merge with store data (store data takes priority)
            const mergedData = { ...organizedData };
            if (machineAvailability) {
              Object.keys(machineAvailability).forEach(dateStr => {
                const storeData = machineAvailability[dateStr];
                if (storeData && Array.isArray(storeData)) {
                  const machineData = storeData.find(item => item.machine_id === machineId);
                  if (machineData && machineData.unavailable_hours) {
                    mergedData[dateStr] = machineData.unavailable_hours;
                  }
                }
              });
            }
            
            setAvailabilityData(mergedData);
          }
        } else if (currentView === 'Year') {
          // For year view, load data for the entire year
          const year = currentDate.getFullYear();
          const firstDay = new Date(year, 0, 1); // January 1st
          const lastDay = new Date(year, 11, 31); // December 31st
          
          // Convert to date strings without timezone using toDateString
          const firstDayStr = toDateString(firstDay);
          const lastDayStr = toDateString(lastDay);
          
          // Load data for the year range using date strings
          const yearData = await loadMachineAvailabilityForDateRange(machineId, firstDayStr, lastDayStr);
          
          // Process the year data and organize by date
          if (yearData && Array.isArray(yearData)) {
            const organizedData = {};
            yearData.forEach(item => {
              if (item.date && item.unavailable_hours) {
                // Convert date to the format expected by toDateString
                const dateObj = new Date(item.date);
                const dateStr = toDateString(dateObj);
                organizedData[dateStr] = item.unavailable_hours;
              }
            });
            
            // Merge with store data (store data takes priority)
            const mergedData = { ...organizedData };
            if (machineAvailability) {
              Object.keys(machineAvailability).forEach(dateStr => {
                const storeData = machineAvailability[dateStr];
                if (storeData && Array.isArray(storeData)) {
                  const machineData = storeData.find(item => item.machine_id === machineId);
                  if (machineData && machineData.unavailable_hours) {
                    mergedData[dateStr] = machineData.unavailable_hours;
                  }
                }
              });
            }
            
            setAvailabilityData(mergedData);
          }
        } else {
          // For other views (like Day), load data for the specific date
          const dateStr = toDateString(currentDate);
          const data = await getMachineAvailability(machineId, dateStr);
          if (data && Array.isArray(data)) {
            // Merge with store data (store data takes priority)
            let finalData = data;
            if (machineAvailability && machineAvailability[dateStr]) {
              const storeData = machineAvailability[dateStr];
              if (Array.isArray(storeData)) {
                const machineData = storeData.find(item => item.machine_id === machineId);
                if (machineData && machineData.unavailable_hours) {
                  finalData = machineData.unavailable_hours;
                }
              }
            }
            
            setAvailabilityData(prev => ({
              ...prev,
              [dateStr]: finalData
            }));
          }
        }
      } catch (error) {
        // Handle error silently
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [machineId, currentDate, currentView, refreshTrigger, machineAvailability, getMachineAvailability, loadMachineAvailabilityForDateRange]);

  // Check if a time slot has scheduled tasks
  const hasScheduledTask = (dateStr, hour) => {
    if (!machine) return false;
    
    const scheduledTasks = odpOrders.filter(task => 
      task.status === 'SCHEDULED' && 
      task.scheduled_machine_id === machine.id
    );
    
    // Debug logging removed for production
    
    return scheduledTasks.some(task => isTaskOverlapping(task, dateStr, hour));
  };

  const handleTimeSlotClick = async (dateStr, hour) => {
    // Check if slot has scheduled tasks
    if (hasScheduledTask(dateStr, hour)) {
      showAlert('Cannot mark time slot as unavailable - it has scheduled tasks', 'error');
      return;
    }
    
    try {
      if (!machine) {
        return;
      }
      
      await toggleMachineHourAvailability(machine.id, dateStr, hour);
      
      // The store sync useEffect will automatically update the local state
      // No need to manually update local state here
    } catch (error) {
      // Handle error silently
    }
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDateObj = new Date(startDate);
    
    while (currentDateObj <= lastDay || days.length < 42) {
      days.push(new Date(currentDateObj));
      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }
    
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return (
      <div className="calendar-month-grid">
        <div className="calendar-week-header">
          {weekDays.map(day => (
            <div key={day} className="week-day-header">{day}</div>
          ))}
        </div>
        
        <div className="calendar-days-grid">
          {days.map((date, index) => {
            const dateStr = toDateString(date);
            const unavailableHours = availabilityData[dateStr] || [];
            const isCurrentMonth = date.getMonth() === month;
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
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="calendar-week-grid">
        <div className="time-column-header">
          <div className="time-header-cell">Time</div>
          {days.map(day => (
            <div key={day.toISOString()} className="day-header-cell">
              {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
        
        {hours.map(hour => (
          <div key={hour} className="time-row">
            <div className="time-label">{hour.toString().padStart(2, '0')}:00</div>
            {days.map(day => {
              const dateStr = toDateString(day);
              const unavailableHours = availabilityData[dateStr] || [];
              // Convert hour to string for comparison since the database stores them as strings
              const hourStr = hour.toString();
              const isUnavailable = unavailableHours.includes(hourStr);
              const hasScheduled = hasScheduledTask(dateStr, hour);
              
              // Debug logging removed for production
              
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
  };

  const renderYearView = () => {
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
                  const unavailableHours = availabilityData[dateStr] || [];
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
  };

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
