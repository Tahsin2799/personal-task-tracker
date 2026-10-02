"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/queries";
import type { Result } from "./actions";

export type FeedComment = {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author: { id: string; name: string };
};
export type FeedActivity = {
  id: number;
  kind: string;
  data: Record<string, unknown>;
  created_at: string;
  actor: string | null;
};
export type FeedAttachment = {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  created_at: string;
  url: string | null;
  uploader: string | null;
};
export type TaskFeed = { comments: FeedComment[]; activity: FeedActivity[]; attachments: FeedAttachment[] };

/** Comments, history and files for one entry, read on demand when its drawer opens. */
export async function getTaskFeed(taskId: string): Promise<TaskFeed> {
  const { supabase } = await getViewer();
  const [{ data: comments }, { data: activity }, { data: attachments }] = await Promise.all([
    supabase
      .from("comments")
      .select("id, body, created_at, edited_at, author:profiles!comments_author_id_fkey(id, display_name)")
      .eq("task_id", taskId)
      .order("created_at"),
    supabase
      .from("activity")
      .select("id, kind, data, created_at, actor:profiles!activity_actor_id_fkey(display_name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("attachments")
      .select("id, name, size, mime, path, created_at, uploader:profiles!attachments_uploader_id_fkey(display_name)")
      .eq("task_id", taskId)
      .order("created_at"),
  ]);

  const files = attachments ?? [];
  const { data: signed } = files.length
    ? await supabase.storage.from("attachments").createSignedUrls(files.map((f) => f.path), 3600)
    : { data: [] };

  return {
    comments: (comments ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      edited_at: c.edited_at,
      author: { id: c.author?.id ?? "", name: c.author?.display_name ?? "Someone" },
    })),
    activity: (activity ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      data: (a.data ?? {}) as Record<string, unknown>,
      created_at: a.created_at,
      actor: a.actor?.display_name ?? null,
    })),
    attachments: files.map((f, i) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mime: f.mime,
      created_at: f.created_at,
      url: signed?.[i]?.signedUrl ?? null,
      uploader: f.uploader?.display_name ?? null,
    })),
  };
}

function done(boardId: string) {
  revalidatePath(`/b/${boardId}`, "layout");
}

export async function addComment(boardId: string, taskId: string, body: string): Promise<Result> {
  const clean = body.trim();
  if (!clean) return { error: "Write something first." };
  const { supabase, profile } = await getViewer();
  const { error } = await supabase
    .from("comments")
    .insert({ board_id: boardId, task_id: taskId, body: clean, author_id: profile.id });
  if (error) return { error: error.message };
  done(boardId);
}

export async function editComment(boardId: string, commentId: string, body: string): Promise<Result> {
  const clean = body.trim();
  if (!clean) return { error: "A comment can't be empty. Delete it instead." };
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("comments")
    .update({ body: clean, edited_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) return { error: error.message };
  done(boardId);
}

export async function deleteComment(boardId: string, commentId: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { error: error.message };
  done(boardId);
}

/** The file itself is uploaded from the browser (Storage RLS checks membership); this records it. */
export async function registerAttachment(
  boardId: string,
  taskId: string,
  file: { name: string; path: string; size: number; mime: string | null },
): Promise<Result> {
  if (!file.path.startsWith(`${boardId}/${taskId}/`)) return { error: "That upload doesn't belong to this entry." };
  const { supabase, profile } = await getViewer();
  const { data, error } = await supabase
    .from("attachments")
    .insert({ board_id: boardId, task_id: taskId, uploader_id: profile.id, ...file })
    .select("id")
    .single();
  if (error) return { error: error.message };
  done(boardId);
  return { id: data.id };
}

export async function deleteAttachment(boardId: string, attachmentId: string): Promise<Result> {
  const { supabase } = await getViewer();
  const { data: row } = await supabase.from("attachments").select("path").eq("id", attachmentId).maybeSingle();
  if (!row) return { error: "That file is already gone." };
  await supabase.storage.from("attachments").remove([row.path]);
  const { error } = await supabase.from("attachments").delete().eq("id", attachmentId);
  if (error) return { error: error.message };
  done(boardId);
}
