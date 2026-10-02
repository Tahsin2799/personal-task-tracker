"use client";

import { createContext, useCallback, useContext, useMemo, useOptimistic, useState, useTransition } from "react";
import type { BoardData, BoardTask } from "@/lib/queries";
import type { Result } from "@/app/(app)/b/[boardId]/actions";

type TaskEdit =
  | { type: "patch"; id: string; patch: Partial<BoardTask> }
  | { type: "add"; task: BoardTask }
  | { type: "remove"; id: string };

type LabelEdit = { taskId: string; labelId: string; on: boolean };

type BoardContextValue = Omit<BoardData, "tasks" | "taskLabels"> & {
  tasks: BoardTask[];
  taskLabels: BoardData["taskLabels"];
  today: string;
  pending: boolean;
  note: string | null;
  setNote: (note: string | null) => void;
  /** Apply an edit to the page at once, then run the server action. The edit rolls back if the action fails. */
  run: (edit: TaskEdit | null, action: () => Promise<Result>) => Promise<Result>;
  runLabel: (edit: LabelEdit, action: () => Promise<Result>) => void;
};

const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoard() {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard must be used inside <BoardProvider>");
  return value;
}

function applyTaskEdit(tasks: BoardTask[], edit: TaskEdit): BoardTask[] {
  switch (edit.type) {
    case "patch":
      return tasks.map((t) => (t.id === edit.id ? { ...t, ...edit.patch } : t));
    case "add":
      return [...tasks, edit.task];
    case "remove":
      return tasks.filter((t) => t.id !== edit.id && t.parent_id !== edit.id);
  }
}

export function BoardProvider({ data, today, children }: { data: BoardData; today: string; children: React.ReactNode }) {
  const [tasks, editTasks] = useOptimistic(data.tasks, applyTaskEdit);
  const [taskLabels, editLabels] = useOptimistic(data.taskLabels, (rows, e: LabelEdit) =>
    e.on
      ? [...rows, { task_id: e.taskId, label_id: e.labelId }]
      : rows.filter((r) => !(r.task_id === e.taskId && r.label_id === e.labelId)),
  );
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const run = useCallback(
    (edit: TaskEdit | null, action: () => Promise<Result>) =>
      new Promise<Result>((resolve) => {
        startTransition(async () => {
          if (edit) editTasks(edit);
          const result = await action();
          setNote(result?.error ?? null);
          resolve(result);
        });
      }),
    [editTasks],
  );

  const runLabel = useCallback(
    (edit: LabelEdit, action: () => Promise<Result>) => {
      startTransition(async () => {
        editLabels(edit);
        const result = await action();
        setNote(result?.error ?? null);
      });
    },
    [editLabels],
  );

  const value = useMemo(
    () => ({ ...data, tasks, taskLabels, today, pending, note, setNote, run, runLabel }),
    [data, tasks, taskLabels, today, pending, note, run, runLabel],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

/** A margin note for failed edits, pinned to the foot of the page. */
export function BoardNote() {
  const { note, setNote } = useBoard();
  if (!note) return null;
  return (
    <div
      role="alert"
      className="fixed right-4 bottom-4 left-4 z-50 flex items-start gap-3 border border-attention bg-page px-4 py-3 text-[14px] text-attention md:left-auto md:max-w-[420px]"
    >
      <span className="flex-1">{note}</span>
      <button type="button" onClick={() => setNote(null)} className="btn btn-quiet min-h-0 px-1 text-attention">
        Dismiss
      </button>
    </div>
  );
}
