"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateKeyBetween } from "fractional-indexing";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/queries";
import type { ActionState } from "@/lib/action-state";

const MAX_USERS = 5;

export async function createWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name the workspace." };
  if (name.length > 80) return { error: "Keep the name under 80 characters.", values: { name } };

  const { supabase, profile } = await getViewer();
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name, created_by: profile.id })
    .select("id")
    .single();
  if (error) return { error: error.message, values: { name } };

  revalidatePath("/", "layout");
  redirect(`/w/${data.id}`);
}

export async function renameWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = String(formData.get("workspaceId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name the workspace." };

  const { supabase } = await getViewer();
  const { data, error } = await supabase.from("workspaces").update({ name }).eq("id", workspaceId).select("id");
  if (error) return { error: error.message };
  if (!data.length) return { error: "Only owners and admins can rename this workspace." };

  revalidatePath("/", "layout");
  return { ok: "Renamed." };
}

function keyFromName(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3);
  return /^[A-Z]/.test(key) ? key.slice(0, 6) : `B${key}`.slice(0, 6);
}

export async function createBoard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = String(formData.get("workspaceId"));
  const name = String(formData.get("name") ?? "").trim();
  const rawKey = String(formData.get("key") ?? "").trim().toUpperCase();
  const values = { name, key: rawKey };
  if (!name) return { error: "Name the board.", values };

  const key = rawKey || keyFromName(name);
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
    return { error: "Keys are 2–10 letters or digits and start with a letter, like MS or LAB2.", values };
  }

  const { supabase, profile } = await getViewer();
  const { data, error } = await supabase
    .from("boards")
    .insert({ workspace_id: workspaceId, name, key, created_by: profile.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `This workspace already has a board with key ${key}.`, values };
    return { error: error.message, values };
  }

  revalidatePath("/", "layout");
  redirect(`/b/${data.id}`);
}

export async function addEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const boardId = String(formData.get("boardId"));
  const columnId = String(formData.get("columnId"));
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Write the entry first." };

  const { supabase, profile } = await getViewer();
  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("tasks").insert({
    board_id: boardId,
    column_id: columnId,
    title,
    position: generateKeyBetween(last?.position ?? null, null),
    assignee_id: profile.id,
    number: 0, // replaced by the per-board sequence trigger
  });
  if (error) return { error: error.message, values: { title } };

  revalidatePath(`/b/${boardId}`);
  revalidatePath("/");
  return { ok: "Added." };
}

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = String(formData.get("workspaceId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "admin" ? "admin" : "member";
  const values = { email, role };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That doesn't look like an email address.", values };

  const { supabase, profile } = await getViewer();

  let { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();

  if (!existing) {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    if ((count ?? 0) >= MAX_USERS) {
      return { error: `Bird-Watcher is limited to ${MAX_USERS} accounts, and all of them are taken.`, values };
    }

    // Confirm the caller may manage this workspace before sending email with the service key.
    const { data: canManage } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .in("role", ["owner", "admin"])
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!canManage) return { error: "Only owners and admins can invite people.", values };

    const admin = createAdminClient();
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited.user) {
      return { error: inviteError?.message ?? "The invite could not be sent.", values };
    }
    existing = { id: invited.user.id };
  }

  const { error } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: existing.id, role });
  if (error) {
    if (error.code === "23505") return { error: "They're already a member.", values };
    if (error.code === "42501") return { error: "Only owners and admins can add people to a team workspace.", values };
    return { error: error.message, values };
  }

  revalidatePath(`/w/${workspaceId}/settings`);
  revalidatePath("/", "layout");
  return { ok: `Added ${email}. New accounts get an email to set a password.` };
}

export async function removeMember(workspaceId: string, userId: string) {
  const { supabase, profile } = await getViewer();
  await supabase.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", userId);

  revalidatePath("/", "layout");
  if (userId === profile.id) redirect("/");
  revalidatePath(`/w/${workspaceId}/settings`);
}

export async function setTheme(theme: "light" | "dark" | "system") {
  const store = await cookies();
  if (theme === "system") store.delete("theme");
  else store.set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function updateDisplayName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) return { error: "Your name can't be empty." };
  if (displayName.length > 80) return { error: "Keep it under 80 characters." };

  const { supabase, profile } = await getViewer();
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function updateEmailPrefs(prefs: { email_notifications?: boolean; email_due_reminders?: boolean }) {
  const { supabase, profile } = await getViewer();
  const { error } = await supabase
    .from("profiles")
    .update({ email_notifications: prefs.email_notifications, email_due_reminders: prefs.email_due_reminders })
    .eq("id", profile.id);
  if (error) return { error: error.message };
  revalidatePath("/account");
}

/** Due-date reminders go out in the morning of the person's own time zone. */
export async function saveTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    return;
  }
  const { supabase, profile } = await getViewer();
  if (profile.time_zone !== timeZone) await supabase.from("profiles").update({ time_zone: timeZone }).eq("id", profile.id);
}
