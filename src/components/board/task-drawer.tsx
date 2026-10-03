"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Flag, X } from "lucide-react";
import { PointsDot, StatusMark, TypeGlyph } from "@/components/marks";
import { epicInk, formatPoints, longDate, repeatPhrase, shortDate, taskKey, type RepeatUnit } from "@/lib/format";
import { addDays } from "@/lib/day-math";
import type { BoardTask } from "@/lib/queries";
import {
  archiveTask,
  createLabel,
  createTask,
  deleteTask,
  setSubtaskDone,
  setTaskColumn,
  setTaskLabel,
  updateTask,
  type TaskPatch,
} from "@/app/(app)/b/[boardId]/actions";
import { useBoard } from "./board-context";
import { AssigneeStamp, LABEL_INKS, LabelTag, POINT_STEPS, PRIORITIES, labelInk, useTaskHref } from "./bits";
import { DrawerAttachments, DrawerConversation, useTaskFeed } from "./drawer-feed";
import { DrawerExperiment } from "./drawer-experiment";

const TYPE_LABEL = { epic: "Epic", story: "Story", task: "Task", bug: "Bug", subtask: "Subtask" } as const;

/** The entry's own page, laid over the board from the right. Opened by ?task=<id>. */
export function TaskDrawer() {
  const board = useBoard();
  const params = useSearchParams();
  const router = useRouter();
  const href = useTaskHref();
  const id = params.get("task");
  const task = id ? board.tasks.find((t) => t.id === id) : undefined;
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!id) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !(e.target as HTMLElement)?.closest("input, textarea, select")) {
        router.replace(href(null), { scroll: false });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, href, router]);

  useEffect(() => {
    if (id) panelRef.current?.focus();
  }, [id]);

  if (!id) return null;

  return (
    <>
      {/* The board dims behind the entry; clicking anywhere on it closes the entry. */}
      <div
        aria-hidden
        onClick={() => router.replace(href(null), { scroll: false })}
        className="fixed inset-0 z-30 bg-[var(--scrim)] animate-[scrim-in_160ms_cubic-bezier(0.16,1,0.3,1)]"
      />
    <aside
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-title"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[600px] flex-col border-l-2 border-ink bg-page outline-none animate-[drawer-in_200ms_cubic-bezier(0.16,1,0.3,1)]"
    >
      {task ? (
        <EntryPage key={task.id} task={task} />
      ) : (
        <div className="p-6">
          <p className="text-[15px]">This entry was archived or deleted.</p>
          <Link href={href(null)} scroll={false} className="btn mt-4">
            Close
          </Link>
        </div>
      )}
    </aside>
    </>
  );
}

