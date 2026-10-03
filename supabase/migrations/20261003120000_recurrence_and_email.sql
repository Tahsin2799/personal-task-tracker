-- =============================================================================
-- Recurring entries, and email (notification batches and due-date reminders).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Recurring entries: finishing one writes the next occurrence into To Do
-- -----------------------------------------------------------------------------

alter table public.tasks
  add column repeat_every smallint check (repeat_every between 1 and 365),
  add column repeat_unit text check (repeat_unit in ('day', 'week', 'month', 'year')),
  -- The occurrence this one spawned when it was finished; guards against spawning twice.
  add column next_occurrence_id uuid references public.tasks (id) on delete set null,
  add constraint tasks_repeat_complete check ((repeat_every is null) = (repeat_unit is null));

grant update (repeat_every, repeat_unit) on public.tasks to authenticated;

create function private.spawn_next_occurrence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  step interval := make_interval(
    days => case new.repeat_unit when 'day' then new.repeat_every when 'week' then 7 * new.repeat_every else 0 end,
    months => case new.repeat_unit when 'month' then new.repeat_every when 'year' then 12 * new.repeat_every else 0 end);
  finished date := (new.completed_at at time zone 'utc')::date;
  next_due date := coalesce(new.due_date, finished);
  todo uuid;
  next_sprint uuid := null;
  next_position text;
  copy_id uuid;
  sub record;
begin
  if new.type not in ('story', 'task', 'bug') then
    return new;
  end if;

  -- Step past the date it was finished, so a late finish doesn't spawn something already overdue.
  loop
    next_due := (next_due + step)::date;
    exit when next_due > finished;
  end loop;

  select c.id into todo from public.board_columns c
  where c.board_id = new.board_id
  order by (c.category = 'todo') desc, c.position
  limit 1;

  -- Stay in the sprint only when the next occurrence still falls inside it.
  if new.sprint_id is not null then
    select s.id into next_sprint from public.sprints s
    where s.id = new.sprint_id and s.status <> 'completed' and (s.end_date is null or next_due <= s.end_date);
  end if;

  -- A key just after the column's last one ("a3" -> "a3V") is a valid fractional index between it and anything above.
  select coalesce(max(t.position) || 'V', 'a0') into next_position from public.tasks t where t.column_id = todo;

  insert into public.tasks (
    board_id, number, type, title, description, column_id, position, priority, story_points,
    sprint_id, epic_id, assignee_id, reporter_id, start_date, due_date, milestone, repeat_every, repeat_unit)
  values (
    new.board_id, 0, new.type, new.title, new.description, todo, next_position, new.priority, new.story_points,
    next_sprint, new.epic_id,
    case when private.is_board_member(new.board_id, new.assignee_id) then new.assignee_id end,
    new.reporter_id,
    case when new.start_date is not null and new.due_date is not null then next_due - (new.due_date - new.start_date) end,
    next_due, new.milestone, new.repeat_every, new.repeat_unit)
  returning id into copy_id;

  insert into public.task_labels (board_id, task_id, label_id)
  select new.board_id, copy_id, tl.label_id from public.task_labels tl where tl.task_id = new.id;

  -- Subtasks are the occurrence's checklist: copy them, all open again.
  for sub in
    select t.title, t.story_points, t.assignee_id from public.tasks t
    where t.parent_id = new.id and t.archived_at is null
    order by t.position
  loop
    select coalesce(max(t.position) || 'V', 'a0') into next_position from public.tasks t where t.column_id = todo;
    insert into public.tasks (board_id, number, type, title, column_id, position, parent_id, story_points, assignee_id)
    values (new.board_id, 0, 'subtask', sub.title, todo, next_position, copy_id, sub.story_points,
            case when private.is_board_member(new.board_id, sub.assignee_id) then sub.assignee_id end);
  end loop;

  new.next_occurrence_id := copy_id;
  return new;
end;
$$;

-- Runs after tasks_30_completion has set completed_at.
create trigger tasks_35_recur
  before update on public.tasks
  for each row
  when (new.completed_at is not null and old.completed_at is null
        and new.repeat_every is not null and new.next_occurrence_id is null and new.archived_at is null)
  execute function private.spawn_next_occurrence();

-- -----------------------------------------------------------------------------
-- Email preferences and bookkeeping
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column time_zone text not null default 'UTC',
  add column email_notifications boolean not null default true,
  add column email_due_reminders boolean not null default true,
  -- The viewer-local date the last due-date reminder covered (written by the email worker).
  add column reminded_on date;

grant update (time_zone, email_notifications, email_due_reminders) on public.profiles to authenticated;

alter table public.notifications add column emailed_at timestamptz;
create index notifications_unemailed_idx on public.notifications (created_at) where emailed_at is null and read_at is null;

-- -----------------------------------------------------------------------------
-- Schedule: every 10 minutes, ask the app's email worker to run.
-- The worker URL and shared secret live in Vault, set per environment:
--   select vault.create_secret('https://<site>/api/cron/email', 'email_worker_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Without them the job does nothing.
-- -----------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function private.kick_email_worker()
returns void language plpgsql security definer set search_path = '' as $$
declare
  url text := (select decrypted_secret from vault.decrypted_secrets where name = 'email_worker_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret');
begin
  if url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
end;
$$;

revoke execute on function private.kick_email_worker() from public, anon, authenticated;

select cron.schedule('email-worker', '*/10 * * * *', 'select private.kick_email_worker()');
