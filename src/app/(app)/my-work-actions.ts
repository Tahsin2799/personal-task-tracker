"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/queries";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Re-date several entries at once (My Work's "move overdue to…", and its undo). Row Level Security
 * decides which of them the viewer may change; the rest are reported back, not silently skipped.
 */
export async function setDueDates(changes: { id: string; due: string | null }[]): Promise<{ error?: string; changed: number }> {
  if (changes.length === 0) return { changed: 0 };
  if (changes.length > 200) return { error: "That's too many entries to move at once.", changed: 0 };
  if (changes.some((c) => c.due !== null && !ISO_DATE.test(c.due))) return { error: "That isn't a date.", changed: 0 };

  const { supabase } = await getSession();
  const results = await Promise.all(
    changes.map((c) => supabase.from("tasks").update({ due_date: c.due }).eq("id", c.id).select("id")),
  );
  const changed = results.reduce((n, r) => n + (r.data?.length ?? 0), 0);
  const failed = results.find((r) => r.error)?.error;

  revalidatePath("/", "layout");
  if (failed) return { error: failed.message, changed };
  if (changed < changes.length) return { error: `${changes.length - changed} of them couldn't be changed.`, changed };
  return { changed };
}
