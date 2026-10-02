import Link from "next/link";
import type { Metadata } from "next";
import { describeActivity } from "@/lib/activity-words";
import { longDate, taskKey } from "@/lib/format";
import { viewerTimeZone } from "@/lib/dates";
import { getBoard, getViewer } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/b/[boardId]/activity">): Promise<Metadata> {
  const board = await getBoard((await params).boardId);
  return { title: `Activity · ${board.name}` };
}

/** Everything that happened on the board, newest first, a day per section. */
export default async function ActivityPage({ params }: PageProps<"/b/[boardId]/activity">) {
  const { boardId } = await params;
  const [board, { supabase }, timeZone] = await Promise.all([getBoard(boardId), getViewer(), viewerTimeZone()]);
  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone });
  const timeOf = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  const { data } = await supabase
    .from("activity")
    .select("id, kind, data, created_at, task_id, actor:profiles!activity_actor_id_fkey(display_name)")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(200);
  const items = data ?? [];
  const tasks = new Map(board.tasks.map((t) => [t.id, t]));
  const days = new Map<string, typeof items>();
  for (const a of items) {
    const day = dayOf.format(new Date(a.created_at));
    (days.get(day) ?? days.set(day, []).get(day)!).push(a);
  }

  return (
    <>
      {items.length === 0 && (
        <p className="border-b border-rule px-4 py-6 text-[15px] text-pencil md:px-8">
          Nothing recorded yet. Moves, assignments, estimates and comments show up here as people work.
        </p>
      )}
      {[...days.entries()].map(([day, list]) => (
        <section key={day} aria-label={longDate(day)}>
          <h2 className="font-mono border-b border-rule-strong bg-page-sunk px-4 pt-3 pb-1.5 text-[12px] md:px-8">{longDate(day)}</h2>
          <ol>
            {list.map((a) => {
              const task = a.task_id ? tasks.get(a.task_id) : undefined;
              const { verb, rest } = describeActivity(a.kind, (a.data ?? {}) as Record<string, unknown>);
              return (
                <li key={a.id} className="flex min-h-[41px] items-baseline gap-3 border-b border-rule px-4 py-2 text-[14px] md:px-8">
                  <span className="font-mono w-12 shrink-0 text-[12px] text-pencil">
                    {timeOf.format(new Date(a.created_at))}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold">{a.actor?.display_name ?? "Someone"}</span> {verb}{" "}
                    {task ? (
                      <Link href={`/b/${boardId}/activity?task=${task.id}`} scroll={false} className="hover:underline">
                        <span className="font-mono text-[13px]">{taskKey(board.key, task.number)}</span> {task.title}
                      </Link>
                    ) : (
                      "an entry"
                    )}{" "}
                    <span className="text-pencil">{rest}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <div className="ruled-fill flex-1" aria-hidden />
    </>
  );
}
