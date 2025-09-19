import React, { useState, useEffect, useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useMachineStore, useOrderStore, useSchedulerStore, useUIStore } from '../store';
import { format, parseISO } from 'date-fns';
import { useErrorHandler } from '../hooks';
import { AppConfig } from '../services/config';

function FullCalendarGrid({ machineId, refreshTrigger }) {
  const [isLoading, setIsLoading] = useState(false);
  const [updatingSlots, setUpdatingSlots] = useState({});
  const calendarRef = React.useRef(null);
  
  const { machines } = useMachineStore();
  const { odpOrders } = useOrderStore();
  const { machineAvailability, loadMachineAvailabilityForDateRange, toggleMachineHourAvailability, getTaskOccupiedSegments } = useSchedulerStore();
  const { showAlert } = useUIStore();
  
  const { handleAsync } = useErrorHandler('FullCalendarGrid');
  
  const machine = machines.find(m => m.id === machineId);

  // Helper function to get actual task segments
  const getTaskSegments = useCallback((task) => {
    try {
      // Try to get segments from the split task manager
      const segments = getTaskOccupiedSegments(task);
      if (segments && segments.length > 0) {
        return segments;
      }
      
      // Fallback: if no segments found, create a single segment from scheduled times
      if (task.scheduled_start_time && task.scheduled_end_time) {
        return [{
          start: new Date(task.scheduled_start_time),
          end: new Date(task.scheduled_end_time),
          duration: (new Date(task.scheduled_end_time).getTime() - new Date(task.scheduled_start_time).getTime()) / (1000 * 60 * 60)
        }];
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to get task segments:', error);
      return [];
    }
  }, [getTaskOccupiedSegments]);



  // Convert scheduled tasks to FullCalendar events (showing actual segments)
  const scheduledEvents = useMemo(() => {
    if (!machine) return [];
    
    const events = [];
    
    odpOrders
      .filter(task => 
        task.status === 'SCHEDULED' && 
        task.scheduled_machine_id === machine.id &&
        task.scheduled_start_time &&
        task.scheduled_end_time
      )
      .forEach(task => {
        // Get the actual segments for this task
        const segments = getTaskSegments(task);
        
        segments.forEach((segment, index) => {
          const isSplitTask = segments.length > 1;
          events.push({
            id: `${task.id}-segment-${index}`,
            title: `${task.odp_number} - ${task.article_code}${isSplitTask ? ` (${index + 1}/${segments.length})` : ''}`,
            start: segment.start,
            end: segment.end,
            backgroundColor: isSplitTask ? '#8b5cf6' : '#3b82f6', // Purple for split tasks, blue for single
            borderColor: isSplitTask ? '#7c3aed' : '#2563eb',
            textColor: '#ffffff',
            extendedProps: {
              taskId: task.id,
              odpNumber: task.odp_number,
              articleCode: task.article_code,
              quantity: task.quantity,
              status: task.status,
              segmentIndex: index,
              totalSegments: segments.length,
              isSplitTask: isSplitTask
            }
          });
        });
      });
    
    return events;
  }, [machine, odpOrders, getTaskSegments]);

  // Convert machine availability to FullCalendar events
  const availabilityEvents = useMemo(() => {
    if (!machineAvailability || !machine) return [];
    
    const events = [];
    
    Object.entries(machineAvailability).forEach(([dateStr, dateData]) => {
      if (Array.isArray(dateData)) {
        const machineData = dateData.find(item => item.machine_id === machineId);
        if (machineData && machineData.unavailable_hours) {
          const unavailableHours = Array.isArray(machineData.unavailable_hours) 
            ? machineData.unavailable_hours 
            : [];
          
          unavailableHours.forEach(hour => {
            const hourInt = parseInt(hour);
            
            // Only render hours between 6:00 and 22:00 (same as Gantt chart)
            if (hourInt < 6 || hourInt >= 22) {
              return;
            }
            
            // Simple date creation - same logic as Gantt chart
            const startTime = new Date(dateStr);
            startTime.setUTCHours(hourInt, 0, 0, 0);
            
            const endTime = new Date(startTime);
            endTime.setUTCHours(hourInt + 1, 0, 0, 0);
            
            events.push({
              id: `availability-${dateStr}-${hour}`,
              title: 'Unavailable',
              start: startTime,
              end: endTime,
              backgroundColor: '#ef4444',
              borderColor: '#dc2626',
              textColor: '#ffffff',
              display: 'background',
              extendedProps: {
                type: 'availability',
                date: dateStr,
                hour: parseInt(hour)
              }
            });
          });
        }
      }
    });
    
    return events;
  }, [machineAvailability, machineId, machine]);

  // Load machine availability data
  useEffect(() => {
    const loadData = async () => {
      if (!machineId) return;
      
      setIsLoading(true);
      try {
        // Load data for the current month (UTC)
        const now = new Date();
        const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
        
        await loadMachineAvailabilityForDateRange(
          machineId, 
          format(startDate, 'yyyy-MM-dd'), 
          format(endDate, 'yyyy-MM-dd')
        );
      } catch (error) {
        console.error('Failed to load machine availability data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [machineId, refreshTrigger]);

  // Handle date click for availability toggle
  const handleDateClick = useCallback(async (arg) => {
    const clickedDate = arg.date;
    
    // Use the same simple logic as Gantt chart - just get the hour directly
    const dateStr = format(clickedDate, 'yyyy-MM-dd');
    const hour = clickedDate.getUTCHours();
    
    // Check if there are scheduled tasks at this time
    const hasScheduledTask = scheduledEvents.some(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const clickedTime = new Date(clickedDate);
      
      return clickedTime >= eventStart && clickedTime < eventEnd;
    });
    
    if (hasScheduledTask) {
      showAlert('Cannot mark time slot as unavailable - it has scheduled tasks', 'error');
      return;
    }
    
    if (!machine) return;
    
    const slotKey = `${dateStr}-${hour}`;
    setUpdatingSlots(prev => ({ ...prev, [slotKey]: true }));
    
    try {
      await toggleMachineHourAvailability(machine.id, dateStr, hour);
    } catch (error) {
      console.error('Failed to toggle machine hour availability:', error);
      showAlert('An unexpected error occurred.', 'error');
    } finally {
      setUpdatingSlots(prev => ({ ...prev, [slotKey]: false }));
    }
  }, [scheduledEvents, showAlert, machine, toggleMachineHourAvailability]);

  // Handle event click
  const handleEventClick = useCallback((arg) => {
    const event = arg.event;
    const props = event.extendedProps;
    
    if (props.type === 'availability') {
      // Handle availability event click
      console.log('Availability event clicked:', props);
    } else {
      // Handle scheduled task event click
      console.log('Scheduled task clicked:', {
        odpNumber: props.odpNumber,
        articleCode: props.articleCode,
        quantity: props.quantity,
        start: event.start,
        end: event.end
      });
    }
  }, []);

  // Calendar options - static to prevent re-renders
  const calendarOptions = useMemo(() => ({
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    initialDate: new Date(), // FullCalendar will handle UTC conversion with timeZone: 'UTC'
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    height: 'auto',
    locale: 'it',
    timeZone: 'UTC', // Force UTC timezone
    firstDay: AppConfig.APP.FIRST_DAY_OF_WEEK, // Monday as first day of week
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    slotDuration: '01:00:00',
    slotLabelInterval: '01:00:00',
    allDaySlot: false,
    weekends: true,
    editable: false,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    eventDisplay: 'block',
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      meridiem: false,
      hour12: false
    },
    dayHeaderFormat: { weekday: 'short', day: 'numeric' },
    slotLabelFormat: {
      hour: '2-digit',
      minute: '2-digit',
      meridiem: false,
      hour12: false
    },
    buttonText: {
      today: 'Oggi',
      month: 'Mese',
      week: 'Settimana',
      day: 'Giorno'
    },
    eventClick: handleEventClick,
    dateClick: handleDateClick,
    events: [...scheduledEvents, ...availabilityEvents]
  }), [handleEventClick, handleDateClick, scheduledEvents, availabilityEvents]);

  if (!machine) {
    return <div className="loading">Loading machine data...</div>;
  }

  if (isLoading) {
    return <div className="loading">Loading calendar data...</div>;
  }

  return (
    <div className="fullcalendar-container">
      <FullCalendar 
        ref={calendarRef}
        {...calendarOptions} 
      />
    </div>
  );
}

export default FullCalendarGrid;
