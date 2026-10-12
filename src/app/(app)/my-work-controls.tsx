"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Plus, X } from "lucide-react";
import { longDate, shortDate } from "@/lib/format";
import { singleKeysAllowed } from "@/lib/shortcuts";
import { createTask, deleteTask, setTaskColumn, updateTask } from "./b/[boardId]/actions";
import { setDueDates } from "./my-work-actions";

/*
 * Triage without leaving My Work. The printed marks stay as they are; native controls sit invisibly
 * on top of them (as on board tiles), out of the tab order so a row stays one stop. The keyboard
 * reaches them through the ledger keys: j / k move, x done, u undo, d due date, s status, Enter opens.
 * Every change is confirmed on a slip at the foot of the screen; the last five can be undone.
 */

type Note = {
  message: string;
  tone?: "error";
  /** Reverses this change; kept on the slip's undo stack while the slip shows. */
  undo?: () => Promise<void>;
  action?: { label: string; run: () => void };
};

function notify(note: Note) {
  window.dispatchEvent(new CustomEvent<Note>("ledger:note", { detail: note }));
}

const failed = (error: string) => notify({ message: error, tone: "error" });

const entryLink = (taskId: string) => document.querySelector<HTMLElement>(`tr[data-task-id="${taskId}"] [data-entry-link]`);

/** Put the keyboard back on an entry, even if its row was re-rendered into another group. */
function keepFocus(taskId: string, tries = 60) {
  const link = entryLink(taskId);
  const active = document.activeElement;
  const lost = !active || active === document.body || !active.isConnected;
  if (link && (lost || active?.closest("tr")?.getAttribute("data-task-id") === taskId) && active !== link) {
    link.focus({ preventScroll: true });
    link.closest("tr")?.scrollIntoView({ block: "nearest" });
  }
  if (tries > 0) requestAnimationFrame(() => keepFocus(taskId, tries - 1));
}

const SLOT =
  "relative -mx-1 flex min-h-8 items-center rounded-[2px] px-1 transition-colors duration-[120ms] hover:bg-page-sunk has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink";

type Column = { id: string; name: string };

