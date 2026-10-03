-- =============================================================================
-- LOCAL DEVELOPMENT DEMO DATA. Synthetic people and tasks; never run in production.
-- Sign in with any of these (password: birdwatcher):
--   nadia@example.com  (owner of "Field Lab" and "Weekend Build")
--   ishan@example.com
--   clara@example.com
-- Dates are relative to the day you run `supabase db reset`.
-- =============================================================================

create function pg_temp.demo_user(email text, display_name text)
returns uuid language plpgsql as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', email,
    extensions.crypt('birdwatcher', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', display_name),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', email, 'email_verified', true),
          'email', now(), now(), now());
  return uid;
end;
$$;

create function pg_temp.col(board uuid, col_name text)
returns uuid language sql as $$
  select id from public.board_columns where board_id = board and name = col_name;
$$;

create function pg_temp.task(
  board uuid, col_name text, title text,
  typ public.task_type default 'task',
  points numeric default null,
  assignee uuid default null,
  due date default null,
  sprint uuid default null,
  epic uuid default null,
  prio public.task_priority default 'medium',
  parent uuid default null
) returns uuid language plpgsql as $$
declare
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  c uuid := pg_temp.col(board, col_name);
  n integer;
  tid uuid;
begin
  select count(*) into n from public.tasks where column_id = c;
  insert into public.tasks (board_id, column_id, position, title, type, story_points, assignee_id,
                            due_date, sprint_id, epic_id, priority, parent_id)
  values (board, c, 'a' || substr(digits, n + 1, 1), title, typ, points, assignee,
          due, sprint, epic, prio, parent)
  returning id into tid;
  return tid;
end;
$$;

do $$
declare
  nadia uuid := pg_temp.demo_user('nadia@example.com', 'Nadia Chowdhury');
  ishan uuid := pg_temp.demo_user('ishan@example.com', 'Ishan Mehta');
  clara uuid := pg_temp.demo_user('clara@example.com', 'Clara Wen');
  d date := current_date;
  lab uuid; side uuid; survey uuid; grants uuid; build uuid; personal_board uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid;
  l_field uuid; l_writing uuid; l_data uuid; l_kit uuid;
  e_transect uuid; e_paper uuid; e_launch uuid;
  t uuid;
