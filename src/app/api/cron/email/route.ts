import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, daysBetween } from "@/lib/day-math";
import { renderMail, sendMail, settingsFooter, siteUrl, type MailLine } from "@/lib/email";
import { shortDate, taskKey } from "@/lib/format";

/**
 * The email worker. Supabase pg_cron calls it every 10 minutes (see the recurrence_and_email
 * migration) with the shared CRON_SECRET. Each run:
 * - batches unread in-app notifications older than a few minutes into one email per person
 *   (anything read in the app first is never emailed), and
 * - once a day, after 07:00 in each person's time zone, sends what is overdue, due today or tomorrow.
 */

const GRACE_MINUTES = 5;
const REMINDER_HOUR = 7;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.SMTP_HOST) return Response.json({ skipped: "SMTP_HOST is not set" });

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, email, display_name, time_zone, email_notifications, email_due_reminders, reminded_on");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const notified = await sendNotificationBatches(admin, profiles);
  const reminded = await sendDueReminders(admin, profiles);
  return Response.json({ notified, reminded });
}

// Vercel Cron and manual runs use GET.
export const GET = POST;

type Admin = ReturnType<typeof createAdminClient>;
type Profile = {
  id: string;
  email: string;
  display_name: string;
  time_zone: string;
  email_notifications: boolean;
  email_due_reminders: boolean;
  reminded_on: string | null;
};

const VERBS = { assigned: "assigned you", mentioned: "mentioned you", commented: "commented" } as const;

async function sendNotificationBatches(admin: Admin, profiles: Profile[]) {
  const now = Date.now();
  const { data: rows, error } = await admin
    .from("notifications")
    .select(
      `id, kind, data, user_id,
       actor:profiles!notifications_actor_id_fkey(display_name),
       task:tasks(id, number, title, board:boards!tasks_board_id_fkey(id, key))`,
    )
    .is("emailed_at", null)
    .is("read_at", null)
    .lt("created_at", new Date(now - GRACE_MINUTES * 60_000).toISOString())
    .gt("created_at", new Date(now - 2 * 86_400_000).toISOString())
    .order("created_at");
  if (error) throw error;

  let sent = 0;
  for (const profile of profiles) {
    const mine = rows.filter((r) => r.user_id === profile.id);
    if (!mine.length) continue;

    if (profile.email_notifications) {
      const lines: MailLine[] = mine.flatMap((n) => {
        if (!n.task?.board) return [];
        const data = n.data as { excerpt?: string };
        const verb = VERBS[n.kind as keyof typeof VERBS] ?? n.kind;
        return [
          {
            key: taskKey(n.task.board.key, n.task.number),
            title: n.task.title,
            href: `${siteUrl()}/b/${n.task.board.id}?task=${n.task.id}`,
            note: `${n.actor?.display_name ?? "Someone"} ${verb}`,
            quote: data.excerpt?.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/g, "@$1"),
          },
        ];
      });
      if (lines.length) {
        const first = lines[0];
        const subject = lines.length === 1 ? `${first.note}: ${first.key} ${first.title}` : `${lines.length} updates in your field book`;
        const { html, text } = renderMail(lines.length === 1 ? `${first.note}` : `${lines.length} updates since you last looked`, [{ caption: "Inbox", lines }], settingsFooter());
        await sendMail(profile.email, subject, html, text);
        sent++;
      }
    }
    // Opted-out or not, these are settled: they never queue up for later.
    await admin
      .from("notifications")
      .update({ emailed_at: new Date().toISOString() })
      .in("id", mine.map((n) => n.id));
  }
  return sent;
}

function localClock(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

async function sendDueReminders(admin: Admin, profiles: Profile[]) {
  let sent = 0;
  for (const profile of profiles) {
    if (!profile.email_due_reminders) continue;
    let clock;
    try {
      clock = localClock(profile.time_zone);
    } catch {
      clock = localClock("UTC");
    }
    if (clock.hour < REMINDER_HOUR || (profile.reminded_on && profile.reminded_on >= clock.date)) continue;

    const tomorrow = addDays(clock.date, 1);
    const { data: tasks, error } = await admin
      .from("tasks")
      .select("id, number, title, due_date, milestone, board:boards!tasks_board_id_fkey(id, key, archived_at)")
      .eq("assignee_id", profile.id)
      .is("completed_at", null)
      .is("archived_at", null)
      .neq("type", "epic")
      .not("due_date", "is", null)
      .lte("due_date", tomorrow)
      .order("due_date");
    if (error) throw error;

    const open = tasks.filter((t) => t.board && !t.board.archived_at);
    const line = (t: (typeof open)[number], note: string, late = false): MailLine => ({
      key: taskKey(t.board!.key, t.number),
      title: t.title,
      href: `${siteUrl()}/b/${t.board!.id}?task=${t.id}`,
      note: t.milestone ? `Milestone · ${note}` : note,
      late,
    });
    const sections = [
      {
        caption: "Overdue",
        lines: open.filter((t) => t.due_date! < clock.date).map((t) => line(t, `${shortDate(t.due_date!)} · ${daysBetween(t.due_date!, clock.date)}d late`, true)),
      },
      { caption: "Due today", lines: open.filter((t) => t.due_date === clock.date).map((t) => line(t, "Today")) },
      { caption: "Due tomorrow", lines: open.filter((t) => t.due_date === tomorrow).map((t) => line(t, shortDate(tomorrow))) },
    ].filter((s) => s.lines.length);

    if (sections.length) {
      const today = sections.find((s) => s.caption === "Due today")?.lines.length ?? 0;
      const late = sections.find((s) => s.caption === "Overdue")?.lines.length ?? 0;
      const subject = [today && `${today} due today`, late && `${late} overdue`].filter(Boolean).join(", ") || "Due tomorrow";
      const { html, text } = renderMail(`Due soon, ${profile.display_name.split(" ")[0]}`, sections, settingsFooter());
      await sendMail(profile.email, `${subject} · Bird-Watcher`, html, text);
      sent++;
    }
    await admin.from("profiles").update({ reminded_on: clock.date }).eq("id", profile.id);
  }
  return sent;
}
