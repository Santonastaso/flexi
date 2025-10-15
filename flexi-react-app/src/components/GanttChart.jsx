import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useOrderStore, useSchedulerStore, useUIStore } from '../store';
import { format, startOfDay, endOfDay, startOfWeek, isSameDay, addDays } from 'date-fns';
import { AppConfig } from '../services/config';
import NextDayDropZone from './NextDayDropZone';
import PreviousDayDropZone from './PreviousDayDropZone';
import { useQueryClient } from '@tanstack/react-query';
import { useMachineAvailabilityForDateAllMachines } from '../hooks/useQueries';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';


// A single 15-minute time slot on the calendar that can receive a dropped task
const TimeSlot = React.memo(({ machine, hour, minute, isUnavailable, hasScheduledTask, dropTargetId, slotId, dragPreview }) => {
  const { setNodeRef } = useDroppable({
    id: `slot-${machine.id}-${hour}-${minute}`,
    data: { machine, hour, minute, type: 'slot', isUnavailable, hasScheduledTask },
  });

  // Optimize className construction
  const slotClass = `time-slot${isUnavailable ? ' unavailable' : ''}${hasScheduledTask ? ' has-scheduled-task' : ''}`;
  const isDropTarget = dropTargetId === slotId;
  
  // Check if this slot should show drag preview
  const currentSlot = (hour - 6) * 4 + Math.floor(minute / 15);
  const isInDragPreview = dragPreview?.isActive && 
    dragPreview.machineId === machine.id &&
    currentSlot >= dragPreview.startSlot && 
    currentSlot < dragPreview.startSlot + dragPreview.durationSlots;

  return (
    <div 
      ref={setNodeRef} 
      className={slotClass} 
      data-hour={hour} 
      data-minute={minute} 
      data-machine-id={machine.id}
      style={{ position: 'relative' }}
    >
      {isDropTarget && (
        <div 
          className="drop-indicator"
          style={{
            position: 'absolute',
            top: '-1px',
            left: '-1px',
            right: '-1px',
            bottom: '-1px',
            border: '3px dashed #007bff',
            background: 'rgba(0, 123, 255, 0.1)',
            pointerEvents: 'none',
            zIndex: 1000,
            borderRadius: '4px'
          }}
        />
      )}
      {isInDragPreview && (
        <div 
          className="drag-preview-indicator"
          style={{
            position: 'absolute',
            top: '0px',
            left: '0px',
            right: '0px',
            bottom: '0px',
            background: 'rgba(59, 130, 246, 0.3)',
            border: '2px solid #3b82f6',
            pointerEvents: 'none',
            zIndex: 999,
            borderRadius: '2px'
          }}
        />
      )}
    </div>
  );
});

