import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

function CalendarGrid({ machineName, currentDate, currentView }) {
  const [availabilityData, setAvailabilityData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  const loadMachineAvailabilityForDateRange = useStore(state => state.loadMachineAvailabilityForDateRange);
  const toggleMachineHourAvailability = useStore(state => state.toggleMachineHourAvailability);
  const getMachineAvailability = useStore(state => state.getMachineAvailability);
  const odpOrders = useStore(state => state.odpOrders);
  const machines = useStore(state => state.machines);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        let startDate, endDate;
        
        if (currentView === 'Month') {
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        } else if (currentView === 'Week') {
          const startOfWeek = new Date(currentDate);
          startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
          startDate = startOfWeek;
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endDate = endOfWeek;
        } else if (currentView === 'Year') {
          startDate = new Date(currentDate.getFullYear(), 0, 1);
          endDate = new Date(currentDate.getFullYear(), 11, 31);
        }
        
        // Load data for each date individually to ensure proper structure
        const availabilityByDate = {};
        const current = new Date(startDate);
        
        while (current <= endDate) {
          const dateStr = current.toISOString().split('T')[0];
          try {
            const data = await getMachineAvailability(machineName, dateStr);
            // Ensure we always have strings for comparison
            availabilityByDate[dateStr] = (data || []).map(h => h.toString());
            console.log(`Loaded data for ${dateStr}:`, data);
          } catch (error) {
            console.warn(`Failed to load data for ${dateStr}:`, error);
            availabilityByDate[dateStr] = [];
          }
          current.setDate(current.getDate() + 1);
        }
        
        console.log('Final availability data:', availabilityByDate);
        setAvailabilityData(availabilityByDate);
      } catch (error) {
        console.error('Error loading availability data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [machineName, currentDate, currentView, getMachineAvailability]);

  // Check if a time slot has scheduled tasks
  const hasScheduledTask = (dateStr, hour) => {
    const machine = machines.find(m => m.machine_name === machineName);
    if (!machine) return false;
    
    const scheduledTasks = odpOrders.filter(task => 
      task.status === 'SCHEDULED' && 
      task.scheduled_machine_id === machine.id
    );
    
    return scheduledTasks.some(task => {
      const taskStart = new Date(task.scheduled_start_time);
      const taskEnd = new Date(task.scheduled_end_time);
      const slotStart = new Date(dateStr);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + 1, 0, 0, 0);
      
      // Check if the task overlaps with this hour slot
      return taskStart < slotEnd && taskEnd > slotStart;
    });
  };

  const handleTimeSlotClick = async (dateStr, hour) => {
    // Check if slot has scheduled tasks
    if (hasScheduledTask(dateStr, hour)) {
      alert('Cannot mark time slot as unavailable - it has scheduled tasks');
      return;
    }
    
    try {
      console.log(`Toggling hour ${hour} for ${dateStr} on machine ${machineName}`);
      await toggleMachineHourAvailability(machineName, dateStr, hour);
      
      // Update local state immediately for responsive UI
      setAvailabilityData(prev => {
        const newData = { ...prev };
        if (!newData[dateStr]) newData[dateStr] = [];
        
        const currentHours = [...newData[dateStr]];
        const hourStr = hour.toString();
        
        if (currentHours.includes(hourStr)) {
          newData[dateStr] = currentHours.filter(h => h !== hourStr);
          console.log(`Removed hour ${hourStr}, new array:`, newData[dateStr]);
        } else {
          newData[dateStr] = [...currentHours, hourStr].sort((a, b) => parseInt(a) - parseInt(b));
          console.log(`Added hour ${hourStr}, new array:`, newData[dateStr]);
        }
        
        return newData;
      });
    } catch (error) {
      console.error('Error toggling time slot:', error);
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
            const dateStr = date.toISOString().split('T')[0];
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
              <div key={index} className={dayClass}>
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
              const dateStr = day.toISOString().split('T')[0];
              const unavailableHours = availabilityData[dateStr] || [];
              // Convert hour to string for comparison since the database stores them as strings
              const hourStr = hour.toString();
              const isUnavailable = unavailableHours.includes(hourStr);
              const hasScheduled = hasScheduledTask(dateStr, hour);
              
              // Debug logging for the first few hours
              if (hour < 3) {
                console.log(`Hour ${hour} for ${dateStr}: unavailableHours=${unavailableHours}, hourStr=${hourStr}, isUnavailable=${isUnavailable}, hasScheduled=${hasScheduled}`);
              }
              
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
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                  <div key={day} className="mini-day-header">{day}</div>
                ))}
                {days.map((day, index) => {
                  if (day === null) {
                    return <div key={index} className="mini-day empty"></div>;
                  }
                  
                  const dateStr = new Date(year, monthIndex, day).toISOString().split('T')[0];
                  const unavailableHours = availabilityData[dateStr] || [];
                  const hasUnavailableHours = unavailableHours.length > 0;
                  
                  return (
                    <div
                      key={index}
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
