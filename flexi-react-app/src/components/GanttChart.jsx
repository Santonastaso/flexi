import React, { useEffect, useMemo } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useStore } from '../store/useStore';
import { toDateString, isTaskOverlapping } from '../utils/dateUtils';

// A single time slot on the calendar that can receive a dropped task
function TimeSlot({ machine, hour, isUnavailable, hasScheduledTask }) {
  const { setNodeRef } = useDroppable({
    id: `slot-${machine.id}-${hour}`,
    data: { machine, hour, type: 'slot', isUnavailable, hasScheduledTask },
  });
  
  let slotClass = 'time-slot';
  if (isUnavailable) slotClass += ' unavailable';
  if (hasScheduledTask) slotClass += ' has-scheduled-task';
  
  return <div ref={setNodeRef} className={slotClass} data-hour={hour} />;
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
    let baseLeft, baseWidth;
    
    if (eventStartsOnCurrentDay) {
        // Event starts on current day - show from start hour
        baseLeft = eventStartTime.getHours() * 80;
        const hoursRemainingInDay = 24 - eventStartTime.getHours();
        const hoursToShow = Math.min(durationHours, hoursRemainingInDay);
        baseWidth = hoursToShow * 80;
    } else if (eventEndsOnCurrentDay) {
        // Event ends on current day - show until end hour
        baseLeft = 0; // Start from beginning of day
        const hoursFromStartOfDay = eventEndTime.getHours() + (eventEndTime.getMinutes() / 60);
        baseWidth = hoursFromStartOfDay * 80;
    } else {
        // Event spans across current day - show full day
        baseLeft = 0;
        baseWidth = 24 * 80; // Full day width
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
  const hours = Array.from({ length: 24 }, (_, i) => i); // 24 hours in a day
  return (
    <div className="machine-row" data-machine-id={machine.id}>
      <div className="machine-label">
        <div className="machine-name">{machine.machine_name}</div>
        <div className="machine-city">{machine.work_center}</div>
      </div>
      <div className="machine-slots">
        {hours.map(hour => {
          const setForMachine = unavailableByMachine[machine.id];
          const isUnavailable = setForMachine ? setForMachine.has(hour.toString()) : false;
          
          // Check if there's a scheduled task at this hour
          const hasScheduledTask = scheduledEvents.some(event => 
            isTaskOverlapping(event, toDateString(currentDate), hour)
          );
          
          return (
            <TimeSlot 
              key={hour} 
              machine={machine} 
              hour={hour} 
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
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="time-slot-header">{i.toString().padStart(2, '0')}</div>
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
