-- =============================================================================
-- Collaboration and polish: comments, activity, notifications, attachments,
-- covers, board colours, search, onboarding, research fields, realtime.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Entries: research fields, search
-- -----------------------------------------------------------------------------

alter table public.tasks
  add column milestone boolean not null default false,
  -- {hypothesis, protocol: [{text, done}], results, outcome: supported|refuted|inconclusive|null}
  add column experiment jsonb,
  add column search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored;
create index tasks_search_idx on public.tasks using gin (search);
create index tasks_due_date_idx on public.tasks (due_date) where due_date is not null;
grant update (milestone, experiment) on public.tasks to authenticated;

alter table public.boards add constraint boards_color_ink check (color is null or color ~ '^ink-[1-6]$');

alter table public.profiles add column onboarded_at timestamptz;
grant update (onboarded_at) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null,
  task_id    uuid not null,
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Mentions are written as @[Name](profile-uuid).
  body       text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  foreign key (board_id, task_id) references public.tasks (board_id, id) on delete cascade
);
create index comments_task_idx on public.comments (task_id, created_at);
alter table public.comments enable row level security;
revoke update on public.comments from authenticated;
grant update (body, edited_at) on public.comments to authenticated;

create policy "comments: members read" on public.comments for select to authenticated
  using (private.can_access_board(board_id));
create policy "comments: members write as themselves" on public.comments for insert to authenticated
  with check (private.can_access_board(board_id) and author_id = (select auth.uid()));
create policy "comments: authors edit" on public.comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "comments: authors delete" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Attachments (files live in the private "attachments" bucket at <board>/<task>/<file>)
-- -----------------------------------------------------------------------------

create table public.attachments (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null,
  task_id     uuid not null,
  uploader_id uuid default auth.uid() references public.profiles (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 255),
  path        text not null unique,
  size        bigint not null default 0,
  mime        text,
  created_at  timestamptz not null default now(),
  foreign key (board_id, task_id) references public.tasks (board_id, id) on delete cascade
);
create index attachments_task_idx on public.attachments (task_id);
alter table public.attachments enable row level security;

create policy "attachments: members read" on public.attachments for select to authenticated
  using (private.can_access_board(board_id));
create policy "attachments: members add" on public.attachments for insert to authenticated
  with check (private.can_access_board(board_id) and uploader_id = (select auth.uid()));
create policy "attachments: members remove" on public.attachments for delete to authenticated
  using (private.can_access_board(board_id));

alter table public.tasks add column cover_attachment_id uuid references public.attachments (id) on delete set null;
grant update (cover_attachment_id) on public.tasks to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do nothing;

create function private.board_from_path(object_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;
grant execute on function private.board_from_path(text) to authenticated;

create policy "attachments bucket: members read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and private.can_access_board(private.board_from_path(name)));
create policy "attachments bucket: members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and private.can_access_board(private.board_from_path(name)));
create policy "attachments bucket: members delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and private.can_access_board(private.board_from_path(name)));

-- -----------------------------------------------------------------------------
-- Activity (written only by triggers)
-- -----------------------------------------------------------------------------

create table public.activity (
  id         bigint generated always as identity primary key,
  board_id   uuid not null references public.boards (id) on delete cascade,
  task_id    uuid references public.tasks (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  kind       text not null,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_board_idx on public.activity (board_id, created_at desc);
create index activity_task_idx on public.activity (task_id, created_at desc);
alter table public.activity enable row level security;
revoke insert, update, delete on public.activity from authenticated;
create policy "activity: members read" on public.activity for select to authenticated
  using (private.can_access_board(board_id));

create function private.log_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  b uuid := new.board_id;
  t uuid := new.id;
begin
  -- Seeds and service-role writes have no actor; history starts with real people.
  if actor is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'created', jsonb_build_object('title', new.title, 'type', new.type));
    return new;
  end if;

  if new.column_id is distinct from old.column_id then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'moved', jsonb_build_object(
      'from', (select name from public.board_columns where id = old.column_id),
      'to', (select name from public.board_columns where id = new.column_id)));
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'assigned', jsonb_build_object(
      'to', (select display_name from public.profiles where id = new.assignee_id)));
  end if;
  if new.sprint_id is distinct from old.sprint_id then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'sprint', jsonb_build_object(
      'to', coalesce((select name from public.sprints where id = new.sprint_id), 'Backlog')));
  end if;
  if new.priority is distinct from old.priority then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'priority', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if new.story_points is distinct from old.story_points then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'points', jsonb_build_object('from', old.story_points, 'to', new.story_points));
  end if;
  if new.due_date is distinct from old.due_date then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'due', jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;
  if new.title is distinct from old.title then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'renamed', jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  if new.type is distinct from old.type then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'type', jsonb_build_object('from', old.type, 'to', new.type));
  end if;
  if new.epic_id is distinct from old.epic_id then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'epic', jsonb_build_object(
      'to', (select title from public.tasks where id = new.epic_id)));
  end if;
  if new.archived_at is not null and old.archived_at is null then
    insert into public.activity (board_id, task_id, actor_id, kind, data)
    values (b, t, actor, 'archived', '{}');
  end if;
  return new;
