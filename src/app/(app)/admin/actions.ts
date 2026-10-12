"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/queries";
import type { ActionState } from "@/lib/action-state";
import type { Database } from "@/lib/supabase/database.types";

type AccountRole = Database["public"]["Enums"]["account_role"];
type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];
export type Outcome = { error?: string; ok?: string } | undefined;

const MAX_OWNERS = 5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The database functions check this too; this keeps everyone else from reaching them at all. */
async function requireAdmin() {
  const viewer = await getViewer();
  if (viewer.profile.account_role !== "admin") notFound();
  return viewer;
}

function done(message?: string): Outcome {
  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return message ? { ok: message } : undefined;
}

export async function setAccountRole(userId: string, role: string): Promise<Outcome> {
  const { supabase } = await requireAdmin();
  if (role !== "owner" && role !== "user") return { error: "Choose owner or user." };
  const { error } = await supabase.rpc("admin_set_account_role", { target: userId, new_role: role });
  return error ? { error: error.message } : done();
}

export async function invitePerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const accountRole: AccountRole = formData.get("account_role") === "owner" ? "owner" : "user";
  const workspaceId = String(formData.get("workspace_id") ?? "");
  const workspaceRole: WorkspaceRole = formData.get("workspace_role") === "admin" ? "admin" : "member";
  const values = { email, account_role: accountRole, workspace_id: workspaceId, workspace_role: workspaceRole };
  if (!EMAIL.test(email)) return { error: "That doesn't look like an email address.", values };

  const { supabase } = await requireAdmin();
  const admin = createAdminClient();

  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return { error: `${email} already has an account. Change their role or workspaces in the lists below.`, values };
  }
  if (accountRole === "owner") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).neq("account_role", "user");
    if ((count ?? 0) >= MAX_OWNERS) {
      return { error: `All ${MAX_OWNERS} owner seats are taken. Invite them as a user, or free a seat first.`, values };
    }
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited.user) return { error: inviteError?.message ?? "The invite could not be sent.", values };
  const userId = invited.user.id;

  // The invite has gone out; anything that fails from here is reported but leaves them as a user.
  if (accountRole === "owner") {
    const { error } = await supabase.rpc("admin_set_account_role", { target: userId, new_role: "owner" });
    if (error) return { error: `Invited ${email} as a user, but couldn't make them an owner: ${error.message}` };
  }
  if (workspaceId) {
    const { error } = await supabase.rpc("admin_set_member", { ws: workspaceId, member: userId, member_role: workspaceRole });
    if (error) return { error: `Invited ${email}, but couldn't add them to the workspace: ${error.message}` };
  }

  return done(`Invited ${email}. They'll get an email to set a password.`);
}

/** Same email as "Set your password" on the sign-in page; works for invites that expired. */
export async function sendSetupLink(email: string): Promise<Outcome> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    console.error("admin sendSetupLink failed:", error.status, error.code, error.message);
    return { error: error.status === 429 ? "Too many emails just now. Try again in a few minutes." : "The email couldn't be sent." };
  }
  return { ok: "Setup link sent." };
}

export async function removeAccount(userId: string): Promise<Outcome> {
  const { supabase, profile } = await requireAdmin();
  if (userId === profile.id) return { error: "You can't remove your own account." };

  const { data: people, error } = await supabase.rpc("admin_people");
  if (error) return { error: error.message };
  const person = people.find((p) => p.id === userId);
  if (!person) return done();
  if (person.account_role === "admin") return { error: "The admin account can't be removed." };
  if (person.owned_workspaces > 0) return { error: "They own a team workspace. Give it to another owner first." };

  const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(userId);
  return deleteError ? { error: deleteError.message } : done();
}

export async function createWorkspaceFor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const ownerId = String(formData.get("owner_id") ?? "");
  const values = { name, owner_id: ownerId };
  if (!name) return { error: "Name the workspace.", values };
  if (name.length > 80) return { error: "Keep the name under 80 characters.", values };
  if (!ownerId) return { error: "Choose who owns it.", values };

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_create_workspace", { owner: ownerId, ws_name: name });
  return error ? { error: error.message, values } : done(`Created ${name}.`);
}

export async function renameWorkspaceAsAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = String(formData.get("workspace_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name the workspace." };
  if (name.length > 80) return { error: "Keep the name under 80 characters." };

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_rename_workspace", { ws: workspaceId, ws_name: name });
  return error ? { error: error.message } : done("Renamed.");
}

export async function deleteWorkspaceAsAdmin(workspaceId: string): Promise<Outcome> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_delete_workspace", { ws: workspaceId });
  return error ? { error: error.message } : done();
}

export async function setWorkspaceMember(workspaceId: string, userId: string, role: string): Promise<Outcome> {
  if (role !== "owner" && role !== "admin" && role !== "member") return { error: "Choose a role." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_member", { ws: workspaceId, member: userId, member_role: role });
  return error ? { error: error.message } : done();
}

export async function addWorkspaceMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = String(formData.get("workspace_id"));
  const userId = String(formData.get("user_id") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "member";
  if (!userId) return { error: "Choose someone to add." };

  const result = await setWorkspaceMember(workspaceId, userId, role);
  return result?.error ? { error: result.error, values: { user_id: userId, role } } : { ok: "Added." };
}

export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<Outcome> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_remove_member", { ws: workspaceId, member: userId });
  return error ? { error: error.message } : done();
}
