import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** When this request read its data; a client page compares it to now to tell a cached copy (<CatchUp>). */
export const requestTime = cache(() => Date.now());

/**
 * The signed-in user's id, from the session token alone. Reads that only need the id start
 * from this, so they don't wait on the profile row. Redirects to /login when there is no session.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
});

/** The signed-in user's profile. Redirects to /login when there is no session. */
export const getViewer = cache(async () => {
  const { supabase, userId } = await getSession();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, onboarded_at, time_zone, email_notifications, email_due_reminders, account_role")
    .eq("id", userId)
    .single();
  if (!profile) redirect("/login");

  return { supabase, profile };
});

/** Workspaces ("sections" of the book) the viewer belongs to, with their boards. */
export const getSections = cache(async () => {
  const { supabase, userId } = await getSession();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, is_personal, created_at, boards(id, name, key, color, archived_at), workspace_members(user_id, role)")
    .order("is_personal", { ascending: false })
    .order("created_at");
  if (error) throw error;

  return data.map((w) => ({
    id: w.id,
    name: w.name,
    isPersonal: w.is_personal,
    memberCount: w.workspace_members.length,
    role: w.workspace_members.find((m) => m.user_id === userId)?.role ?? "member",
    boards: w.boards
      .filter((b) => !b.archived_at)
      .map(({ id, name, key, color }) => ({ id, name, key, color }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
});

export type Section = Awaited<ReturnType<typeof getSections>>[number];

/** Everything assigned to the viewer, open or finished in the last 7 days. Epics are containers and excluded. */
export const getMyWork = cache(async () => {
  const { supabase, userId } = await getSession();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `id, number, title, type, priority, story_points, due_date, completed_at, milestone,
       board:boards!tasks_board_id_fkey(id, key, name, color, workspace:workspaces(id, name, is_personal),
         board_columns(id, name, category, position)),
       column:board_columns!tasks_board_id_column_id_fkey(id, name, category),
       sprint:sprints!tasks_board_id_sprint_id_fkey(name, status), epic_id, parent_id`,
    )
    .eq("assignee_id", userId)
    .is("archived_at", null)
    .neq("type", "epic")
    .or(`completed_at.is.null,completed_at.gte.${weekAgo}`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("number");
  if (error) throw error;

  // PostgREST can't embed the self-referencing (board_id, epic_id / parent_id) keys, so epics and
  // a subtask's parent are one second read.
  const refIds = [...new Set(data.flatMap((t) => [t.epic_id, t.parent_id].filter((id): id is string => Boolean(id))))];
  const { data: refs } = refIds.length
    ? await supabase.from("tasks").select("id, number, title").in("id", refIds)
    : { data: [] };
  const refById = new Map((refs ?? []).map((r) => [r.id, r]));

  return data.map((t) => ({
    ...t,
    epic: t.epic_id ? (refById.get(t.epic_id) ?? null) : null,
    parent: t.parent_id ? (refById.get(t.parent_id) ?? null) : null,
  }));
});

export type MyWorkEntry = Awaited<ReturnType<typeof getMyWork>>[number];

/**
 * Milestones in every workspace the viewer can see, late ones first, up to 30 days out: the spine's
 * deadline strip. Team deadlines count even when they're assigned to someone else.
 */
export const getUpcomingMilestones = cache(async (today: string) => {
  const { supabase } = await getSession();
  const horizon = new Date(Date.parse(`${today}T12:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("tasks")
    .select("id, number, title, due_date, board:boards!tasks_board_id_fkey(id, key, archived_at)")
    .eq("milestone", true)
    .is("archived_at", null)
    .is("completed_at", null)
    .not("due_date", "is", null)
    .lte("due_date", horizon)
    .order("due_date")
    .limit(8);
  if (error) throw error;
  return data.filter((t) => t.board && !t.board.archived_at).slice(0, 5);
});

/** The spine's My Work tally: a count, so every page doesn't pay for the full list and its epics. */
export const getOpenCount = cache(async () => {
  const { supabase, userId } = await getSession();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assignee_id", userId)
    .is("archived_at", null)
    .is("completed_at", null)
    .neq("type", "epic");
  return count ?? 0;
});

/** Cached per request: the page and its metadata share one read. */
export const getWorkspace = cache(async (workspaceId: string) => {
  const { supabase } = await getSession();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select(
      `id, name, is_personal, created_at,
       boards(id, name, key, description, color, archived_at,
         tasks(type, story_points, completed_at, archived_at),
         sprints(name, status, end_date))`,
    )
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) notFound();
  return workspace;
});

export async function getWorkspaceMembers(workspaceId: string) {
  const { supabase } = await getSession();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, joined_at, profile:profiles(id, email, display_name)")
    .eq("workspace_id", workspaceId)
    .order("joined_at");
  if (error) throw error;
  return data;
}

/** Everything a board's views (kanban, backlog, epics, reports, settings) need, in one read. */
export const getBoard = cache(async (boardId: string) => {
  const { supabase, userId } = await getSession();
  // One round trip: the side tables only need the board id, so they're read alongside the board.
  // task_labels references boards only through composite keys, so PostgREST can't embed it.
  const [{ data: board, error }, { data: taskLabels }, { data: comments }, { data: attachments }] = await Promise.all([
    supabase
      .from("boards")
      .select(
        `id, name, key, description, color,
         workspace:workspaces(id, name, is_personal,
           workspace_members(role, joined_at, profile:profiles(id, email, display_name))),
         board_columns(id, name, category, position, wip_limit),
         sprints(id, name, goal, status, start_date, end_date, completed_at, committed_points, created_at),
         labels(id, name, color),
         tasks(id, number, title, description, type, priority, story_points, start_date, due_date,
               completed_at, archived_at, created_at, updated_at, milestone, experiment, cover_attachment_id,
               repeat_every, repeat_unit, next_occurrence_id,
               column_id, position, sprint_id, epic_id, parent_id, assignee_id, reporter_id)`,
      )
      .eq("id", boardId)
      .maybeSingle(),
    supabase.from("task_labels").select("task_id, label_id").eq("board_id", boardId),
    supabase.from("comments").select("task_id").eq("board_id", boardId),
    supabase.from("attachments").select("id, task_id, path, mime").eq("board_id", boardId),
  ]);
  if (error && error.code !== "22P02") throw error; // 22P02: not a uuid
  if (!board) notFound();
  const members = [...board.workspace!.workspace_members].sort((a, b) => a.joined_at.localeCompare(b.joined_at));

  const commentCounts: Record<string, number> = {};
  for (const c of comments ?? []) commentCounts[c.task_id] = (commentCounts[c.task_id] ?? 0) + 1;
  const attachmentCounts: Record<string, number> = {};
  for (const a of attachments ?? []) attachmentCounts[a.task_id] = (attachmentCounts[a.task_id] ?? 0) + 1;

  // Card covers are private files: sign them for an hour.
  const coverIds = new Set(board.tasks.flatMap((t) => (t.cover_attachment_id && !t.archived_at ? [t.cover_attachment_id] : [])));
  const coverFiles = (attachments ?? []).filter((a) => coverIds.has(a.id));
  const covers: Record<string, string> = {};
  if (coverFiles.length) {
    const { data: signed } = await supabase.storage
      .from("attachments")
      .createSignedUrls(coverFiles.map((a) => a.path), 3600);
    coverFiles.forEach((a, i) => {
      const url = signed?.[i]?.signedUrl;
      if (url) covers[a.id] = url;
    });
  }
  const myRole = members.find((m) => m.profile?.id === userId)?.role ?? "member";

  return {
    id: board.id,
    name: board.name,
    key: board.key,
    description: board.description,
    color: board.color,
    workspace: { id: board.workspace!.id, name: board.workspace!.name, is_personal: board.workspace!.is_personal },
    columns: [...board.board_columns].sort((a, b) => (a.position < b.position ? -1 : 1)),
    sprints: [...board.sprints].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    labels: [...board.labels].sort((a, b) => a.name.localeCompare(b.name)),
    taskLabels: taskLabels ?? [],
    commentCounts,
    attachmentCounts,
    covers,
    tasks: board.tasks.filter((t) => !t.archived_at),
    members: members.map((m) => ({ id: m.profile!.id, name: m.profile!.display_name, role: m.role })),
    viewerId: userId,
    canManage: myRole === "owner" || myRole === "admin",
    // Prefetched boards can be shown from the client cache; <LiveRefresh> uses this to catch up.
    renderedAt: requestTime(),
  };
});

/** Just the board's name, for page titles: a tab switch shouldn't re-read the whole board. */
export const getBoardName = cache(async (boardId: string) => {
  const { supabase } = await getSession();
  const { data } = await supabase.from("boards").select("name").eq("id", boardId).maybeSingle();
  return data?.name ?? "Board";
});

export type BoardData = Awaited<ReturnType<typeof getBoard>>;
export type BoardTask = BoardData["tasks"][number];
export type BoardColumn = BoardData["columns"][number];
export type BoardSprint = BoardData["sprints"][number];
export type BoardLabel = BoardData["labels"][number];

/** The viewer's notifications, newest first, with enough context to link to the entry. */
export async function getInbox() {
  const { supabase, userId } = await getSession();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      `id, kind, data, read_at, created_at,
       actor:profiles!notifications_actor_id_fkey(display_name),
       task:tasks(id, number, title, board:boards!tasks_board_id_fkey(id, key, name))`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export type InboxItem = Awaited<ReturnType<typeof getInbox>>[number];

export const getUnreadCount = cache(async () => {
  const { supabase, userId } = await getSession();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
});
