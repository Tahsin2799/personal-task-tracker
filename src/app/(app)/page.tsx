import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CatchUp } from "@/components/catch-up";
import { FoldRows } from "@/components/fold-rows";
import { PageHeader } from "@/components/page-header";
import { MilestoneStamp, PointsDot, PriorityMark, StatusMark, TypeGlyph } from "@/components/marks";
import { daysBetween, viewerToday } from "@/lib/dates";
import { longDate, shortDate, taskKey } from "@/lib/format";
import { Welcome } from "@/components/welcome";
import { getMyWork, getSections, getViewer, requestTime, type MyWorkEntry } from "@/lib/queries";
import { byUrgency } from "@/lib/urgency";
import { Check } from "lucide-react";
import { DueSlot, LedgerKeys, QuickWrite, ReschedulePile, StatusSlot, WorkspaceSelect } from "./my-work-controls";

export const metadata: Metadata = { title: "My Work" };

type GroupId = "overdue" | "today" | "week" | "later" | "done";

// Fold only what's long: the most urgent group stays open unless it would run off the page.
const GROUPS: { id: GroupId; label: string; noun: string; fold?: { over: number; show: number } }[] = [
  { id: "overdue", label: "Overdue", noun: "overdue", fold: { over: 10, show: 8 } },
  { id: "today", label: "Today", noun: "due today" },
  { id: "week", label: "Next 7 days", noun: "this week" },
  { id: "later", label: "Later", noun: "later", fold: { over: 10, show: 8 } },
  { id: "done", label: "Done this week", noun: "done", fold: { over: 5, show: 3 } },
];

const COLUMNS = 8;

