"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateKeyBetween } from "fractional-indexing";
import { GripVertical, Plus } from "lucide-react";
import { StatusMark } from "@/components/marks";
import { shortDate } from "@/lib/format";
import { daysUntil } from "@/lib/day-math";
import type { BoardColumn, BoardTask } from "@/lib/queries";
import {
  createColumn,
  createTask,
  deleteColumn,
  moveColumn,
  moveTask,
  updateColumn,
} from "@/app/(app)/b/[boardId]/actions";
import { useBoard } from "./board-context";
import { EntryCard } from "./entry-card";
import { labelInk } from "./bits";
import { FilterBar, useFilteredTasks, useFilters } from "./filters";

const COL = "col:";

function between(prev: string | null, next: string | null) {
  try {
    return generateKeyBetween(prev, next);
  } catch {
    return generateKeyBetween(prev, null);
  }
}

export function Kanban() {
  const board = useBoard();
  const { scope, set, active: filtering } = useFilters();
  const activeSprint = board.sprints.find((s) => s.status === "active");
  const sprintScope = Boolean(activeSprint) && scope !== "all";

  const inScope = useMemo(
    () =>
      board.tasks.filter(
        (t) => t.type !== "epic" && t.type !== "subtask" && (!sprintScope || t.sprint_id === activeSprint?.id),
      ),
    [board.tasks, sprintScope, activeSprint?.id],
  );
  const visible = useFilteredTasks(inScope);
  const byId = useMemo(() => new Map(board.tasks.map((t) => [t.id, t])), [board.tasks]);

  const grouped = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of board.columns) out[c.id] = [];
    for (const t of [...visible].sort((a, b) => (a.position < b.position ? -1 : 1))) out[t.column_id]?.push(t.id);
    return out;
  }, [visible, board.columns]);

  // While a drag is in flight the board works on its own copy; on drop the optimistic store takes over.
  const [dragItems, setDragItems] = useState<Record<string, string[]> | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const items = dragItems ?? grouped;
  const columnIds = columnOrder ?? board.columns.map((c) => c.id);
  const columnById = new Map(board.columns.map((c) => [c.id, c]));

  const dndId = useId(); // stable ids so dnd-kit's a11y attributes hydrate
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function containerOf(id: string, from = items) {
    if (id.startsWith(COL)) return id.slice(COL.length);
    return Object.keys(from).find((col) => from[col].includes(id)) ?? null;
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    if (!String(active.id).startsWith(COL)) setDragItems(grouped);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || String(active.id).startsWith(COL)) return;
    setDragItems((current) => {
      if (!current) return current;
      const from = containerOf(String(active.id), current);
      const to = containerOf(String(over.id), current);
      if (!from || !to || from === to) return current;
      const target = current[to];
      const overIndex = target.indexOf(String(over.id));
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...current,
        [from]: current[from].filter((id) => id !== active.id),
        [to]: [...target.slice(0, index), String(active.id), ...target.slice(index)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    setActiveId(null);

    if (id.startsWith(COL)) {
      if (!over) return;
      const overCol = containerOf(String(over.id), grouped);
      const from = columnIds.indexOf(id.slice(COL.length));
      const to = overCol ? columnIds.indexOf(overCol) : -1;
      if (from < 0 || to < 0 || from === to) return;
      const order = arrayMove(columnIds, from, to);
      const prev = columnById.get(order[to - 1])?.position ?? null;
      const next = columnById.get(order[to + 1])?.position ?? null;
      setColumnOrder(order);
      void board.run(null, () => moveColumn(board.id, id.slice(COL.length), between(prev, next))).then(() => setColumnOrder(null));
      return;
    }

    const current = dragItems;
    setDragItems(null);
    if (!current || !over) return;
    const col = containerOf(id, current);
    if (!col) return;
    let list = current[col];
    const overIndex = list.indexOf(String(over.id));
    const fromIndex = list.indexOf(id);
    if (overIndex >= 0 && overIndex !== fromIndex) list = arrayMove(list, fromIndex, overIndex);

    const index = list.indexOf(id);
    const prev = byId.get(list[index - 1])?.position ?? null;
    const next = byId.get(list[index + 1])?.position ?? null;
    const task = byId.get(id)!;
    // Dropped where it started: same column, same neighbours.
    const original = grouped[task.column_id] ?? [];
    const was = original.indexOf(id);
    if (task.column_id === col && list[index - 1] === original[was - 1] && list[index + 1] === original[was + 1]) return;

    const position = between(prev, next);
    const doneNow = columnById.get(col)?.category === "done";
    void board.run(
      {
        type: "patch",
        id,
        patch: {
          column_id: col,
          position,
          completed_at: doneNow ? (task.completed_at ?? new Date().toISOString()) : null,
        },
      },
      () => moveTask(board.id, id, col, position),
    );
  }

  const activeTask = activeId && !activeId.startsWith(COL) ? byId.get(activeId) : undefined;
  const activeColumn = activeId?.startsWith(COL) ? columnById.get(activeId.slice(COL.length)) : undefined;
  const left = activeSprint?.end_date ? daysUntil(board.today, activeSprint.end_date) : null;

  return (
    <>
      <FilterBar>
        {activeSprint && (
          <div role="group" aria-label="Board scope" className="flex border border-rule-strong">
            {[
              { value: "", label: activeSprint.name },
              { value: "all", label: "All entries" },
            ].map((o) => {
              const on = (scope ?? "") === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("scope", o.value)}
                  className={`stamp px-3 py-1.5 text-[12px] ${on ? "bg-ink text-page" : "text-pencil hover:bg-page-sunk hover:text-ink"}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
      </FilterBar>

      {sprintScope && activeSprint && (
        <p className="border-b border-rule px-4 py-1.5 text-[13px] text-pencil md:px-8">
          {activeSprint.goal && <span className="text-ink">{activeSprint.goal}</span>}
          {activeSprint.end_date && (
            <span className="font-mono ml-3 whitespace-nowrap text-[12px]">
              ENDS {shortDate(activeSprint.end_date)}
              {left != null && (left >= 0 ? ` · ${left}d left` : ` · ${-left}d over`)}
            </span>
          )}
        </p>
      )}

      {inScope.length === 0 && !filtering && (
        <p className="border-b border-rule bg-page-sunk px-4 py-2.5 text-[14px] md:px-8">
          {sprintScope
            ? "Nothing in this sprint yet. Plan it from the Backlog, or create an entry in a lane below."
            : "This board is empty. Type into “+ Create entry” in any lane, or press c."}
        </p>
      )}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setDragItems(null);
        }}
      >
        <div className="flex flex-1 gap-2 overflow-x-auto px-4 py-3 md:px-6">
          <SortableContext items={columnIds.map((id) => COL + id)} strategy={horizontalListSortingStrategy}>
            {columnIds.map((colId) => {
              const column = columnById.get(colId);
              if (!column) return null;
              return (
                <ColumnLane
                  key={colId}
                  column={column}
                  ids={items[colId] ?? []}
                  byId={byId}
                  sprintId={sprintScope ? (activeSprint?.id ?? null) : null}
                  filtering={filtering}
                />
              );
            })}
          </SortableContext>
          <AddColumn />
        </div>
        <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {activeTask ? (
            <div className="w-[280px]">
              <EntryCard task={activeTask} lifted />
            </div>
          ) : activeColumn ? (
            <div className="-rotate-1 border border-ink bg-page px-3 py-3">
              <span className="stamp text-[15px]">{activeColumn.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function ColumnLane({
  column,
  ids,
  byId,
  sprintId,
  filtering,
}: {
  column: BoardColumn;
  ids: string[];
  byId: Map<string, BoardTask>;
  sprintId: string | null;
  filtering: boolean;
}) {
  const board = useBoard();
  const [editing, setEditing] = useState(false);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: COL + column.id,
    data: { type: "column" },
  });
  const count = board.tasks.filter(
    (t) => t.column_id === column.id && t.type !== "epic" && t.type !== "subtask" && (!sprintId || t.sprint_id === sprintId),
  ).length;
  const overLimit = column.wip_limit != null && count > column.wip_limit;

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        background: board.color ? `color-mix(in oklab, ${labelInk(board.color)} var(--lane-tint), var(--ground))` : undefined,
      }}
      aria-labelledby={`col-${column.id}`}
      className={`flex min-w-[272px] flex-1 flex-col rounded-[2px] bg-ground md:max-w-[360px] ${isDragging ? "opacity-40" : ""}`}
    >
      {editing ? (
        <ColumnEditor column={column} onDone={() => setEditing(false)} />
      ) : (
        <header className="flex items-center gap-2 px-2 pt-2 pb-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab p-1 text-pencil hover:text-ink active:cursor-grabbing"
            aria-label={`Reorder column ${column.name}`}
          >
            <GripVertical size={14} strokeWidth={1.6} aria-hidden />
          </button>
          <StatusMark category={column.category} />
          <button
            type="button"
            id={`col-${column.id}`}
            onClick={() => setEditing(true)}
            className="stamp truncate text-left text-[14px] hover:underline"
            title="Edit column"
          >
            {column.name}
          </button>
          <span className={`font-mono ml-auto pr-1 text-[12px] ${overLimit ? "font-semibold text-attention" : "text-pencil"}`}>
            {filtering && ids.length !== count ? `${ids.length} of ${count}` : count}
            {column.wip_limit != null && ` / ${column.wip_limit}`}
          </span>
        </header>
      )}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="flex min-h-12 flex-col gap-2 px-2 pt-1 pb-2">
          {ids.map((id) => {
            const task = byId.get(id);
            return task ? <SortableEntry key={id} task={task} /> : null;
          })}
        </ol>
      </SortableContext>
      <QuickAdd columnId={column.id} columnName={column.name} sprintId={sprintId} />
      <div className="flex-1" aria-hidden />
    </section>
  );
}

function SortableEntry({ task }: { task: BoardTask }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task" },
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable entry"
      className={`touch-manipulation rounded-[2px] outline-offset-2 ${isDragging ? "opacity-30" : ""}`}
    >
      <EntryCard task={task} />
    </li>
  );
}

function QuickAdd({ columnId, columnName, sprintId }: { columnId: string; columnName: string; sprintId: string | null }) {
  const board = useBoard();
  const ref = useRef<HTMLInputElement>(null);

  async function add(title: string) {
    const clean = title.trim();
    if (!clean) return;
    if (ref.current) ref.current.value = "";
    const now = new Date().toISOString();
    await board.run(
      {
        type: "add",
        task: {
          id: `temp-${now}`,
          number: 0,
          title: clean,
          description: null,
          type: "task",
          priority: "medium",
          story_points: null,
          start_date: null,
          due_date: null,
          completed_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          column_id: columnId,
          position: "zzzz",
          sprint_id: sprintId,
          epic_id: null,
          parent_id: null,
          milestone: false,
          experiment: null,
          cover_attachment_id: null,
          repeat_every: null,
          repeat_unit: null,
          next_occurrence_id: null,
          assignee_id: board.viewerId,
          reporter_id: board.viewerId,
        },
      },
      () => createTask(board.id, { title: clean, columnId, sprintId }),
    );
  }

  return (
    <form
      className="px-2 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        void add(ref.current?.value ?? "");
      }}
    >
      <label htmlFor={`add-${columnId}`} className="sr-only">
        Add an entry to {columnName}
      </label>
      <input
        ref={ref}
        id={`add-${columnId}`}
        maxLength={500}
        autoComplete="off"
        placeholder="+ Create entry"
        className="field min-h-9 rounded-[2px] border-transparent px-2 text-[14px] hover:bg-page focus:bg-page"
      />
    </form>
  );
}

const CATEGORIES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done (counts as finished)" },
] as const;

function ColumnEditor({ column, onDone }: { column: BoardColumn; onDone: () => void }) {
  const board = useBoard();
  return (
    <form
      className="space-y-2 border-b-[3px] border-double border-rule-strong bg-page-sunk px-3 py-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const wip = String(f.get("wip") ?? "").trim();
        const result = await board.run(null, () =>
          updateColumn(board.id, column.id, {
            name: String(f.get("name") ?? ""),
            category: f.get("category") as BoardColumn["category"],
            wip_limit: wip ? Number(wip) : null,
          }),
        );
        if (!result?.error) onDone();
      }}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
    >
      <label className="field-label" htmlFor={`name-${column.id}`}>
        Column
      </label>
      <input id={`name-${column.id}`} name="name" defaultValue={column.name} required maxLength={40} autoFocus className="field min-h-9" />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="field-label" htmlFor={`cat-${column.id}`}>
            Counts as
          </label>
          <select id={`cat-${column.id}`} name="category" defaultValue={column.category} className="field min-h-9 text-[14px]">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <label className="field-label" htmlFor={`wip-${column.id}`}>
            WIP
          </label>
          <input
            id={`wip-${column.id}`}
            name="wip"
            type="number"
            min={1}
            defaultValue={column.wip_limit ?? ""}
            placeholder="None"
            className="field font-mono min-h-9 text-[14px]"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" className="btn btn-primary min-h-8">
          Save
        </button>
        <button type="button" onClick={onDone} className="btn btn-quiet min-h-8">
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger ml-auto min-h-8"
          onClick={async () => {
            const result = await board.run(null, () => deleteColumn(board.id, column.id));
            if (!result?.error) onDone();
          }}
        >
          Delete
        </button>
      </div>
    </form>
  );
}

function AddColumn() {
  const board = useBoard();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="w-[148px] shrink-0 pt-1">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-quiet w-full justify-start">
          <Plus size={14} strokeWidth={1.8} aria-hidden />
          Add column
        </button>
      </div>
    );
  }

  return (
    <form
      className="w-[240px] shrink-0 space-y-2 rounded-[2px] bg-ground p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const result = await board.run(null, () =>
          createColumn(board.id, String(f.get("name") ?? ""), f.get("category") as BoardColumn["category"]),
        );
        if (!result?.error) setOpen(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <label className="field-label" htmlFor="new-column">
        New column
      </label>
      <input id="new-column" name="name" required maxLength={40} autoFocus placeholder="e.g. Waiting on data" className="field min-h-9" />
      <label className="field-label" htmlFor="new-column-cat">
        Counts as
      </label>
      <select id="new-column-cat" name="category" defaultValue="in_progress" className="field min-h-9 text-[14px]">
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn btn-primary min-h-8">
          Add
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet min-h-8">
          Cancel
        </button>
      </div>
    </form>
  );
}
