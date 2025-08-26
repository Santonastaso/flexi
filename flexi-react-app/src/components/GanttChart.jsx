import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useOrderStore, useSchedulerStore } from '../store';
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

  return <div ref={setNodeRef} className={slotClass} data-hour={hour} data-minute={minute} data-machine-id={machine.id} />;
});

// A scheduled event that can be dragged to be rescheduled or unscheduled
const ScheduledEvent = React.memo(({ event, machine, currentDate }) => {
    const [isLocked, setIsLocked] = useState(true); // Events start locked by default
    
    // Note: updateOdpOrder and handleAsync are available if needed for future features

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `event-${event.id}`,
        data: { event, type: 'event', machine },
        disabled: isLocked, // Disable dragging when locked
    });

    // Memoize expensive calculations - optimized for performance
    const eventPosition = useMemo(() => {
        // Cache date parsing to avoid repeated operations
        const eventStartTime = new Date(event.scheduled_start_time);
        // Calculate end time based on start time + time_remaining instead of stored scheduled_end_time
        const timeRemaining = event.time_remaining || event.duration || 1;
        const calculatedEndTime = new Date(eventStartTime.getTime() + (timeRemaining * 60 * 60 * 1000)); // Convert hours to milliseconds
        
        // Check if this event should be visible on the current day
        const currentDayStart = getStartOfDay(currentDate);
        const currentDayEnd = getEndOfDay(currentDate);

        const eventStartsOnCurrentDay = isSameDate(eventStartTime, currentDate);
        const eventEndsOnCurrentDay = isSameDate(calculatedEndTime, currentDate);
        const eventSpansCurrentDay = eventStartTime < currentDayEnd && calculatedEndTime > currentDayStart;

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
            const hoursToShow = Math.min(timeRemaining, hoursRemainingInDay);
            const slotsToShow = hoursToShow * 4;
            baseWidth = slotsToShow * 20;
        } else if (eventEndsOnCurrentDay) {
            baseLeft = 0;
            const endHour = calculatedEndTime.getHours();
            const endMinute = calculatedEndTime.getMinutes();
            const endSlot = endHour * 4 + Math.ceil(endMinute / 15);
            baseWidth = endSlot * 20;
        } else {
            // Full day span - optimize calculation
            baseLeft = 0;
            baseWidth = 1920; // 24 * 4 * 20 = 1920px
        }

        return { baseLeft, baseWidth, eventSpansCurrentDay, eventStartsOnCurrentDay, eventEndsOnCurrentDay };
    }, [event.scheduled_start_time, event.time_remaining, event.duration, currentDate]);

    // Simplified sizing logic - CSS will handle responsive behavior
    const isVerySmallTask = eventPosition?.baseWidth < 60; // Less than 3 time slots (45 minutes)
    const isSmallTask = eventPosition?.baseWidth < 120; // Less than 6 time slots (1.5 hours)
    const shouldOverlayButtons = isVerySmallTask && eventPosition?.baseWidth < 80; // Less than 4 time slots (1 hour)
    const isExtremelyNarrow = eventPosition?.baseWidth < 40; // Less than 2 time slots (30 minutes)

    const style = useMemo(() => {
        if (!eventPosition) return {};
        
        const { baseLeft, baseWidth } = eventPosition;
        
        return isDragging ? {
            position: 'absolute',
            left: `${baseLeft}px`,
            width: `${baseWidth}px`,
            transform: `translate3d(${transform?.x || 0}px, ${transform?.y || 0}px, 0)`,
            zIndex: 1001,
            pointerEvents: 'none',
            // Ultra-light drag state - minimal CSS for maximum performance
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            transition: 'none',
            boxShadow: 'none',
            opacity: 0.8,
            // Remove all visual effects during drag
            filter: 'none',
            borderRadius: '4px',
            padding: '4px 6px',
            minHeight: '32px',
        } : {
            position: 'absolute',
            left: `${baseLeft}px`,
            width: `${baseWidth}px`,
            transform: 'none',
            zIndex: 10,
            // Normal state - minimal CSS
            willChange: 'auto',
            backfaceVisibility: 'visible',
            opacity: 1,
            // Minimal transitions
            transition: 'opacity 0.1s ease',

        };
    }, [eventPosition, isDragging, transform, isSmallTask, isVerySmallTask, isExtremelyNarrow]);

    const handleLockClick = useCallback((e) => {
        e.stopPropagation(); // Prevent drag from starting
        setIsLocked(!isLocked);
    }, [isLocked]);

    // Early return after ALL hooks have been called
    if (!eventPosition) return null;

    const { baseLeft, baseWidth, eventSpansCurrentDay, eventStartsOnCurrentDay, eventEndsOnCurrentDay } = eventPosition;
    
    // Debug logging removed for production

    return (
        <div 
            ref={setNodeRef} 
            style={style || {}} 
            className={`scheduled-event ${isDragging ? 'dragging' : ''} ${eventSpansCurrentDay && !eventStartsOnCurrentDay && !eventEndsOnCurrentDay ? 'cross-day' : ''} ${isVerySmallTask ? 'very-small' : ''} ${isSmallTask ? 'small' : ''} ${isExtremelyNarrow ? 'extremely-narrow' : ''}`}
        >
            <div 
                className={`event-content`}
                style={{
                    // Simplify content during drag for better performance
                    opacity: isDragging ? 0.7 : 1,
                    transform: isDragging ? 'scale(0.95)' : 'none',
                }}
            >
                <span className="event-label">{event.odp_number}</span>
            </div>
            
            {/* Only render controls when not dragging for maximum performance */}
            {!isDragging && (
                <div 
                    className={`event-controls ${shouldOverlayButtons ? 'overlay' : ''}`}
                >
                {/* Info Button */}
                <button 
                    className="event-btn info-btn" 
                    title={`Codice Articolo: ${event.article_code || 'Non specificato'}
Codice Articolo Esterno: ${event.external_article_code || 'Non specificato'}
Nome Cliente: ${event.nome_cliente || 'Non specificato'}
Data Consegna: ${event.delivery_date ? new Date(event.delivery_date).toLocaleDateString() : 'Non impostata'}
Quantità: ${event.quantity || 'Non specificata'}
${event.scheduled_start_time ? `Inizio Programmato: ${new Date(event.scheduled_start_time).toLocaleString()}` : 'Non programmato'}
${event.scheduled_end_time ? `Fine Programmata: ${new Date(event.scheduled_end_time).toLocaleString()}` : 'Non programmato'}`}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                </button>
                
                {/* Lock/Unlock Button */}
                <button 
                    className={`event-btn lock-btn ${isLocked ? 'locked' : 'unlocked'}`}
                    onClick={handleLockClick}
                    title={isLocked ? "Sblocca per abilitare il trascinamento" : "Blocca per disabilitare il trascinamento"}
                >
                    {isLocked ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
                        </svg>
                    ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-9h-1V6c0-2.76-2.24-5-5-5-2.28 0-4.27 1.54-4.84 3.75-.14.54.18 1.08.72 1.22.53.14 1.08-.18 1.22-.72C9.44 6.06 10.72 5 12 5c1.66 0 3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"/>
                        </svg>
                    )}
                </button>
                
                {/* Drag Handle - only active when unlocked */}
                {!isLocked && (
                    <div 
                        className="drag-handle" 
                        {...listeners} 
                        {...attributes}
                        title="Trascina per riprogrammare"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                        </svg>
                    </div>
                )}
                
                {/* Unschedule Button - only active when unlocked */}
                {!isLocked && (
                    <button 
                        className="event-btn unschedule-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Call the unschedule function from the store
                            useSchedulerStore.getState().unscheduleTask(event.id);
                        }}
                        title="Annulla programmazione e riporta al pool"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13H5v-2h14v2z"/>
                        </svg>
                    </button>
                )}
            </div>
            )}
            
            {/* Info Popup */}
            {/* Removed Info Popup as it's now handled by hover tooltip */}
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
              key={`${machine.id}-${hour}-${minute}`} // Use semantic key based on machine and time
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
const GanttChart = React.memo(({ machines, currentDate }) => {
  const { odpOrders: tasks } = useOrderStore();
  const scheduledTasks = useMemo(() =>
    tasks.filter(task => task.status === 'SCHEDULED'),
    [tasks]
  );

  const { loadMachineAvailabilityForDate, machineAvailability } = useSchedulerStore();

  const dateStr = useMemo(() => toDateString(currentDate), [currentDate]);

  useEffect(() => {
    loadMachineAvailabilityForDate(dateStr);
    
    // Cleanup function for component unmount
    return () => {
      // No specific cleanup needed for this effect, but good practice to have
    };
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
    // Performance logging removed for production

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
        <div className="calendar-grid-container">
                      <div className="empty-state">
              <h3>Nessuna macchina disponibile</h3>
              <p>Aggiungi macchine per visualizzare il programma.</p>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-section">
      <div className="calendar-grid-container">
        <div className="calendar-grid">
          <div className="calendar-header-row">
            <div className="machine-label-header">Macchine</div>
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
    </div>
  );
});

export default GanttChart;