begin
  -- Team workspace: research group.
  insert into public.workspaces (name, created_by) values ('Field Lab', nadia) returning id into lab;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (lab, ishan, 'admin'), (lab, clara, 'member');

  insert into public.boards (workspace_id, name, key, description, created_by)
  values (lab, 'Munia Survey', 'MS', 'Scaly-breasted munia plumage and transect study', nadia)
  returning id into survey;
  insert into public.board_columns (board_id, name, category, position)
  values (survey, 'Review', 'in_progress', 'a1V');

  insert into public.sprints (board_id, name, goal, status, start_date, end_date, completed_at)
  values (survey, 'Sprint 1', 'Literature and site scouting', 'completed', d - 53, d - 40, now() - interval '40 days')
  returning id into s1;
  insert into public.sprints (board_id, name, goal, status, start_date, end_date, completed_at)
  values (survey, 'Sprint 2', 'Permits and kit', 'completed', d - 39, d - 26, now() - interval '26 days')
  returning id into s2;
  insert into public.sprints (board_id, name, goal, status, start_date, end_date, completed_at)
  values (survey, 'Sprint 3', 'Pilot transects and protocol', 'completed', d - 25, d - 12, now() - interval '12 days')
  returning id into s3;
  insert into public.sprints (board_id, name, goal, status, start_date, end_date)
  values (survey, 'Sprint 4', 'Finish spring transects, draft methods', 'active', d - 4, d + 10)
  returning id into s4;
  insert into public.sprints (board_id, name, goal, status, start_date, end_date)
  values (survey, 'Sprint 5', 'Analysis and figures', 'planned', d + 11, d + 25)
  returning id into s5;

  e_transect := pg_temp.task(survey, 'In Progress', 'Spring transect counts', 'epic', null, nadia, d + 20, null, null, 'high');
  e_paper    := pg_temp.task(survey, 'To Do', 'Paper: plumage variation in urban munias', 'epic', null, clara, d + 60, null, null, 'high');

  perform pg_temp.task(survey, 'Done', 'Scout three candidate transect sites', 'story', 5, nadia, d - 45, s1, e_transect);
  perform pg_temp.task(survey, 'Done', 'Read: urban munia foraging ecology', 'task', 2, clara, d - 44, s1, e_paper, 'low');
  perform pg_temp.task(survey, 'Done', 'Annotated bibliography, first pass', 'task', 3, clara, d - 41, s1, e_paper);
  perform pg_temp.task(survey, 'Done', 'Apply for park access permit', 'task', 2, ishan, d - 35, s2, e_transect, 'high');
  perform pg_temp.task(survey, 'Done', 'Order range-finder and GPS loggers', 'task', 3, ishan, d - 33, s2, e_transect);
  perform pg_temp.task(survey, 'Done', 'Draft data sheet for visits', 'task', 5, nadia, d - 28, s2, e_transect);
  perform pg_temp.task(survey, 'Done', 'Write field protocol v2', 'task', 3, nadia, d - 14, s3, e_transect);
  perform pg_temp.task(survey, 'Done', 'Calibrate range-finder and GPS units', 'task', 1, ishan, d - 13, s3, e_transect, 'low');
  perform pg_temp.task(survey, 'Done', 'Pilot transect: botanical garden', 'story', 5, clara, d - 12, s3, e_transect);

  t := pg_temp.task(survey, 'In Progress', 'Transect B: river embankment, 3 visits', 'story', 8, nadia, d + 2, s4, e_transect, 'high');
  perform pg_temp.task(survey, 'Done', 'Visit 1: 06:00 count', 'subtask', null, nadia, d - 2, s4, null, 'medium', t);
  perform pg_temp.task(survey, 'In Progress', 'Visit 2: 06:00 count', 'subtask', null, nadia, d, s4, null, 'medium', t);
  perform pg_temp.task(survey, 'To Do', 'Visit 3: 17:30 count', 'subtask', null, ishan, d + 2, s4, null, 'medium', t);

  perform pg_temp.task(survey, 'In Progress', 'Photograph breast scaling for 20 individuals', 'story', 5, clara, d + 1, s4, e_paper);
  perform pg_temp.task(survey, 'Done', 'Transect A: botanical garden, 3 visits', 'story', 3, clara, d - 2, s4, e_transect);
  perform pg_temp.task(survey, 'Review', 'Methods section draft', 'task', 3, nadia, d - 1, s4, e_paper, 'high');
  perform pg_temp.task(survey, 'To Do', 'Enter visit sheets into the dataset', 'task', 2, ishan, d + 3, s4, e_transect);
  perform pg_temp.task(survey, 'To Do', 'GPS logger drops fixes under tree cover', 'bug', 2, ishan, d + 4, s4, e_transect, 'highest');
  perform pg_temp.task(survey, 'To Do', 'Collect DOIs for plumage colouration references', 'task', 1, nadia, d + 5, s4, e_paper, 'low');

  perform pg_temp.task(survey, 'To Do', 'Fit mixed model: scaling vs. urbanisation', 'story', 8, clara, d + 18, s5, e_paper);
  perform pg_temp.task(survey, 'To Do', 'Figure 2: transect map with counts', 'task', 5, nadia, d + 21, s5, e_paper);
  perform pg_temp.task(survey, 'To Do', 'Ask museum for reference skins', 'task', 2, null, null, null, e_paper, 'low');
  perform pg_temp.task(survey, 'To Do', 'Compare with 2019 eBird checklists', 'task', 3, null, null, null, null, 'lowest');

  -- Labels on the survey board.
  insert into public.labels (board_id, name, color) values (survey, 'fieldwork', 'ink-3') returning id into l_field;
  insert into public.labels (board_id, name, color) values (survey, 'writing', 'ink-2') returning id into l_writing;
  insert into public.labels (board_id, name, color) values (survey, 'data', 'ink-1') returning id into l_data;
  insert into public.labels (board_id, name, color) values (survey, 'equipment', 'ink-4') returning id into l_kit;
  insert into public.task_labels (board_id, task_id, label_id)
  select survey, t.id, l from public.tasks t
  cross join lateral (values
    (case when t.title ~* 'transect|visit|scout|photograph' then l_field end),
    (case when t.title ~* 'draft|methods|paper|bibliography|read:|figure' then l_writing end),
    (case when t.title ~* 'dataset|model|ebird|data sheet|figure' then l_data end),
    (case when t.title ~* 'gps|range-finder|logger' then l_kit end)
  ) as v(l)
  where t.board_id = survey and l is not null and t.type <> 'subtask';

  -- Commitment snapshots (what each sprint held when it started; later work was added mid-sprint).
  update public.sprints s set committed_points = c.pts
  from (select sprint_id, sum(story_points) pts from public.tasks where sprint_id is not null group by sprint_id) c
  where c.sprint_id = s.id and s.status <> 'planned';
  update public.sprints set committed_points = committed_points + 3 where id in (s1, s3);

  -- Backdate completion so burndown and velocity read like real history.
  update public.tasks t set completed_at = (s.end_date - (t.number % 4))::timestamptz + interval '15 hours'
  from public.sprints s where t.sprint_id = s.id and s.status = 'completed' and t.completed_at is not null;
  update public.tasks set completed_at = (d - 2)::timestamptz + interval '9 hours' where board_id = survey and title = 'Visit 1: 06:00 count';
  update public.tasks set completed_at = (d - 2)::timestamptz + interval '17 hours' where board_id = survey and title like 'Transect A:%';

  insert into public.boards (workspace_id, name, key, description, created_by)
  values (lab, 'Grants & Admin', 'GA', 'Funding, ethics and reporting', ishan)
  returning id into grants;
  perform pg_temp.task(grants, 'In Progress', 'Ethics renewal for bird handling', 'task', 2, nadia, d + 6, null, null, 'high');
  perform pg_temp.task(grants, 'To Do', 'Small grant report: interim budget', 'task', 3, ishan, d + 12);
  perform pg_temp.task(grants, 'To Do', 'Conference abstract deadline', 'task', 2, nadia, d + 9, null, null, 'highest');

  -- Research details: a milestone, an experiment, board colour.
  update public.boards set color = 'ink-3' where id = survey;
  update public.boards set color = 'ink-4' where id = grants;
  update public.tasks set milestone = true where board_id = grants and title = 'Conference abstract deadline';
  update public.tasks set experiment = jsonb_build_object(
      'hypothesis', 'Breast scaling is denser in birds from greener sites.',
      'protocol', jsonb_build_array(
        jsonb_build_object('text', 'Photograph each bird at 1:1 against the grey card', 'done', true),
        jsonb_build_object('text', 'Score scale density on the 0-5 key', 'done', true),
        jsonb_build_object('text', 'Record site NDVI from the transect map', 'done', false)),
      'results', '',
      'outcome', null),
    description = 'Scoring key from Restall (1996). See also 10.1111/ibi.12345 for the greenness index.'
  where board_id = survey and title like 'Photograph breast scaling%';

  -- Conversation and history. Comment triggers write activity and notifications.
  insert into public.comments (board_id, task_id, author_id, body, created_at)
  select survey, t.id, ishan,
         '@[Nadia Chowdhury](' || nadia || ') the GPS drops are worst under the fig trees on visit 2. Can we add a waypoint before the canopy?',
         now() - interval '20 hours'
  from public.tasks t where t.board_id = survey and t.title like 'Transect B:%';
  insert into public.comments (board_id, task_id, author_id, body, created_at)
  select survey, t.id, nadia, 'Yes, I will mark one at the bridge. Visit 3 stays at 17:30.', now() - interval '18 hours'
  from public.tasks t where t.board_id = survey and t.title like 'Transect B:%';
  insert into public.comments (board_id, task_id, author_id, body, created_at)
  select survey, t.id, clara,
         'First 12 birds scored. @[Nadia Chowdhury](' || nadia || ') could you double-score three of them blind?',
         now() - interval '3 hours'
  from public.tasks t where t.board_id = survey and t.title like 'Photograph breast scaling%';
  insert into public.activity (board_id, task_id, actor_id, kind, data, created_at)
  select survey, t.id, nadia, 'moved', '{"from": "To Do", "to": "Review"}', now() - interval '26 hours'
  from public.tasks t where t.board_id = survey and t.title = 'Methods section draft';
  insert into public.activity (board_id, task_id, actor_id, kind, data, created_at)
  select survey, t.id, clara, 'moved', '{"from": "In Progress", "to": "Done"}', now() - interval '30 hours'
  from public.tasks t where t.board_id = survey and t.title like 'Transect A:%';

  -- Demo accounts have seen the welcome; real new accounts get it.
  update public.profiles set onboarded_at = now();

  -- Team workspace: side project.
  insert into public.workspaces (name, created_by) values ('Weekend Build', nadia) returning id into side;
  insert into public.workspace_members (workspace_id, user_id, role) values (side, ishan, 'member');
  insert into public.boards (workspace_id, name, key, description, created_by)
  values (side, 'Birdsong App', 'BA', 'Offline birdsong ID for walks', ishan)
  returning id into build;
  e_launch := pg_temp.task(build, 'In Progress', 'Private beta', 'epic', null, ishan, d + 30);
  perform pg_temp.task(build, 'In Progress', 'Record 30 local species clips', 'story', 5, nadia, d + 7, null, e_launch);
  perform pg_temp.task(build, 'To Do', 'Waveform view stutters on long clips', 'bug', 3, ishan, d - 3, null, e_launch, 'high');
  perform pg_temp.task(build, 'To Do', 'Landing page copy', 'task', 2, nadia, d + 14, null, e_launch, 'low');

  -- Nadia's personal workspace (created by the sign-up trigger).
  select b.id into personal_board
  from public.boards b join public.workspaces w on w.id = b.workspace_id
  where w.is_personal and w.created_by = nadia;
  perform pg_temp.task(personal_board, 'To Do', 'Return library books', 'task', null, nadia, d - 2, null, null, 'medium');
  perform pg_temp.task(personal_board, 'To Do', 'Renew passport', 'task', null, nadia, d + 3, null, null, 'high');
  perform pg_temp.task(personal_board, 'To Do', 'Book dentist appointment', 'task', null, nadia, null, null, null, 'low');
  perform pg_temp.task(personal_board, 'In Progress', 'Clean binocular lenses and strap', 'task', null, nadia, d, null, null, 'low');
  perform pg_temp.task(personal_board, 'Done', 'Pay electricity bill', 'task', null, nadia, d - 5);
end;
$$;

-- Local email worker: pg_cron reaches the dev server through Docker's host alias.
-- CRON_SECRET in .env.local must match. Production sets its own values (docs/PLAN.md).
select vault.create_secret('http://host.docker.internal:3000/api/cron/email', 'email_worker_url');
select vault.create_secret('local-dev-cron-secret', 'cron_secret');