function EntryPage({ task }: { task: BoardTask }) {
  const board = useBoard();
  const href = useTaskHref();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const key = taskKey(board.key, task.number);
  const column = board.columns.find((c) => c.id === task.column_id);
  const parent = task.parent_id ? board.tasks.find((t) => t.id === task.parent_id) : undefined;
  const epics = board.tasks.filter((t) => t.type === "epic" && t.id !== task.id);
  const subtasks = board.tasks.filter((t) => t.parent_id === task.id);
  const epicEntries = task.type === "epic" ? board.tasks.filter((t) => t.epic_id === task.id) : [];
  const reporter = board.members.find((m) => m.id === task.reporter_id);
  const temp = task.id.startsWith("temp-");
  const { feed, reload } = useTaskFeed(task.id);

  function save(patch: TaskPatch) {
    if (temp) return;
    void board.run({ type: "patch", id: task.id, patch }, () => updateTask(board.id, task.id, patch));
  }

  function setStatus(columnId: string) {
    const done = board.columns.find((c) => c.id === columnId)?.category === "done";
    void board.run(
      { type: "patch", id: task.id, patch: { column_id: columnId, completed_at: done ? (task.completed_at ?? new Date().toISOString()) : null } },
      () => setTaskColumn(board.id, task.id, columnId),
    );
  }

  return (
    <>
      <header className="rule-double flex items-center gap-3 bg-page-sunk px-5 py-3 md:h-[79px]">
        <TypeGlyph type={task.type} />
        <label htmlFor="entry-type" className="sr-only">
          Type
        </label>
        <select
          id="entry-type"
          value={task.type}
          disabled={task.type === "subtask" || temp}
          onChange={(e) => save({ type: e.target.value as BoardTask["type"] })}
          className="field stamp min-h-8 w-[110px] border-transparent text-[13px]"
        >
          {(task.type === "subtask" ? ["subtask"] : ["story", "task", "bug", "epic"]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t as keyof typeof TYPE_LABEL]}
            </option>
          ))}
        </select>
        <span className={`font-mono text-[14px] ${task.completed_at ? "struck" : ""}`}>{key}</span>
        <Link href={href(null)} scroll={false} className="btn btn-quiet ml-auto px-2" aria-label="Close entry">
          <X size={16} strokeWidth={1.7} aria-hidden />
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 pt-4">
          {parent && (
            <Link href={href(parent.id)} scroll={false} className="mb-1 block text-[13px] text-pencil hover:text-ink hover:underline">
              Subtask of {taskKey(board.key, parent.number)} {parent.title}
            </Link>
          )}
          <label htmlFor="entry-title" className="sr-only">
            Title
          </label>
          <textarea
            id="entry-title"
            defaultValue={task.title}
            rows={1}
            maxLength={500}
            onBlur={(e) => e.target.value.trim() !== task.title && save({ title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="w-full resize-none bg-transparent text-[22px] leading-snug font-semibold [field-sizing:content] focus:bg-page-sunk focus:outline-none focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        <dl className="mt-3 border-t border-rule">
          <Row label="Status">
            <div className="flex items-center gap-2">
              {column && <StatusMark category={column.category} />}
              <select aria-label="Status" value={task.column_id} onChange={(e) => setStatus(e.target.value)} className="field min-h-9 text-[14px]">
                {board.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </Row>
          <Row label="Assignee">
            <select
              aria-label="Assignee"
              value={task.assignee_id ?? ""}
              onChange={(e) => save({ assignee_id: e.target.value || null })}
              className="field min-h-9 text-[14px]"
            >
              <option value="">Unassigned</option>
              {board.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === board.viewerId ? `${m.name} (you)` : m.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Priority">
            <select
              aria-label="Priority"
              value={task.priority}
              onChange={(e) => save({ priority: e.target.value as BoardTask["priority"] })}
              className={`field min-h-9 text-[14px] capitalize ${task.priority === "highest" ? "text-attention" : ""}`}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Row>
          {task.type !== "epic" && (
            <Row label="Story points">
              <div className="flex items-center gap-3">
                <select
                  aria-label="Story points"
                  value={task.story_points ?? ""}
                  onChange={(e) => save({ story_points: e.target.value === "" ? null : Number(e.target.value) })}
                  className="field font-mono min-h-9 text-[14px]"
                >
                  <option value="">No estimate</option>
                  {POINT_STEPS.map((p) => (
                    <option key={p} value={p}>
                      {formatPoints(p)}
                    </option>
                  ))}
                </select>
                {task.story_points != null && <PointsDot points={task.story_points} />}
              </div>
            </Row>
          )}
          {task.type !== "epic" && task.type !== "subtask" && (
            <Row label="Sprint">
              <select
                aria-label="Sprint"
                value={task.sprint_id ?? ""}
                onChange={(e) => save({ sprint_id: e.target.value || null })}
                className="field min-h-9 text-[14px]"
              >
                <option value="">Backlog</option>
                {board.sprints
                  .filter((s) => s.status !== "completed" || s.id === task.sprint_id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.status === "active" ? " (active)" : s.status === "completed" ? " (completed)" : ""}
                    </option>
                  ))}
              </select>
            </Row>
          )}
          {(task.type === "story" || task.type === "task" || task.type === "bug") && (
            <Row label="Epic">
              <div className="flex items-center gap-2">
                {task.epic_id && (
                  <span
                    className="h-4 w-[3px] shrink-0"
                    style={{ background: epicInk(epics.find((e) => e.id === task.epic_id)?.number ?? 0) }}
                    aria-hidden
                  />
                )}
                <select
                  aria-label="Epic"
                  value={task.epic_id ?? ""}
                  onChange={(e) => save({ epic_id: e.target.value || null })}
                  className="field min-h-9 text-[14px]"
                >
                  <option value="">No epic</option>
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>
                      {taskKey(board.key, e.number)} {e.title}
                    </option>
                  ))}
                </select>
              </div>
            </Row>
          )}
          <Row label="Start">
            <DateField label="Start date" value={task.start_date} onChange={(v) => save({ start_date: v })} />
          </Row>
          <Row label="Due">
            <DateField
              label="Due date"
              value={task.due_date}
              late={Boolean(task.due_date && !task.completed_at && task.due_date < board.today)}
              onChange={(v) => save({ due_date: v })}
            />
          </Row>
          {(task.type === "story" || task.type === "task" || task.type === "bug") && (
            <Row label="Repeat">
              <RepeatField task={task} save={save} />
            </Row>
          )}
          <Row label="Labels">
            <LabelPicker task={task} />
          </Row>
          <Row label="Milestone">
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={task.milestone}
                onChange={(e) => save({ milestone: e.target.checked })}
                className="check"
              />
              <Flag size={14} strokeWidth={1.8} aria-hidden className={task.milestone ? "text-ink" : "text-pencil"} />
              <span className={task.milestone ? "" : "text-pencil"}>
                {task.milestone ? "A milestone: shown on the calendar and in My Work" : "Mark as a milestone (deadline, submission, grant)"}
              </span>
            </label>
          </Row>
        </dl>

        <section className="px-5 pt-5">
          <h3 className="field-label">Notes</h3>
          <label htmlFor="entry-notes" className="sr-only">
            Notes
          </label>
          <textarea
            id="entry-notes"
            defaultValue={task.description ?? ""}
            placeholder="Context, protocol, results, links. DOIs and URLs become references below."
            onBlur={(e) => (e.target.value.trim() || null) !== (task.description ?? null) && save({ description: e.target.value })}
            className="ruled-fill min-h-[164px] w-full resize-y bg-transparent py-[9px] text-[15px] leading-[41px] [field-sizing:content] placeholder:text-pencil focus:outline-none focus-visible:outline-2 focus-visible:outline-ink"
          />
          <References text={task.description ?? ""} />
        </section>

        {task.type !== "epic" && <DrawerExperiment task={task} />}
        <DrawerAttachments task={task} files={feed?.attachments ?? null} reload={reload} />

        {task.type === "epic" ? (
          <EpicChildren epic={task} entries={epicEntries} />
        ) : task.type !== "subtask" ? (
          <Subtasks task={task} subtasks={subtasks} />
        ) : null}

        <DrawerConversation task={task} feed={feed} reload={reload} />

        <footer className="mt-6 border-t border-rule px-5 py-4 text-[12px] text-pencil">
          <p>
            Written {longDate(task.created_at.slice(0, 10))}
            {reporter && ` by ${reporter.name}`} · updated {longDate(task.updated_at.slice(0, 10))}
            {task.completed_at && ` · finished ${longDate(task.completed_at.slice(0, 10))}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn min-h-8"
              disabled={temp}
              onClick={async () => {
                const result = await board.run({ type: "remove", id: task.id }, () => archiveTask(board.id, task.id));
                if (!result?.error) router.replace(href(null), { scroll: false });
              }}
            >
              Archive
            </button>
            {confirmDelete ? (
              <button
                type="button"
                className="btn btn-danger min-h-8"
                onClick={async () => {
                  const result = await board.run({ type: "remove", id: task.id }, () => deleteTask(board.id, task.id));
                  if (!result?.error) router.replace(href(null), { scroll: false });
                }}
              >
                Delete for good{subtasks.length > 0 ? ` (and ${subtasks.length} subtasks)` : ""}
              </button>
            ) : (
              <button type="button" className="btn btn-quiet min-h-8" disabled={temp} onClick={() => setConfirmDelete(true)}>
                Delete…
              </button>
            )}
          </div>
        </footer>
      </div>
    </>
  );
}

/** A date written on the line; an empty one reads as a pencil dash until it's focused. */
function DateField({ label, value, late = false, onChange }: { label: string; value: string | null; late?: boolean; onChange: (v: string | null) => void }) {
  const [current, setCurrent] = useState(value ?? "");
  return (
    <span className="group relative block">
      <input
        type="date"
        aria-label={label}
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          onChange(e.target.value || null);
        }}
        className={`field font-mono min-h-9 text-[13px] ${late ? "font-semibold text-attention" : ""} ${
          current ? "" : "text-transparent focus:text-ink"
        }`}
      />
      {!current && (
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-1 -translate-y-1/2 text-pencil group-focus-within:hidden">
          —
        </span>
      )}
    </span>
  );
}

const REPEAT_PRESETS: { every: number; unit: RepeatUnit }[] = [
  { every: 1, unit: "day" },
  { every: 1, unit: "week" },
  { every: 2, unit: "week" },
  { every: 1, unit: "month" },
  { every: 1, unit: "year" },
];

/** The due date the next occurrence would get if this one were finished today (mirrors private.spawn_next_occurrence). */
function nextDue(due: string | null, today: string, every: number, unit: RepeatUnit) {
  const step = (iso: string) => {
    if (unit === "day" || unit === "week") return addDays(iso, unit === "week" ? 7 * every : every);
    const [y, m, d] = iso.split("-").map(Number);
    const months = m - 1 + (unit === "year" ? 12 * every : every);
    const last = new Date(Date.UTC(y + Math.floor(months / 12), (months % 12) + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y + Math.floor(months / 12), months % 12, Math.min(d, last))).toISOString().slice(0, 10);
  };
  let next = due ?? today;
  do next = step(next);
  while (next <= today);
  return next;
}

function RepeatField({ task, save }: { task: BoardTask; save: (patch: TaskPatch) => void }) {
  const board = useBoard();
  const href = useTaskHref();
  const every = task.repeat_every;
  const unit = task.repeat_unit as RepeatUnit | null;
  const preset = REPEAT_PRESETS.findIndex((p) => p.every === every && p.unit === unit);
  const [custom, setCustom] = useState(every != null && preset < 0);
  const next = task.next_occurrence_id ? board.tasks.find((t) => t.id === task.next_occurrence_id) : undefined;

  return (
    <div className="py-1">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Repeat"
          value={custom ? "custom" : every == null ? "" : String(preset)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom") return setCustom(true);
            setCustom(false);
            const p = v === "" ? null : REPEAT_PRESETS[Number(v)];
            save({ repeat_every: p?.every ?? null, repeat_unit: p?.unit ?? null });
          }}
          className="field min-h-9 w-auto text-[14px]"
        >
          <option value="">Doesn&apos;t repeat</option>
          {REPEAT_PRESETS.map((p, i) => (
            <option key={i} value={i}>
              {repeatPhrase(p.every, p.unit).replace(/^./, (c) => c.toUpperCase())}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {custom && (
          <span className="flex items-center gap-2 text-[14px]">
            every
            <input
              type="number"
              aria-label="Repeat interval"
              min={1}
              max={365}
              defaultValue={every ?? 3}
              onBlur={(e) => {
                const n = Math.min(365, Math.max(1, Math.round(Number(e.target.value) || 1)));
                save({ repeat_every: n, repeat_unit: unit ?? "day" });
              }}
              className="field font-mono min-h-9 w-[64px] text-[14px]"
            />
            <select
              aria-label="Repeat unit"
              value={unit ?? "day"}
              onChange={(e) => save({ repeat_every: every ?? 3, repeat_unit: e.target.value as RepeatUnit })}
              className="field min-h-9 w-auto text-[14px]"
            >
              {(["day", "week", "month", "year"] as const).map((u) => (
                <option key={u} value={u}>
                  {u}s
                </option>
              ))}
            </select>
          </span>
        )}
      </div>
      {every != null && unit && (
        <p className="mt-1 text-[12px] leading-snug text-pencil">
          {next ? (
            <>
              Next occurrence:{" "}
              <Link href={href(next.id)} scroll={false} className="font-mono text-ink underline decoration-rule-mid underline-offset-4 hover:decoration-ink">
                {taskKey(board.key, next.number)}
              </Link>
              {next.due_date && <> due {shortDate(next.due_date)}</>}
            </>
          ) : (
            <>Finishing it adds the next one to To Do, due {shortDate(nextDue(task.due_date, board.today, every, unit))}.</>
          )}
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[41px] grid-cols-[112px_minmax(0,1fr)] items-center gap-3 border-b border-rule px-5">
      <dt className="stamp text-[11px] text-pencil">{label}</dt>
      <dd className="min-w-0 py-0.5">{children}</dd>
    </div>
  );
}

function LabelPicker({ task }: { task: BoardTask }) {
  const board = useBoard();
  const [adding, setAdding] = useState(false);
  const [ink, setInk] = useState<string>(LABEL_INKS[0]);
  const on = new Set(board.taskLabels.filter((r) => r.task_id === task.id).map((r) => r.label_id));
  const applied = board.labels.filter((l) => on.has(l.id));
  const available = board.labels.filter((l) => !on.has(l.id));

  function toggle(labelId: string, next: boolean) {
    board.runLabel({ taskId: task.id, labelId, on: next }, () => setTaskLabel(board.id, task.id, labelId, next));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1.5">
      {applied.map((l) => (
        <LabelTag key={l.id} name={l.name} color={l.color} onRemove={() => toggle(l.id, false)} />
      ))}
      {available.length > 0 && (
        <select
          aria-label="Add a label"
          value=""
          onChange={(e) => e.target.value && toggle(e.target.value, true)}
          className="field min-h-7 w-auto border-transparent pr-6 text-[13px] text-pencil"
        >
          <option value="">+ Label</option>
          {available.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      {adding ? (
        <form
          className="flex w-full items-center gap-2 pt-1"
          onSubmit={async (e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("label") ?? "");
            const result = await board.run(null, () => createLabel(board.id, name, ink));
            if (result?.id) {
              toggle(result.id, true);
              setAdding(false);
            }
          }}
        >
          <input name="label" aria-label="New label name" required maxLength={40} autoFocus placeholder="new label" className="field min-h-8 flex-1 text-[13px]" />
          <div role="radiogroup" aria-label="Label ink" className="flex gap-1">
            {LABEL_INKS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={ink === c}
                aria-label={`Ink ${c.slice(4)}`}
                onClick={() => setInk(c)}
                className={`size-5 border ${ink === c ? "border-ink outline-2 outline-ink" : "border-transparent"}`}
                style={{ background: labelInk(c) }}
              />
            ))}
          </div>
          <button type="submit" className="btn min-h-8">
            Add
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-[13px] text-pencil hover:text-ink hover:underline">
          New label
        </button>
      )}
    </div>
  );
}

const DOI = /\b(10\.\d{4,9}\/[^\s"<>]+[^\s"<>.,;)])/gi;
const URL_RE = /\bhttps?:\/\/[^\s<>"]+[^\s<>".,;)]/gi;

/** Research references found in the notes: DOIs resolve through doi.org. */
function References({ text }: { text: string }) {
  const urls = [...new Set(text.match(URL_RE) ?? [])];
  const dois = [...new Set(text.replace(URL_RE, "").match(DOI) ?? [])];
  if (urls.length + dois.length === 0) return null;
  return (
    <div className="mt-2">
      <h3 className="field-label">References</h3>
      <ul className="space-y-1 text-[14px]">
        {dois.map((d) => (
          <li key={d}>
            <a href={`https://doi.org/${d}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
              <span className="font-mono text-[13px]">doi:{d}</span>
              <ExternalLink size={12} strokeWidth={1.7} aria-hidden />
            </a>
          </li>
        ))}
        {urls.map((u) => (
          <li key={u} className="truncate">
            <a href={u} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 hover:underline">
              <span className="truncate">{u.replace(/^https?:\/\//, "")}</span>
              <ExternalLink size={12} strokeWidth={1.7} className="shrink-0" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Subtasks({ task, subtasks }: { task: BoardTask; subtasks: BoardTask[] }) {
  const board = useBoard();
  const href = useTaskHref();
  const ref = useRef<HTMLInputElement>(null);
  const done = subtasks.filter((s) => s.completed_at).length;

  return (
    <section className="px-5 pt-6">
      <h3 className="field-label">
        Subtasks <span className="font-mono">{subtasks.length > 0 && `${done}/${subtasks.length}`}</span>
      </h3>
      <ul className="border-t border-rule">
        {subtasks.map((s) => {
          const isDone = Boolean(s.completed_at);
          const assignee = board.members.find((m) => m.id === s.assignee_id);
          return (
            <li key={s.id} className="flex min-h-[41px] items-center gap-3 border-b border-rule">
              <input
                type="checkbox"
                checked={isDone}
                aria-label={`Mark ${s.title} ${isDone ? "not done" : "done"}`}
                onChange={() => {
                  const target = board.columns.find((c) => c.category === (isDone ? "todo" : "done"));
                  void board.run(
                    { type: "patch", id: s.id, patch: { completed_at: isDone ? null : new Date().toISOString(), column_id: target?.id ?? s.column_id } },
                    () => setSubtaskDone(board.id, s.id, !isDone),
                  );
                }}
                className="check"
              />
              <span className={`font-mono text-[12px] ${isDone ? "struck" : "text-pencil"}`}>{taskKey(board.key, s.number)}</span>
              <Link href={href(s.id)} scroll={false} className={`min-w-0 flex-1 truncate text-[14px] hover:underline ${isDone ? "text-pencil" : ""}`}>
                {s.title}
              </Link>
              {assignee && <AssigneeStamp name={assignee.name} size="sm" />}
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const title = ref.current?.value.trim();
          if (!title) return;
          if (ref.current) ref.current.value = "";
          void board.run(null, () =>
            createTask(board.id, { title, type: "subtask", parentId: task.id, sprintId: task.sprint_id, assigneeId: task.assignee_id }),
          );
        }}
      >
        <label htmlFor="new-subtask" className="sr-only">
          Add a subtask
        </label>
        <input ref={ref} id="new-subtask" maxLength={500} autoComplete="off" placeholder="+ Add subtask" className="field min-h-9 border-rule-mid text-[14px]" />
      </form>
    </section>
  );
}

function EpicChildren({ epic, entries }: { epic: BoardTask; entries: BoardTask[] }) {
  const board = useBoard();
  const href = useTaskHref();
  const total = entries.reduce((s, t) => s + (t.story_points ?? 0), 0);
  const donePts = entries.filter((t) => t.completed_at).reduce((s, t) => s + (t.story_points ?? 0), 0);

  return (
    <section className="px-5 pt-6">
      <h3 className="field-label">
        In this epic{" "}
        <span className="font-mono">
          {entries.filter((t) => t.completed_at).length}/{entries.length} · {formatPoints(donePts)}/{formatPoints(total)} pts
        </span>
      </h3>
      <ul className="border-t border-rule">
        {entries.map((t) => {
          const column = board.columns.find((c) => c.id === t.column_id);
          return (
            <li key={t.id} className="flex min-h-[41px] items-center gap-3 border-b border-rule">
              <span className="h-4 w-[3px] shrink-0" style={{ background: epicInk(epic.number) }} aria-hidden />
              <TypeGlyph type={t.type} />
              <span className={`font-mono text-[12px] ${t.completed_at ? "struck" : "text-pencil"}`}>{taskKey(board.key, t.number)}</span>
              <Link href={href(t.id)} scroll={false} className={`min-w-0 flex-1 truncate text-[14px] hover:underline ${t.completed_at ? "text-pencil" : ""}`}>
                {t.title}
              </Link>
              {column && <StatusMark category={column.category} />}
            </li>
          );
        })}
        {entries.length === 0 && <li className="py-3 text-[14px] text-pencil">Link stories, tasks or bugs to this epic from their Epic field.</li>}
      </ul>
    </section>
  );
}
