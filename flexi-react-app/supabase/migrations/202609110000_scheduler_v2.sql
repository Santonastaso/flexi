-- Canonical Scheduler v2 schema. Actual 15-minute segments are authoritative.
begin;
create extension if not exists btree_gist;

create table public.scheduler_v2_machine_state (
  machine_id uuid primary key references public.machines(id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
create table public.scheduler_v2_task_metadata (
  task_id uuid primary key references public.odp_orders(id) on delete cascade,
  task_kind text not null default 'production' check (task_kind in ('production','pause')),
  duration_minutes integer check (duration_minutes > 0)
);
create table public.scheduler_v2_queue_items (
  machine_id uuid not null references public.machines(id) on delete cascade,
  task_id uuid not null unique references public.odp_orders(id) on delete cascade,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  primary key (machine_id, task_id),
  unique (machine_id, position) deferrable initially deferred
);
create table public.scheduler_v2_calendar_overrides (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (mod(extract(epoch from starts_at)::bigint,900)=0),
  check (mod(extract(epoch from ends_at)::bigint,900)=0),
  exclude using gist (machine_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
);
create table public.scheduler_v2_segments (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null,
  task_id uuid not null references public.odp_orders(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (mod(extract(epoch from starts_at)::bigint,900)=0),
  check (mod(extract(epoch from ends_at)::bigint,900)=0),
  foreign key (machine_id,task_id) references public.scheduler_v2_queue_items(machine_id,task_id) on delete cascade,
  exclude using gist (machine_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
);
create index scheduler_v2_queue_position_idx on public.scheduler_v2_queue_items(machine_id,position);
create index scheduler_v2_segment_task_idx on public.scheduler_v2_segments(task_id,starts_at);
create index scheduler_v2_segment_machine_idx on public.scheduler_v2_segments(machine_id,starts_at);

create function public.scheduler_v2_ceil_slot(p_at timestamptz) returns timestamptz
language sql immutable set search_path=public,pg_catalog as $$
  select date_trunc('hour',p_at)+ceil((extract(minute from p_at)+extract(second from p_at)/60)/15)*interval '15 minutes'
$$;

create function public.scheduler_v2_slot_available(p_machine_id uuid,p_at timestamptz) returns boolean
language plpgsql security definer set search_path=public,pg_catalog as $$
declare d date := (p_at at time zone 'Europe/Rome')::date; h text := extract(hour from p_at at time zone 'Europe/Rome')::integer::text; blocked text[];
begin
  select unavailable_hours into blocked from public.machine_availability where machine_id=p_machine_id and date=d;
  if not found or blocked is null then raise exception 'No explicit availability for machine % on %',p_machine_id,d using errcode='P0001'; end if;
  return not h=any(blocked) and not exists (
    select 1 from public.scheduler_v2_calendar_overrides c where c.machine_id=p_machine_id
    and tstzrange(c.starts_at,c.ends_at,'[)')&&tstzrange(p_at,p_at+interval '15 minutes','[)')
  );
end $$;

create function public.scheduler_v2_lock_revision(p_machine_id uuid,p_expected integer) returns integer
language plpgsql security definer set search_path=public,pg_catalog as $$
declare current_revision integer;
begin
  if p_expected is null then raise exception 'Expected revision is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_machine_id::text,0));
  insert into public.scheduler_v2_machine_state(machine_id) values(p_machine_id) on conflict do nothing;
  select revision into current_revision from public.scheduler_v2_machine_state where machine_id=p_machine_id for update;
  if current_revision<>p_expected then raise exception 'Revision conflict for machine %: expected %, current %',p_machine_id,p_expected,current_revision using errcode='40001'; end if;
  return current_revision;
end $$;

create function public.scheduler_v2_resequence(p_machine_id uuid) returns void
language sql security definer set search_path=public,pg_catalog as $$
  with ranked as (select task_id,row_number() over(order by position,task_id)::integer p from public.scheduler_v2_queue_items where machine_id=p_machine_id)
  update public.scheduler_v2_queue_items q set position=r.p from ranked r where q.machine_id=p_machine_id and q.task_id=r.task_id
$$;

create function public.scheduler_v2_insert_at(p_machine_id uuid,p_task_id uuid,p_before uuid) returns void
language plpgsql security definer set search_path=public,pg_catalog as $$
declare p integer;
begin
  if p_before is null then select coalesce(max(position),0)+1 into p from public.scheduler_v2_queue_items where machine_id=p_machine_id;
  else select position into p from public.scheduler_v2_queue_items where machine_id=p_machine_id and task_id=p_before;
    if p is null then raise exception 'Target task % is not on machine %',p_before,p_machine_id using errcode='P0001'; end if;
  end if;
  update public.scheduler_v2_queue_items set position=position+1 where machine_id=p_machine_id and position>=p;
  insert into public.scheduler_v2_queue_items(machine_id,task_id,position) values(p_machine_id,p_task_id,p);
  perform public.scheduler_v2_resequence(p_machine_id);
end $$;

create function public.scheduler_v2_replan_machine(p_machine_id uuid,p_expected integer) returns jsonb
language plpgsql security definer set search_path=public,pg_catalog as $$
declare rev integer; fixed integer:=0; slot timestamptz; seg_start timestamptz; seg_end timestamptz; remaining integer; scanned integer; written integer:=0; task record;
begin
  rev:=public.scheduler_v2_lock_revision(p_machine_id,p_expected);
  select coalesce(max(q.position),0) into fixed from public.scheduler_v2_queue_items q join public.odp_orders o on o.id=q.task_id where q.machine_id=p_machine_id and o.status='IN PROGRESS';
  if fixed>0 then
    select max(s.ends_at) into slot from public.scheduler_v2_segments s join public.scheduler_v2_queue_items q on q.machine_id=s.machine_id and q.task_id=s.task_id where q.machine_id=p_machine_id and q.position<=fixed;
    if slot is null then raise exception 'In-progress task has no fixed v2 segments' using errcode='P0001'; end if;
  else slot:=now(); end if;
  slot:=public.scheduler_v2_ceil_slot(slot);
  delete from public.scheduler_v2_segments s using public.scheduler_v2_queue_items q where s.machine_id=q.machine_id and s.task_id=q.task_id and q.machine_id=p_machine_id and q.position>fixed;
  for task in
    select q.task_id,coalesce(m.duration_minutes,ceil(coalesce(nullif(o.time_remaining,0),nullif(o.duration,0))::numeric*60)::integer) minutes
    from public.scheduler_v2_queue_items q join public.odp_orders o on o.id=q.task_id left join public.scheduler_v2_task_metadata m on m.task_id=q.task_id
    where q.machine_id=p_machine_id and q.position>fixed order by q.position,q.task_id
  loop
    if task.minutes is null or task.minutes<=0 then raise exception 'Task % has no positive duration',task.task_id using errcode='P0001'; end if;
    remaining:=ceil(task.minutes::numeric/15); scanned:=0; seg_start:=null; seg_end:=null;
    while remaining>0 loop
      if scanned>=70176 then raise exception 'No capacity for task % within two years',task.task_id using errcode='P0001'; end if;
      if public.scheduler_v2_slot_available(p_machine_id,slot) then
        if seg_start is null then seg_start:=slot; seg_end:=slot+interval '15 minutes';
        elsif seg_end=slot then seg_end:=slot+interval '15 minutes';
        else insert into public.scheduler_v2_segments(machine_id,task_id,starts_at,ends_at) values(p_machine_id,task.task_id,seg_start,seg_end); written:=written+1; seg_start:=slot; seg_end:=slot+interval '15 minutes'; end if;
        remaining:=remaining-1;
      elsif seg_start is not null then
        insert into public.scheduler_v2_segments(machine_id,task_id,starts_at,ends_at) values(p_machine_id,task.task_id,seg_start,seg_end); written:=written+1; seg_start:=null; seg_end:=null;
      end if;
      slot:=slot+interval '15 minutes'; scanned:=scanned+1;
    end loop;
    if seg_start is not null then insert into public.scheduler_v2_segments(machine_id,task_id,starts_at,ends_at) values(p_machine_id,task.task_id,seg_start,seg_end); written:=written+1; end if;
  end loop;
  update public.odp_orders o set scheduled_machine_id=p_machine_id, scheduled_start_time=x.starts_at, scheduled_end_time=x.ends_at, status=case when o.status='IN PROGRESS' then o.status else 'SCHEDULED' end from (select task_id,min(starts_at) starts_at,max(ends_at) ends_at from public.scheduler_v2_segments where machine_id=p_machine_id group by task_id) x where o.id=x.task_id;
  update public.scheduler_v2_machine_state set revision=revision+1,updated_at=now() where machine_id=p_machine_id returning revision into rev;
  return jsonb_build_object('machine_id',p_machine_id,'revision',rev,'segments_written',written);
end $$;

create function public.scheduler_v2_schedule_task(p_machine_id uuid,p_task_id uuid,p_before_task_id uuid default null,p_expected_revision integer default null) returns jsonb
language plpgsql security definer set search_path=public,pg_catalog as $$
declare rev integer; old_machine uuid; task_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text,1)); rev:=public.scheduler_v2_lock_revision(p_machine_id,p_expected_revision);
  select status into task_status from public.odp_orders where id=p_task_id;
  if not found then raise exception 'Task % does not exist',p_task_id using errcode='P0001'; end if;
  if task_status in ('IN PROGRESS','COMPLETED') then raise exception 'Task % cannot be queued',p_task_id using errcode='P0001'; end if;
  select machine_id into old_machine from public.scheduler_v2_queue_items where task_id=p_task_id;
  if old_machine is not null and old_machine<>p_machine_id then raise exception 'Use cross-machine move' using errcode='P0001'; end if;
  if p_before_task_id=p_task_id then return jsonb_build_object('machine_id',p_machine_id,'revision',rev); end if;
  delete from public.scheduler_v2_queue_items where task_id=p_task_id; perform public.scheduler_v2_resequence(p_machine_id);
  perform public.scheduler_v2_insert_at(p_machine_id,p_task_id,p_before_task_id);
  insert into public.scheduler_v2_task_metadata(task_id) values(p_task_id) on conflict do nothing;
  return public.scheduler_v2_replan_machine(p_machine_id,rev);
end $$;

create function public.scheduler_v2_unschedule_task(p_task_id uuid,p_expected_revision integer default null) returns jsonb
language plpgsql security definer set search_path=public,pg_catalog as $$
declare machine uuid; rev integer; task_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text,1));
  select q.machine_id,o.status into machine,task_status from public.scheduler_v2_queue_items q join public.odp_orders o on o.id=q.task_id where q.task_id=p_task_id;
  if machine is null then raise exception 'Task % is not scheduled',p_task_id using errcode='P0001'; end if;
  if task_status='IN PROGRESS' then raise exception 'In-progress task cannot be unscheduled' using errcode='P0001'; end if;
  rev:=public.scheduler_v2_lock_revision(machine,p_expected_revision);
  delete from public.scheduler_v2_queue_items where task_id=p_task_id; perform public.scheduler_v2_resequence(machine);
  update public.odp_orders set scheduled_machine_id=null,scheduled_start_time=null,scheduled_end_time=null,status='NOT SCHEDULED' where id=p_task_id and task_status<>'COMPLETED';
  return public.scheduler_v2_replan_machine(machine,rev);
end $$;

create function public.scheduler_v2_move_task(p_task_id uuid,p_target_machine_id uuid,p_before_task_id uuid,p_expected_source_revision integer,p_expected_target_revision integer) returns jsonb
language plpgsql security definer set search_path=public,pg_catalog as $$
declare source uuid; source_rev integer; target_rev integer; task_status text; source_result jsonb; target_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text,1));
  select q.machine_id,o.status into source,task_status from public.scheduler_v2_queue_items q join public.odp_orders o on o.id=q.task_id where q.task_id=p_task_id;
  if source is null or source=p_target_machine_id then raise exception 'Invalid cross-machine move' using errcode='22023'; end if;
  if task_status='IN PROGRESS' then raise exception 'In-progress task cannot be moved' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(source::text,p_target_machine_id::text),0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(source::text,p_target_machine_id::text),0));
  source_rev:=public.scheduler_v2_lock_revision(source,p_expected_source_revision); target_rev:=public.scheduler_v2_lock_revision(p_target_machine_id,p_expected_target_revision);
  delete from public.scheduler_v2_queue_items where task_id=p_task_id; perform public.scheduler_v2_resequence(source);
  update public.odp_orders set scheduled_machine_id=null,scheduled_start_time=null,scheduled_end_time=null,status='NOT SCHEDULED' where id=p_task_id;
  perform public.scheduler_v2_insert_at(p_target_machine_id,p_task_id,p_before_task_id);
  source_result:=public.scheduler_v2_replan_machine(source,source_rev); target_result:=public.scheduler_v2_replan_machine(p_target_machine_id,target_rev);
  return jsonb_build_object('source',source_result,'target',target_result);
