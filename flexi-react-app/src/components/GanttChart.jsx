import React, { useEffect, useMemo, useCallback } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useStore } from '../store/useStore';
import { toDateString, isTaskOverlapping } from '../utils/dateUtils';

// A single 15-minute time slot on the calendar that can receive a dropped task
const TimeSlot = React.memo(({ machine, hour, minute, isUnavailable, hasScheduledTask }) => {
  const { setNodeRef } = useDroppable({
    id: `slot-${machine.id}-${hour}-${minute}`,
    data: { machine, hour, minute, type: 'slot', isUnavailable, hasScheduledTask },
  });
  
  const slotClass = useMemo(() => {
    let className = 'time-slot';
    if (isUnavailable) className += ' unavailable';
    if (hasScheduledTask) className += ' has-scheduled-task';
    return className;
  }, [isUnavailable, hasScheduledTask]);
  
  return <div ref={setNodeRef} className={slotClass} data-hour={hour} data-minute={minute} />;
});

// A scheduled event that can be dragged to be rescheduled or unscheduled
const ScheduledEvent = React.memo(({ event, machine, currentDate }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `event-${event.id}`,
        data: { event, type: 'event', machine },
    });

    // Memoize expensive calculations
    const eventPosition = useMemo(() => {
        const durationHours = event.duration || 1;
        const eventStartTime = new Date(event.scheduled_start_time);
        const eventEndTime = new Date(event.scheduled_end_time);
        
        // Check if this event should be visible on the current day
        const currentDayStart = new Date(currentDate);
        currentDayStart.setHours(0, 0, 0, 0);
        const currentDayEnd = new Date(currentDate);
        currentDayEnd.setHours(23, 59, 59, 999);
        
        const eventStartsOnCurrentDay = eventStartTime.toDateString() === currentDate.toDateString();
        const eventEndsOnCurrentDay = eventEndTime.toDateString() === currentDate.toDateString();
        const eventSpansCurrentDay = eventStartTime < currentDayEnd && eventEndTime > currentDayStart;
        
        if (!eventStartsOnCurrentDay && !eventEndsOnCurrentDay && !eventSpansCurrentDay) {
            return null;
        }
        
        // Calculate positioning for the event on the current day
        let baseLeft, baseWidth;
        
        if (eventStartsOnCurrentDay) {
            const startHour = eventStartTime.getHours();
            const startMinute = eventStartTime.getMinutes();
            const startSlot = startHour * 4 + Math.floor(startMinute / 15);
            baseLeft = startSlot * 20;
            
            const hoursRemainingInDay = 24 - eventStartTime.getHours();
            const hoursToShow = Math.min(durationHours, hoursRemainingInDay);
            const slotsToShow = hoursToShow * 4;
            baseWidth = slotsToShow * 20;
        } else if (eventEndsOnCurrentDay) {
            baseLeft = 0;
            const endHour = eventEndTime.getHours();
            const endMinute = eventEndTime.getMinutes();
            const endSlot = endHour * 4 + Math.ceil(endMinute / 15);
            baseWidth = endSlot * 20;
        } else {
            baseLeft = 0;
            baseWidth = 24 * 4 * 20;
        }
        
        return { baseLeft, baseWidth, eventSpansCurrentDay, eventStartsOnCurrentDay, eventEndsOnCurrentDay };
    }, [event, currentDate]);

    if (!eventPosition) return null;

    const { baseLeft, baseWidth, eventSpansCurrentDay, eventStartsOnCurrentDay, eventEndsOnCurrentDay } = eventPosition;
    
    // Apply transform only when dragging, otherwise use base position
    const style = isDragging ? {
        position: 'absolute',
        left: `${baseLeft}px`,
        width: `${baseWidth}px`,
        transform: `translate3d(${transform?.x || 0}px, ${transform?.y || 0}px, 0)`,
        zIndex: 1001,
        pointerEvents: 'none',
    } : {
        position: 'absolute',
        left: `${baseLeft}px`,
        width: `${baseWidth}px`,
        transform: 'none',
        zIndex: 10,
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
});

// A single row in the Gantt chart, representing one machine
const MachineRow = React.memo(({ machine, scheduledEvents, currentDate, unavailableByMachine }) => {
  // Memoize time slots to prevent recreation on every render
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  }, []);
  
  // Memoize scheduled events for this machine
  const machineScheduledEvents = useMemo(() => 
    scheduledEvents.filter(event => event.scheduled_machine_id === machine.id),
    [scheduledEvents, machine.id]
  );
  
  return (
    <div className="machine-row" data-machine-id={machine.id}>
      <div className="machine-label">
        <div className="machine-name">{machine.machine_name}</div>
        <div className="machine-city">{machine.work_center}</div>
      </div>
      <div className="machine-slots">
        {timeSlots.map(({ hour, minute }) => {
          const setForMachine = unavailableByMachine[machine.id];
          const isUnavailable = setForMachine ? setForMachine.has(hour.toString()) : false;
          
          return (
            <TimeSlot 
              key={`${hour}-${minute}`} 
              machine={machine} 
              hour={hour} 
              minute={minute}
              isUnavailable={isUnavailable} 
              hasScheduledTask={false}
            />
          );
        })}
        {machineScheduledEvents.map(event => (
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
});

// The main Gantt Chart component
const GanttChart = React.memo(({ machines, tasks, currentDate }) => {
  const scheduledTasks = useMemo(() => 
    tasks.filter(task => task.status === 'SCHEDULED'),
    [tasks]
  );

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

  // Memoize the time header to prevent recreation
  const timeHeader = useMemo(() => 
    Array.from({ length: 24 }, (_, hour) => (
      <div key={hour} className="time-slot-header hour-header" style={{ gridColumn: `${hour * 4 + 1} / span 4` }}>
        {hour.toString().padStart(2, '0')}
      </div>
    )),
    []
  );

  return (
    <div className="calendar-section">
      <div className="calendar-grid">
        <div className="calendar-header-row">
          <div className="machine-label-header">Machines</div>
          <div className="time-header">
            {timeHeader}
          </div>
        </div>
        <div className="calendar-body">
          {machines.map(machine => (
            <MachineRow
              key={machine.id}
              machine={machine}
              scheduledEvents={scheduledTasks}
              currentDate={currentDate}
              unavailableByMachine={unavailableByMachine}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default GanttChart;
