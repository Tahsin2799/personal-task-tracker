"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
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
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { TypeGlyph } from "@/components/marks";
import { addDays } from "@/lib/day-math";
import { longDate, taskKey } from "@/lib/format";
import type { BoardTask } from "@/lib/queries";
import { updateTask } from "@/app/(app)/b/[boardId]/actions";
import { useBoard } from "./board-context";
import { useTaskHref } from "./bits";
import { FilterBar, useFilteredTasks } from "./filters";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthGrid(month: string) {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(first, -weekday);
  const days: string[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));
  // Drop a trailing week that belongs entirely to the next month.
  return days.slice(35).every((d) => d.slice(0, 7) !== month) ? days.slice(0, 35) : days;
}

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Due dates on a month page; drag an entry to another day (or from Unscheduled) to reschedule it. */
export function CalendarView() {
  const board = useBoard();
  const dndId = useId();
  const [month, setMonth] = useState(board.today.slice(0, 7));
  const [dragging, setDragging] = useState<BoardTask | null>(null);
  const work = useMemo(() => board.tasks.filter((t) => t.type !== "subtask"), [board.tasks]);
  const visible = useFilteredTasks(work);
  const days = monthGrid(month);
  const byDay = useMemo(() => {
    const map = new Map<string, BoardTask[]>();
    for (const t of visible) if (t.due_date) (map.get(t.due_date) ?? map.set(t.due_date, []).get(t.due_date)!).push(t);
    for (const list of map.values()) list.sort((a, b) => Number(b.milestone) - Number(a.milestone) || a.number - b.number);
    return map;
  }, [visible]);
  const unscheduled = visible.filter((t) => !t.due_date && !t.completed_at && t.type !== "epic");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const [y, m] = month.split("-").map(Number);

  function reschedule(task: BoardTask, due: string | null) {
    if (task.due_date === due) return;
    void board.run({ type: "patch", id: task.id, patch: { due_date: due } }, () => updateTask(board.id, task.id, { due_date: due }));
  }

  return (
    <>
      <FilterBar>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="btn btn-quiet min-h-8 px-2" aria-label="Previous month">
            <ChevronLeft size={16} strokeWidth={1.7} aria-hidden />
          </button>
          <h2 className="stamp w-[150px] text-center text-[15px]" aria-live="polite">
            {MONTHS[m - 1]} <span className="font-mono">{y}</span>
          </h2>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className="btn btn-quiet min-h-8 px-2" aria-label="Next month">
            <ChevronRight size={16} strokeWidth={1.7} aria-hidden />
          </button>
          <button type="button" onClick={() => setMonth(board.today.slice(0, 7))} className="btn min-h-8">
            Today
          </button>
        </div>
      </FilterBar>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => setDragging(board.tasks.find((t) => t.id === active.id) ?? null)}
        onDragEnd={({ active, over }) => {
          setDragging(null);
          const task = board.tasks.find((t) => t.id === active.id);
          if (task && over) reschedule(task, over.id === "unscheduled" ? null : String(over.id));
        }}
        onDragCancel={() => setDragging(null)}
      >
        <div className="flex flex-1 flex-col gap-4 px-4 py-3 md:px-6 xl:flex-row">
          <Agenda days={days.filter((d) => d.slice(0, 7) === month)} byDay={byDay} />
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="grid grid-cols-7 border-t border-l border-rule-mid">
              {WEEKDAYS.map((d) => (
                <div key={d} className="stamp border-r border-b border-rule-mid bg-ground px-2 py-1 text-[11px] text-pencil">
                  {d}
                </div>
              ))}
              {days.map((day) => (
                <Day key={day} day={day} inMonth={day.slice(0, 7) === month} tasks={byDay.get(day) ?? []} />
              ))}
            </div>
          </div>
          <Unscheduled tasks={unscheduled} />
        </div>
        <DragOverlay dropAnimation={null}>{dragging && <Chip task={dragging} lifted />}</DragOverlay>
      </DndContext>
    </>
  );
}

