import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';

// A single time slot on the calendar that can receive a dropped task
function TimeSlot({ machine, hour }) {
  const { setNodeRef } = useDroppable({
    id: `slot-${machine.id}-${hour}`,
    data: { machine, hour, type: 'slot' },
  });
  return <div ref={setNodeRef} className="time-slot" data-hour={hour} />;
}

// A scheduled event that can be dragged to be rescheduled or unscheduled
function ScheduledEvent({ event, machine }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `event-${event.id}`,
        data: { event, type: 'event', machine },
    });

    const durationHours = event.duration || 1;
    
    // Calculate base position
    const baseLeft = (new Date(event.scheduled_start_time).getHours() * 80);
    const baseWidth = durationHours * 80;
    
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
            className={`scheduled-event ${isDragging ? 'dragging' : ''}`}
        >
            <span className="event-label">{event.odp_number}</span>
        </div>
    );
}

// A single row in the Gantt chart, representing one machine
function MachineRow({ machine, scheduledEvents }) {
  const hours = Array.from({ length: 24 }, (_, i) => i); // 24 hours in a day
  return (
    <div className="machine-row" data-machine-id={machine.id}>
      <div className="machine-label">
        <div className="machine-name">{machine.machine_name}</div>
        <div className="machine-city">{machine.work_center}</div>
      </div>
      <div className="machine-slots">
        {hours.map(hour => <TimeSlot key={hour} machine={machine} hour={hour} />)}
        {scheduledEvents.map(event => <ScheduledEvent key={event.id} event={event} machine={machine} />)}
      </div>
    </div>
  );
}

// The main Gantt Chart component
function GanttChart({ machines, tasks }) {
  const scheduledTasks = tasks.filter(task => task.status === 'SCHEDULED');

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
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default GanttChart;
