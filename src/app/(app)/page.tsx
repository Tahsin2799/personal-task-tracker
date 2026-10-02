import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { EpicTick, PointsDot, StatusMark, TypeGlyph } from "@/components/marks";
import { daysBetween, viewerToday } from "@/lib/dates";
import { longDate, shortDate, taskKey } from "@/lib/format";
import { Flag } from "lucide-react";
import { Welcome } from "@/components/welcome";
import { getMyWork, getSections, getViewer, type MyWorkEntry } from "@/lib/queries";

export const metadata: Metadata = { title: "My Work" };

type GroupId = "overdue" | "today" | "week" | "later" | "undated" | "done";

const GROUPS: { id: GroupId; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "Next 7 days" },
  { id: "later", label: "Later" },
  { id: "undated", label: "Undated" },
  { id: "done", label: "Done this week" },
];

function groupOf(entry: MyWorkEntry, today: string): GroupId {
  if (entry.completed_at) return "done";
  if (!entry.due_date) return "undated";
  const days = daysBetween(today, entry.due_date);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

export default async function MyWorkPage() {
  const [entries, today, sections, { profile }] = await Promise.all([getMyWork(), viewerToday(), getSections(), getViewer()]);

  const grouped = new Map<GroupId, MyWorkEntry[]>(GROUPS.map((g) => [g.id, []]));
  for (const e of entries) grouped.get(groupOf(e, today))!.push(e);
  // Finished work reads newest first.
  grouped.get("done")!.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  const open = entries.filter((e) => !e.completed_at);
  const overdue = grouped.get("overdue")!.length;
  const sprintPoints = open
    .filter((e) => e.sprint?.status === "active")
    .reduce((sum, e) => sum + (e.story_points ?? 0), 0);

  return (
    <>
      <PageHeader
        title="My Work"
        fields={[
          { label: "Date", value: longDate(today) },
          { label: "Open", value: open.length },
          { label: "Overdue", value: overdue, attention: overdue > 0 },
          { label: "Sprint pts", value: sprintPoints },
        ]}
      />

      {!profile.onboarded_at && (
        <Welcome
          personalBoard={sections.find((s) => s.isPersonal)?.boards[0]?.id ?? null}
          steps={{
            entry: entries.length > 0,
            team: sections.some((s) => !s.isPersonal),
            teammate: sections.some((s) => !s.isPersonal && s.memberCount > 1),
          }}
          teamId={sections.find((s) => !s.isPersonal)?.id ?? null}
        />
      )}

      {entries.length === 0 ? (
        <EmptyIndex firstBoard={sections.flatMap((s) => s.boards)[0]} />
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Tasks assigned to you, grouped by due date</caption>
          <thead className="hidden md:table-header-group">
            <tr className="stamp text-[11px] text-pencil">
              <th scope="col" className="w-10 py-2 pl-8">
                <span className="sr-only">Type</span>
              </th>
              <th scope="col" className="w-[88px] py-2 pl-3">Key</th>
              <th scope="col" className="py-2 pl-3">Entry</th>
              <th scope="col" className="hidden w-[220px] py-2 pl-3 lg:table-cell">Where</th>
              <th scope="col" className="w-[140px] py-2 pl-3">Status</th>
              <th scope="col" className="hidden w-[110px] py-2 pl-3 xl:table-cell">Sprint</th>
              <th scope="col" className="w-[72px] py-2 pl-3">Pts</th>
              <th scope="col" className="w-[164px] py-2 pr-8 pl-3">Due</th>
            </tr>
          </thead>
          {GROUPS.map(({ id, label }) => {
            const rows = grouped.get(id)!;
            if (rows.length === 0) return null;
            return (
              <tbody key={id}>
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={8}
                    className={`border-t border-rule-strong bg-page-sunk px-4 pt-3 pb-1.5 md:px-8 ${
                      id === "overdue" ? "text-attention" : ""
                    }`}
                  >
                    <span className="stamp text-[13px]">{label}</span>
                    <span className="font-mono ml-2 text-[12px] text-pencil">{rows.length}</span>
                  </th>
                </tr>
                {rows.map((e, i) => (
                  <EntryRow key={e.id} entry={e} today={today} primary={id === "overdue" && i === 0} />
                ))}
              </tbody>
            );
          })}
        </table>
      )}
      <div className="ruled-fill flex-1" aria-hidden />
    </>
  );
}

function EntryRow({ entry: e, today, primary }: { entry: MyWorkEntry; today: string; primary: boolean }) {
  const key = taskKey(e.board!.key, e.number);
  const done = Boolean(e.completed_at);
  const where = `${e.board!.workspace!.is_personal ? "Personal" : e.board!.workspace!.name} / ${e.board!.name}`;

  return (
    <tr className={`group border-t border-rule ${primary ? "bg-attention-wash" : "hover:bg-page-sunk"}`}>
      <td className="relative hidden h-10 py-0 pl-8 md:table-cell">
        {primary && (
          <svg
            width="8"
            height="10"
            viewBox="0 0 8 10"
            className="absolute top-1/2 left-3.5 -translate-y-1/2 text-attention"
            role="img"
            aria-label="Most urgent"
          >
            <path d="M0 0 L8 5 L0 10 Z" fill="currentColor" />
          </svg>
        )}
        <span className="flex h-10 items-center gap-2">
          <span className="flex h-4 w-[3px]">
            {e.epic && <EpicTick epicNumber={e.epic.number} title={e.epic.title} />}
          </span>
          <TypeGlyph type={e.type} />
        </span>
      </td>
      <td className="hidden pl-3 align-middle md:table-cell">
        <Link
          href={`/b/${e.board!.id}?task=${e.id}`}
          className={`font-mono text-[13px] hover:underline ${done ? "struck" : ""}`}
        >
          {key}
        </Link>
      </td>
      <td className="max-w-0 py-2 pr-4 pl-4 align-middle md:max-w-none md:pr-0 md:pl-3">
        <Link
          href={`/b/${e.board!.id}?task=${e.id}`}
          className={`text-[15px] hover:underline ${done ? "text-pencil" : ""} ${primary ? "font-semibold" : ""}`}
        >
          {e.milestone && <Flag size={13} strokeWidth={2.2} className="mr-1.5 inline align-[-1px]" aria-label="Milestone" />}
          {e.title}
        </Link>
        {/* Compact meta line where the columns don't fit. */}
        <span className="mt-0.5 flex items-center gap-x-3 whitespace-nowrap text-[12px] text-pencil md:hidden">
          <span className={`font-mono shrink-0 ${done ? "struck" : ""}`}>{key}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <StatusMark category={e.column!.category} />
            {e.column!.name}
          </span>
          <span className="min-w-0 truncate">{where}</span>
          <span className="shrink-0">
            <Due due={e.due_date} today={today} done={done} />
          </span>
        </span>
        <span className="mt-0.5 hidden text-[12px] text-pencil md:block lg:hidden">{where}</span>
      </td>
      <td className="hidden truncate pl-3 align-middle text-[13px] text-pencil lg:table-cell">{where}</td>
      <td className="hidden pl-3 align-middle md:table-cell">
        <span className="flex items-center gap-2 text-[13px]">
          <StatusMark category={e.column!.category} />
          <span className="truncate">{e.column!.name}</span>
        </span>
      </td>
      <td className="hidden pl-3 align-middle text-[13px] text-pencil xl:table-cell">
        {e.sprint ? e.sprint.name : <span aria-label="Backlog">Backlog</span>}
      </td>
      <td className="hidden pl-3 align-middle md:table-cell">
        <PointsDot points={e.story_points} />
      </td>
      <td className="hidden pr-8 pl-3 align-middle md:table-cell">
        <Due due={e.due_date} today={today} done={done} />
      </td>
    </tr>
  );
}

function Due({ due, today, done }: { due: string | null; today: string; done: boolean }) {
  if (!due) return <span className="text-pencil">—</span>;
  const days = daysBetween(today, due);
  if (!done && days < 0) {
    return (
      <span className="font-mono whitespace-nowrap text-[13px] font-semibold text-attention">
        {shortDate(due)} <span className="font-normal">· {-days}d late</span>
      </span>
    );
  }
  if (!done && days === 0) return <span className="stamp text-[13px]">Today</span>;
  return <span className="font-mono text-[13px]">{shortDate(due)}</span>;
}

function EmptyIndex({ firstBoard }: { firstBoard?: { id: string; name: string } }) {
  return (
    <div className="px-4 py-10 md:px-8">
      <p className="max-w-[60ch] text-[17px]">Nothing is assigned to you yet.</p>
      <p className="mt-2 max-w-[60ch] text-pencil">
        Any entry assigned to you, on any board in any workspace, is listed here, most urgent first.
      </p>
      {firstBoard && (
        <Link href={`/b/${firstBoard.id}`} className="btn btn-primary mt-6">
          Open {firstBoard.name}
        </Link>
      )}
    </div>
  );
}
