"use server";

import { getSession } from "@/lib/queries";

/** Full-text + key search across every board the viewer can see (RLS-scoped RPC). */
export async function searchEntries(q: string) {
  const query = q.trim();
  if (query.length < 2) return [];
  const { supabase } = await getSession();
  const { data } = await supabase.rpc("search_entries", { q: query });
  return data ?? [];
}

export async function finishOnboarding() {
  const { supabase, userId } = await getSession();
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", userId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");
}
