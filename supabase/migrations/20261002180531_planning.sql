-- =============================================================================
-- Planning: sprint commitment snapshot, label inks, atomic sprint start/complete.
-- =============================================================================

-- Points committed when the sprint started; velocity compares it with what finished.
alter table public.sprints add column committed_points numeric(6, 1);

-- Labels use the field book's fixed ink set.
alter table public.labels
  add constraint labels_color_ink check (color ~ '^ink-[1-6]$');

-- Start a planned sprint: one active sprint per board, dates and goal set, commitment snapshotted.
-- security invoker: RLS decides whether the caller may touch this board.
create function public.start_sprint(sprint uuid, starts date, ends date, sprint_goal text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  b uuid;
begin
  if ends < starts then
    raise exception using errcode = 'check_violation', message = 'The sprint has to end after it starts';
  end if;

  select s.board_id into b from public.sprints s where s.id = sprint and s.status = 'planned';
  if b is null then
    raise exception using errcode = 'no_data_found', message = 'Only a planned sprint can be started';
  end if;
  if exists (select 1 from public.sprints s where s.board_id = b and s.status = 'active') then
    raise exception using errcode = 'unique_violation', message = 'Complete the active sprint before starting another';
  end if;

  update public.sprints s
  set status = 'active',
      start_date = starts,
      end_date = ends,
      goal = nullif(trim(sprint_goal), ''),
      committed_points = (
        select coalesce(sum(t.story_points), 0) from public.tasks t
        where t.sprint_id = sprint and t.archived_at is null and t.type not in ('epic', 'subtask')
      )
  where s.id = sprint;
end;
$$;

-- Complete the active sprint and carry unfinished work to another sprint (or the backlog when null).
create function public.complete_sprint(sprint uuid, carry_to uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  moved integer;
begin
  if not exists (select 1 from public.sprints s where s.id = sprint and s.status = 'active') then
    raise exception using errcode = 'no_data_found', message = 'Only the active sprint can be completed';
  end if;
  if carry_to is not null and not exists (
    select 1 from public.sprints s
    where s.id = carry_to and s.status = 'planned'
      and s.board_id = (select board_id from public.sprints where id = sprint)
  ) then
    raise exception using errcode = 'check_violation', message = 'Unfinished work can only move to a planned sprint on this board';
  end if;

  update public.tasks t set sprint_id = carry_to
  where t.sprint_id = sprint and t.completed_at is null;
  get diagnostics moved = row_count;

  update public.sprints s set status = 'completed', completed_at = now() where s.id = sprint;
  return moved;
end;
$$;

revoke execute on function public.start_sprint(uuid, date, date, text) from public, anon;
revoke execute on function public.complete_sprint(uuid, uuid) from public, anon;
grant execute on function public.start_sprint(uuid, date, date, text) to authenticated;
grant execute on function public.complete_sprint(uuid, uuid) to authenticated;