function groupOf(entry: MyWorkEntry, today: string): GroupId {
  if (entry.completed_at) return "done";
  if (!entry.due_date) return "later";
  const days = daysBetween(today, entry.due_date);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

const workspaceOf = (e: MyWorkEntry) => e.board!.workspace!;
const workspaceLabel = (w: { name: string; is_personal: boolean }) => (w.is_personal ? "Personal" : w.name);
const boardInk = (color: string | null) => (color ? `var(--${color.replace("ink", "ink-epic")})` : "transparent");

export default async function MyWorkPage({ searchParams }: PageProps<"/">) {
  const [all, today, sections, { profile }, params, store] = await Promise.all([
    getMyWork(),
    viewerToday(),
    getSections(),
    getViewer(),
    searchParams,
    cookies(),
  ]);

  // The workspace filter lives in the URL (?ws=), like the board filters.
  const workspaces = [...new Map(all.map((e) => [workspaceOf(e).id, workspaceOf(e)])).values()].sort(
    (a, b) => Number(b.is_personal) - Number(a.is_personal) || a.name.localeCompare(b.name),
  );
  const ws = typeof params.ws === "string" && workspaces.some((w) => w.id === params.ws) ? params.ws : null;
  const entries = ws ? all.filter((e) => workspaceOf(e).id === ws) : all;

  const grouped = new Map<GroupId, MyWorkEntry[]>(GROUPS.map((g) => [g.id, []]));
  for (const e of entries) grouped.get(groupOf(e, today))!.push(e);
  for (const { id } of GROUPS) {
    if (id === "done") grouped.get(id)!.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    else grouped.get(id)!.sort(byUrgency);
  }
  // The one entry to rescue first: the top of Overdue, or of Today when nothing is late.
  const primaryId = (grouped.get("overdue")![0] ?? grouped.get("today")![0])?.id;
  const openCount = entries.filter((e) => !e.completed_at).length;

  // Quick write: every board you can write on; the filtered workspace's, else the one you last used.
  const writable = sections.flatMap((s) =>
    s.boards.map((b) => ({ id: b.id, label: `${s.isPersonal ? "Personal" : s.name} / ${b.name}`, workspaceId: s.id })),
  );
  const remembered = store.get("write-board")?.value;
  const defaultBoardId =
    (ws && writable.find((b) => b.workspaceId === ws)?.id) ||
    (remembered && writable.some((b) => b.id === remembered) ? remembered : null) ||
    sections.find((s) => s.isPersonal)?.boards[0]?.id ||
    writable[0]?.id ||
    null;

  return (
    <>
      <CatchUp renderedAt={requestTime()} />
      <PageHeader
        title="My Work"
        subtitle={longDate(today)}
        actions={
          workspaces.length > 1 ? (
            <div className="w-full md:w-auto">
              <WorkspaceStrip workspaces={workspaces} entries={all} active={ws} />
              <div className="md:hidden">
                <WorkspaceSelect
                  active={ws}
                  options={workspaces.map((w) => ({
                    id: w.id,
                    label: workspaceLabel(w),
                    count: all.filter((e) => !e.completed_at && workspaceOf(e).id === w.id).length,
                  }))}
                />
              </div>
            </div>
          ) : undefined
        }
      />

      {!profile.onboarded_at && (
        <Welcome
          personalBoard={sections.find((s) => s.isPersonal)?.boards[0]?.id ?? null}
          firstBoard={sections.flatMap((s) => s.boards)[0]?.id ?? null}
          canCreateWorkspaces={profile.account_role !== "user"}
          steps={{
            entry: all.length > 0,
            team: sections.some((s) => !s.isPersonal),
            teammate: sections.some((s) => !s.isPersonal && s.memberCount > 1),
          }}
          teamId={sections.find((s) => !s.isPersonal)?.id ?? null}
        />
      )}

      <QuickWrite boards={writable.map(({ id, label }) => ({ id, label }))} defaultBoardId={defaultBoardId} />

      {entries.length > 0 && openCount === 0 && (
        <p className="flex items-center gap-2 border-b border-rule bg-page-sunk px-4 py-2.5 text-[15px] md:px-8">
          <Check size={15} strokeWidth={2.5} className="text-done" aria-hidden />
          All clear. Nothing open is assigned to you{ws ? " in this workspace" : ""}.
        </p>
      )}
      {entries.length === 0 ? (
        <EmptyIndex filtered={Boolean(ws)} veteran={Boolean(profile.onboarded_at)} />
      ) : (
        // Fixed layout from md: long workspace or board names truncate instead of squeezing the entry.
        <table className="w-full border-collapse text-left md:table-fixed">
          <caption className="sr-only">Tasks assigned to you, most urgent first, grouped by due date</caption>
          <thead className="hidden md:table-header-group">
            <tr className="stamp text-[11px] text-pencil">
              <th scope="col" className="w-[76px] py-2 pl-8">
                <span className="sr-only">Priority and type</span>
              </th>
              <th scope="col" className="w-[104px] py-2 pl-3">Key</th>
              <th scope="col" className="py-2 pl-3">Entry</th>
              <th scope="col" className="hidden w-[220px] py-2 pl-3 lg:table-cell">Where</th>
              <th scope="col" className="w-[132px] py-2 pl-3">Status</th>
              <th scope="col" className="hidden w-[112px] py-2 pl-3 xl:table-cell">Sprint</th>
              <th scope="col" className="w-[64px] py-2 pl-3">Pts</th>
              <th scope="col" className="w-[156px] py-2 pr-8 pl-3">Due</th>
            </tr>
          </thead>
          {GROUPS.map(({ id, label, noun, fold }) => {
            const rows = grouped.get(id)!;
            // Today always answers, even when the answer is nothing.
            if (rows.length === 0 && id === "today" && openCount > 0) {
              return (
                <tbody key={id}>
                  <tr>
                    <th scope="rowgroup" colSpan={COLUMNS} className="border-t border-rule-strong bg-page-sunk px-4 pt-2 pb-1 md:px-8">
                      <span className="flex min-h-7 items-center gap-2">
                        <span className="stamp text-[13px]">{label}</span>
                        <span className="tnum text-[12px] font-normal text-pencil">0</span>
                      </span>
                    </th>
                  </tr>
                  <tr className="border-t border-rule">
                    <td colSpan={COLUMNS} className="h-10 px-4 text-[14px] text-pencil md:pl-[88px]">
                      Nothing due today.
                    </td>
                  </tr>
                </tbody>
              );
            }
            if (rows.length === 0) return null;
            const shown = fold && rows.length > fold.over ? fold.show : rows.length;
            const row = (e: MyWorkEntry) => <EntryRow key={e.id} entry={e} today={today} primary={e.id === primaryId} />;
            return (
              <tbody key={id}>
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={COLUMNS}
                    className={`border-t border-rule-strong bg-page-sunk px-4 pt-2 pb-1 md:px-8 ${id === "overdue" ? "text-attention" : ""}`}
                  >
                    <span className="flex min-h-7 items-center gap-2">
                      <span className="stamp text-[13px]">{label}</span>
                      <span className="tnum text-[12px] font-normal text-pencil">{rows.length}</span>
                      {id === "overdue" && (
                        <ReschedulePile items={rows.filter((e) => !e.milestone).map((e) => ({ id: e.id, due: e.due_date }))} />
                      )}
                    </span>
                  </th>
                </tr>
                {rows.slice(0, shown).map(row)}
                {shown < rows.length && (
                  <FoldRows count={rows.length - shown} noun={noun} colSpan={COLUMNS}>
                    {rows.slice(shown).map(row)}
                  </FoldRows>
                )}
              </tbody>
            );
          })}
        </table>
      )}

      {all.length > 0 && (
        <>
          <LedgerKeys />
          {/* The ledger's key, printed at its foot: how to work it without the mouse. */}
          <p className="hidden border-t border-rule px-8 py-3 text-[12px] text-pencil md:block">
            <Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>x</Kbd> done or reopen · <Kbd>u</Kbd> undo · <Kbd>d</Kbd> due date · <Kbd>s</Kbd>{" "}
            status · <Kbd>↵</Kbd> open · <Kbd>c</Kbd> write
          </p>
        </>
      )}
    </>
  );
}

/** Personal or a team, at a glance: a square segmented strip, the pressed workspace inverted to ink. */
function WorkspaceStrip({
  workspaces,
  entries,
  active,
}: {
  workspaces: { id: string; name: string; is_personal: boolean }[];
  entries: MyWorkEntry[];
  active: string | null;
}) {
  const open = (wsId?: string) => entries.filter((e) => !e.completed_at && (!wsId || workspaceOf(e).id === wsId)).length;
  const segment = (href: string, label: string, count: number, pressed: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={pressed ? "page" : undefined}
      className={`flex min-h-8 shrink-0 items-center gap-1.5 border-l border-rule-strong px-2.5 text-[13px] first:border-l-0 ${
        pressed ? "bg-ink text-page" : "hover:bg-page-sunk"
      }`}
    >
      {label}
      <span className={`tnum text-[12px] ${pressed ? "text-page" : "text-pencil"}`}>{count}</span>
    </Link>
  );

  return (
    <nav aria-label="Filter by workspace" className="hidden max-w-full overflow-x-auto md:block">
      <div className="flex w-max border border-rule-strong">
        {segment("/", "All", open(), active === null)}
        {workspaces.map((w) => segment(`/?ws=${w.id}`, workspaceLabel(w), open(w.id), active === w.id))}
      </div>
    </nav>
  );
}

function EntryRow({ entry: e, today, primary }: { entry: MyWorkEntry; today: string; primary: boolean }) {
  const key = taskKey(e.board!.key, e.number);
  const done = Boolean(e.completed_at);
  const where = `${workspaceLabel(workspaceOf(e))} / ${e.board!.name}`;
  const href = `/b/${e.board!.id}?task=${e.id}`;
  const columns = [...e.board!.board_columns].sort((a, b) => (a.position < b.position ? -1 : 1));
  const firstOf = (category: "todo" | "done") => columns.find((c) => c.category === category)?.id ?? "";
  const swatch = (
    <span className="size-2 shrink-0" style={{ background: boardInk(e.board!.color) }} aria-hidden />
  );

  return (
    <tr
      data-entry
      data-task-id={e.id}
      data-board-id={e.board!.id}
      data-entry-key={key}
      data-done={done}
      data-column={e.column!.id}
      data-done-column={firstOf("done")}
      data-todo-column={firstOf("todo") || columns[0]?.id || ""}
      className={`group border-t border-rule ${primary ? "bg-attention-wash" : "hover:bg-page-sunk focus-within:bg-page-sunk"}`}
    >
      <td className="relative hidden h-10 py-0 pl-8 md:table-cell">
        {primary && (
          <svg width="8" height="10" viewBox="0 0 8 10" className="absolute top-1/2 left-3.5 -translate-y-1/2 text-attention" aria-hidden>
            <path d="M0 0 L8 5 L0 10 Z" fill="currentColor" />
          </svg>
        )}
        {/* The ranked column: priority first (the order within a group), then the entry's type. */}
        <span className="flex h-10 items-center gap-1.5">
          <PriorityMark priority={e.priority} markMedium />
          <TypeGlyph type={e.type} />
        </span>
      </td>
      <td className="hidden pl-3 align-middle md:table-cell">
        <span className="flex items-center gap-1.5">
          {/* The title is the link for keyboard and screen readers; the key is a second mouse target. */}
          <Link href={href} tabIndex={-1} aria-hidden className={`font-mono relative top-px text-[13px] hover:underline ${done ? "struck" : ""}`}>
            {key}
          </Link>
        </span>
      </td>
      <td className="max-w-0 py-2 pr-4 pl-4 align-middle md:max-w-none md:pr-0 md:pl-3">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={href}
            data-entry-link
            title={e.epic ? `Epic: ${e.epic.title}` : undefined}
            className={`text-[15px] hover:underline ${done ? "text-pencil" : ""} ${primary ? "font-semibold" : ""}`}
          >
            {primary && <span className="sr-only">Most urgent: </span>}
            {e.title}
          </Link>
          {e.parent && (
            <span className="text-[13px] text-pencil">
              in <span className="font-mono">{taskKey(e.board!.key, e.parent.number)}</span>
            </span>
          )}
          {e.milestone && <MilestoneStamp />}
        </span>
        {/* Compact meta line where the columns don't fit: only Where gives way, so the date is never cut. */}
        <span className="mt-0.5 flex items-center gap-x-3 overflow-hidden whitespace-nowrap text-[12px] text-pencil md:hidden">
          <span className={`font-mono shrink-0 ${done ? "struck" : ""}`}>{key}</span>
          <PriorityMark priority={e.priority} />
          <span className="flex shrink-0 items-center gap-1.5">
            <StatusMark category={e.column!.category} />
            {e.column!.name}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {swatch}
            <span className="truncate">{where}</span>
          </span>
          <span className="shrink-0">
            <Due due={e.due_date} today={today} done={done} />
          </span>
        </span>
        <span className="mt-0.5 hidden items-center gap-1.5 text-[12px] text-pencil md:flex lg:hidden">
          {swatch}
          <span className="truncate">{where}</span>
        </span>
      </td>
      <td className="hidden pl-3 align-middle text-[13px] text-pencil lg:table-cell" title={where}>
        <span className="flex min-w-0 items-center gap-2">
          {swatch}
          <span className="truncate">{where}</span>
        </span>
      </td>
      <td className="hidden pl-3 align-middle md:table-cell">
        <StatusSlot boardId={e.board!.id} taskId={e.id} entryKey={key} columnId={e.column!.id} columns={columns}>
          <span className="flex min-w-0 items-center gap-2 text-[13px]">
            <StatusMark category={e.column!.category} />
            <span className="truncate">{e.column!.name}</span>
          </span>
        </StatusSlot>
      </td>
      <td className="hidden truncate pl-3 align-middle text-[13px] text-pencil xl:table-cell">
        {e.sprint ? (
          e.sprint.name
        ) : (
          <>
            <span aria-hidden>—</span>
            <span className="sr-only">No sprint</span>
          </>
        )}
      </td>
      <td className="hidden pl-3 align-middle md:table-cell">
        <PointsDot points={e.story_points} />
      </td>
      <td className="hidden pr-8 pl-3 align-middle md:table-cell">
        <DueSlot boardId={e.board!.id} taskId={e.id} entryKey={key} due={e.due_date}>
          <Due due={e.due_date} today={today} done={done} />
        </DueSlot>
      </td>
    </tr>
  );
}

function Due({ due, today, done }: { due: string | null; today: string; done: boolean }) {
  if (!due) return <span className="text-pencil">—</span>;
  const days = daysBetween(today, due);
  if (!done && days < 0) {
    return (
      // The band already says overdue: the date stays ink, the lateness carries the chestnut.
      <span className="tnum whitespace-nowrap text-[13px]">
        {shortDate(due)} <span className="font-semibold text-attention">· {-days}d late</span>
      </span>
    );
  }
  if (!done && days === 0) return <span className="tnum text-[13px] font-semibold">Today</span>;
  return <span className="tnum text-[13px]">{shortDate(due)}</span>;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="font-mono border border-rule-strong px-1 text-[11px] text-ink">{children}</kbd>;
}

function EmptyIndex({ filtered, veteran }: { filtered: boolean; veteran: boolean }) {
  return (
    <div className="px-4 py-10 md:px-8">
      <p className="max-w-[60ch] text-[17px]">
        {filtered ? "Nothing of yours in this workspace." : veteran ? "All clear. Nothing open is assigned to you." : "Nothing is assigned to you yet."}
      </p>
      <p className="mt-2 max-w-[60ch] text-pencil">
        {filtered ? (
          <>
            Write one above, or{" "}
            <Link href="/" className="text-ink underline decoration-rule-mid underline-offset-4 hover:decoration-ink">
              see every workspace
            </Link>
            .
          </>
        ) : veteran ? (
          "Write the next one above when it comes. Anything assigned to you, on any board, lands here most urgent first."
        ) : (
          "Write your first entry above. Anything assigned to you, on any board in any workspace, is listed here, most urgent first."
        )}
      </p>
    </div>
  );
}
