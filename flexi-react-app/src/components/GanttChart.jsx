import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useOrderStore, useSchedulerStore } from '../store';
import {
  toDateString,
  getUTCStartOfDay,
  getUTCEndOfDay,
  isSameUTCDate
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
    const navigate = useNavigate();
    const { getSplitTaskInfo } = useSchedulerStore();
    
    // Note: updateOdpOrder and handleAsync are available if needed for future features

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `event-${event.id}`,
        data: { event, type: 'event', machine },
        disabled: isLocked, // Disable dragging when locked
    });

    // Calculate segments for split tasks or regular positioning for normal tasks
    const eventSegments = useMemo(() => {
        const segmentInfo = getSplitTaskInfo(event.id);
        const currentDayStart = getUTCStartOfDay(currentDate);
        const currentDayEnd = getUTCEndOfDay(currentDate);
        
        if (segmentInfo && segmentInfo.wasSplit) {
            // Handle split tasks - render only segments that appear on current day
            const visibleSegments = [];
            
            for (const segment of segmentInfo.segments) {
                const segmentStart = new Date(segment.start);
                const segmentEnd = new Date(segment.end);
                
                // Check if this segment is visible on the current day
                const segmentStartsOnCurrentDay = isSameUTCDate(segmentStart, currentDate);
                const segmentEndsOnCurrentDay = isSameUTCDate(segmentEnd, currentDate);
                const segmentSpansCurrentDay = segmentStart < currentDayEnd && segmentEnd > currentDayStart;
                
                if (segmentStartsOnCurrentDay || segmentEndsOnCurrentDay || segmentSpansCurrentDay) {
                    // Calculate positioning for this segment on the current day
                    let segmentLeft, segmentWidth;
                    
                    if (segmentStartsOnCurrentDay && segmentEndsOnCurrentDay) {
                        // Segment starts and ends on current day - use UTC to get absolute times
                        const startHour = segmentStart.getUTCHours();
                        const startMinute = segmentStart.getUTCMinutes();
                        const endHour = segmentEnd.getUTCHours();
                        const endMinute = segmentEnd.getUTCMinutes();
                        
                        const startSlot = startHour * 4 + Math.floor(startMinute / 15);
                        const endSlot = endHour * 4 + Math.ceil(endMinute / 15);
                        
                        segmentLeft = startSlot * 20;
                        segmentWidth = (endSlot - startSlot) * 20;
                    } else if (segmentStartsOnCurrentDay) {
                        // Segment starts on current day but continues to next day - use UTC
                        const startHour = segmentStart.getUTCHours();
                        const startMinute = segmentStart.getUTCMinutes();
                        const startSlot = startHour * 4 + Math.floor(startMinute / 15);
                        
                        segmentLeft = startSlot * 20;
                        segmentWidth = (96 - startSlot) * 20; // 96 = 24 * 4 slots per day
                    } else if (segmentEndsOnCurrentDay) {
                        // Segment ends on current day but started on previous day - use UTC
                        const endHour = segmentEnd.getUTCHours();
                        const endMinute = segmentEnd.getUTCMinutes();
                        const endSlot = endHour * 4 + Math.ceil(endMinute / 15);
                        
                        segmentLeft = 0;
                        segmentWidth = endSlot * 20;
                    } else {
                        // Segment spans entire current day
                        segmentLeft = 0;
                        segmentWidth = 1920; // 24 * 4 * 20 = 1920px
                    }
                    
                    visibleSegments.push({
                        left: segmentLeft,
                        width: segmentWidth,
                        start: segmentStart,
                        end: segmentEnd
                    });
                }
            }
            
            return visibleSegments.length > 0 ? visibleSegments : null;
        } else {
            // Handle regular (non-split) tasks - use original logic
            const eventStartTime = new Date(event.scheduled_start_time);
            const timeRemaining = event.time_remaining || event.duration || 1;
            const calculatedEndTime = new Date(eventStartTime.getTime() + (timeRemaining * 60 * 60 * 1000));
            
            const eventStartsOnCurrentDay = isSameUTCDate(eventStartTime, currentDate);
            const eventEndsOnCurrentDay = isSameUTCDate(calculatedEndTime, currentDate);
            const eventSpansCurrentDay = eventStartTime < currentDayEnd && calculatedEndTime > currentDayStart;

            if (!eventStartsOnCurrentDay && !eventEndsOnCurrentDay && !eventSpansCurrentDay) {
                return null;
            }

            let baseLeft, baseWidth;

            if (eventStartsOnCurrentDay) {
                const startHour = eventStartTime.getUTCHours();
                const startMinute = eventStartTime.getUTCMinutes();
                const startSlot = startHour * 4 + Math.floor(startMinute / 15);
                baseLeft = startSlot * 20;

                const hoursRemainingInDay = 24 - startHour;
                const hoursToShow = Math.min(timeRemaining, hoursRemainingInDay);
                const slotsToShow = hoursToShow * 4;
                baseWidth = slotsToShow * 20;
            } else if (eventEndsOnCurrentDay) {
                baseLeft = 0;
                const endHour = calculatedEndTime.getUTCHours();
                const endMinute = calculatedEndTime.getUTCMinutes();
                const endSlot = endHour * 4 + Math.ceil(endMinute / 15);
                baseWidth = endSlot * 20;
            } else {
                baseLeft = 0;
                baseWidth = 1920;
            }

            return [{ left: baseLeft, width: baseWidth, start: eventStartTime, end: calculatedEndTime }];
        }
    }, [event.scheduled_start_time, event.time_remaining, event.duration, currentDate, getSplitTaskInfo, event.id]);

    // Calculate sizing based on segments
    const totalWidth = eventSegments ? eventSegments.reduce((sum, seg) => sum + seg.width, 0) : 0;
    const isVerySmallTask = totalWidth < 60; // Less than 3 time slots (45 minutes)
    const isSmallTask = totalWidth < 120; // Less than 6 time slots (1.5 hours)
    const shouldOverlayButtons = isVerySmallTask && totalWidth < 80; // Less than 4 time slots (1 hour)
    const isExtremelyNarrow = totalWidth < 40; // Less than 2 time slots (30 minutes)

    const handleLockClick = useCallback((e) => {
        e.stopPropagation(); // Prevent drag from starting
        setIsLocked(!isLocked);
    }, [isLocked]);

    // Early return if no segments are visible (AFTER all hooks are called)
    if (!eventSegments || eventSegments.length === 0) return null;
    
    // Debug logging removed for production

    return (
        <>
            {eventSegments.map((segment, index) => (
                <div 
                    key={`${event.id}-segment-${index}`}
                    ref={index === 0 ? setNodeRef : undefined} // Only attach drag ref to first segment
                    style={{
                        position: 'absolute',
                        left: `${segment.left}px`,
                        width: `${segment.width}px`,
                        transform: isDragging && index === 0 ? `translate3d(${transform?.x || 0}px, ${transform?.y || 0}px, 0)` : 'none',
                        zIndex: isDragging ? 1001 : 10,
                        opacity: isDragging ? 0.8 : 1,
                        transition: isDragging ? 'none' : 'opacity 0.1s ease',
                        pointerEvents: isDragging ? 'none' : 'auto',
                    }}
                    className={`scheduled-event ${isDragging ? 'dragging' : ''} ${isVerySmallTask ? 'very-small' : ''} ${isSmallTask ? 'small' : ''} ${isExtremelyNarrow ? 'extremely-narrow' : ''} ${eventSegments.length > 1 ? 'split-segment' : ''}`}
                    {...(index === 0 ? { ...attributes, ...listeners } : {})} // Only add drag attributes to first segment
                >
                    <div 
                        className={`event-content`}
                        style={{
                            opacity: isDragging ? 0.7 : 1,
                            transform: isDragging ? 'scale(0.95)' : 'none',
                        }}
                    >
                        <span className="event-label">
                            {event.odp_number}
                            {index === 0 && (() => {
                                const segmentInfo = getSplitTaskInfo(event.id);
                                return segmentInfo && segmentInfo.wasSplit ? (
                                    <span className="split-indicator" title={`Task split into ${segmentInfo.totalSegments} segments`}>
                                        ✂️
                                    </span>
                                ) : null;
                            })()}
                        </span>
                    </div>
                    
                    {/* Only render controls on first segment when not dragging */}
                    {!isDragging && index === 0 && (
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
${event.scheduled_start_time ? `Inizio Programmato: ${new Date(event.scheduled_start_time).toISOString().replace('T', ' ').replace('.000Z', '')}` : 'Non programmato'}
${event.scheduled_end_time ? `Fine Programmata: ${new Date(event.scheduled_end_time).toISOString().replace('T', ' ').replace('.000Z', '')}` : 'Non programmato'}`}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                </button>

                {/* Edit Button */}
                <button 
                    className="event-btn edit-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/backlog/${event.id}/edit`);
                    }}
                    title="Modifica e ricalcola"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
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
                </div>
            ))}
        </>
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

    for (let i = 0; i < dayData.length; i++) {
      const row = dayData[i];
              if (row.machine_id && row.unavailable_hours) {
          map[row.machine_id] = new Set(row.unavailable_hours.map(h => h.toString()));
        }
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