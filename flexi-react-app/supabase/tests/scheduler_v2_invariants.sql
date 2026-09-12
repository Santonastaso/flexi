-- Transactional integration tests for the sandbox database. Nothing persists.

begin;

do $$
declare
  v_machine uuid;
  v_revision integer;
  v_removed_task uuid;
  v_next_task uuid;
  v_before timestamptz;
  v_after timestamptz;
begin
  select q.machine_id into v_machine
  from public.scheduler_v2_queue_items q
  join public.scheduler_v2_segments s on s.machine_id = q.machine_id and s.task_id = q.task_id
  join public.odp_orders o on o.id = q.task_id and o.status <> 'IN PROGRESS'
  group by q.machine_id
  having count(distinct q.task_id) >= 2
  limit 1;
  if v_machine is null then raise exception 'Test fixture missing machine with two eligible queued tasks'; end if;

  select q.task_id into v_removed_task
  from public.scheduler_v2_queue_items q
  join public.odp_orders o on o.id = q.task_id
  where q.machine_id = v_machine and o.status <> 'IN PROGRESS'
  order by q.position limit 1;
  select q.task_id into v_next_task
  from public.scheduler_v2_queue_items q
  where q.machine_id = v_machine and q.position > (
    select position from public.scheduler_v2_queue_items where task_id = v_removed_task
  )
  order by q.position limit 1;
  select min(starts_at) into v_before from public.scheduler_v2_segments where task_id = v_next_task;
  select revision into v_revision from public.scheduler_v2_machine_state where machine_id = v_machine;

  perform public.scheduler_v2_unschedule_task(v_removed_task, v_revision);

  if exists (select 1 from public.scheduler_v2_segments where task_id = v_removed_task) then
    raise exception 'Invariant failed: unscheduled task retained segments';
  end if;
  select min(starts_at) into v_after from public.scheduler_v2_segments where task_id = v_next_task;
  if v_after is null or v_after >= v_before then
    raise exception 'Invariant failed: downstream task did not anticipate (% -> %)', v_before, v_after;
  end if;
end;
$$;

do $$
declare
  v_machine uuid;
  v_revision integer;
  v_task uuid;
  v_failed boolean := false;
begin
  select q.machine_id, q.task_id into v_machine, v_task
  from public.scheduler_v2_queue_items q
  join public.odp_orders o on o.id = q.task_id and o.status <> 'IN PROGRESS'
  limit 1;
  select revision into v_revision from public.scheduler_v2_machine_state where machine_id = v_machine;

  begin
    perform public.scheduler_v2_schedule_task(v_machine, v_task, null, v_revision - 1);
  exception when serialization_failure then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Invariant failed: stale revision was accepted';
  end if;
end;
$$;

do $$
declare
  v_machine uuid;
  v_revision integer;
  v_segment public.scheduler_v2_segments%rowtype;
  v_failed boolean := false;
begin
  select * into v_segment from public.scheduler_v2_segments order by starts_at limit 1;
  v_machine := v_segment.machine_id;
  select revision into v_revision from public.scheduler_v2_machine_state where machine_id = v_machine;

  begin
    perform public.scheduler_v2_add_calendar_override(
      v_machine, v_segment.starts_at, v_segment.ends_at, 'must fail', v_revision
    );
  exception when raise_exception then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Invariant failed: downtime over actual work was accepted';
  end if;
end;
$$;

do $$
declare
  v_machine uuid;
  v_revision integer;
  v_result jsonb;
  v_task uuid;
  v_minutes numeric;
begin
  select s.machine_id into v_machine
  from public.scheduler_v2_machine_state s
  where exists (select 1 from public.machine_availability a where a.machine_id = s.machine_id and a.date = (now() at time zone 'Europe/Rome')::date)
  order by s.machine_id limit 1;
  select revision into v_revision from public.scheduler_v2_machine_state where machine_id = v_machine;
  v_result := public.scheduler_v2_create_pause(v_machine, 1, null, v_revision);
  v_task := (v_result->>'task_id')::uuid;
  select sum(extract(epoch from ends_at - starts_at) / 60) into v_minutes
  from public.scheduler_v2_segments where task_id = v_task;
  if v_minutes <> 15 then
    raise exception 'Invariant failed: one-minute pause occupied % minutes instead of 15', v_minutes;
  end if;
end;
$$;

rollback;
