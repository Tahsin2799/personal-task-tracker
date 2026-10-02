"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Flag } from "lucide-react";
import { StatusMark, TypeGlyph } from "@/components/marks";
import { epicInk, shortDate, taskKey } from "@/lib/format";
import type { BoardTask } from "@/lib/queries";
import { useBoard } from "./board-context";
import { useTaskHref } from "./bits";
import { FilterBar, useFilteredTasks } from "./filters";
import { PriorityMark, TileAssignee, TileDue, TilePoints } from "./tile-editors";

type SortKey = "key" | "title" | "status" | "assignee" | "priority" | "points" | "sprint" | "due" | "updated";
const PRIORITY_ORDER = ["highest", "high", "medium", "low", "lowest"];

/** Every entry on the board as one sortable ledger; points, due and assignee edit in place. */
export function TableView() {
  const board = useBoard();
  const router = useRouter();
  const href = useTaskHref();
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "key", dir: 1 });
  const base = useMemo(
    () => board.tasks.filter((t) => t.type !== "epic" && (showSubtasks || t.type !== "subtask")),
    [board.tasks, showSubtasks],
  );
  const visible = useFilteredTasks(base);
  const colIndex = new Map(board.columns.map((c, i) => [c.id, i]));
  const member = (id: string | null) => board.members.find((m) => m.id === id)?.name ?? "";
  const sprint = (id: string | null) => board.sprints.find((s) => s.id === id);

  const rows = useMemo(() => {
    const value = (t: BoardTask): string | number => {
      switch (sort.key) {
        case "key": return t.number;
        case "title": return t.title.toLowerCase();
        case "status": return colIndex.get(t.column_id) ?? 0;
        case "assignee": return member(t.assignee_id) || "~";
        case "priority": return PRIORITY_ORDER.indexOf(t.priority);
        case "points": return t.story_points ?? -1;
        case "sprint": return sprint(t.sprint_id)?.created_at ?? "~";
        case "due": return t.due_date ?? "~";
        case "updated": return t.updated_at;
      }
    };
    return [...visible].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers derive from board
  }, [visible, sort, board]);

  return (
    <>
      <FilterBar>
        <label className="flex items-center gap-2 text-[13px] text-pencil">
          <input type="checkbox" checked={showSubtasks} onChange={(e) => setShowSubtasks(e.target.checked)} className="check" />
          Include subtasks
        </label>
      </FilterBar>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left md:min-w-[980px]">
          <caption className="sr-only">All entries on {board.name}</caption>
          <thead className="rule-double">
            <tr>
              <SortHead sort={sort} onSort={setSort} k="key" className="w-[84px] pl-4 md:w-[92px] md:pl-8">Key</SortHead>
              <SortHead sort={sort} onSort={setSort} k="title" className="pr-4 md:pr-0">Entry</SortHead>
              <SortHead sort={sort} onSort={setSort} k="status" className="hidden w-[140px] md:table-cell">Status</SortHead>
              <SortHead sort={sort} onSort={setSort} k="priority" className="hidden w-[86px] md:table-cell">Priority</SortHead>
              <SortHead sort={sort} onSort={setSort} k="points" className="hidden w-[76px] md:table-cell">Pts</SortHead>
              <SortHead sort={sort} onSort={setSort} k="due" className="hidden w-[92px] md:table-cell">Due</SortHead>
              <SortHead sort={sort} onSort={setSort} k="assignee" className="hidden w-[64px] md:table-cell">Who</SortHead>
              <SortHead sort={sort} onSort={setSort} k="sprint" className="hidden w-[110px] md:table-cell">Sprint</SortHead>
              <SortHead sort={sort} onSort={setSort} k="updated" className="hidden w-[100px] pr-4 md:table-cell md:pr-8">Updated</SortHead>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const column = board.columns.find((c) => c.id === t.column_id);
              const epic = t.epic_id ? board.tasks.find((e) => e.id === t.epic_id) : undefined;
              const done = Boolean(t.completed_at);
              return (
                <tr
                  key={t.id}
                  onClick={() => router.push(href(t.id), { scroll: false })}
                  className="cursor-pointer border-b border-rule hover:bg-page-sunk"
                >
                  <td className="py-1.5 pl-4 align-top md:pl-8 md:align-middle">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <TypeGlyph type={t.type} />
                      <span className={`font-mono text-[12px] ${done ? "struck" : "text-pencil"}`}>{taskKey(board.key, t.number)}</span>
                    </span>
                  </td>
                  <td className="max-w-0 py-1.5 pr-4 pl-3 md:max-w-none md:pr-0">
                    <span className="flex min-w-0 items-center gap-2">
                      {/* The tick slot is always there, so titles line up with or without an epic. */}
                      <span
                        className="h-4 w-[3px] shrink-0"
                        style={epic ? { background: epicInk(epic.number) } : undefined}
                        title={epic ? `Epic: ${epic.title}` : undefined}
                      />
                      {t.milestone && <Flag size={13} strokeWidth={2} className="shrink-0" aria-label="Milestone" />}
                      <span className={`truncate text-[15px] ${done ? "text-pencil" : ""}`}>{t.title}</span>
                    </span>
                    {/* Phone: the columns that don't fit become a meta line. */}
                    <span className="mt-0.5 flex items-center gap-2 text-[12px] text-pencil md:hidden">
                      {column && <StatusMark category={column.category} />}
                      <span className="truncate">{column?.name}</span>
                      <span className="ml-auto flex shrink-0 items-center">
                        <TilePoints task={t} interactive />
                        <TileDue task={t} interactive />
                        <TileAssignee task={t} interactive />
                      </span>
                    </span>
                  </td>
                  <td className="hidden py-1.5 pl-3 text-[13px] md:table-cell">
                    <span className="flex items-center gap-2">
                      {column && <StatusMark category={column.category} />}
                      {column?.name}
                    </span>
                  </td>
                  <td className="hidden py-1.5 pl-3 text-[13px] capitalize md:table-cell">
                    <span className="flex items-center gap-1">
                      <PriorityMark priority={t.priority} />
                      <span className={t.priority === "medium" ? "text-pencil" : ""}>{t.priority}</span>
                    </span>
                  </td>
                  <td className="hidden py-1.5 pl-2 md:table-cell">
                    <TilePoints task={t} interactive />
                  </td>
                  <td className="hidden py-1.5 pl-2 md:table-cell">
                    <TileDue task={t} interactive />
                  </td>
                  <td className="hidden py-1.5 pl-2 md:table-cell">
                    <TileAssignee task={t} interactive />
                  </td>
                  <td className="hidden py-1.5 pl-3 text-[13px] text-pencil md:table-cell">{sprint(t.sprint_id)?.name ?? "Backlog"}</td>
                  <td className="font-mono hidden py-1.5 pr-4 pl-3 text-[12px] text-pencil md:table-cell md:pr-8">{shortDate(t.updated_at.slice(0, 10))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-6 text-[15px] text-pencil md:px-8">No entries match. Clear the filters, or press c on the Board to create one.</p>}
      </div>
      <div className="ruled-fill flex-1" aria-hidden />
    </>
  );
}

type Sort = { key: SortKey; dir: 1 | -1 };

function SortHead({
  k,
  sort,
  onSort,
  children,
  className = "",
}: {
  k: SortKey;
  sort: Sort;
  onSort: (s: Sort) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const on = sort.key === k;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`py-2 pl-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort({ key: k, dir: on ? (sort.dir === 1 ? -1 : 1) : 1 })}
        className={`stamp inline-flex items-center gap-1 text-[11px] hover:text-ink ${on ? "text-ink" : "text-pencil"}`}
      >
        {children}
        {on && (sort.dir === 1 ? <ArrowUp size={11} strokeWidth={2} aria-hidden /> : <ArrowDown size={11} strokeWidth={2} aria-hidden />)}
      </button>
    </th>
  );
}
