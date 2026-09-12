-- Cross-machine move is atomic and leaves segments owned by the target queue.

begin;

do $$
declare
  v_source uuid;
  v_target uuid;
  v_task uuid;
  v_source_revision integer;
  v_target_revision integer;
begin
  select q.machine_id, q.task_id into v_source, v_task
  from public.scheduler_v2_queue_items q
  join public.scheduler_v2_segments s on s.machine_id = q.machine_id and s.task_id = q.task_id
  join public.odp_orders o on o.id = q.task_id and o.status <> 'IN PROGRESS'
  order by q.position desc
  limit 1;

  select state.machine_id into v_target
  from public.scheduler_v2_machine_state state
  where state.machine_id <> v_source
    and not exists (select 1 from public.scheduler_v2_queue_items q where q.machine_id = state.machine_id)
    and exists (
      select 1 from public.machine_availability a
      where a.machine_id = state.machine_id
        and a.date = (now() at time zone 'Europe/Rome')::date
    )
  order by state.machine_id
  limit 1;

  if v_source is null or v_target is null then
    raise exception 'Test fixture missing source or empty target machine';
  end if;

  select revision into v_source_revision from public.scheduler_v2_machine_state where machine_id = v_source;
  select revision into v_target_revision from public.scheduler_v2_machine_state where machine_id = v_target;

  perform public.scheduler_v2_move_task(
    v_task, v_target, null, v_source_revision, v_target_revision
  );

  if not exists (
    select 1 from public.scheduler_v2_queue_items
    where task_id = v_task and machine_id = v_target
  ) then
    raise exception 'Invariant failed: queue item did not move to target';
  end if;
  if exists (
    select 1 from public.scheduler_v2_segments
    where task_id = v_task and machine_id <> v_target
  ) then
    raise exception 'Invariant failed: source segments survived cross-machine move';
  end if;
  if not exists (
    select 1 from public.scheduler_v2_segments
    where task_id = v_task and machine_id = v_target
  ) then
    raise exception 'Invariant failed: target segments were not planned';
  end if;
end;
$$;

rollback;