end $$;

create function public.scheduler_v2_set_task_duration(p_task_id uuid,p_duration_minutes integer,p_expected_revision integer default null) returns jsonb
language plpgsql security definer set search_path=public,pg_catalog as $$
declare machine uuid; rev integer; task_status text;
begin
  if p_duration_minutes is null or p_duration_minutes<=0 then raise exception 'Duration must be positive minutes' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text,1));
  select q.machine_id,o.status into machine,task_status from public.scheduler_v2_queue_items q join public.odp_orders o on o.id=q.task_id where q.task_id=p_task_id;
  if machine is null or task_status='IN PROGRESS' then raise exception 'Task duration cannot be changed' using errcode='P0001'; end if;
  rev:=public.scheduler_v2_lock_revision(machine,p_expected_revision);
  insert into public.scheduler_v2_task_metadata(task_id,duration_minutes) values(p_task_id,p_duration_minutes) on conflict(task_id) do update set duration_minutes=excluded.duration_minutes;
  return public.scheduler_v2_replan_machine(machine,rev);
end $$;

create function public.scheduler_v2_create_pause(p_machine_id uuid,p_duration_minutes integer,p_before_task_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path=public,pg_catalog as $$
declare machine public.machines%rowtype; task uuid; rev integer; result jsonb;
begin
  if p_duration_minutes is null or p_duration_minutes<=0 then raise exception 'Pause duration must be positive' using errcode='22023'; end if;
  rev:=public.scheduler_v2_lock_revision(p_machine_id,p_expected_revision); select * into machine from public.machines where id=p_machine_id;
  if not found then raise exception 'Machine does not exist' using errcode='P0001'; end if;
  insert into public.odp_orders(odp_number,article_code,work_center,nome_cliente,quantity,delivery_date,customer_order_ref,department,duration,cost,status)
  values('PAUSE-'||replace(gen_random_uuid()::text,'-',''),'PAUSE',machine.work_center,'SISTEMA',0,now(),'PAUSE',coalesce(machine.department,'N/A'),p_duration_minutes/60.0,0,'NOT SCHEDULED') returning id into task;
  insert into public.scheduler_v2_task_metadata(task_id,task_kind,duration_minutes) values(task,'pause',p_duration_minutes);
  perform public.scheduler_v2_insert_at(p_machine_id,task,p_before_task_id); result:=public.scheduler_v2_replan_machine(p_machine_id,rev);
  return result||jsonb_build_object('task_id',task);
end $$;

create function public.scheduler_v2_repair_machine(p_machine_id uuid,p_expected_revision integer) returns jsonb
language sql security definer set search_path=public,pg_catalog as $$ select public.scheduler_v2_replan_machine(p_machine_id,p_expected_revision) $$;

create function public.scheduler_v2_add_calendar_override(p_machine_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text default null,p_expected_revision integer default null) returns jsonb
language plpgsql security definer set search_path=public,pg_catalog as $$
declare rev integer; override_id uuid;
begin
  if p_ends_at<=p_starts_at or mod(extract(epoch from p_starts_at)::bigint,900)<>0 or mod(extract(epoch from p_ends_at)::bigint,900)<>0 then raise exception 'Downtime must use 15-minute boundaries' using errcode='22023'; end if;
  rev:=public.scheduler_v2_lock_revision(p_machine_id,p_expected_revision);
  if exists(select 1 from public.scheduler_v2_segments s where s.machine_id=p_machine_id and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) then raise exception 'Downtime overlaps scheduled work' using errcode='P0001'; end if;
  insert into public.scheduler_v2_calendar_overrides(machine_id,starts_at,ends_at,reason) values(p_machine_id,p_starts_at,p_ends_at,nullif(trim(p_reason),'')) returning id into override_id;
  update public.scheduler_v2_machine_state set revision=revision+1,updated_at=now() where machine_id=p_machine_id returning revision into rev;
  return jsonb_build_object('override_id',override_id,'revision',rev);
end $$;

create function public.scheduler_v2_remove_calendar_override(p_override_id uuid,p_expected_revision integer default null) returns jsonb
language plpgsql security definer set search_path=public,pg_catalog as $$
declare machine uuid; rev integer;
begin
  select machine_id into machine from public.scheduler_v2_calendar_overrides where id=p_override_id;
  if machine is null then raise exception 'Downtime does not exist' using errcode='P0001'; end if;
  rev:=public.scheduler_v2_lock_revision(machine,p_expected_revision); delete from public.scheduler_v2_calendar_overrides where id=p_override_id;
  update public.scheduler_v2_machine_state set revision=revision+1,updated_at=now() where machine_id=machine returning revision into rev;
  return jsonb_build_object('machine_id',machine,'revision',rev);
end $$;

create function public.scheduler_v2_workspace_snapshot() returns jsonb
language sql security definer stable set search_path=public,pg_catalog as $$
select jsonb_build_object(
 'revisions',coalesce((select jsonb_object_agg(machine_id::text,revision) from public.scheduler_v2_machine_state),'{}'::jsonb),
 'queue',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('machine_id',q.machine_id,'position',q.position,'task_kind',coalesce(m.task_kind,'production'),'duration_minutes',coalesce(m.duration_minutes,ceil(coalesce(nullif(o.time_remaining,0),nullif(o.duration,0))::numeric*60)::integer)) order by q.machine_id,q.position) from public.scheduler_v2_queue_items q join public.odp_orders o on o.id=q.task_id left join public.scheduler_v2_task_metadata m on m.task_id=q.task_id),'[]'::jsonb),
 'segments',coalesce((select jsonb_agg(to_jsonb(s) order by s.machine_id,s.starts_at) from public.scheduler_v2_segments s),'[]'::jsonb),
 'overrides',coalesce((select jsonb_agg(to_jsonb(c) order by c.machine_id,c.starts_at) from public.scheduler_v2_calendar_overrides c),'[]'::jsonb),
 'pool',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('task_kind',coalesce(m.task_kind,'production'),'duration_minutes',coalesce(m.duration_minutes,ceil(coalesce(nullif(o.time_remaining,0),nullif(o.duration,0))::numeric*60)::integer)) order by o.delivery_date,o.odp_number) from public.odp_orders o left join public.scheduler_v2_task_metadata m on m.task_id=o.id where not exists(select 1 from public.scheduler_v2_queue_items q where q.task_id=o.id) and o.status<>'COMPLETED' and coalesce(o.progress,0)<100 and coalesce(m.duration_minutes,ceil(coalesce(nullif(o.time_remaining,0),nullif(o.duration,0))::numeric*60)::integer,0)>0),'[]'::jsonb)
) $$;

