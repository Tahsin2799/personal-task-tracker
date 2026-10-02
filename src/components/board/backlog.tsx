"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, Plus } from "lucide-react";
import { PointsDot, StatusMark, TypeGlyph } from "@/components/marks";
import { epicInk, formatPoints, shortDate, taskKey } from "@/lib/format";
import { addDays, daysUntil } from "@/lib/day-math";
import type { BoardSprint, BoardTask } from "@/lib/queries";
import {
  completeSprint,
  createSprint,
  createTask,
  deleteSprint,
  startSprint,
  updateSprint,
  updateTask,
} from "@/app/(app)/b/[boardId]/actions";
import { useBoard } from "./board-context";
import { AssigneeStamp, labelInk, useTaskHref } from "./bits";
import { FilterBar, useFilteredTasks } from "./filters";

const BACKLOG = "backlog";

function points(tasks: BoardTask[]) {
  return tasks.reduce((sum, t) => sum + (t.story_points ?? 0), 0);
}

/** Average finished points over the last three completed sprints. */
export function useVelocity() {
  const board = useBoard();
  return useMemo(() => {
    const completed = board.sprints.filter((s) => s.status === "completed").slice(-3);
    if (completed.length === 0) return null;
    const total = completed.reduce(
      (sum, s) => sum + points(board.tasks.filter((t) => t.sprint_id === s.id && t.completed_at && t.type !== "subtask")),
      0,
    );
    return total / completed.length;
  }, [board.sprints, board.tasks]);
}

export function Backlog() {
  const board = useBoard();
  const work = useMemo(() => board.tasks.filter((t) => t.type !== "epic" && t.type !== "subtask"), [board.tasks]);
  const visible = useFilteredTasks(work);
  const [dragging, setDragging] = useState<BoardTask | null>(null);
  const velocity = useVelocity();

  const dndId = useId(); // stable ids so dnd-kit's a11y attributes hydrate
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const active = board.sprints.find((s) => s.status === "active");
  const planned = board.sprints.filter((s) => s.status === "planned");

  function moveTo(task: BoardTask, sprintId: string | null) {
    if (task.sprint_id === sprintId) return;
    void board.run({ type: "patch", id: task.id, patch: { sprint_id: sprintId } }, () =>
      updateTask(board.id, task.id, { sprint_id: sprintId }),
    );
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    setDragging(null);
    if (!over) return;
    const task = board.tasks.find((t) => t.id === a.id);
    if (task) moveTo(task, over.id === BACKLOG ? null : String(over.id));
  }

  const rank = (list: BoardTask[]) =>
    [...list].sort((a, b) => {
      const order = ["highest", "high", "medium", "low", "lowest"];
      return order.indexOf(a.priority) - order.indexOf(b.priority) || a.number - b.number;
    });

  return (
    <>
      <FilterBar>
        <button type="button" className="btn min-h-8" onClick={() => void board.run(null, () => createSprint(board.id))}>
          <Plus size={14} strokeWidth={1.8} aria-hidden />
          New sprint
        </button>
      </FilterBar>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active: a }) => setDragging(board.tasks.find((t) => t.id === a.id) ?? null)}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div aria-hidden className="rule-double stamp hidden items-center gap-3 pr-8 pl-5 pt-3 pb-1.5 text-[11px] text-pencil md:flex">
          <span className="w-[22px]" />
          <span className="w-[3px]" />
          <span className="w-[15px]" />
          <span className="w-[52px]">Key</span>
          <span className="flex-1">Entry</span>
          <span className="w-[120px]">Status</span>
          <span className="w-7">Who</span>
          <span className="w-[52px]">Pts</span>
          <span className="w-[120px]">Sprint</span>
        </div>
        {active && (
          <SprintSection sprint={active} tasks={rank(visible.filter((t) => t.sprint_id === active.id))} all={work.filter((t) => t.sprint_id === active.id)} onMove={moveTo} />
        )}
        {planned.map((s) => (
          <SprintSection
            key={s.id}
            sprint={s}
            tasks={rank(visible.filter((t) => t.sprint_id === s.id))}
            all={work.filter((t) => t.sprint_id === s.id)}
            onMove={moveTo}
            velocity={velocity}
            canStart={!active}
          />
        ))}
        <Section
          id={BACKLOG}
          title="Backlog"
          meta={
            <span className="font-mono text-[12px] text-pencil">
              {visible.filter((t) => !t.sprint_id && !t.completed_at).length} open · {formatPoints(points(visible.filter((t) => !t.sprint_id && !t.completed_at)))} pts
            </span>
          }
        >
          <Rows tasks={rank(visible.filter((t) => !t.sprint_id && !t.completed_at))} onMove={moveTo} empty="Nothing waiting. New entries without a sprint land here." />
          <BacklogAdd />
        </Section>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="-rotate-1 border border-ink bg-page px-4 py-2 text-[14px]">
              <span className="font-mono mr-2 text-[12px] text-pencil">{taskKey(board.key, dragging.number)}</span>
              {dragging.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <div className="ruled-fill min-h-20 flex-1" aria-hidden />
    </>
  );
}

