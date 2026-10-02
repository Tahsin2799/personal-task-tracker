"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/queries";

export async function openNotification(id: number, href: string) {
  const { supabase, profile } = await getViewer();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", profile.id);
  revalidatePath("/", "layout");
  redirect(href);
}

export async function markAllRead() {
  const { supabase, profile } = await getViewer();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", profile.id).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function clearRead() {
  const { supabase, profile } = await getViewer();
  await supabase.from("notifications").delete().eq("user_id", profile.id).not("read_at", "is", null);
  revalidatePath("/", "layout");
}
