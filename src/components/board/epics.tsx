"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { StatusMark, TypeGlyph } from "@/components/marks";
import { epicInk, formatPoints, shortDate, taskKey } from "@/lib/format";
import type { BoardTask } from "@/lib/queries";
import { createTask } from "@/app/(app)/b/[boardId]/actions";
import { useBoard } from "./board-context";
import { AssigneeStamp, DueMark, useTaskHref } from "./bits";

/** Epics as ruled lines of the book, each with a tally bar of finished points. */
export function Epics() {
  const board = useBoard();
  const epics = board.tasks.filter((t) => t.type === "epic").sort((a, b) => a.number - b.number);
  const loose = board.tasks.filter((t) => (t.type === "story" || t.type === "task" || t.type === "bug") && !t.epic_id && !t.completed_at);

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline border-b border-rule px-4 py-2 text-[13px] text-pencil md:px-8">
        <span>
          {epics.length} epic{epics.length === 1 ? "" : "s"} · {loose.length} open entr{loose.length === 1 ? "y" : "ies"} not in any epic
        </span>
      </div>
      <div
        aria-hidden
        className="rule-double stamp hidden grid-cols-[28px_minmax(0,1fr)_260px_120px_88px] gap-x-2 pr-8 pl-5 pt-3 pb-1.5 text-[11px] text-pencil md:grid"
      >
        <span />
        <span>Epic</span>
        <span>Progress</span>
        <span>Status · owner</span>
        <span>Due</span>
      </div>
      <ul>
        {epics.map((e) => (
          <EpicRow key={e.id} epic={e} />
        ))}
      </ul>
      <NewEpic />
      <div className="ruled-fill flex-1" aria-hidden />
    </>
  );
}

function EpicRow({ epic }: { epic: BoardTask }) {
  const board = useBoard();
  const href = useTaskHref();
  const [open, setOpen] = useState(false);
  const entries = board.tasks.filter((t) => t.epic_id === epic.id);
  const total = entries.reduce((s, t) => s + (t.story_points ?? 0), 0);
  const done = entries.filter((t) => t.completed_at).reduce((s, t) => s + (t.story_points ?? 0), 0);
  const doneCount = entries.filter((t) => t.completed_at).length;
  const share = total > 0 ? done / total : entries.length > 0 ? doneCount / entries.length : 0;
  const column = board.columns.find((c) => c.id === epic.column_id);
  const owner = board.members.find((m) => m.id === epic.assignee_id);

  return (
    <li className="border-b border-rule">
      <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-2 py-3 pr-4 pl-2 md:grid-cols-[28px_minmax(0,1fr)_260px_120px_88px] md:pr-8 md:pl-5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} entries in ${epic.title}`}
          className="flex size-7 items-center justify-center text-pencil hover:text-ink"
        >
          <ChevronRight size={15} strokeWidth={1.7} className={`transition-transform duration-[160ms] ${open ? "rotate-90" : ""}`} aria-hidden />
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-4 w-[3px] shrink-0" style={{ background: epicInk(epic.number) }} aria-hidden />
          <span className={`font-mono shrink-0 whitespace-nowrap text-[13px] ${epic.completed_at ? "struck" : "text-pencil"}`}>{taskKey(board.key, epic.number)}</span>
          <Link href={href(epic.id)} scroll={false} className="min-w-0 truncate text-[16px] font-semibold hover:underline">
            {epic.title}
          </Link>
        </div>
        <div className="col-start-2 mt-2 flex items-center gap-3 md:col-start-auto md:mt-0">
          <span
            role="meter"
            aria-label={`${epic.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
            className="relative block h-2.5 flex-1 border border-rule-strong"
          >
            <span className="absolute inset-y-0 left-0" style={{ width: `${share * 100}%`, background: epicInk(epic.number) }} />
          </span>
          <span className="font-mono w-[96px] shrink-0 text-[12px] text-pencil">
            {total > 0 ? `${formatPoints(done)}/${formatPoints(total)} pts` : `${doneCount}/${entries.length} done`}
          </span>
        </div>
        <span className="col-start-2 mt-1 flex items-center gap-2 text-[13px] text-pencil md:col-start-auto md:mt-0">
          {column && <StatusMark category={column.category} />}
          {column?.name}
          {owner && <AssigneeStamp name={owner.name} size="sm" />}
        </span>
        <span className="col-start-2 mt-1 md:col-start-auto md:mt-0">
          {epic.due_date ? <DueMark due={epic.due_date} today={board.today} done={Boolean(epic.completed_at)} /> : <span className="text-pencil">—</span>}
        </span>
      </div>
      {open && (
        <ul className="border-t border-rule bg-page-sunk/60 pb-1">
          {entries.length === 0 && <li className="py-2 pl-16 text-[14px] text-pencil">No entries yet. Set an entry&apos;s Epic field to {taskKey(board.key, epic.number)}.</li>}
          {entries
            .sort((a, b) => Number(Boolean(a.completed_at)) - Number(Boolean(b.completed_at)) || a.number - b.number)
            .map((t) => {
              const c = board.columns.find((col) => col.id === t.column_id);
              return (
                <li key={t.id} className="flex min-h-9 items-center gap-3 pr-4 pl-14 md:pr-8 md:pl-16">
                  <TypeGlyph type={t.type} />
                  <span className={`font-mono w-[52px] shrink-0 whitespace-nowrap text-[12px] ${t.completed_at ? "struck" : "text-pencil"}`}>{taskKey(board.key, t.number)}</span>
                  <Link href={href(t.id)} scroll={false} className={`min-w-0 flex-1 truncate text-[14px] hover:underline ${t.completed_at ? "text-pencil" : ""}`}>
                    {t.title}
                  </Link>
                  {c && <StatusMark category={c.category} />}
                  <span className="font-mono w-8 text-right text-[12px] text-pencil">{t.story_points != null ? formatPoints(t.story_points) : "—"}</span>
                  {t.due_date && <span className="font-mono hidden text-[12px] text-pencil sm:inline">{shortDate(t.due_date)}</span>}
                </li>
              );
            })}
        </ul>
      )}
    </li>
  );
}

function NewEpic() {
  const board = useBoard();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      className="border-b border-rule-strong px-4 py-3 md:px-8"
      onSubmit={(e) => {
        e.preventDefault();
        const title = ref.current?.value.trim();
        if (!title) return;
        if (ref.current) ref.current.value = "";
        void board.run(null, () => createTask(board.id, { title, type: "epic", sprintId: null }));
      }}
    >
      <label htmlFor="new-epic" className="field-label">
        New epic
      </label>
      <input ref={ref} id="new-epic" maxLength={500} autoComplete="off" placeholder="e.g. Paper: plumage variation" className="field max-w-[560px]" />
    </form>
  );
}
