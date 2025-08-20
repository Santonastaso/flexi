import React, { useEffect, useMemo } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useStore } from '../store/useStore';
import {
  toDateString,
  getStartOfDay,
  getEndOfDay,
  isSameDate
} from '../utils/dateUtils';

// A single 15-minute time slot on the calendar that can receive a dropped task
const TimeSlot = React.memo(({ machine, hour, minute, isUnavailable, hasScheduledTask }) => {
  const { setNodeRef } = useDroppable({
    id: `slot-${machine.id}-${hour}-${minute}`,
    data: { machine, hour, minute, type: 'slot', isUnavailable, hasScheduledTask },
  });

  // Optimize className construction
  const slotClass = `time-slot${isUnavailable ? ' unavailable' : ''}${hasScheduledTask ? ' has-scheduled-task' : ''}`;

  return <div ref={setNodeRef} className={slotClass} data-hour={hour} data-minute={minute} />;
});

// A scheduled event that can be dragged to be rescheduled or unscheduled
const ScheduledEvent = React.memo(({ event, machine, currentDate }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `event-${event.id}`,
        data: { event, type: 'event', machine },
    });

    // Memoize expensive calculations - optimized for performance
    const eventPosition = useMemo(() => {
        // Cache date parsing to avoid repeated operations
        const eventStartTime = new Date(event.scheduled_start_time);
        const eventEndTime = new Date(event.scheduled_end_time);
        const durationHours = event.duration || 1;

        // Check if this event should be visible on the current day
        const currentDayStart = getStartOfDay(currentDate);
        const currentDayEnd = getEndOfDay(currentDate);

        const eventStartsOnCurrentDay = isSameDate(eventStartTime, currentDate);
        const eventEndsOnCurrentDay = isSameDate(eventEndTime, currentDate);
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

            const hoursRemainingInDay = 24 - startHour;
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
            // Full day span - optimize calculation
            baseLeft = 0;
            baseWidth = 1920; // 24 * 4 * 20 = 1920px
        }

        return { baseLeft, baseWidth, eventSpansCurrentDay, eventStartsOnCurrentDay, eventEndsOnCurrentDay };
    }, [event.scheduled_start_time, event.scheduled_end_time, event.duration, currentDate]);

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
  // Memoize scheduled events for this machine - optimize filtering
  const machineScheduledEvents = useMemo(() =>
    scheduledEvents.filter(event => event.scheduled_machine_id === machine.id),
    [scheduledEvents, machine.id]
  );

  // Get unavailable hours for this machine
  const unavailableHours = unavailableByMachine[machine.id];

  return (
    <div className="machine-row" data-machine-id={machine.id}>
      <div className="machine-label">
        <div className="machine-name">{machine.machine_name}</div>
        <div className="machine-city">{machine.work_center}</div>
      </div>
      <div className="machine-slots">
        {/* Render time slots in a more efficient way - use a single loop */}
        {Array.from({ length: 96 }, (_, index) => {
          const hour = Math.floor(index / 4);
          const minute = (index % 4) * 15;
          const isUnavailable = unavailableHours ? unavailableHours.has(hour.toString()) : false;

          return (
            <TimeSlot
              key={`${index}`} // Use index as key for better performance
              machine={machine}
              hour={hour}
              minute={minute}
              isUnavailable={isUnavailable}
              hasScheduledTask={false}
            />
          );
        })}
        {/* Render scheduled events for this machine */}
        {machineScheduledEvents.length > 0 && machineScheduledEvents.map(event => (
          <ScheduledEvent
            key={`event-${event.id}`}
            event={event}
            machine={machine}
            currentDate={currentDate}
          />
        ))}
      </div>
    </div>
  );
});

// The main Gantt Chart component - heavily optimized for performance
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

  // Optimize unavailable hours processing with early returns
  const unavailableByMachine = useMemo(() => {
    const dayData = machineAvailability[dateStr];
    if (!Array.isArray(dayData) || dayData.length === 0) return {};

    const map = {};
    const startTime = performance.now();

    for (let i = 0; i < dayData.length; i++) {
      const row = dayData[i];
      if (row.machine_id && row.unavailable_hours) {
        map[row.machine_id] = new Set(row.unavailable_hours.map(h => h.toString()));
      }
    }

    const endTime = performance.now();
    if (endTime - startTime > 3) {
      console.log(`⚡ Unavailable hours processing took: ${(endTime - startTime).toFixed(2)}ms`);
    }

    return map;
  }, [machineAvailability, dateStr]);

  // Memoize the time header with optimized rendering
  const timeHeader = useMemo(() =>
    Array.from({ length: 24 }, (_, hour) => (
      <div
        key={hour}
        className="time-slot-header hour-header"
        style={{ gridColumn: `${hour * 4 + 1} / span 4` }}
      >
        {hour.toString().padStart(2, '0')}
      </div>
    )),
    []
  );

  // Early return for empty state
  if (!machines || machines.length === 0) {
    return (
      <div className="calendar-section">
        <div className="empty-state">
          <h3>No machines available</h3>
          <p>Please add machines to view the schedule.</p>
        </div>
      </div>
    );
  }

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
          {/* Render only visible machines - can be optimized further with virtualization */}
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
