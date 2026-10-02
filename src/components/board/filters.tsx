"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { X } from "lucide-react";
import type { BoardTask } from "@/lib/queries";
import { taskKey } from "@/lib/format";
import { useBoard } from "./board-context";

const KEYS = ["q", "who", "label", "type", "epic"] as const;
type FilterKey = (typeof KEYS)[number];

/** Filters live in the URL so a filtered view survives reloads and can be shared. */
export function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<FilterKey, string>;

  function set(key: FilterKey | "scope", value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function clear() {
    const next = new URLSearchParams(params);
    KEYS.forEach((k) => next.delete(k));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const active = KEYS.some((k) => values[k]);
  return { values, set, clear, active, scope: params.get("scope") };
}

export function useFilteredTasks(tasks: BoardTask[]) {
  const board = useBoard();
  const { values } = useFilters();
  return useMemo(() => {
    const q = values.q.trim().toLowerCase();
    const labelled = values.label
      ? new Set(board.taskLabels.filter((r) => r.label_id === values.label).map((r) => r.task_id))
      : null;
    return tasks.filter((t) => {
      if (q && !`${taskKey(board.key, t.number)} ${t.title}`.toLowerCase().includes(q)) return false;
      if (values.who === "me" && t.assignee_id !== board.viewerId) return false;
      if (values.who === "none" && t.assignee_id) return false;
      if (values.who && values.who !== "me" && values.who !== "none" && t.assignee_id !== values.who) return false;
      if (labelled && !labelled.has(t.id)) return false;
      if (values.type && t.type !== values.type) return false;
      if (values.epic && t.epic_id !== values.epic) return false;
      return true;
    });
  }, [tasks, values, board.taskLabels, board.key, board.viewerId]);
}

export function FilterBar({ children }: { children?: React.ReactNode }) {
  const board = useBoard();
  const { values, set, clear, active } = useFilters();
  const epics = board.tasks.filter((t) => t.type === "epic");

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-rule px-4 py-2.5 md:px-8">
      <div className="w-[180px]">
        <label htmlFor="filter-q" className="sr-only">
          Search entries
        </label>
        <input
          id="filter-q"
          type="search"
          placeholder="Find by key or title"
          defaultValue={values.q}
          onChange={(e) => set("q", e.target.value)}
          className="field min-h-8 text-[14px]"
        />
      </div>
      <button
        type="button"
        aria-pressed={values.who === "me"}
        onClick={() => set("who", values.who === "me" ? "" : "me")}
        className={`btn min-h-8 ${values.who === "me" ? "bg-ink text-page hover:bg-ink" : ""}`}
      >
        Only mine
      </button>
      <FilterSelect label="Assignee" value={values.who} onChange={(v) => set("who", v)}>
        <option value="">Anyone</option>
        <option value="none">Unassigned</option>
        {board.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id === board.viewerId ? `${m.name} (you)` : m.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Label" value={values.label} onChange={(v) => set("label", v)}>
        <option value="">Any label</option>
        {board.labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Type" value={values.type} onChange={(v) => set("type", v)}>
        <option value="">Any type</option>
        <option value="story">Story</option>
        <option value="task">Task</option>
        <option value="bug">Bug</option>
      </FilterSelect>
      {epics.length > 0 && (
        <FilterSelect label="Epic" value={values.epic} onChange={(v) => set("epic", v)}>
          <option value="">Any epic</option>
          {epics.map((e) => (
            <option key={e.id} value={e.id}>
              {taskKey(board.key, e.number)} {e.title}
            </option>
          ))}
        </FilterSelect>
      )}
      {active && (
        <button type="button" onClick={clear} className="btn btn-quiet min-h-8 px-2">
          <X size={14} strokeWidth={1.7} aria-hidden />
          Clear
        </button>
      )}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="w-[132px]">
      <label className="sr-only" htmlFor={`filter-${label}`}>
        {label}
      </label>
      <select
        id={`filter-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`field min-h-8 text-[14px] ${value ? "font-semibold" : "text-pencil"}`}
      >
        {children}
      </select>
    </div>
  );
}