// A scheduled event that can be dragged to be rescheduled or unscheduled
const ScheduledEvent = React.memo(({ event, machine, currentDate, queryClient }) => {
    const [isLocked, setIsLocked] = useState(true); // Events start locked by default
    const navigate = useNavigate();
    const { getSplitTaskInfo, splitTasksInfo } = useSchedulerStore();
    const { schedulingLoading } = useUIStore();
    
    // Note: updateOdpOrder and handleAsync are available if needed for future features

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `event-${event.id}`,
        data: { event, type: 'event', machine },
        disabled: isLocked, // Disable dragging when locked
    });

    // Calculate segments for ALL tasks using description column only
    const eventSegments = useMemo(() => {
        const segmentInfo = getSplitTaskInfo(event.id);
        const currentDayStart = startOfDay(currentDate);
        const currentDayEnd = endOfDay(currentDate);
        
        // Calculate overall task progress
        const totalDuration = event.duration || 1;
        const progressPercentage = event.progress || 0;
        const completedDuration = totalDuration * (progressPercentage / 100);
        const remainingDuration = totalDuration - completedDuration;
        
        
        // If no segment info exists, create a single segment from the task data
        if (!segmentInfo || !segmentInfo.segments) {
            console.warn(`⚠️ No segment info for task ${event.odp_number}, creating fallback`);
            // This should not happen in the new system, but create a single segment as fallback
            if (!event.scheduled_start_time) {
                return null; // No start time, can't render
            }
            
            const eventStartTime = new Date(event.scheduled_start_time);
            const timeRemaining = event.time_remaining || event.duration || 1;
            const calculatedEndTime = new Date(eventStartTime.getTime() + (timeRemaining * 60 * 60 * 1000));
            
            // Create a single segment for this task
            const singleSegment = {
                start: eventStartTime,
                end: calculatedEndTime,
                duration: timeRemaining
            };
            
            // Check if this segment is visible on current day - use UTC consistently
            const segmentStartsOnCurrentDay = isSameDay(singleSegment.start, currentDate);
            const segmentEndsOnCurrentDay = isSameDay(singleSegment.end, currentDate);
            const segmentSpansCurrentDay = singleSegment.start < currentDayEnd && singleSegment.end > currentDayStart;
            
            if (!segmentStartsOnCurrentDay && !segmentEndsOnCurrentDay && !segmentSpansCurrentDay) {
                return null;
            }
            
            // Calculate positioning for this single segment
            let segmentLeft, segmentWidth;
            
                            if (segmentStartsOnCurrentDay && segmentEndsOnCurrentDay) {
                    // Segment starts and ends on current day - use UTC time (no conversion needed)
                    const startHour = singleSegment.start.getUTCHours();
                    const startMinute = singleSegment.start.getUTCMinutes();
                    const endHour = singleSegment.end.getUTCHours();
                    const endMinute = singleSegment.end.getUTCMinutes();
                    
                    // Adjust for 6 AM start time
                    const adjustedStartHour = Math.max(6, startHour);
                    const adjustedEndHour = Math.min(22, endHour);
                    
                    const startSlot = (adjustedStartHour - 6) * 4 + Math.floor(startMinute / 15);
                    const endSlot = (adjustedEndHour - 6) * 4 + Math.ceil(endMinute / 15);
                    
                    segmentLeft = startSlot * 15;
                    segmentWidth = (endSlot - startSlot) * 15;
                } else if (segmentStartsOnCurrentDay) {
                    // Segment starts on current day but ends later - use UTC time (no conversion needed)
                    const startHour = singleSegment.start.getUTCHours();
                    const startMinute = singleSegment.start.getUTCMinutes();
                    const adjustedStartHour = Math.max(6, startHour);
                    const startSlot = (adjustedStartHour - 6) * 4 + Math.floor(startMinute / 15);
                    
                    segmentLeft = startSlot * 15;
                    segmentWidth = (64 - startSlot) * 15; // Rest of the day (64 slots from 6 AM to 10 PM)
                } else if (segmentEndsOnCurrentDay) {
                    // Segment starts earlier but ends on current day - use UTC time (no conversion needed)
                    const endHour = singleSegment.end.getUTCHours();
                    const endMinute = singleSegment.end.getUTCMinutes();
                    const adjustedEndHour = Math.min(22, endHour);
                    const endSlot = (adjustedEndHour - 6) * 4 + Math.ceil(endMinute / 15);
                    
                    segmentLeft = 0;
                    segmentWidth = endSlot * 15;
                } else {
                    // Segment spans the entire current day
                    segmentLeft = 0;
                    segmentWidth = 960; // Full day width (64 slots * 15px)
                }
            
            // Calculate progress for single segment
            const singleSegmentProgress = progressPercentage;
            
            return [{ 
                left: segmentLeft, 
                width: segmentWidth, 
                start: singleSegment.start, 
                end: singleSegment.end,
                progress: singleSegmentProgress,
                duration: timeRemaining
            }];
        }
        
        // Handle split tasks - render only segments that appear on current day
        const visibleSegments = [];
        let cumulativeDuration = 0;
        
        for (const segment of segmentInfo.segments) {
            const segmentStart = new Date(segment.start);
            const segmentEnd = new Date(segment.end);
            const segmentDuration = segment.duration || 0;
            
            // Check if this segment is visible on the current day - use UTC consistently
            const segmentStartsOnCurrentDay = isSameDay(segmentStart, currentDate);
            const segmentEndsOnCurrentDay = isSameDay(segmentEnd, currentDate);
            const segmentSpansCurrentDay = segmentStart < currentDayEnd && segmentEnd > currentDayStart;
            
            if (segmentStartsOnCurrentDay || segmentEndsOnCurrentDay || segmentSpansCurrentDay) {
                // Calculate positioning for this segment on the current day
                let segmentLeft, segmentWidth;
                
                if (segmentStartsOnCurrentDay && segmentEndsOnCurrentDay) {
                    // Segment starts and ends on current day - use UTC time (no conversion needed)
                    const startHour = segmentStart.getUTCHours();
                    const startMinute = segmentStart.getUTCMinutes();
                    const endHour = segmentEnd.getUTCHours();
                    const endMinute = segmentEnd.getUTCMinutes();
                    
                    // Adjust for 6 AM start time
                    const adjustedStartHour = Math.max(6, startHour);
                    const adjustedEndHour = Math.min(22, endHour);
                    
                    const startSlot = (adjustedStartHour - 6) * 4 + Math.floor(startMinute / 15);
                    const endSlot = (adjustedEndHour - 6) * 4 + Math.ceil(endMinute / 15);
                    
                    segmentLeft = startSlot * 15;
                    segmentWidth = (endSlot - startSlot) * 15;
                } else if (segmentStartsOnCurrentDay) {
                    // Segment starts on current day but ends later - use UTC time (no conversion needed)
                    const startHour = segmentStart.getUTCHours();
                    const startMinute = segmentStart.getUTCMinutes();
                    const adjustedStartHour = Math.max(6, startHour);
                    const startSlot = (adjustedStartHour - 6) * 4 + Math.floor(startMinute / 15);
                    
                    segmentLeft = startSlot * 15;
                    segmentWidth = (64 - startSlot) * 15; // Rest of the day (64 slots from 6 AM to 10 PM)
                } else if (segmentEndsOnCurrentDay) {
                    // Segment starts earlier but ends on current day - use UTC time (no conversion needed)
                    const endHour = segmentEnd.getUTCHours();
                    const endMinute = segmentEnd.getUTCMinutes();
                    const adjustedEndHour = Math.min(22, endHour);
                    const endSlot = (adjustedEndHour - 6) * 4 + Math.ceil(endMinute / 15);
                    
                    segmentLeft = 0;
                    segmentWidth = endSlot * 15;
                } else {
                    // Segment spans the entire current day
                    segmentLeft = 0;
                    segmentWidth = 960; // Full day width (64 slots * 15px)
                }
                
                // Calculate progress for this segment
                let segmentProgress = 0;
                if (completedDuration > cumulativeDuration) {
                    // This segment has some completed work
                    const segmentCompletedDuration = Math.min(segmentDuration, completedDuration - cumulativeDuration);
                    segmentProgress = (segmentCompletedDuration / segmentDuration) * 100;
                }
                
                visibleSegments.push({
                    left: segmentLeft,
                    width: segmentWidth,
                    start: segmentStart,
                    end: segmentEnd,
                    progress: segmentProgress,
                    duration: segmentDuration
                });
                
                cumulativeDuration += segmentDuration;
            }
        }
        
        return visibleSegments.length > 0 ? visibleSegments : null;
    }, [event.id, currentDate, getSplitTaskInfo, splitTasksInfo]);

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
                        zIndex: 10,
                        opacity: 1,
                        transition: 'opacity 0.1s ease',
                        pointerEvents: 'auto',
                    }}
                    className={`scheduled-event ${isVerySmallTask ? 'very-small' : ''} ${isSmallTask ? 'small' : ''} ${isExtremelyNarrow ? 'extremely-narrow' : ''} ${eventSegments.length > 1 ? 'split-segment' : ''} ${schedulingLoading.taskId === event.id && (schedulingLoading.isScheduling || schedulingLoading.isRescheduling || schedulingLoading.isShunting) ? 'processing' : ''}`}
                >
                    <div 
                        className={`event-content`}
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
                    
                    {/* Progress bar overlay */}
                    {segment.progress && segment.progress > 0 && (
                        <div 
                            className="progress-bar-overlay"
                            style={{
                                width: `${Math.min(segment.progress, 100)}%`
                            }}
                        />
                    )}
                    
                    {/* Only render controls on first segment */}
                    {index === 0 && (
                        <div 
                            className={`event-controls ${shouldOverlayButtons ? 'overlay' : ''}`}
                >
                {/* Info Button - Always functional */}
                <button 
                    className="event-btn info-btn" 
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                    title={`Codice Articolo: ${event.article_code || 'Non specificato'}
Codice Articolo Esterno: ${event.external_article_code || 'Non specificato'}
Nome Cliente: ${event.nome_cliente || 'Non specificato'}
        Data Consegna: ${event.delivery_date ? format(new Date(event.delivery_date), 'yyyy-MM-dd') : 'Non impostata'}
Quantità: ${event.quantity || 'Non specificata'}
Altezza Busta: ${event.bag_height || 'Non specificata'} mm
Passo Busta: ${event.bag_step || 'Non specificato'} mm
Note Libere: ${event.user_notes || 'Nessuna nota'}
Note ASD: ${event.asd_notes || 'Nessuna nota'}
Material Global: ${event.material_availability_global || 'N/A'}%
        ${event.scheduled_start_time ? `Inizio Programmato: ${event.scheduled_start_time.replace('+00:00', '')}` : 'Non programmato'}
        ${event.scheduled_end_time ? `Fine Programmata: ${event.scheduled_end_time.replace('+00:00', '')}` : 'Non programmato'}`}
                >
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>i</span>
                </button>

                {/* Edit Button - Always functional */}
                <button 
                    className="event-btn edit-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        navigate(`/backlog/${event.id}/edit`);
                    }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
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
                        style={{
                            transform: isDragging ? `translate3d(${transform?.x || 0}px, ${transform?.y || 0}px, 0)` : 'none',
                            zIndex: isDragging ? 1001 : 20,
                        }}
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
                        onClick={async (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            try {
                                await useSchedulerStore.getState().unscheduleTask(event.id, queryClient);
                            } catch (error) {
                                console.error('Error unscheduling task:', error);
                            }
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                        }}
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                        }}
                        title="Annulla programmazione e riporta al pool"
                    >
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>×</span>
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
const MachineRow = React.memo(({ machine, scheduledEvents, currentDate, unavailableByMachine, dropTargetId, hideMachineLabel = false, queryClient, dragPreview }) => {
  // Memoize scheduled events for this machine - optimize filtering
  const machineScheduledEvents = useMemo(() =>
    scheduledEvents.filter(event => event.scheduled_machine_id === machine.id),
    [scheduledEvents, machine.id]
  );

  // Get unavailable hours for this machine
  const unavailableHours = unavailableByMachine[machine.id];

  return (
    <div className="machine-row" data-machine-id={machine.id}>
      {!hideMachineLabel && (
        <div className="machine-label">
          <div className="machine-name">{machine.machine_name}</div>
          <div className="machine-city">{machine.work_center}</div>
        </div>
      )}
      <div className="machine-slots">
        {/* Render time slots from 6:00 AM to 10:00 PM (16 hours = 64 slots) */}
        {Array.from({ length: 64 }, (_, index) => {
          const hour = Math.floor(index / 4) + 6; // Start from 6 AM
          const minute = (index % 4) * 15;
          const isUnavailable = unavailableHours ? unavailableHours.has(hour.toString()) : false;

          const slotId = `${machine.id}-${hour}-${minute}`;
          return (
            <TimeSlot
              key={slotId} // Use semantic key based on machine and time
              machine={machine}
              hour={hour}
              minute={minute}
              isUnavailable={isUnavailable}
              hasScheduledTask={false}
              dropTargetId={dropTargetId}
              slotId={slotId}
              dragPreview={dragPreview}
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
            queryClient={queryClient}
          />
        ))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent re-renders when only dropTargetId changes
  // Only re-render if the actual data props change
  return (
    prevProps.machine.id === nextProps.machine.id &&
    prevProps.machine.machine_name === nextProps.machine.machine_name &&
    prevProps.machine.work_center === nextProps.machine.work_center &&
    prevProps.scheduledEvents === nextProps.scheduledEvents &&
    prevProps.currentDate.getTime() === nextProps.currentDate.getTime() &&
    prevProps.unavailableByMachine === nextProps.unavailableByMachine &&
    prevProps.hideMachineLabel === nextProps.hideMachineLabel &&
    prevProps.queryClient === nextProps.queryClient &&
    prevProps.dragPreview === nextProps.dragPreview
    // Note: dropTargetId is intentionally excluded from comparison
  );
});

// Weekly Gantt View Component - reuses machine calendar weekly structure
const WeeklyGanttView = React.memo(({ machines, currentDate, scheduledTasks }) => {
  const navigate = useNavigate();
  const { getSplitTaskInfo } = useSchedulerStore();
  
  // Generate week dates
  const weekDates = useMemo(() => {
          const weekStart = startOfWeek(currentDate, { weekStartsOn: AppConfig.APP.FIRST_DAY_OF_WEEK });
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setUTCDate(weekStart.getUTCDate() + i);
      dates.push(day);
    }
    return dates;
  }, [currentDate]);

  // Get tasks for each machine and day - now checks for segments on that day
  const getTasksForMachineAndDay = useCallback((machineId, dateStr) => {
    return scheduledTasks.filter(task => {
      // First check if task is assigned to this machine
      if (task.scheduled_machine_id !== machineId || !task.scheduled_start_time) {
        return false;
      }
      
      // Get segment information for this task
      const segmentInfo = getSplitTaskInfo(task.id);
      
      if (segmentInfo && segmentInfo.segments && segmentInfo.segments.length > 0) {
        // Check if any segment falls on this day
        const targetDate = new Date(dateStr + 'T00:00:00Z');
        const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
        
        return segmentInfo.segments.some(segment => {
          const segmentStart = new Date(segment.start);
          const segmentEnd = new Date(segment.end);
          
          // Check if segment overlaps with the target day
          return segmentStart < nextDay && segmentEnd > targetDate;
        });
      } else {
        // Fallback: check if task start date matches (for tasks without segment info)
        return format(new Date(task.scheduled_start_time), 'yyyy-MM-dd') === dateStr;
      }
    });
  }, [scheduledTasks, getSplitTaskInfo]);

  // Handle task click to show details
  const handleTaskClick = useCallback((task) => {
    // Navigate to the task edit page
    navigate(`/backlog/${task.id}/edit`);
  }, [navigate]);

  // Get total tasks count for a day
  const getDayTaskCount = useCallback((machineId, dateStr) => {
    return getTasksForMachineAndDay(machineId, dateStr).length;
  }, [getTasksForMachineAndDay]);

  return (
    <div className="weekly-gantt-container">
      <div className="weekly-gantt-header">
        <div className="machine-label-header">Macchine</div>
        {weekDates.map(day => (
          <div key={day.toISOString()} className="day-header-cell">
                            <div className="day-name">{format(day, 'yyyy-MM-dd')}</div>
                <div className="day-date">{format(day, 'yyyy-MM-dd')}</div>
          </div>
        ))}
      </div>
      
      <div className="weekly-gantt-body">
        {machines.map(machine => (
          <div key={machine.id} className="machine-week-row">
            <div className="machine-label">
              <div className="machine-name">{machine.machine_name}</div>
              <div className="machine-city">{machine.work_center}</div>
            </div>
            
            {weekDates.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayTasks = getTasksForMachineAndDay(machine.id, dateStr);
              const taskCount = getDayTaskCount(machine.id, dateStr);
              const isToday = day.toDateString() === new Date().toDateString();
              
              return (
                <div 
                  key={`${machine.id}-${dateStr}`} 
                  className={`day-cell ${isToday ? 'today' : ''} ${taskCount > 0 ? 'has-tasks' : ''}`}
                >
                  {dayTasks.length > 0 ? (
                    <div className="day-tasks">
                      <div className="day-task-count">{taskCount} task{taskCount !== 1 ? 's' : ''}</div>
                      {dayTasks.slice(0, 3).map(task => (
                        <div 
                          key={task.id} 
                          className="day-task-item"
                          onClick={() => handleTaskClick(task)}
                          title={`${task.odp_number} - ${task.article_code || 'Codice articolo FLEXI'} - ${task.time_remaining ? Number(task.time_remaining).toFixed(1) : (task.duration || 1).toFixed(1)}h`}
                        >
                          <span className="task-odp">{task.odp_number}</span>
                          <span className="task-duration">
                            {task.time_remaining ? Number(task.time_remaining).toFixed(1) : (task.duration || 1).toFixed(1)}h
                          </span>
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="more-tasks-indicator">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="empty-day">-</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

// The main Gantt Chart component - heavily optimized for performance
const GanttChart = React.memo(({ machines, currentDate, dropTargetId, dragPreview, onNavigateToNextDay, onNavigateToPreviousDay }) => {
  const [currentView, setCurrentView] = useState('Daily'); // Add view state
  const [currentTimePosition, setCurrentTimePosition] = useState(null);
  
  const { odpOrders: tasks } = useOrderStore();
  const scheduledTasks = useMemo(() =>
    tasks.filter(task => task.status === 'SCHEDULED'),
    [tasks]
  );

  const queryClient = useQueryClient();

  // Use the exact same date that's displayed in the banner - no conversion needed
  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  // Use React Query hook for machine availability data with caching and background updates
  const { 
    data: machineAvailabilityData = [], 
    isLoading: isMachineAvailabilityLoading, 
    error: machineAvailabilityError 
  } = useMachineAvailabilityForDateAllMachines(dateStr);

  // Optimize unavailable hours processing with early returns
  const unavailableByMachine = useMemo(() => {
    if (currentView !== 'Daily') return {};
    
    if (!Array.isArray(machineAvailabilityData) || machineAvailabilityData.length === 0) return {};

    const map = {};

    for (let i = 0; i < machineAvailabilityData.length; i++) {
      const row = machineAvailabilityData[i];
      if (row.machine_id && row.unavailable_hours) {
        map[row.machine_id] = new Set(row.unavailable_hours.map(h => h.toString()));
      }
    }

    return map;
  }, [machineAvailabilityData, currentView]);

  // Memoize the time header with optimized rendering - show only 6:00 AM to 10:00 PM
  const timeHeader = useMemo(() =>
    Array.from({ length: 16 }, (_, hourIndex) => {
      const hour = hourIndex + 6; // Start from 6 AM
      return (
        <div
          key={hour}
          className="time-slot-header hour-header"
          style={{ gridColumn: `${hourIndex * 4 + 1} / span 4` }}
        >
          {hour.toString().padStart(2, '0')}
        </div>
      );
    }),
    []
  );

  // Calculate current time position
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Only show if within visible range (6 AM to 10 PM local time)
      if (hour >= 6 && hour < 22) {
        const slot = (hour - 6) * 4 + Math.floor(minute / 15);
        const minuteOffset = (minute % 15) / 15;
        const position = slot * 15 + minuteOffset * 15;
        setCurrentTimePosition(position);
      } else {
        setCurrentTimePosition(null);
      }
    };
    
    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

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
      <div className="gantt-chart-wrapper">
        {/* Combined Controls Bar */}
        <div className="gantt-controls-bar">
          {/* Centered Date Navigation */}
          <div className="gantt-date-navigation">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigateToPreviousDay && onNavigateToPreviousDay(currentView)}
            >
              &lt;
            </Button>
            <span className="current-date">{format(currentDate, 'dd/MM/yyyy')}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigateToNextDay && onNavigateToNextDay(currentView)}
            >
              &gt;
            </Button>
          </div>

          {/* View Selector */}
          <div className="gantt-view-selector">
            <Select value={currentView} onValueChange={setCurrentView}>
              <SelectTrigger className="view-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Daily">Vista Giornaliera</SelectItem>
                <SelectItem value="Weekly">Vista Settimanale</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="gantt-scroll-container">
        <div className="calendar-grid-container">
          {currentView === 'Daily' ? (
            <div className="calendar-grid-with-day-navigation">
              <div className="machine-column-wrapper">
                <div className="machine-label-header sticky-header">Macchine</div>
                <div className="machine-labels-body">
                  {machines.map(machine => (
                    <div key={machine.id} className="machine-label-only">
                      <div className="machine-name">{machine.machine_name}</div>
                      <div className="machine-city">{machine.work_center}</div>
                    </div>
                  ))}
                </div>
              </div>
              <PreviousDayDropZone 
                currentDate={currentDate}
                onNavigateToPreviousDay={() => onNavigateToPreviousDay && onNavigateToPreviousDay(currentView)}
                isDragOver={dropTargetId === 'previous-day-drop-zone'}
              />
              <div className="time-grid-wrapper">
                <div className="time-header-row sticky-header">
                  {timeHeader}
                </div>
                <div className="time-grid-body" style={{ position: 'relative' }}>
                  {machines.map(machine => (
                    <MachineRow
                      key={machine.id}
                      machine={machine}
                      scheduledEvents={scheduledTasks}
                      currentDate={currentDate}
                      unavailableByMachine={unavailableByMachine}
                      dropTargetId={dropTargetId}
                      hideMachineLabel={true}
                      queryClient={queryClient}
                      dragPreview={dragPreview}
                    />
                  ))}
                  {currentTimePosition !== null && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${currentTimePosition}px`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: '#ef4444',
                        zIndex: 100,
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                </div>
              </div>
              <NextDayDropZone 
                currentDate={currentDate}
                onNavigateToNextDay={() => onNavigateToNextDay && onNavigateToNextDay(currentView)}
                isDragOver={dropTargetId === 'next-day-drop-zone'}
              />
            </div>
          ) : (
            <WeeklyGanttView 
              machines={machines}
              currentDate={currentDate}
              scheduledTasks={scheduledTasks}
            />
          )}
        </div>
      </div>
      </div>
    </div>
  );
});

export default GanttChart;