function Section({ id, title, meta, actions, children }: { id: string; title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={typeof title === "string" ? title : undefined} className={`border-b border-rule-strong ${isOver ? "bg-page-sunk" : ""}`}>
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 bg-page-sunk px-4 pt-3 pb-2 md:px-8">
        <h2 className="stamp text-[15px]">{title}</h2>
        {meta}
        {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

function SprintSection({
  sprint,
  tasks,
  all,
  onMove,
  velocity,
  canStart,
}: {
  sprint: BoardSprint;
  tasks: BoardTask[];
  all: BoardTask[];
  onMove: (t: BoardTask, sprintId: string | null) => void;
  velocity?: number | null;
  canStart?: boolean;
}) {
  const board = useBoard();
  const [mode, setMode] = useState<"idle" | "start" | "complete" | "rename">("idle");
  const total = points(all);
  const finished = points(all.filter((t) => t.completed_at));
  const isActive = sprint.status === "active";
  const left = isActive && sprint.end_date ? daysUntil(board.today, sprint.end_date) : null;
  const over = velocity != null && total > velocity * 1.15;

  return (
    <Section
      id={sprint.id}
      title={
        mode === "rename" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "");
              void board.run(null, () => updateSprint(board.id, sprint.id, { name })).then(() => setMode("idle"));
            }}
          >
            <input name="name" aria-label="Sprint name" defaultValue={sprint.name} autoFocus onBlur={(e) => e.currentTarget.form?.requestSubmit()} className="field min-h-8 w-48" />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setMode("rename")}
            className="font-sans text-[16px] font-semibold tracking-normal hover:underline"
            title="Rename sprint"
          >
            {sprint.name}
          </button>
        )
      }
      meta={
        <span className="font-mono flex flex-wrap gap-x-3 text-[12px] text-pencil">
          {isActive && <span className="stamp text-[11px] text-ink">Active</span>}
          {sprint.start_date && sprint.end_date && (
            <span>
              {shortDate(sprint.start_date)} → {shortDate(sprint.end_date)}
              {left != null && (left >= 0 ? ` · ${left}d left` : <span className="text-attention"> · {-left}d over</span>)}
            </span>
          )}
          <span>
            {all.length} entries · {isActive ? `${formatPoints(finished)}/` : ""}
            {formatPoints(total)} pts
          </span>
          {sprint.committed_points != null && <span>committed {formatPoints(sprint.committed_points)}</span>}
          {!isActive && velocity != null && (
            <span className={over ? "font-semibold text-attention" : ""}>
              avg velocity {formatPoints(Math.round(velocity * 10) / 10)}
              {over && " · over capacity"}
            </span>
          )}
        </span>
      }
      actions={
        mode === "idle" &&
        (isActive ? (
          <button type="button" className="btn min-h-8" onClick={() => setMode("complete")}>
            Complete sprint
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-quiet min-h-8"
              onClick={() => void board.run(null, () => deleteSprint(board.id, sprint.id))}
              title="Delete this planned sprint; its entries return to the backlog"
            >
              Delete
            </button>
            {!canStart && (
              <span className="order-last w-full text-right text-[13px] text-pencil md:order-none md:w-auto">
                Complete the active sprint first
              </span>
            )}
            <button type="button" className="btn btn-primary min-h-8" disabled={!canStart} onClick={() => setMode("start")}>
              Start sprint
            </button>
          </>
        ))
      }
    >
      {sprint.goal && <p className="border-t border-rule px-4 py-2 text-[14px] md:px-8">{sprint.goal}</p>}
      {mode === "start" && <StartForm sprint={sprint} onDone={() => setMode("idle")} />}
      {mode === "complete" && <CompleteForm sprint={sprint} unfinished={all.filter((t) => !t.completed_at).length} onDone={() => setMode("idle")} />}
      <Rows tasks={tasks} onMove={onMove} empty={isActive ? "No entries in this sprint." : "Drag entries here from the backlog, or set their Sprint field."} />
    </Section>
  );
}