create function public.scheduler_v2_guard_order_delete() returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
begin if exists(select 1 from public.scheduler_v2_queue_items where task_id=old.id) then raise exception 'Task must be unscheduled before deletion' using errcode='P0001'; end if; return old; end $$;
create trigger scheduler_v2_guard_order_delete before delete on public.odp_orders for each row execute function public.scheduler_v2_guard_order_delete();

create function public.scheduler_v2_guard_base_calendar() returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.machine_id,old.machine_id)::text,0));
  if tg_op='DELETE' then if exists(select 1 from public.scheduler_v2_queue_items where machine_id=old.machine_id) then raise exception 'Availability cannot be deleted while work is queued' using errcode='P0001'; end if; insert into public.scheduler_v2_machine_state(machine_id) values(old.machine_id) on conflict do nothing; update public.scheduler_v2_machine_state set revision=revision+1,updated_at=now() where machine_id=old.machine_id; return old; end if;
  if new.unavailable_hours is null or exists(select 1 from unnest(new.unavailable_hours) h where h!~'^(?:[0-9]|1[0-9]|2[0-3])$') then raise exception 'Invalid unavailable hours' using errcode='22023'; end if;
  if exists(select 1 from public.scheduler_v2_segments s cross join unnest(new.unavailable_hours) h cross join lateral(select (new.date+make_interval(hours=>h::integer)) at time zone 'Europe/Rome' starts_at)b where s.machine_id=new.machine_id and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(b.starts_at,b.starts_at+interval '1 hour','[)')) then raise exception 'Calendar change overlaps scheduled work' using errcode='P0001'; end if;
  insert into public.scheduler_v2_machine_state(machine_id) values(new.machine_id) on conflict do nothing; update public.scheduler_v2_machine_state set revision=revision+1,updated_at=now() where machine_id=new.machine_id;
  return new;
