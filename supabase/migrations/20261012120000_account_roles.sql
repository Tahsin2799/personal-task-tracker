-- =============================================================================
-- Account roles. One admin, at most five owners, any number of workspace users.
--   admin  runs this Bird-Watcher. An owner who can also manage every account and team
--          workspace from /admin: names, people and roles, never board contents.
--   owner  has a Personal workspace and creates team workspaces. Five seats, admin included.
--   user   works in the team workspaces they're added to. No Personal workspace,
--          can't create workspaces, and doesn't use an owner seat.
-- New accounts start as users; only the admin promotes (public.admin_set_account_role).
-- =============================================================================

create type public.account_role as enum ('admin', 'owner', 'user');

alter table public.profiles add column account_role public.account_role not null default 'user';
create unique index profiles_one_admin on public.profiles ((true)) where account_role = 'admin';

-- Everyone here today could create workspaces, so they stay owners.
update public.profiles set account_role = 'owner';
update public.profiles set account_role = 'admin' where lower(email) = 'tshahriar@isrt.ac.bd';
-- A database without that address still gets an admin: its oldest account.
update public.profiles set account_role = 'admin'
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where account_role = 'admin');

-- One owner per workspace; only owner accounts can hold it.
create unique index workspace_members_one_owner on public.workspace_members (workspace_id) where role = 'owner';

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create function private.account_role_of(u uuid)
returns public.account_role language sql stable security definer set search_path = '' as $$
  select p.account_role from public.profiles p where p.id = u;
$$;

create function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.account_role_of((select auth.uid())) = 'admin', false);
$$;

create function private.can_own_workspaces()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.account_role_of((select auth.uid())) in ('admin', 'owner'), false);
$$;

