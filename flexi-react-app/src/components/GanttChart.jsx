import React, { useEffect, useMemo } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useStore } from '../store/useStore';
import { toDateString, isTaskOverlapping } from '../utils/dateUtils';

// A single 15-minute time slot on the calendar that can receive a dropped task
function TimeSlot({ machine, hour, minute, isUnavailable, hasScheduledTask }) {
  const { setNodeRef } = useDroppable({
    id: `slot-${machine.id}-${hour}-${minute}`,
    data: { machine, hour, minute, type: 'slot', isUnavailable, hasScheduledTask },
  });
  
  let slotClass = 'time-slot';
  if (isUnavailable) slotClass += ' unavailable';
  if (hasScheduledTask) slotClass += ' has-scheduled-task';
  
  return <div ref={setNodeRef} className={slotClass} data-hour={hour} data-minute={minute} />;
}

// A scheduled event that can be dragged to be rescheduled or unscheduled
function ScheduledEvent({ event, machine, currentDate }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `event-${event.id}`,
        data: { event, type: 'event', machine },
    });

    const durationHours = event.duration || 1;
    
    // Calculate base position based on the current date context
    const eventStartTime = new Date(event.scheduled_start_time);
    const eventEndTime = new Date(event.scheduled_end_time);
    
    // Check if this event should be visible on the current day
    // Event should be visible if it starts, ends, or spans across the current day
    const currentDayStart = new Date(currentDate);
    currentDayStart.setHours(0, 0, 0, 0);
    const currentDayEnd = new Date(currentDate);
    currentDayEnd.setHours(23, 59, 59, 999);
    
    const eventStartsOnCurrentDay = eventStartTime.toDateString() === currentDate.toDateString();
    const eventEndsOnCurrentDay = eventEndTime.toDateString() === currentDate.toDateString();
    const eventSpansCurrentDay = eventStartTime < currentDayEnd && eventEndTime > currentDayStart;
    
    // Debug logging for cross-day tasks
    if (eventStartTime.toDateString() !== eventEndTime.toDateString()) {
        console.log('Cross-day task detected:', {
            taskId: event.id,
            startDate: eventStartTime.toDateString(),
            endDate: eventEndTime.toDateString(),
            currentDate: currentDate.toDateString(),
            eventStartsOnCurrentDay,
            eventEndsOnCurrentDay,
            eventSpansCurrentDay,
            shouldShow: eventStartsOnCurrentDay || eventEndsOnCurrentDay || eventSpansCurrentDay
        });
    }
    
    if (!eventStartsOnCurrentDay && !eventEndsOnCurrentDay && !eventSpansCurrentDay) {
        // If event doesn't overlap with current day at all, don't show it
        return null;
    }
    
    // Calculate positioning for the event on the current day
    // Now using 15-minute precision (20px per 15-minute slot)
    let baseLeft, baseWidth;
    
    if (eventStartsOnCurrentDay) {
        // Event starts on current day - show from start time with 15-minute precision
        const startHour = eventStartTime.getHours();
        const startMinute = eventStartTime.getMinutes();
        const startSlot = startHour * 4 + Math.floor(startMinute / 15);
        baseLeft = startSlot * 20; // 20px per 15-minute slot
        
        const hoursRemainingInDay = 24 - eventStartTime.getHours();
        const hoursToShow = Math.min(durationHours, hoursRemainingInDay);
        const slotsToShow = hoursToShow * 4; // Convert hours to 15-minute slots
        baseWidth = slotsToShow * 20;
    } else if (eventEndsOnCurrentDay) {
        // Event ends on current day - show until end time with 15-minute precision
        baseLeft = 0; // Start from beginning of day
        const endHour = eventEndTime.getHours();
        const endMinute = eventEndTime.getMinutes();
        const endSlot = endHour * 4 + Math.ceil(endMinute / 15);
        baseWidth = endSlot * 20;
    } else {
        // Event spans across current day - show full day
        baseLeft = 0;
        baseWidth = 24 * 4 * 20; // Full day width (96 slots * 20px)
    }
    
    // Apply transform only when dragging, otherwise use base position
    const style = isDragging ? {
        position: 'absolute',
        left: `${baseLeft}px`,
        width: `${baseWidth}px`,
        transform: `translate3d(${transform?.x || 0}px, ${transform?.y || 0}px, 0)`,
        zIndex: 1000,
    } : {
        position: 'absolute',
        left: `${baseLeft}px`,
        width: `${baseWidth}px`,
        transform: 'none',
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...listeners} 
            {...attributes} 
            className={`scheduled-event ${isDragging ? 'dragging' : ''} ${eventSpansCurrentDay && !eventStartsOnCurrentDay && !eventEndsOnCurrentDay ? 'cross-day' : ''}`}
        >
            <span className="event-label">{event.odp_number}</span>
        </div>
    );
}

