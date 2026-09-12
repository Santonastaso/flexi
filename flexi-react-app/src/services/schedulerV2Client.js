import { supabase, handleSupabaseError } from './supabase/client';
import { AppError, ERROR_TYPES } from '../utils/errorHandling';

async function rpc(command, args = {}) {
  const { data, error } = await supabase.rpc(command, args);
  if (!error) return data;

  const message = handleSupabaseError(error);
  const revisionConflict = error.code === '40001' || /revision conflict/i.test(message);
  throw new AppError(
    revisionConflict
      ? 'La pianificazione è cambiata. Aggiorna e riprova.'
      : message,
    ERROR_TYPES.BUSINESS_LOGIC_ERROR,
    revisionConflict ? 409 : 400,
    { originalError: error, source: `schedulerV2.${command}` },
  );
}

export const schedulerV2Client = {
  snapshot: () => rpc('scheduler_v2_workspace_snapshot'),

  schedule: ({ machineId, taskId, beforeTaskId = null, revision }) =>
    rpc('scheduler_v2_schedule_task', {
      p_machine_id: machineId,
      p_task_id: taskId,
      p_before_task_id: beforeTaskId,
      p_expected_revision: revision,
    }),

  unschedule: ({ taskId, revision }) =>
    rpc('scheduler_v2_unschedule_task', {
      p_task_id: taskId,
      p_expected_revision: revision,
    }),

  move: ({ taskId, targetMachineId, beforeTaskId = null, sourceRevision, targetRevision }) =>
    rpc('scheduler_v2_move_task', {
      p_task_id: taskId,
      p_target_machine_id: targetMachineId,
      p_before_task_id: beforeTaskId,
      p_expected_source_revision: sourceRevision,
      p_expected_target_revision: targetRevision,
    }),

  setDuration: ({ taskId, durationMinutes, revision }) =>
    rpc('scheduler_v2_set_task_duration', {
      p_task_id: taskId,
      p_duration_minutes: durationMinutes,
      p_expected_revision: revision,
    }),

  createPause: ({ machineId, durationMinutes, revision }) =>
    rpc('scheduler_v2_create_pause', {
      p_machine_id: machineId,
      p_duration_minutes: durationMinutes,
      p_before_task_id: null,
      p_expected_revision: revision,
    }),

  repair: ({ machineId, revision }) =>
    rpc('scheduler_v2_repair_machine', {
      p_machine_id: machineId,
      p_expected_revision: revision,
    }),

  addDowntime: ({ machineId, startsAt, endsAt, reason, revision }) =>
    rpc('scheduler_v2_add_calendar_override', {
      p_machine_id: machineId,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_reason: reason || null,
      p_expected_revision: revision,
    }),

  removeDowntime: ({ overrideId, revision }) =>
    rpc('scheduler_v2_remove_calendar_override', {
      p_override_id: overrideId,
      p_expected_revision: revision,
    }),
};