end $$;
create trigger scheduler_v2_guard_base_calendar before insert or update or delete on public.machine_availability for each row execute function public.scheduler_v2_guard_base_calendar();

alter table public.scheduler_v2_machine_state enable row level security;
alter table public.scheduler_v2_task_metadata enable row level security;
alter table public.scheduler_v2_queue_items enable row level security;
alter table public.scheduler_v2_calendar_overrides enable row level security;
alter table public.scheduler_v2_segments enable row level security;
revoke all on public.scheduler_v2_machine_state,public.scheduler_v2_task_metadata,public.scheduler_v2_queue_items,public.scheduler_v2_calendar_overrides,public.scheduler_v2_segments from anon,authenticated;
revoke execute on function public.scheduler_v2_schedule_task(uuid,uuid,uuid,integer),public.scheduler_v2_unschedule_task(uuid,integer),public.scheduler_v2_move_task(uuid,uuid,uuid,integer,integer),public.scheduler_v2_set_task_duration(uuid,integer,integer),public.scheduler_v2_create_pause(uuid,integer,uuid,integer),public.scheduler_v2_repair_machine(uuid,integer),public.scheduler_v2_add_calendar_override(uuid,timestamptz,timestamptz,text,integer),public.scheduler_v2_remove_calendar_override(uuid,integer),public.scheduler_v2_workspace_snapshot() from public,anon;
revoke execute on function public.scheduler_v2_ceil_slot(timestamptz),public.scheduler_v2_slot_available(uuid,timestamptz),public.scheduler_v2_lock_revision(uuid,integer),public.scheduler_v2_resequence(uuid),public.scheduler_v2_insert_at(uuid,uuid,uuid),public.scheduler_v2_replan_machine(uuid,integer),public.scheduler_v2_guard_order_delete(),public.scheduler_v2_guard_base_calendar() from public,authenticated;
grant execute on function public.scheduler_v2_schedule_task(uuid,uuid,uuid,integer),public.scheduler_v2_unschedule_task(uuid,integer),public.scheduler_v2_move_task(uuid,uuid,uuid,integer,integer),public.scheduler_v2_set_task_duration(uuid,integer,integer),public.scheduler_v2_create_pause(uuid,integer,uuid,integer),public.scheduler_v2_repair_machine(uuid,integer),public.scheduler_v2_add_calendar_override(uuid,timestamptz,timestamptz,text,integer),public.scheduler_v2_remove_calendar_override(uuid,integer),public.scheduler_v2_workspace_snapshot() to authenticated;

drop policy if exists "All users can insert" on public.odp_orders;
drop policy if exists "All users can select" on public.odp_orders;
drop policy if exists "All users can update" on public.odp_orders;
insert into public.scheduler_v2_machine_state(machine_id) select id from public.machines on conflict do nothing;
insert into public.scheduler_v2_task_metadata(task_id,task_kind) select id,case when article_code='PAUSE' then 'pause' else 'production' end from public.odp_orders on conflict do nothing;
insert into public.scheduler_v2_queue_items(machine_id,task_id,position)
select scheduled_machine_id,id,row_number() over(partition by scheduled_machine_id order by scheduled_start_time,id)::integer from public.odp_orders where scheduled_machine_id is not null and status in('SCHEDULED','IN PROGRESS') on conflict(task_id) do nothing;
commit;
