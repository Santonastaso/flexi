import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { toDateString, isTaskOverlapping } from '../utils/dateUtils';

function CalendarGrid({ machineId, currentDate, currentView }) {
  const [availabilityData, setAvailabilityData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  const machines = useStore(state => state.machines);
  const odpOrders = useStore(state => state.odpOrders);
  const getMachineAvailability = useStore(state => state.getMachineAvailability);
  const toggleMachineHourAvailability = useStore(state => state.toggleMachineHourAvailability);
  const showAlert = useStore(state => state.showAlert);
  
  const machine = machines.find(m => m.id === machineId);

  // Load availability data for the current view
  useEffect(() => {
    const loadData = async () => {
      if (!machineId) return;
      
      const dateStr = toDateString(currentDate);
      setIsLoading(true);
      try {
        const data = await getMachineAvailability(machineId, dateStr);
        if (data && Array.isArray(data)) {
          setAvailabilityData(prev => ({
            ...prev,
            [dateStr]: data
          }));
        }
      } catch (error) {
        console.error('Error loading availability data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [machineId, currentDate, currentView, getMachineAvailability]);

  // Check if a time slot has scheduled tasks
  const hasScheduledTask = (dateStr, hour) => {
    if (!machine) return false;
    
    const scheduledTasks = odpOrders.filter(task => 
      task.status === 'SCHEDULED' && 
      task.scheduled_machine_id === machine.id
    );
    
    // Debug logging for the first few hours
    if (hour < 3 && scheduledTasks.length > 0) {
      console.log(`CalendarGrid: Checking scheduled tasks for ${dateStr} hour ${hour}`);
      console.log(`CalendarGrid: Found ${scheduledTasks.length} scheduled tasks`);
      scheduledTasks.forEach(task => {
        console.log(`CalendarGrid: Task ${task.odp_number}: ${task.scheduled_start_time} to ${task.scheduled_end_time}`);
      });
    }
    
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
        console.error('Machine not found:', machineId);
        return;
      }
      
      console.log(`Toggling hour ${hour} for ${dateStr} on machine ${machine.id}`);
      await toggleMachineHourAvailability(machine.id, dateStr, hour);
      
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
              const dateStr = toDateString(day);
              const unavailableHours = availabilityData[dateStr] || [];
              // Convert hour to string for comparison since the database stores them as strings
              const hourStr = hour.toString();
              const isUnavailable = unavailableHours.includes(hourStr);
              const hasScheduled = hasScheduledTask(dateStr, hour);
              
              // Debug logging for the first few hours and first few days
              if (hour < 3 && days.indexOf(day) < 3) {
                console.log(`CalendarGrid: Day ${day.toDateString()} -> dateStr: ${dateStr}, hour: ${hour}, hasScheduled: ${hasScheduled}`);
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
                  
                  const dateStr = toDateString(new Date(year, monthIndex, day));
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