function StartForm({ sprint, onDone }: { sprint: BoardSprint; onDone: () => void }) {
  const board = useBoard();
  return (
    <form
      className="flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-rule bg-page px-4 py-3 md:px-8"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const result = await board.run(null, () =>
          startSprint(board.id, sprint.id, String(f.get("starts")), String(f.get("ends")), String(f.get("goal") ?? "")),
        );
        if (!result?.error) onDone();
      }}
    >
      <div>
        <label className="field-label" htmlFor={`starts-${sprint.id}`}>
          Starts
        </label>
        <input id={`starts-${sprint.id}`} name="starts" type="date" required defaultValue={board.today} className="field font-mono min-h-9 text-[14px]" />
      </div>
      <div>
        <label className="field-label" htmlFor={`ends-${sprint.id}`}>
          Ends
        </label>
        <input id={`ends-${sprint.id}`} name="ends" type="date" required defaultValue={addDays(board.today, 13)} className="field font-mono min-h-9 text-[14px]" />
      </div>
      <div className="min-w-[220px] flex-1">
        <label className="field-label" htmlFor={`goal-${sprint.id}`}>
          Goal
        </label>
        <input id={`goal-${sprint.id}`} name="goal" defaultValue={sprint.goal ?? ""} placeholder="What this sprint is for" className="field min-h-9" />
      </div>
      <button type="submit" className="btn btn-primary">
        Start
      </button>
      <button type="button" onClick={onDone} className="btn btn-quiet">
        Cancel
      </button>
    </form>
  );
}