create function private.shares_workspace(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

create function private.ensure_personal_workspace(u uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ws_id uuid;
begin
  if exists (select 1 from public.workspaces w where w.created_by = u and w.is_personal) then
    return;
  end if;
  insert into public.workspaces (name, is_personal, created_by) values ('Personal', true, u) returning id into ws_id;
  insert into public.boards (workspace_id, name, key, created_by) values (ws_id, 'My Tasks', 'MY', u);
end;
$$;

revoke execute on function private.account_role_of(uuid), private.is_admin(), private.can_own_workspaces(),
  private.shares_workspace(uuid), private.ensure_personal_workspace(uuid) from public, anon;
grant execute on function private.account_role_of(uuid), private.is_admin(), private.can_own_workspaces(),
  private.shares_workspace(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- New accounts are workspace users with no Personal workspace and no seat limit.
-- An empty database's first account becomes the admin.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_role public.account_role := 'user';
begin
  perform pg_advisory_xact_lock(hashtext('private.handle_new_user'));
  if not exists (select 1 from public.profiles p where p.account_role = 'admin') then
    new_role := 'admin';
  end if;

  insert into public.profiles (id, email, display_name, account_role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    new_role
  );

  if new_role = 'admin' then
    perform private.ensure_personal_workspace(new.id);
  end if;
  return new;
end;
$$;

-- Owner seats, and no demotion while someone still owns a team workspace.
create function private.guard_account_role()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  max_owners constant integer := 5;
begin
  if new.account_role = old.account_role then
    return new;
  end if;

  if new.account_role in ('admin', 'owner') then
    perform pg_advisory_xact_lock(hashtext('private.owner_seats'));
    if (select count(*) from public.profiles p where p.account_role in ('admin', 'owner') and p.id <> new.id) >= max_owners then
      raise exception using errcode = 'check_violation',
        message = format('All %s owner seats are taken', max_owners);
    end if;
  elsif exists (
    select 1 from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.user_id = new.id and m.role = 'owner' and not w.is_personal
  ) then
    raise exception using errcode = 'check_violation',
      message = 'They still own a team workspace. Give it to another owner first';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_account_role
  before update of account_role on public.profiles
  for each row execute function private.guard_account_role();

-- Promoted to owner: they get their Personal workspace (kept if they're later demoted).
create function private.on_account_role_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.account_role in ('admin', 'owner') then
    perform private.ensure_personal_workspace(new.id);
  end if;
  return null;
end;
$$;

create trigger profiles_account_role_changed
  after update of account_role on public.profiles
  for each row when (old.account_role is distinct from new.account_role)
  execute function private.on_account_role_changed();

create function private.check_workspace_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'owner' and private.account_role_of(new.user_id) = 'user' then
    raise exception using errcode = 'check_violation', message = 'Only owner accounts can own a workspace';
  end if;
  return new;
end;
$$;

create trigger workspace_members_owner_account
  before insert or update of role on public.workspace_members
  for each row execute function private.check_workspace_owner();

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------

-- With unlimited workspace users, people only see who they work with. Owners see every
-- account so they can add existing people to their workspaces.
drop policy "profiles: signed-in users can read" on public.profiles;
create policy "profiles: yourself, people you share a workspace with; owners see all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.can_own_workspaces() or private.shares_workspace(id));

drop policy "workspaces: users create team workspaces" on public.workspaces;
create policy "workspaces: owners create team workspaces"
  on public.workspaces for insert to authenticated
  with check (created_by = (select auth.uid()) and not is_personal and private.can_own_workspaces());

-- -----------------------------------------------------------------------------
-- Admin functions. Each checks the caller is the admin; they manage structure only.
-- -----------------------------------------------------------------------------

create function private.require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception using errcode = 'insufficient_privilege', message = 'Only the admin can do this';
  end if;
end;
$$;

create function private.require_team_workspace(ws uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.workspaces w where w.id = ws and not w.is_personal) then
    raise exception using errcode = 'no_data_found', message = 'That team workspace no longer exists';
  end if;
end;
$$;

create function public.admin_people()
returns table (
  id uuid, email text, display_name text, account_role public.account_role, created_at timestamptz,
  last_sign_in_at timestamptz, team_workspaces integer, owned_workspaces integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select p.id, p.email, p.display_name, p.account_role, p.created_at, u.last_sign_in_at,
      (select count(*)::integer from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
        where m.user_id = p.id and not w.is_personal),
      (select count(*)::integer from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
        where m.user_id = p.id and m.role = 'owner' and not w.is_personal)
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.account_role, p.display_name;
end;
$$;

create function public.admin_workspaces()
returns table (
  id uuid, name text, created_at timestamptz, board_count integer, members jsonb
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select w.id, w.name, w.created_at,
      (select count(*)::integer from public.boards b where b.workspace_id = w.id and b.archived_at is null),
      coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'email', p.email,
                                            'role', m.role, 'account_role', p.account_role)
                         order by m.role, p.display_name)
        from public.workspace_members m join public.profiles p on p.id = m.user_id
        where m.workspace_id = w.id
      ), '[]'::jsonb)
    from public.workspaces w
    where not w.is_personal
    order by w.name;
end;
$$;

create function public.admin_set_account_role(target uuid, new_role public.account_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if new_role = 'admin' or private.account_role_of(target) = 'admin' then
    raise exception using errcode = 'check_violation', message = 'The admin role can''t be moved from here';
  end if;
  update public.profiles set account_role = new_role where id = target;
end;
$$;

create function public.admin_create_workspace(owner uuid, ws_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ws_id uuid;
begin
  perform private.require_admin();
  -- The owner trigger on workspaces makes created_by the owner; check_workspace_owner vets them.
  insert into public.workspaces (name, created_by) values (trim(ws_name), owner) returning id into ws_id;
  return ws_id;
end;
$$;

create function public.admin_rename_workspace(ws uuid, ws_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  perform private.require_team_workspace(ws);
  update public.workspaces set name = trim(ws_name) where id = ws;
end;
$$;

create function public.admin_delete_workspace(ws uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  perform private.require_team_workspace(ws);
  delete from public.workspaces where id = ws;
end;
$$;

-- Adds someone or changes their role. Making someone the owner hands the workspace over:
-- the previous owner stays on as a workspace admin.
create function public.admin_set_member(ws uuid, member uuid, member_role public.workspace_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  perform private.require_team_workspace(ws);

  if member_role = 'owner' then
    update public.workspace_members set role = 'admin' where workspace_id = ws and role = 'owner' and user_id <> member;
    update public.workspaces set created_by = member where id = ws;
  elsif exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = member and m.role = 'owner') then
    raise exception using errcode = 'check_violation', message = 'Make someone else the owner first';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws, member, member_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;
end;
$$;

create function public.admin_remove_member(ws uuid, member uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  perform private.require_team_workspace(ws);
  if exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = member and m.role = 'owner') then
    raise exception using errcode = 'check_violation', message = 'Make someone else the owner before removing them';
  end if;
  delete from public.workspace_members where workspace_id = ws and user_id = member;
end;
$$;

revoke execute on function private.require_admin(), private.require_team_workspace(uuid) from public, anon;
grant execute on function private.require_admin(), private.require_team_workspace(uuid) to authenticated;
revoke execute on function public.admin_people(), public.admin_workspaces(),
  public.admin_set_account_role(uuid, public.account_role), public.admin_create_workspace(uuid, text),
  public.admin_rename_workspace(uuid, text), public.admin_delete_workspace(uuid),
  public.admin_set_member(uuid, uuid, public.workspace_role), public.admin_remove_member(uuid, uuid)
  from public, anon;
grant execute on function public.admin_people(), public.admin_workspaces(),
  public.admin_set_account_role(uuid, public.account_role), public.admin_create_workspace(uuid, text),
  public.admin_rename_workspace(uuid, text), public.admin_delete_workspace(uuid),
  public.admin_set_member(uuid, uuid, public.workspace_role), public.admin_remove_member(uuid, uuid)
  to authenticated;
