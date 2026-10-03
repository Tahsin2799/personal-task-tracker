"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import type { PostgrestError } from "@supabase/supabase-js";
import { getViewer } from "@/lib/queries";
import type { Database } from "@/lib/supabase/database.types";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type ColumnCategory = Database["public"]["Enums"]["column_category"];
export type Result = { error?: string; id?: string } | undefined;

const TASK_FIELDS = [
  "title",
  "description",
  "type",
  "priority",
  "story_points",
  "start_date",
  "due_date",
  "sprint_id",
  "epic_id",
  "assignee_id",
  "milestone",
  "experiment",
  "cover_attachment_id",
  "repeat_every",
  "repeat_unit",
] as const;
export type TaskPatch = Partial<Pick<TaskRow, (typeof TASK_FIELDS)[number]>>;

function friendly(error: PostgrestError | null): Result {
  if (!error) return undefined;
  switch (error.code) {
    case "23514":
    case "P0002":
      return { error: error.message.startsWith("new row") ? "That value isn't allowed here." : error.message };
    case "23503":
      return { error: "Something else still depends on this. Move or remove it first." };
    case "23505":
      return { error: error.message.includes("sprints_one_active") ? "Only one sprint can be active at a time." : "That name or key is already used on this board." };
    case "42501":
      return { error: "You don't have permission to change this." };
    default:
      return { error: error.message };
  }
}

function done(boardId: string) {
  revalidatePath(`/b/${boardId}`, "layout");
  revalidatePath("/");
}

/** The last fractional position in a column (for entries) or on a board (for columns). */
async function lastPosition(table: "tasks" | "board_columns", id: string) {
  const { supabase } = await getViewer();
  const query =
    table === "tasks"
      ? supabase.from("tasks").select("position").eq("column_id", id)
      : supabase.from("board_columns").select("position").eq("board_id", id);
  const { data } = await query.order("position", { ascending: false }).limit(1).maybeSingle();
  return data?.position ?? null;
}

async function firstColumn(boardId: string, category: ColumnCategory) {
  const { supabase } = await getViewer();
  const { data } = await supabase
    .from("board_columns")
    .select("id")
    .eq("board_id", boardId)
    .eq("category", category)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (data) return data.id;
  const { data: any } = await supabase
    .from("board_columns")
    .select("id")
    .eq("board_id", boardId)
    .order("position")
    .limit(1)
    .maybeSingle();
  return any?.id ?? null;
}

/* ------------------------------------------------------------------ entries */

export async function createTask(
  boardId: string,
  input: {
    title: string;
    columnId?: string;
    type?: TaskRow["type"];
    sprintId?: string | null;
    epicId?: string | null;
    parentId?: string | null;
    assigneeId?: string | null;
  },
): Promise<Result> {
  const title = input.title.trim();
  if (!title) return { error: "Write the entry first." };

  const { supabase, profile } = await getViewer();
  const columnId = input.columnId ?? (await firstColumn(boardId, "todo"));
  if (!columnId) return { error: "Add a column to this board first." };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      board_id: boardId,
      column_id: columnId,
      title,
      type: input.type ?? "task",
      position: generateKeyBetween(await lastPosition("tasks", columnId), null),
      sprint_id: input.sprintId ?? null,
      epic_id: input.epicId ?? null,
      parent_id: input.parentId ?? null,
      assignee_id: input.assigneeId === undefined ? profile.id : input.assigneeId,
      number: 0, // replaced by the per-board sequence trigger
    })
    .select("id")
    .single();
  if (error) return friendly(error);

  done(boardId);
  return { id: data.id };
}