// A single row in the Gantt chart, representing one machine
function MachineRow({ machine, scheduledEvents, currentDate, unavailableByMachine }) {
  // Generate 96 slots (24 hours * 4 slots per hour)
  const timeSlots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      timeSlots.push({ hour, minute });
    }
  }
  
  return (
    <div className="machine-row" data-machine-id={machine.id}>
      <div className="machine-label">
        <div className="machine-name">{machine.machine_name}</div>
        <div className="machine-city">{machine.work_center}</div>
      </div>
      <div className="machine-slots">
        {timeSlots.map(({ hour, minute }, index) => {
          const setForMachine = unavailableByMachine[machine.id];
          // Check if this 15-minute slot falls within an unavailable hour
          const isUnavailable = setForMachine ? setForMachine.has(hour.toString()) : false;
          
          // Check if there's a scheduled task at this 15-minute slot
          const hasScheduledTask = scheduledEvents.some(event => {
            // Convert the 15-minute slot to a time range for overlap checking
            const slotStart = new Date(currentDate);
            slotStart.setHours(hour, minute, 0, 0);
            const slotEnd = new Date(currentDate);
            slotEnd.setHours(hour, minute + 15, 0, 0);
            
            const eventStart = new Date(event.scheduled_start_time);
            const eventEnd = new Date(event.scheduled_end_time);
            
            // Check if the event overlaps with this 15-minute slot
            return eventStart < slotEnd && eventEnd > slotStart;
          });
          
          return (
            <TimeSlot 
              key={`${hour}-${minute}`} 
              machine={machine} 
              hour={hour} 
              minute={minute}
              isUnavailable={isUnavailable} 
              hasScheduledTask={hasScheduledTask}
            />
          );
        })}
        {scheduledEvents.map(event => (
          <ScheduledEvent 
            key={event.id} 
            event={event} 
            machine={machine} 
            currentDate={currentDate}
          />
        ))}
      </div>
    </div>
  );
}

// The main Gantt Chart component
function GanttChart({ machines, tasks, currentDate }) {
  const scheduledTasks = tasks.filter(task => task.status === 'SCHEDULED');

  const loadMachineAvailabilityForDate = useStore(state => state.loadMachineAvailabilityForDate);
  const machineAvailability = useStore(state => state.machineAvailability);

  const dateStr = useMemo(() => toDateString(currentDate), [currentDate]);

  useEffect(() => {
    loadMachineAvailabilityForDate(dateStr);
  }, [dateStr, loadMachineAvailabilityForDate]);

  const unavailableByMachine = useMemo(() => {
    const dayData = machineAvailability[dateStr];
    const map = {};
    if (Array.isArray(dayData)) {
      dayData.forEach(row => {
        map[row.machine_id] = new Set((row.unavailable_hours || []).map(h => h.toString()));
      });
    }
    return map;
  }, [machineAvailability, dateStr]);

  return (
    <div className="calendar-section">
      <div className="calendar-grid">
        <div className="calendar-header-row">
          <div className="machine-label-header">Machines</div>
          <div className="time-header">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="time-slot-header hour-header" style={{ gridColumn: `${hour * 4 + 1} / span 4` }}>
                {hour.toString().padStart(2, '0')}
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-body">
          {machines.map(machine => (
            <MachineRow
              key={machine.id}
              machine={machine}
              scheduledEvents={scheduledTasks.filter(task => task.scheduled_machine_id === machine.id)}
              currentDate={currentDate}
              unavailableByMachine={unavailableByMachine}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default GanttChart;