function Day({ day, inMonth, tasks }: { day: string; inMonth: boolean; tasks: BoardTask[] }) {
  const board = useBoard();
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const isToday = day === board.today;
  const shown = tasks.slice(0, 3);
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[124px] border-r border-b border-rule-mid p-1.5 ${inMonth ? "bg-page" : "bg-ground"} ${isOver ? "outline-2 -outline-offset-2 outline-ink" : ""}`}
    >
      <p className={`font-mono mb-1 flex items-center justify-between text-[12px] ${inMonth ? "" : "text-pencil"}`}>
        <span className={isToday ? "bg-ink px-1 text-page" : ""}>{Number(day.slice(8))}</span>
        {tasks.length > 3 && <span className="text-[11px] text-pencil">+{tasks.length - 3}</span>}
      </p>
      <ul className="space-y-1">
        {shown.map((t) => (
          <li key={t.id}>
            <Chip task={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ task, lifted = false }: { task: BoardTask; lifted?: boolean }) {
  const board = useBoard();
  const href = useTaskHref();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: task.id, disabled: lifted });
  const done = Boolean(task.completed_at);
  const late = !done && task.due_date != null && task.due_date < board.today;
  return (
    <div
      ref={lifted ? undefined : setNodeRef}
      {...(lifted ? {} : attributes)}
      {...(lifted ? {} : listeners)}
      className={`rounded-[2px] border px-1.5 py-1 text-[12px] leading-tight ${
        task.milestone ? "border-ink" : "border-rule-mid"
      } bg-page ${lifted ? "-rotate-1 border-ink" : "hover:border-ink"} ${isDragging ? "opacity-30" : ""}`}
    >
      <span className="font-mono flex items-center gap-1 text-[11px] text-pencil">
        {task.milestone && <Flag size={11} strokeWidth={2.2} className="shrink-0 text-ink" aria-label="Milestone" />}
        <span className={done ? "struck" : ""}>{taskKey(board.key, task.number)}</span>
      </span>
      <Link
        href={href(task.id)}
        scroll={false}
        draggable={false}
        className={`line-clamp-2 hover:underline ${task.milestone ? "font-semibold" : ""} ${done ? "text-pencil" : late ? "text-attention" : ""}`}
      >
        {task.title}
      </Link>
    </div>
  );
}

function Unscheduled({ tasks }: { tasks: BoardTask[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });
  return (
    <aside ref={setNodeRef} aria-labelledby="unscheduled-heading" className={`w-full shrink-0 rounded-[2px] bg-ground p-2 xl:w-[260px] ${isOver ? "outline-2 outline-ink" : ""}`}>
      <h2 id="unscheduled-heading" className="stamp px-1 pb-2 text-[13px]">
        Unscheduled <span className="font-mono text-[12px] text-pencil">{tasks.length}</span>
      </h2>
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id}>
            <Chip task={t} />
          </li>
        ))}
      </ul>
      <p className="px-1 pt-2 text-[12px] text-pencil">Drag an entry onto a day to give it a due date; drag it back here to clear it.</p>
    </aside>
  );
}

/** Below md the month reads as a ruled agenda: one dated line per day that has entries. */
function Agenda({ days, byDay }: { days: string[]; byDay: Map<string, BoardTask[]> }) {
  const board = useBoard();
  const href = useTaskHref();
  const dated = days.filter((d) => byDay.has(d));
  return (
    <div className="md:hidden">
      {dated.length === 0 && <p className="border-b border-rule py-3 text-[14px] text-pencil">Nothing is due this month.</p>}
      {dated.map((day) => (
        <section key={day} aria-label={longDate(day)}>
          <h3 className={`font-mono border-b border-rule-strong bg-ground px-2 pt-2 pb-1 text-[12px] ${day === board.today ? "font-semibold" : ""}`}>
            {longDate(day)}
            {day === board.today && <span className="stamp ml-2 text-[11px]">Today</span>}
          </h3>
          <ul>
            {byDay.get(day)!.map((t) => {
              const done = Boolean(t.completed_at);
              const late = !done && day < board.today;
              return (
                <li key={t.id} className="border-b border-rule">
                  <Link href={href(t.id)} scroll={false} className="flex min-h-[41px] items-center gap-2 px-2 py-2">
                    {t.milestone ? <Flag size={13} strokeWidth={2.2} className="shrink-0" aria-label="Milestone" /> : <TypeGlyph type={t.type} />}
                    <span className={`font-mono shrink-0 text-[12px] ${done ? "struck" : "text-pencil"}`}>{taskKey(board.key, t.number)}</span>
                    <span className={`min-w-0 flex-1 text-[15px] ${done ? "text-pencil" : late ? "text-attention" : ""} ${t.milestone ? "font-semibold" : ""}`}>
                      {t.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