export async function updateTask(boardId: string, taskId: string, patch: TaskPatch): Promise<Result> {
  const clean: TaskPatch = {};
  for (const key of TASK_FIELDS) {
    if (key in patch) Object.assign(clean, { [key]: patch[key] });
  }
  if (clean.title !== undefined) {
    clean.title = clean.title.trim();
    if (!clean.title) return { error: "An entry needs a title." };
  }
  if (clean.description !== undefined) clean.description = clean.description?.trim() || null;

  const { supabase } = await getViewer();
  const { error } = await supabase.from("tasks").update(clean).eq("id", taskId).eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

/** Drop an entry into a column at a fractional position the client computed between its new neighbours. */
export async function moveTask(boardId: string, taskId: string, columnId: string, position: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("tasks")
    .update({ column_id: columnId, position })
    .eq("id", taskId)
    .eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

/** Move to another column and land at its foot (status changes from the drawer and backlog). */
export async function setTaskColumn(boardId: string, taskId: string, columnId: string): Promise<Result> {
  const position = generateKeyBetween(await lastPosition("tasks", columnId), null);
  return moveTask(boardId, taskId, columnId, position);
}

/** Tick a subtask: it moves to the board's first Done column, or back to the first To Do column. */
export async function setSubtaskDone(boardId: string, taskId: string, isDone: boolean): Promise<Result> {
  const columnId = await firstColumn(boardId, isDone ? "done" : "todo");
  if (!columnId) return { error: "This board has no column for that." };
  return setTaskColumn(boardId, taskId, columnId);
}

export async function archiveTask(boardId: string, taskId: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

export async function deleteTask(boardId: string, taskId: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

/** Reading-list import: one unassigned task per reference, at the foot of a column. */
export async function importReferences(
  boardId: string,
  input: { columnId: string; labelId: string | null; items: { title: string; description: string }[] },
): Promise<{ error?: string; count?: number }> {
  const items = input.items
    .map((i) => ({ title: i.title.trim().slice(0, 500), description: i.description.trim() || null }))
    .filter((i) => i.title);
  if (!items.length) return { error: "Choose at least one reference." };
  if (items.length > 300) return { error: "Import at most 300 references at a time." };

  const { supabase } = await getViewer();
  const positions = generateNKeysBetween(await lastPosition("tasks", input.columnId), null, items.length);
  const { data, error } = await supabase
    .from("tasks")
    .insert(
      items.map((item, n) => ({
        board_id: boardId,
        column_id: input.columnId,
        title: item.title,
        description: item.description,
        type: "task" as const,
        position: positions[n],
        assignee_id: null,
        number: 0,
      })),
    )
    .select("id");
  if (error) return { error: friendly(error)?.error };

  if (input.labelId) {
    const { error: labelError } = await supabase
      .from("task_labels")
      .insert(data.map((t) => ({ board_id: boardId, task_id: t.id, label_id: input.labelId! })));
    if (labelError) return { error: friendly(labelError)?.error };
  }
  done(boardId);
  return { count: data.length };
}

/* ------------------------------------------------------------------ labels */

export async function setTaskLabel(boardId: string, taskId: string, labelId: string, on: boolean): Promise<Result> {
  const { supabase } = await getViewer();
  const { error } = on
    ? await supabase.from("task_labels").upsert({ board_id: boardId, task_id: taskId, label_id: labelId })
    : await supabase.from("task_labels").delete().eq("task_id", taskId).eq("label_id", labelId);
  if (error) return friendly(error);
  done(boardId);
}

export async function createLabel(boardId: string, name: string, color: string): Promise<Result> {
  const clean = name.trim().toLowerCase();
  if (!clean) return { error: "Name the label." };
  if (!/^ink-[1-6]$/.test(color)) return { error: "Pick one of the label inks." };

  const { supabase } = await getViewer();
  const { data, error } = await supabase
    .from("labels")
    .insert({ board_id: boardId, name: clean, color })
    .select("id")
    .single();
  if (error) return friendly(error);
  done(boardId);
  return { id: data.id };
}

export async function updateLabel(boardId: string, labelId: string, patch: { name?: string; color?: string }): Promise<Result> {
  const clean: { name?: string; color?: string } = {};
  if (patch.name !== undefined) {
    clean.name = patch.name.trim().toLowerCase();
    if (!clean.name) return { error: "Name the label." };
  }
  if (patch.color !== undefined) clean.color = patch.color;

  const { supabase } = await getViewer();
  const { error } = await supabase.from("labels").update(clean).eq("id", labelId).eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

export async function deleteLabel(boardId: string, labelId: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { error } = await supabase.from("labels").delete().eq("id", labelId).eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

/* ------------------------------------------------------------------ columns */

export async function createColumn(boardId: string, name: string, category: ColumnCategory): Promise<Result> {
  const clean = name.trim();
  if (!clean) return { error: "Name the column." };

  const { supabase } = await getViewer();
  const { error } = await supabase.from("board_columns").insert({
    board_id: boardId,
    name: clean,
    category,
    position: generateKeyBetween(await lastPosition("board_columns", boardId), null),
  });
  if (error) return friendly(error);
  done(boardId);
}

export async function updateColumn(
  boardId: string,
  columnId: string,
  patch: { name?: string; category?: ColumnCategory; wip_limit?: number | null },
): Promise<Result> {
  if (patch.name !== undefined && !patch.name.trim()) return { error: "Name the column." };
  if (patch.wip_limit != null && (!Number.isInteger(patch.wip_limit) || patch.wip_limit < 1)) {
    return { error: "A WIP limit is a whole number above zero, or empty for none." };
  }

  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("board_columns")
    .update({ ...patch, name: patch.name?.trim() })
    .eq("id", columnId)
    .eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

export async function moveColumn(boardId: string, columnId: string, position: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { error } = await supabase.from("board_columns").update({ position }).eq("id", columnId).eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

export async function deleteColumn(boardId: string, columnId: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("column_id", columnId);
  if (count) return { error: `Move this column's ${count} entr${count === 1 ? "y" : "ies"} (archived ones too) first.` };

  const { error } = await supabase.from("board_columns").delete().eq("id", columnId).eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

/* ------------------------------------------------------------------ sprints */

export async function createSprint(boardId: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { count } = await supabase.from("sprints").select("id", { count: "exact", head: true }).eq("board_id", boardId);
  const { data, error } = await supabase
    .from("sprints")
    .insert({ board_id: boardId, name: `Sprint ${(count ?? 0) + 1}` })
    .select("id")
    .single();
  if (error) return friendly(error);
  done(boardId);
  return { id: data.id };
}

export async function updateSprint(boardId: string, sprintId: string, patch: { name?: string; goal?: string | null }): Promise<Result> {
  if (patch.name !== undefined && !patch.name.trim()) return { error: "Name the sprint." };
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("sprints")
    .update({ name: patch.name?.trim(), goal: patch.goal === undefined ? undefined : patch.goal?.trim() || null })
    .eq("id", sprintId)
    .eq("board_id", boardId);
  if (error) return friendly(error);
  done(boardId);
}

export async function startSprint(boardId: string, sprintId: string, starts: string, ends: string, goal: string): Promise<Result> {
  if (!starts || !ends) return { error: "Give the sprint a start and an end date." };
  const { supabase } = await getViewer();
  const { error } = await supabase.rpc("start_sprint", { sprint: sprintId, starts, ends, sprint_goal: goal });
  if (error) return friendly(error);
  done(boardId);
}

export async function completeSprint(boardId: string, sprintId: string, carryTo: string | null): Promise<Result> {
  const { supabase } = await getViewer();
  const { error } = await supabase.rpc("complete_sprint", { sprint: sprintId, carry_to: carryTo as string });
  if (error) return friendly(error);
  done(boardId);
}

export async function deleteSprint(boardId: string, sprintId: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("sprints")
    .delete()
    .eq("id", sprintId)
    .eq("board_id", boardId)
    .eq("status", "planned");
  if (error) return friendly(error);
  done(boardId);
}

/* ------------------------------------------------------------------ board */

export async function updateBoard(
  boardId: string,
  patch: { name?: string; description?: string | null; color?: string | null },
): Promise<Result> {
  if (patch.name !== undefined && !patch.name.trim()) return { error: "Name the board." };
  if (patch.color != null && !/^ink-[1-6]$/.test(patch.color)) return { error: "Pick one of the board inks." };
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("boards")
    .update({
      name: patch.name?.trim(),
      description: patch.description === undefined ? undefined : patch.description?.trim() || null,
      color: patch.color,
    })
    .eq("id", boardId);
  if (error) return friendly(error);
  revalidatePath("/", "layout");
}

export async function archiveBoard(boardId: string, workspaceId: string) {
  const { supabase } = await getViewer();
  await supabase.from("boards").update({ archived_at: new Date().toISOString() }).eq("id", boardId);
  revalidatePath("/", "layout");
  redirect(`/w/${workspaceId}`);
}
