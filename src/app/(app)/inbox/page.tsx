import Link from "next/link";
import type { Metadata } from "next";
import { AtSign, MessageSquare, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TypeGlyph } from "@/components/marks";
import { daysBetween, viewerToday } from "@/lib/dates";
import { shortDate, taskKey } from "@/lib/format";
import { getInbox, getMyWork, type InboxItem } from "@/lib/queries";
import { clearRead, markAllRead, openNotification } from "./actions";

export const metadata: Metadata = { title: "Inbox" };

const KIND = {
  assigned: { icon: UserCheck, verb: "assigned you" },
  mentioned: { icon: AtSign, verb: "mentioned you on" },
  commented: { icon: MessageSquare, verb: "commented on" },
} as const;

function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return shortDate(iso.slice(0, 10));
}

export default async function InboxPage() {
  const [items, work, today] = await Promise.all([getInbox(), getMyWork(), viewerToday()]);
  const unread = items.filter((n) => !n.read_at);
  const earlier = items.filter((n) => n.read_at);
  const dueSoon = work
    .filter((t) => !t.completed_at && t.due_date && daysBetween(today, t.due_date) <= 2)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  return (
    <>
      <PageHeader
        title="Inbox"
        fields={[
          { label: "Unread", value: unread.length, attention: false },
          { label: "Due soon", value: dueSoon.length, attention: dueSoon.some((t) => t.due_date! < today) },
        ]}
        actions={
          <div className="flex gap-2">
            {unread.length > 0 && (
              <form action={markAllRead}>
                <button type="submit" className="btn">
                  Mark all read
                </button>
              </form>
            )}
            {earlier.length > 0 && (
              <form action={clearRead}>
                <button type="submit" className="btn btn-quiet">
                  Clear read
                </button>
              </form>
            )}
          </div>
        }
      />

      {dueSoon.length > 0 && (
        <section aria-labelledby="due-heading">
          <h2 id="due-heading" className="stamp border-b border-rule-strong bg-page-sunk px-4 pt-3 pb-1.5 text-[13px] md:px-8">
            Due soon <span className="font-mono text-[12px] text-pencil">{dueSoon.length}</span>
          </h2>
          <ul>
            {dueSoon.map((t) => {
              const late = t.due_date! < today;
              return (
                <li key={t.id} className="border-b border-rule">
                  <Link href={`/b/${t.board!.id}?task=${t.id}`} className="flex min-h-[41px] items-center gap-3 px-4 py-2 hover:bg-page-sunk md:px-8">
                    <TypeGlyph type={t.type} />
                    <span className="font-mono w-[56px] shrink-0 text-[12px] text-pencil">{taskKey(t.board!.key, t.number)}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{t.title}</span>
                    <span className={`font-mono shrink-0 text-[13px] ${late ? "font-semibold text-attention" : ""}`}>
                      {t.due_date === today ? "TODAY" : shortDate(t.due_date!)}
                      {late && ` · ${daysBetween(t.due_date!, today)}d late`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Group title="Unread" items={unread} empty="You're all caught up." />
      {earlier.length > 0 && <Group title="Earlier" items={earlier} />}
      <div className="ruled-fill flex-1" aria-hidden />
    </>
  );
}

function Group({ title, items, empty }: { title: string; items: InboxItem[]; empty?: string }) {
  return (
    <section aria-label={title}>
      <h2 className="stamp border-b border-rule-strong bg-page-sunk px-4 pt-3 pb-1.5 text-[13px] md:px-8">
        {title} <span className="font-mono text-[12px] text-pencil">{items.length}</span>
      </h2>
      {items.length === 0 && empty && <p className="border-b border-rule px-4 py-3 text-[15px] text-pencil md:px-8">{empty}</p>}
      <ul>
        {items.map((n) => {
          const kind = KIND[n.kind as keyof typeof KIND] ?? KIND.commented;
          const Icon = kind.icon;
          const task = n.task;
          const data = (n.data ?? {}) as { title?: string; excerpt?: string };
          const href = task?.board ? `/b/${task.board.id}?task=${task.id}` : "/";
          return (
            <li key={n.id} className="border-b border-rule">
              <form action={openNotification.bind(null, n.id, href)}>
                <button type="submit" className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-page-sunk md:px-8">
                  <Icon size={16} strokeWidth={1.7} className={`mt-0.5 shrink-0 ${n.read_at ? "text-pencil" : "text-ink"}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] ${n.read_at ? "text-pencil" : ""}`}>
                      <span className="font-semibold">{n.actor?.display_name ?? "Someone"}</span> {kind.verb}{" "}
                      {task?.board && <span className="font-mono text-[13px]">{taskKey(task.board.key, task.number)}</span>}{" "}
                      {task?.title ?? data.title}
                    </span>
                    {data.excerpt && (
                      <span className="mt-0.5 block truncate text-[13px] text-pencil">
                        {data.excerpt.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/g, "@$1")}
                      </span>
                    )}
                  </span>
                  <span className="font-mono shrink-0 text-[12px] text-pencil">{ago(n.created_at)}</span>
                  {!n.read_at && <span className="mt-1.5 size-2 shrink-0 bg-ink" aria-label="Unread" role="img" />}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
