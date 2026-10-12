"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next-path";
import type { ActionState } from "@/lib/action-state";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: "That email and password don't match an account. Check both, or reset your password.",
      values: { email },
    };
  }
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter the email you were invited with." };

  const supabase = await createClient();
  // Supabase answers success for unknown addresses, so an error here is a real send failure
  // (rate limit or SMTP), not a sign the account doesn't exist.
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    console.error("resetPasswordForEmail failed:", error.status, error.code, error.message);
    return {
      error:
        error.status === 429
          ? "Too many emails were sent recently. Wait a few minutes, then try again."
          : "We couldn't send the email. Try again shortly, or ask a workspace owner for help.",
      values: { email },
    };
  }
  // Same answer whether or not the account exists.
  return { ok: "If that address has an account, a reset link is on its way. It expires in an hour." };
}

export async function setPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
