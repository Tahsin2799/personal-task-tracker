"use server";

import { getViewer } from "@/lib/queries";

/** Full-text + key search across every board the viewer can see (RLS-scoped RPC). */
export async function searchEntries(q: string) {
  const query = q.trim();
  if (query.length < 2) return [];
  const { supabase } = await getViewer();
  const { data } = await supabase.rpc("search_entries", { q: query });
  return data ?? [];
}

export async function finishOnboarding() {
  const { supabase, profile } = await getViewer();
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", profile.id);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");
}