function CompleteForm({ sprint, unfinished, onDone }: { sprint: BoardSprint; unfinished: number; onDone: () => void }) {
  const board = useBoard();
  const planned = board.sprints.filter((s) => s.status === "planned");
  return (
    <form
      className="flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-rule bg-page px-4 py-3 md:px-8"
      onSubmit={async (e) => {
        e.preventDefault();
        const to = String(new FormData(e.currentTarget).get("carry") ?? "");
        const result = await board.run(null, () => completeSprint(board.id, sprint.id, to || null));
        if (!result?.error) onDone();
      }}
    >
      <p className="w-full text-[14px]">
        {unfinished === 0
          ? "Everything in this sprint is finished."
          : `${unfinished} unfinished entr${unfinished === 1 ? "y" : "ies"} will move on.`}
      </p>
      {unfinished > 0 && (
        <div className="min-w-[200px]">
          <label className="field-label" htmlFor={`carry-${sprint.id}`}>
            Move unfinished to
          </label>
          <select id={`carry-${sprint.id}`} name="carry" defaultValue={planned[0]?.id ?? ""} className="field min-h-9 text-[14px]">
            {planned.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="">Backlog</option>
          </select>
        </div>
      )}
      <button type="submit" className="btn btn-primary">
        Complete {sprint.name}
      </button>
      <button type="button" onClick={onDone} className="btn btn-quiet">
        Cancel
      </button>
    </form>
  );
}

function Rows({ tasks, onMove, empty }: { tasks: BoardTask[]; onMove: (t: BoardTask, sprintId: string | null) => void; empty: string }) {
  if (tasks.length === 0) return <p className="border-t border-rule px-4 py-3 text-[14px] text-pencil md:px-8">{empty}</p>;
  return (
    <ul>
      {tasks.map((t) => (
        <Row key={t.id} task={t} onMove={onMove} />
      ))}
    </ul>
  );
}

function Row({ task, onMove }: { task: BoardTask; onMove: (t: BoardTask, sprintId: string | null) => void }) {
  const board = useBoard();
  const href = useTaskHref();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: task.id });
  const epic = task.epic_id ? board.tasks.find((t) => t.id === task.epic_id) : undefined;
  const column = board.columns.find((c) => c.id === task.column_id);
  const assignee = board.members.find((m) => m.id === task.assignee_id);
  const labels = board.taskLabels.filter((r) => r.task_id === task.id).map((r) => board.labels.find((l) => l.id === r.label_id)).filter((l) => l !== undefined);
  const done = Boolean(task.completed_at);
  const open = board.sprints.filter((s) => s.status !== "completed");

  return (
    <li ref={setNodeRef} className={`flex min-h-[41px] items-center gap-3 border-t border-rule pr-4 pl-2 hover:bg-page-sunk md:pr-8 md:pl-5 ${isDragging ? "opacity-30" : ""}`}>
      <button type="button" {...attributes} {...listeners} className="cursor-grab p-1 text-pencil hover:text-ink" aria-label={`Move ${taskKey(board.key, task.number)} to another sprint`}>
        <GripVertical size={14} strokeWidth={1.6} aria-hidden />
      </button>
      <span className="flex h-4 w-[3px] shrink-0">{epic && <span className="block h-full w-full" style={{ background: epicInk(epic.number) }} title={`Epic: ${epic.title}`} />}</span>
      <TypeGlyph type={task.type} />
      <span className={`font-mono w-[52px] shrink-0 whitespace-nowrap text-[12px] ${done ? "struck" : "text-pencil"}`}>{taskKey(board.key, task.number)}</span>
      <Link href={href(task.id)} scroll={false} className={`min-w-0 flex-1 truncate text-[15px] hover:underline ${done ? "text-pencil" : ""}`}>
        {task.title}
      </Link>
      <span className="hidden gap-1 lg:flex">
        {labels.map((l) => (
          <span key={l.id} title={l.name} className="block size-2" style={{ background: labelInk(l.color) }} />
        ))}
      </span>
      {column && (
        <span className="hidden w-[120px] items-center gap-2 text-[13px] text-pencil md:flex">
          <StatusMark category={column.category} />
          <span className="truncate">{column.name}</span>
        </span>
      )}
      <span className="hidden w-7 sm:block">{assignee && <AssigneeStamp name={assignee.name} size="sm" />}</span>
      <span className="w-[52px]">
        <PointsDot points={task.story_points} />
      </span>
      <label className="sr-only" htmlFor={`sprint-${task.id}`}>
        Sprint for {taskKey(board.key, task.number)}
      </label>
      <select
        id={`sprint-${task.id}`}
        value={task.sprint_id ?? ""}
        onChange={(e) => onMove(task, e.target.value || null)}
        className="field hidden min-h-8 w-[120px] border-transparent text-[13px] text-pencil md:block"
      >
        <option value="">Backlog</option>
        {open.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </li>
  );
}

function BacklogAdd() {
  const board = useBoard();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      className="border-t border-rule px-4 py-2 md:px-8"
      onSubmit={(e) => {
        e.preventDefault();
        const title = ref.current?.value.trim();
        if (!title) return;
        if (ref.current) ref.current.value = "";
        void board.run(null, () => createTask(board.id, { title, sprintId: null }));
      }}
    >
      <label htmlFor="backlog-add" className="sr-only">
        Add an entry to the backlog
      </label>
      <input ref={ref} id="backlog-add" maxLength={500} autoComplete="off" placeholder="+ Add to backlog" className="field min-h-9 border-rule-mid text-[14px]" />
    </form>
  );
}
