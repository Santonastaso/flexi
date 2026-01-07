import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { useSchedulerStore } from '../store';
import { useQueryClient } from '@tanstack/react-query';

function QueueTaskCard({ task, index, machineId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unscheduleTask } = useSchedulerStore();

  // Set up sortable functionality
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    data: {
      type: 'queue-task',
      task,
      machineId,
      index
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Check if this is a pause task and get split info
  const { isPauseTask, splitInfo } = useMemo(() => {
    try {
      if (task.description) {
        const parsed = JSON.parse(task.description);
        const isPause = parsed.is_pause === true;
        const split = parsed.wasSplit ? {
          wasSplit: parsed.wasSplit,
          totalSegments: parsed.totalSegments || 1,
          segments: parsed.segments || []
        } : null;
        return { isPauseTask: isPause, splitInfo: split };
      }
    } catch (e) {
      // Not JSON or no description
    }
    const isPause = task.odp_number?.startsWith('PAUSE-') || task.article_code === 'PAUSE';
    return { isPauseTask: isPause, splitInfo: null };
  }, [task]);

  // Get task duration
  const duration = task.time_remaining || task.duration || 0;

  // Format times
  const startTime = task.scheduled_start_time ? format(new Date(task.scheduled_start_time), 'dd/MM HH:mm') : '—';
  const endTime = task.scheduled_end_time ? format(new Date(task.scheduled_end_time), 'dd/MM HH:mm') : '—';

  // Get color based on material availability
  const getOdpColor = (materialGlobal) => {
    if (isPauseTask) return '#6b7280'; // Gray for pause tasks
    if (materialGlobal > 70) {
      return '#059669'; // green
    } else if (materialGlobal >= 40 && materialGlobal <= 69) {
      return '#d97706'; // yellow
    } else {
      return '#dc2626'; // red
    }
  };

  const cardColor = getOdpColor(task.material_availability_global || 0);

  // Handle unschedule
  const handleUnschedule = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await unscheduleTask(task.id, queryClient);
    } catch (error) {
      console.error('Error unscheduling task:', error);
    }
  };

  // Handle edit
  const handleEdit = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isPauseTask) {
      navigate(`/backlog/${task.id}/edit`);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`queue-task-card ${isPauseTask ? 'pause-task' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      {/* Drag Handle */}
      <div className="queue-task-drag-handle" {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      </div>

      {/* Task Content */}
      <div 
        className="queue-task-content"
        style={{ borderLeftColor: cardColor }}
      >
        {/* Position Badge */}
        <div className="queue-task-position">
          #{index + 1}
        </div>

        {/* Main Info */}
        <div className="queue-task-main">
          <div className="queue-task-odp">
            {task.odp_number}
            {splitInfo && splitInfo.wasSplit && (
              <span className="split-badge" title={`Task split into ${splitInfo.totalSegments} segments due to machine unavailability`}>
                ✂️ {splitInfo.totalSegments}
              </span>
            )}
          </div>
          {!isPauseTask && task.article_code && (
            <div className="queue-task-article">{task.article_code}</div>
          )}
          {isPauseTask && (
            <div className="queue-task-pause-label">⏸ Pausa</div>
          )}
        </div>

        {/* Duration */}
        <div className="queue-task-duration">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>{duration.toFixed(1)}h</span>
        </div>

        {/* Times */}
        <div className="queue-task-times">
          <div className="queue-task-time">
            <span className="time-label">Inizio:</span>
            <span className="time-value">{startTime}</span>
          </div>
          <div className="queue-task-time">
            <span className="time-label">Fine:</span>
            <span className="time-value">{endTime}</span>
          </div>
          {splitInfo && splitInfo.wasSplit && (
            <div className="queue-task-split-info">
              <span className="split-info-icon">⚠️</span>
              <span className="split-info-text">
                Task diviso in {splitInfo.totalSegments} segmenti per non disponibilità macchina
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar (if not pause task) */}
        {!isPauseTask && task.progress > 0 && (
          <div className="queue-task-progress">
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${Math.min(task.progress, 100)}%` }}
              />
            </div>
            <span className="progress-text">{Math.round(task.progress)}%</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="queue-task-actions">
        {/* Info Button */}
        <button 
          className="queue-task-btn info-btn" 
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          title={isPauseTask ? 
            `Pausa di ${duration}h` :
            `Codice Articolo: ${task.article_code || 'Non specificato'}
Codice Articolo Esterno: ${task.external_article_code || 'Non specificato'}
Nome Cliente: ${task.nome_cliente || 'Non specificato'}
Data Consegna: ${task.delivery_date ? format(new Date(task.delivery_date), 'yyyy-MM-dd') : 'Non impostata'}
Quantità: ${task.quantity || 'Non specificata'}
Note Libere: ${task.user_notes || 'Nessuna nota'}
Note ASD: ${task.asd_notes || 'Nessuna nota'}
Material Global: ${task.material_availability_global || 'N/A'}%`
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>

        {/* Edit Button (not for pause tasks) */}
        {!isPauseTask && (
          <button 
            className="queue-task-btn edit-btn"
            onClick={handleEdit}
            title="Modifica"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
        )}

        {/* Remove Button */}
        <button 
          className="queue-task-btn remove-btn"
          onClick={handleUnschedule}
          title={isPauseTask ? "Rimuovi pausa" : "Rimuovi dalla coda"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default QueueTaskCard;