end;
$$;

create trigger tasks_50_activity
  after insert or update on public.tasks
  for each row execute function private.log_task_activity();

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  board_id   uuid references public.boards (id) on delete cascade,
  task_id    uuid references public.tasks (id) on delete cascade,
  kind       text not null check (kind in ('assigned', 'mentioned', 'commented')),
  data       jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "notifications: own read" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: own mark read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: own clear" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create function private.is_board_member(b uuid, u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boards bo
    join public.workspace_members m on m.workspace_id = bo.workspace_id
    where bo.id = b and m.user_id = u
  );
$$;

create function private.notify_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
begin
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.assignee_id is distinct from actor
     and actor is not null then
    insert into public.notifications (user_id, actor_id, board_id, task_id, kind, data)
    values (new.assignee_id, actor, new.board_id, new.id, 'assigned', jsonb_build_object('title', new.title));
  end if;
  return new;
end;
$$;

create trigger tasks_60_notify_assignment
  after insert or update of assignee_id on public.tasks
  for each row execute function private.notify_assignment();

create function private.on_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  task record;
  mentioned uuid[];
  recipient uuid;
  excerpt text;
begin
  select t.title, t.assignee_id, t.reporter_id into task from public.tasks t where t.id = new.task_id;

  excerpt := case when length(new.body) > 140 then rtrim(left(new.body, 139)) || '…' else new.body end;

  insert into public.activity (board_id, task_id, actor_id, kind, data, created_at)
  values (new.board_id, new.task_id, new.author_id, 'commented', jsonb_build_object('excerpt', excerpt), new.created_at);

  select coalesce(array_agg(distinct m[1]::uuid), '{}') into mentioned
  from regexp_matches(new.body, '@\[[^\]]+\]\(([0-9a-f-]{36})\)', 'g') as m;

  foreach recipient in array mentioned loop
    if recipient <> new.author_id and private.is_board_member(new.board_id, recipient) then
      insert into public.notifications (user_id, actor_id, board_id, task_id, kind, data, created_at)
      values (recipient, new.author_id, new.board_id, new.task_id, 'mentioned',
              jsonb_build_object('title', task.title, 'excerpt', excerpt), new.created_at);
    end if;
  end loop;

  foreach recipient in array array_remove(array[task.assignee_id, task.reporter_id], null) loop
    if recipient <> new.author_id and not (recipient = any (mentioned))
       and private.is_board_member(new.board_id, recipient)
       and not exists (
         select 1 from public.notifications n
         where n.user_id = recipient and n.task_id = new.task_id and n.kind = 'commented'
           and n.created_at > now() - interval '1 second'
       ) then
      insert into public.notifications (user_id, actor_id, board_id, task_id, kind, data, created_at)
      values (recipient, new.author_id, new.board_id, new.task_id, 'commented',
              jsonb_build_object('title', task.title, 'excerpt', excerpt), new.created_at);
    end if;
  end loop;
  return new;
end;
$$;

create trigger comments_after_insert
  after insert on public.comments
  for each row execute function private.on_comment();

-- -----------------------------------------------------------------------------
-- Search across every board the caller can see (RLS applies: security invoker)
-- -----------------------------------------------------------------------------

create function public.search_entries(q text)
returns table (
  id uuid, board_id uuid, board_key text, board_name text, number integer,
  title text, type public.task_type, completed_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.board_id, b.key, b.name, t.number, t.title, t.type, t.completed_at
  from public.tasks t
  join public.boards b on b.id = t.board_id
  where t.archived_at is null
    and b.archived_at is null
    and length(trim(q)) > 0
    and (
      t.search @@ websearch_to_tsquery('simple', q)
      or t.title ilike '%' || trim(q) || '%'
      or (b.key || '-' || t.number) ilike trim(q) || '%'
    )
  order by
    ((b.key || '-' || t.number) ilike trim(q)) desc,
    ts_rank(t.search, websearch_to_tsquery('simple', q)) desc,
    t.completed_at is not null,
    t.updated_at desc
  limit 20;
$$;
revoke execute on function public.search_entries(text) from public, anon;
grant execute on function public.search_entries(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: board views refresh when teammates change things
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.tasks, public.task_labels, public.board_columns, public.sprints,
  public.comments, public.attachments, public.activity, public.notifications;
