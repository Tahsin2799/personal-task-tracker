"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/queries";

export async function openNotification(id: number, href: string) {
  const { supabase, userId } = await getSession();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
  revalidatePath("/", "layout");
  redirect(href);
}

export async function markAllRead() {
  const { supabase, userId } = await getSession();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function clearRead() {
  const { supabase, userId } = await getSession();
  await supabase.from("notifications").delete().eq("user_id", userId).not("read_at", "is", null);
  revalidatePath("/", "layout");
}