/** Status: the printed square and column name, with the board's columns in a native select over them. */
export function StatusSlot({
  boardId,
  taskId,
  entryKey,
  columnId,
  columns,
  children,
}: {
  boardId: string;
  taskId: string;
  entryKey: string;
  columnId: string;
  columns: Column[];
  children: React.ReactNode;
}) {
  const [pending, start] = useTransition();

  return (
    <span className={`${SLOT} ${pending ? "opacity-60" : ""}`} title="Change status (s)">
      {children}
      <select
        aria-label={`Status of ${entryKey}`}
        data-status-select
        tabIndex={-1}
        value={columnId}
        disabled={pending}
        // Letters would pick an option by type-ahead and save it at once: arrows and Enter only.
        onKeyDown={(e) => {
          if (e.key.length === 1) e.preventDefault();
          if (e.key === "Escape") {
            e.preventDefault();
            entryLink(taskId)?.focus();
          }
        }}
        onChange={(e) => {
          const next = e.target.value;
          const name = columns.find((c) => c.id === next)?.name ?? "another column";
          start(async () => {
            const result = await setTaskColumn(boardId, taskId, next);
            if (result?.error) return failed(result.error);
            notify({
              message: `${entryKey} moved to ${name}.`,
              undo: async () => {
                const undo = await setTaskColumn(boardId, taskId, columnId);
                if (undo?.error) failed(undo.error);
                else notify({ message: `${entryKey} is back where it was.` });
              },
            });
            entryLink(taskId)?.focus();
            keepFocus(taskId);
          });
        }}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
      >
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Due date: the printed date (or a dash), opening the native date picker. */
export function DueSlot({
  boardId,
  taskId,
  entryKey,
  due,
  children,
}: {
  boardId: string;
  taskId: string;
  entryKey: string;
  due: string | null;
  children: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const label = due ? `Due date of ${entryKey}, ${longDate(due)}` : `Due date of ${entryKey}, none`;

  return (
    <span className={`${SLOT} w-fit ${pending ? "opacity-60" : ""}`}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${label}. Change (d)`}
        title={due ? "Change the due date (d)" : "Set a due date (d)"}
        onClick={() => {
          try {
            input.current?.showPicker();
          } catch {
            input.current?.focus();
          }
        }}
        className="flex items-center"
      >
        {children}
      </button>
      {/* A real, labelled field (focused by d), drawn out of sight behind the printed date. */}
      <input
        ref={input}
        type="date"
        data-due-input
        tabIndex={-1}
        aria-label={label}
        value={due ?? ""}
        disabled={pending}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            entryLink(taskId)?.focus();
          }
        }}
        onChange={(e) => {
          const next = e.target.value || null;
          start(async () => {
            const result = await updateTask(boardId, taskId, { due_date: next });
            if (result?.error) return failed(result.error);
            notify({
              message: next ? `${entryKey} is due ${shortDate(next)}.` : `${entryKey} has no due date now.`,
              undo: async () => {
                const undo = await updateTask(boardId, taskId, { due_date: due });
                if (undo?.error) failed(undo.error);
                else notify({ message: `${entryKey} keeps its old date.` });
              },
            });
            entryLink(taskId)?.focus();
            keepFocus(taskId);
          });
        }}
        className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
      />
    </span>
  );
}

/** "Re-date N…": one new due date for the whole late pile. Milestones keep their dates. */
export function ReschedulePile({ items }: { items: { id: string; due: string | null }[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  if (items.length < 2) return null;

  return (
    <span className="relative ml-auto">
      <button
        type="button"
        disabled={pending}
        title="Give every overdue entry one new due date. Milestones keep theirs."
        onClick={() => {
          try {
            input.current?.showPicker();
          } catch {
            input.current?.focus();
          }
        }}
        className="btn min-h-7 gap-1.5 px-2 text-[12px]"
      >
        <CalendarClock size={13} strokeWidth={1.7} aria-hidden />
        {pending ? "Re-dating…" : `Re-date ${items.length}…`}
      </button>
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-label={`One new due date for ${items.length} overdue entries`}
        onChange={(e) => {
          const date = e.target.value;
          if (!date) return;
          start(async () => {
            const result = await setDueDates(items.map((i) => ({ id: i.id, due: date })));
            if (result.error && result.changed === 0) return failed(result.error);
            notify({
              message: result.error ?? `${result.changed} overdue ${result.changed === 1 ? "entry is" : "entries are"} now due ${shortDate(date)}.`,
              tone: result.error ? "error" : undefined,
              undo: async () => {
                const undo = await setDueDates(items);
                if (undo.error) failed(undo.error);
                else notify({ message: "Their old due dates are back." });
              },
            });
          });
        }}
        className="pointer-events-none absolute right-0 bottom-0 h-px w-px opacity-0"
      />
    </span>
  );
}

/** "+ Write an entry": a to-do in two seconds, onto the board you last wrote on. c focuses it. */
export function QuickWrite({ boards, defaultBoardId }: { boards: { id: string; label: string }[]; defaultBoardId: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [boardId, setBoardId] = useState(defaultBoardId ?? boards[0]?.id ?? "");
  const [pending, start] = useTransition();

  // ⌘K "Write an entry" lands here with ?write.
  useEffect(() => {
    if (params.has("write")) input.current?.focus();
  }, [params]);

  if (boards.length === 0) return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = title.trim();
        if (!text || !boardId) return;
        const label = boards.find((b) => b.id === boardId)?.label ?? "the board";
        start(async () => {
          const result = await createTask(boardId, { title: text });
          if (result?.error) return failed(result.error);
          setTitle("");
          // Remembered per browser, so the page renders with this board already chosen next time.
          document.cookie = `write-board=${boardId}; path=/; max-age=31536000; samesite=lax`;
          const id = result?.id;
          notify({
            message: `Written in ${label}.`,
            undo: id
              ? async () => {
                  const undo = await deleteTask(boardId, id);
                  if (undo?.error) failed(undo.error);
                  else notify({ message: `"${text}" is unwritten.` });
                }
              : undefined,
            action: id ? { label: "Open", run: () => router.push(`/b/${boardId}?task=${id}`) } : undefined,
          });
          input.current?.focus();
        });
      }}
      className="flex items-center gap-3 border-b border-rule px-4 transition-colors duration-[120ms] hover:bg-page-sunk has-[:focus]:bg-page-sunk md:px-8"
    >
      <Plus size={15} strokeWidth={1.8} className="shrink-0 text-pencil" aria-hidden />
      <label htmlFor="add-my-work" className="sr-only">
        Write an entry
      </label>
      <input
        ref={input}
        id="add-my-work"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={500}
        autoComplete="off"
        placeholder="Write an entry"
        disabled={pending}
        className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-pencil focus:outline-none md:max-w-[560px]"
      />
      <span className="hidden text-[13px] text-pencil sm:inline" aria-hidden>
        in
      </span>
      <label htmlFor="write-board" className="sr-only">
        Board
      </label>
      <select
        id="write-board"
        value={boardId}
        onChange={(e) => setBoardId(e.target.value)}
        className="field min-h-8 w-[min(220px,40%)] border-b-transparent py-0.5 text-[13px] text-pencil hover:border-b-rule-strong"
      >
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      {title.trim() && (
        <button type="submit" disabled={pending} className="btn btn-primary min-h-8 shrink-0">
          {pending ? "Adding…" : "Add"}
        </button>
      )}
    </form>
  );
}

/** Phones: the workspace filter as one select instead of a second strip under the tabs. */
export function WorkspaceSelect({ options, active }: { options: { id: string; label: string; count: number }[]; active: string | null }) {
  const router = useRouter();
  return (
    <span className="block w-full">
      <label htmlFor="ws-filter" className="sr-only">
        Workspace
      </label>
      <select
        id="ws-filter"
        value={active ?? ""}
        onChange={(e) => router.push(e.target.value ? `/?ws=${e.target.value}` : "/")}
        className="field min-h-9 text-[14px]"
      >
        <option value="">All workspaces · {options.reduce((n, o) => n + o.count, 0)} open</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label} · {o.count} open
          </option>
        ))}
      </select>
    </span>
  );
}

const UNDO_DEPTH = 5;

/** The ledger keys for My Work, and the slip that confirms what they (and the slots) did. */
export function LedgerKeys() {
  const [note, setNote] = useState<Note | null>(null);
  const [depth, setDepth] = useState(0);
  const [, start] = useTransition();
  // The last few changes, newest first; they can be undone only while the slip shows.
  const stack = useRef<(() => Promise<void>)[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onNote(e: Event) {
      const next = (e as CustomEvent<Note>).detail;
      if (next.undo) stack.current = [next.undo, ...stack.current].slice(0, UNDO_DEPTH);
      setDepth(stack.current.length);
      setNote(next);
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => {
          setNote(null);
          stack.current = [];
          setDepth(0);
        },
        next.tone === "error" ? 12_000 : 10_000,
      );
    }
    window.addEventListener("ledger:note", onNote);
    return () => {
      window.removeEventListener("ledger:note", onNote);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function undoLast() {
    const undo = stack.current.shift();
    setDepth(stack.current.length);
    if (undo) start(undo);
  }

  function dismiss() {
    setNote(null);
    stack.current = [];
    setDepth(0);
  }

  useEffect(() => {
    const rows = () => [...document.querySelectorAll<HTMLTableRowElement>("tr[data-entry], tr[data-fold]")];
    const current = () =>
      (document.activeElement as HTMLElement | null)?.closest<HTMLTableRowElement>("tr[data-entry], tr[data-fold]") ?? null;
    const focusRow = (row: HTMLTableRowElement | undefined) => {
      row?.querySelector<HTMLElement>("[data-entry-link], [data-fold-toggle]")?.focus();
      row?.scrollIntoView({ block: "nearest" });
    };

    function onKey(e: KeyboardEvent) {
      if (!singleKeysAllowed(e)) return;
      const row = current();
      // The ledger keys act from the ledger itself, or from nowhere in particular (the page body).
      const fromPage = !document.activeElement || document.activeElement === document.body;
      if (!row && !fromPage) return;

      if (e.key === "u") {
        if (stack.current.length) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("ledger:undo"));
        }
        return;
      }

      const list = rows();
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const i = row ? list.indexOf(row) : -1;
        focusRow(e.key === "j" ? list[Math.min(list.length - 1, i + 1)] : list[Math.max(0, i - 1)]);
        return;
      }
      if (!row?.dataset.taskId) return;
      const { taskId, boardId, column: from, doneColumn, todoColumn, done, entryKey } = row.dataset;

      if (e.key === "x") {
        e.preventDefault();
        const to = done === "true" ? todoColumn : doneColumn;
        if (!boardId || !to || !from) return failed("This board has no column to move it to.");
        // Batch triage: the keyboard moves on to the next entry, not down to Done this week.
        const entries = list.filter((r) => r.dataset.taskId);
        const at = entries.indexOf(row);
        const next = (entries[at + 1] ?? entries[at - 1])?.dataset.taskId;
        start(async () => {
          const result = await setTaskColumn(boardId, taskId, to);
          if (result?.error) return failed(result.error);
          notify({
            message: done === "true" ? `${entryKey} reopened.` : `${entryKey} done.`,
            undo: async () => {
              const undo = await setTaskColumn(boardId, taskId, from);
              if (undo?.error) return failed(undo.error);
              notify({ message: `${entryKey} is back where it was.` });
              keepFocus(taskId);
            },
          });
          if (next) {
            entryLink(next)?.focus();
            keepFocus(next);
          }
        });
      } else if (e.key === "d") {
        e.preventDefault();
        const input = row.querySelector<HTMLInputElement>("[data-due-input]");
        input?.focus();
        try {
          input?.showPicker();
        } catch {
          // Focused is enough on browsers without a picker API; phones open the entry with Enter.
        }
      } else if (e.key === "s") {
        e.preventDefault();
        const select = row.querySelector<HTMLSelectElement>("[data-status-select]");
        select?.focus();
        try {
          select?.showPicker();
        } catch {
          // Focused is enough: arrow keys change it.
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // u from the key handler: it runs outside React's render, so it asks through an event.
  useEffect(() => {
    const onUndo = () => undoLast();
    window.addEventListener("ledger:undo", onUndo);
    return () => window.removeEventListener("ledger:undo", onUndo);
  });

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center md:left-[256px]">
      {note && (
        <p
          role={note.tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-[600px] items-center gap-3 rounded-[2px] border bg-page px-3 py-2 text-[14px] ${
            note.tone === "error" ? "border-attention text-attention" : "border-ink text-ink"
          }`}
        >
          <span className="min-w-0">{note.message}</span>
          {depth > 0 && (
            <button type="button" onClick={undoLast} className="btn btn-quiet min-h-7 shrink-0 gap-1.5 px-2 text-[13px] text-ink">
              Undo
              {depth > 1 && <span className="tnum font-sans text-[12px] font-normal tracking-normal text-pencil">· {depth}</span>}
              <kbd className="font-mono border border-rule-strong px-1 text-[11px] font-normal tracking-normal normal-case text-pencil">u</kbd>
            </button>
          )}
          {note.action && (
            <button
              type="button"
              onClick={() => {
                const action = note.action!;
                dismiss();
                action.run();
              }}
              className="btn btn-quiet min-h-7 shrink-0 px-2 text-[13px] text-ink"
            >
              {note.action.label}
            </button>
          )}
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="btn btn-quiet min-h-7 shrink-0 px-1.5">
            <X size={14} strokeWidth={1.7} aria-hidden />
          </button>
        </p>
      )}
    </div>
  );
}
