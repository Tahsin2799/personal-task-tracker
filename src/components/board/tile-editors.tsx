"use client";

import { useRef } from "react";
import { CalendarPlus, ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, UserPlus } from "lucide-react";
import { PointsDot } from "@/components/marks";
import { formatPoints, shortDate } from "@/lib/format";
import type { BoardTask } from "@/lib/queries";
import { updateTask, type TaskPatch } from "@/app/(app)/b/[boardId]/actions";
import { useBoard } from "./board-context";
import { AssigneeStamp, POINT_STEPS } from "./bits";

/** Controls inside a draggable tile must not start a drag or open the entry. */
const isolate = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
  onClick: (e: React.MouseEvent) => e.stopPropagation(),
};

function useSave(task: BoardTask) {
  const board = useBoard();
  return (patch: TaskPatch) => {
    if (task.id.startsWith("temp-")) return;
    void board.run({ type: "patch", id: task.id, patch }, () => updateTask(board.id, task.id, patch));
  };
}

const SLOT = "relative flex h-7 min-w-7 items-center justify-center rounded-[2px] hover:bg-page-sunk focus-within:outline-2 focus-within:outline-ink";

/** Story points: the magnitude dot, or a quiet dash; a native select sits invisibly on top. */
export function TilePoints({ task, interactive }: { task: BoardTask; interactive: boolean }) {
  const save = useSave(task);
  const label = task.story_points != null ? `${formatPoints(task.story_points)} story points, change` : "Estimate story points";
  return (
    <span className={`${SLOT} px-1`} title={interactive ? label : undefined}>
      {task.story_points != null ? <PointsDot points={task.story_points} /> : <span className="font-mono text-[12px] text-pencil">–pt</span>}
      {interactive && (
        <select
          {...isolate}
          aria-label={label}
          value={task.story_points ?? ""}
          onChange={(e) => save({ story_points: e.target.value === "" ? null : Number(e.target.value) })}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">No estimate</option>
          {POINT_STEPS.map((p) => (
            <option key={p} value={p}>
              {formatPoints(p)} pt
            </option>
          ))}
        </select>
      )}
    </span>
  );
}

/** Due date: written date (chestnut when late), or a calendar glyph; opens the native picker. */
export function TileDue({ task, interactive }: { task: BoardTask; interactive: boolean }) {
  const board = useBoard();
  const save = useSave(task);
  const input = useRef<HTMLInputElement>(null);
  const done = Boolean(task.completed_at);
  const late = Boolean(task.due_date && !done && task.due_date < board.today);
  const label = task.due_date ? `Due ${task.due_date}, change` : "Set a due date";

  return (
    <span className={`${SLOT} px-1`}>
      <button
        type="button"
        {...isolate}
        disabled={!interactive}
        aria-label={label}
        title={interactive ? label : undefined}
        onClick={(e) => {
          e.stopPropagation();
          try {
            input.current?.showPicker();
          } catch {
            input.current?.focus();
          }
        }}
        className={`font-mono flex items-center whitespace-nowrap text-[12px] ${late ? "font-semibold text-attention" : task.due_date ? "text-ink" : "text-pencil"}`}
      >
        {task.due_date ? (
          task.due_date === board.today && !done ? "TODAY" : shortDate(task.due_date)
        ) : (
          <CalendarPlus size={14} strokeWidth={1.6} aria-hidden />
        )}
      </button>
      {interactive && (
        <input
          ref={input}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={task.due_date ?? ""}
          onChange={(e) => save({ due_date: e.target.value || null })}
          className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
        />
      )}
    </span>
  );
}

/** Assignee: initials stamp, or an add-person glyph; a native select sits invisibly on top. */
export function TileAssignee({ task, interactive }: { task: BoardTask; interactive: boolean }) {
  const board = useBoard();
  const save = useSave(task);
  const assignee = board.members.find((m) => m.id === task.assignee_id);
  const label = assignee ? `Assigned to ${assignee.name}, change` : "Assign someone";
  return (
    <span className={SLOT} title={interactive ? label : assignee?.name}>
      {assignee ? (
        <AssigneeStamp name={assignee.name} size="sm" />
      ) : (
        <span className="flex size-6 items-center justify-center border border-dashed border-pencil text-pencil">
          <UserPlus size={13} strokeWidth={1.6} aria-hidden />
        </span>
      )}
      {interactive && (
        <select
          {...isolate}
          aria-label={label}
          value={task.assignee_id ?? ""}
          onChange={(e) => save({ assignee_id: e.target.value || null })}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">Unassigned</option>
          {board.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === board.viewerId ? `${m.name} (you)` : m.name}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}

const PRIORITY_ICON = {
  highest: { icon: ChevronsUp, className: "text-attention" },
  high: { icon: ChevronUp, className: "text-ink" },
  low: { icon: ChevronDown, className: "text-pencil" },
  lowest: { icon: ChevronsDown, className: "text-pencil" },
} as const;

/** Priority as a printed chevron; medium is the unmarked default. */
export function PriorityMark({ priority }: { priority: BoardTask["priority"] }) {
  if (priority === "medium") return null;
  const { icon: Icon, className } = PRIORITY_ICON[priority];
  return <Icon size={15} strokeWidth={2} className={`shrink-0 ${className}`} aria-label={`${priority} priority`} role="img" />;
}
