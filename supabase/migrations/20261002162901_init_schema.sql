-- =============================================================================
-- Initial schema: workspaces, boards, columns, sprints, labels, tasks.
-- Authorization is enforced entirely by Row Level Security; see "Policies".
-- =============================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.column_category as enum ('todo', 'in_progress', 'done');
create type public.sprint_status as enum ('planned', 'active', 'completed');
create type public.task_type as enum ('epic', 'story', 'task', 'bug', 'subtask');
create type public.task_priority as enum ('lowest', 'low', 'medium', 'high', 'highest');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  is_personal boolean not null default false,
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.workspace_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.boards (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  -- Prefix for task keys, e.g. "TT" -> TT-42.
  key              text not null check (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  description      text,
  color            text,
  next_task_number integer not null default 1,
  archived_at      timestamptz,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (workspace_id, key)
);
create index boards_workspace_id_idx on public.boards (workspace_id);

create table public.board_columns (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  category   public.column_category not null default 'todo',
  -- Fractional index; "C" collation gives plain byte ordering.
  position   text collate "C" not null,
  wip_limit  integer check (wip_limit > 0),
  created_at timestamptz not null default now(),
  unique (board_id, id)
);
create index board_columns_board_position_idx on public.board_columns (board_id, position);

create table public.sprints (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  goal         text,
  status       public.sprint_status not null default 'planned',
  start_date   date,
  end_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (board_id, id),
  check (start_date is null or end_date is null or end_date >= start_date)
);
create unique index sprints_one_active_per_board on public.sprints (board_id) where status = 'active';

create table public.labels (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name     text not null check (char_length(name) between 1 and 40),
  color    text not null,
  unique (board_id, name),
  unique (board_id, id)
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards (id) on delete cascade,
  number       integer not null, -- assigned by trigger
  type         public.task_type not null default 'task',
  title        text not null check (char_length(title) between 1 and 500),
  description  text,
  column_id    uuid not null,
  position     text collate "C" not null,
  priority     public.task_priority not null default 'medium',
  story_points numeric(4, 1) check (story_points >= 0),
  sprint_id    uuid, -- null = backlog
  epic_id      uuid, -- story/task/bug -> epic
  parent_id    uuid, -- subtask -> story/task/bug
  assignee_id  uuid references public.profiles (id) on delete set null,
  reporter_id  uuid default auth.uid() references public.profiles (id) on delete set null,
  start_date   date,
  due_date     date,
  completed_at timestamptz, -- maintained by trigger from the column category
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (board_id, number),
  unique (board_id, id),
  -- Composite FKs keep every reference inside the same board.
  foreign key (board_id, column_id) references public.board_columns (board_id, id) on delete restrict,
  foreign key (board_id, sprint_id) references public.sprints (board_id, id) on delete set null (sprint_id),
  foreign key (board_id, epic_id) references public.tasks (board_id, id) on delete set null (epic_id),
  foreign key (board_id, parent_id) references public.tasks (board_id, id) on delete cascade
);
create index tasks_board_column_position_idx on public.tasks (board_id, column_id, position);
create index tasks_sprint_id_idx on public.tasks (sprint_id);
create index tasks_epic_id_idx on public.tasks (epic_id);
create index tasks_parent_id_idx on public.tasks (parent_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

create table public.task_labels (
  board_id uuid not null,
  task_id  uuid not null,
  label_id uuid not null,
  primary key (task_id, label_id),
  foreign key (board_id, task_id) references public.tasks (board_id, id) on delete cascade,
  foreign key (board_id, label_id) references public.labels (board_id, id) on delete cascade
);
create index task_labels_label_id_idx on public.task_labels (label_id);

-- -----------------------------------------------------------------------------
-- Authorization helpers (security definer so policies don't recurse into RLS)
-- -----------------------------------------------------------------------------

create function private.is_workspace_member(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create function private.has_workspace_role(ws uuid, roles public.workspace_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = any (roles)
  );
$$;

create function private.is_personal_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select w.is_personal from public.workspaces w where w.id = ws), false);
$$;

create function private.can_access_board(b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boards bo
    join public.workspace_members m on m.workspace_id = bo.workspace_id
    where bo.id = b and m.user_id = (select auth.uid())
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- New auth user -> profile + personal workspace + starter board.
-- Also enforces the hard cap on accounts.
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  max_users constant integer := 5;
  ws_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('private.handle_new_user'));
  if (select count(*) from public.profiles) >= max_users then
    raise exception 'This tracker is limited to % accounts', max_users;
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  );

  insert into public.workspaces (name, is_personal, created_by)
  values ('Personal', true, new.id)
  returning id into ws_id;

  insert into public.boards (workspace_id, name, key, created_by)
  values (ws_id, 'My Tasks', 'MY', new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Creator of a workspace becomes its owner.
create function private.add_workspace_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger workspaces_add_owner
  after insert on public.workspaces
  for each row execute function private.add_workspace_owner();

-- Every new board starts with To Do / In Progress / Done.
create function private.create_default_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.board_columns (board_id, name, category, position) values
    (new.id, 'To Do', 'todo', 'a0'),
    (new.id, 'In Progress', 'in_progress', 'a1'),
    (new.id, 'Done', 'done', 'a2');
  return new;
end;
$$;

create trigger boards_default_columns
  after insert on public.boards
  for each row execute function private.create_default_columns();

-- Per-board sequential task numbers (row lock on the board serializes inserts).
create function private.assign_task_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.boards
  set next_task_number = next_task_number + 1
  where id = new.board_id
  returning next_task_number - 1 into new.number;
  return new;
end;
$$;

-- Issue-type hierarchy and assignee membership.
create function private.validate_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ref_type public.task_type;
  ws uuid;
begin
  if new.epic_id is not null then
    if new.type not in ('story', 'task', 'bug') then
      raise exception using errcode = 'check_violation',
        message = 'Only stories, tasks and bugs can belong to an epic';
    end if;
    select t.type into ref_type from public.tasks t where t.id = new.epic_id;
    if ref_type is distinct from 'epic' then
      raise exception using errcode = 'check_violation', message = 'epic_id must reference an epic';
    end if;
  end if;

  if new.type = 'subtask' then
    if new.parent_id is null then
      raise exception using errcode = 'check_violation', message = 'A subtask needs a parent task';
    end if;
    select t.type into ref_type from public.tasks t where t.id = new.parent_id;
    if ref_type is null or ref_type not in ('story', 'task', 'bug') then
      raise exception using errcode = 'check_violation',
        message = 'A subtask''s parent must be a story, task or bug';
    end if;
  elsif new.parent_id is not null then
    raise exception using errcode = 'check_violation', message = 'Only subtasks can have a parent task';
  end if;

  if tg_op = 'UPDATE' and new.type is distinct from old.type then
    if old.type = 'epic' and exists (select 1 from public.tasks t where t.epic_id = new.id) then
      raise exception using errcode = 'check_violation',
        message = 'Detach this epic''s issues before changing its type';
    end if;
    if new.type in ('epic', 'subtask') and exists (select 1 from public.tasks t where t.parent_id = new.id) then
      raise exception using errcode = 'check_violation',
        message = 'Remove this task''s subtasks before changing its type';
    end if;
  end if;

  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    select b.workspace_id into ws from public.boards b where b.id = new.board_id;
    if not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = ws and m.user_id = new.assignee_id
    ) then
      raise exception using errcode = 'check_violation',
        message = 'Assignee must be a member of the workspace';
    end if;
  end if;

  return new;
end;
$$;

-- completed_at follows the column category (feeds velocity / burndown).
create function private.sync_task_completion()
returns trigger language plpgsql set search_path = '' as $$
declare
  cat public.column_category;
begin
  if tg_op = 'INSERT' or new.column_id is distinct from old.column_id then
    select c.category into cat from public.board_columns c where c.id = new.column_id;
    if cat = 'done' then
      new.completed_at := coalesce(case when tg_op = 'UPDATE' then old.completed_at end, now());
    else
      new.completed_at := null;
    end if;
  else
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- BEFORE triggers fire in name order.
create trigger tasks_10_number
  before insert on public.tasks
  for each row execute function private.assign_task_number();
create trigger tasks_20_validate
  before insert or update on public.tasks
  for each row execute function private.validate_task();
create trigger tasks_30_completion
  before insert or update on public.tasks
  for each row execute function private.sync_task_completion();
create trigger tasks_40_updated_at
  before update on public.tasks
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Column-level privileges (system-managed columns are not client-writable)
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;

revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

revoke update on public.workspace_members from authenticated;
grant update (role) on public.workspace_members to authenticated;

revoke update on public.boards from authenticated;
grant update (workspace_id, name, key, description, color, archived_at) on public.boards to authenticated;

revoke update on public.tasks from authenticated;
grant update (
  type, title, description, column_id, position, priority, story_points,
  sprint_id, epic_id, parent_id, assignee_id, reporter_id, start_date, due_date, archived_at
) on public.tasks to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.boards enable row level security;
alter table public.board_columns enable row level security;
alter table public.sprints enable row level security;
alter table public.labels enable row level security;
alter table public.tasks enable row level security;
alter table public.task_labels enable row level security;

-- profiles: the app is a closed group of <= 5 invited people, so everyone
-- signed in can see everyone (needed to add someone to a workspace).
create policy "profiles: signed-in users can read"
  on public.profiles for select to authenticated using (true);
create policy "profiles: users update themselves"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces
create policy "workspaces: members (and creator) can read"
  on public.workspaces for select to authenticated
  using (created_by = (select auth.uid()) or private.is_workspace_member(id));
create policy "workspaces: users create team workspaces"
  on public.workspaces for insert to authenticated
  with check (created_by = (select auth.uid()) and not is_personal);
create policy "workspaces: owners and admins rename"
  on public.workspaces for update to authenticated
  using (private.has_workspace_role(id, '{owner,admin}'));
create policy "workspaces: owners delete team workspaces"
  on public.workspaces for delete to authenticated
  using (not is_personal and private.has_workspace_role(id, '{owner}'));

-- workspace_members
create policy "members: members can read"
  on public.workspace_members for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "members: owners and admins add non-owners to team workspaces"
  on public.workspace_members for insert to authenticated
  with check (
    role <> 'owner'
    and not private.is_personal_workspace(workspace_id)
    and private.has_workspace_role(workspace_id, '{owner,admin}')
  );
create policy "members: owners change other members' roles"
  on public.workspace_members for update to authenticated
  using (user_id <> (select auth.uid()) and private.has_workspace_role(workspace_id, '{owner}'))
  with check (role <> 'owner');
create policy "members: admins remove non-owners, anyone but the owner can leave"
  on public.workspace_members for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = (select auth.uid()) or private.has_workspace_role(workspace_id, '{owner,admin}'))
  );

-- boards
create policy "boards: members read"
  on public.boards for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "boards: members create"
  on public.boards for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and created_by = (select auth.uid()));
create policy "boards: members update"
  on public.boards for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));
create policy "boards: owners and admins delete"
  on public.boards for delete to authenticated
  using (private.has_workspace_role(workspace_id, '{owner,admin}'));

-- Everything inside a board is open to every member of its workspace.
create policy "board_columns: workspace members"
  on public.board_columns for all to authenticated
  using (private.can_access_board(board_id)) with check (private.can_access_board(board_id));
create policy "sprints: workspace members"
  on public.sprints for all to authenticated
  using (private.can_access_board(board_id)) with check (private.can_access_board(board_id));
create policy "labels: workspace members"
  on public.labels for all to authenticated
  using (private.can_access_board(board_id)) with check (private.can_access_board(board_id));
create policy "tasks: workspace members"
  on public.tasks for all to authenticated
  using (private.can_access_board(board_id)) with check (private.can_access_board(board_id));
create policy "task_labels: workspace members"
  on public.task_labels for all to authenticated
  using (private.can_access_board(board_id)) with check (private.can_access_board(board_id));
