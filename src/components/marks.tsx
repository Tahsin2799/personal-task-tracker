import { Bug, BookMarked, CornerDownRight, SquareCheck, Zap, type LucideIcon } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import { epicInk, formatPoints } from "@/lib/format";

type TaskType = Database["public"]["Enums"]["task_type"];
type ColumnCategory = Database["public"]["Enums"]["column_category"];

const TYPE_GLYPHS: Record<TaskType, { icon: LucideIcon; label: string }> = {
  epic: { icon: Zap, label: "Epic" },
  story: { icon: BookMarked, label: "Story" },
  task: { icon: SquareCheck, label: "Task" },
  bug: { icon: Bug, label: "Bug" },
  subtask: { icon: CornerDownRight, label: "Subtask" },
};

export function TypeGlyph({ type, className = "" }: { type: TaskType; className?: string }) {
  const { icon: Icon, label } = TYPE_GLYPHS[type];
  return (
    <Icon
      aria-label={label}
      role="img"
      size={15}
      strokeWidth={1.6}
      className={`shrink-0 text-pencil ${className}`}
    />
  );
}

/** Printed status square: empty (to do), half (in progress), filled (done). */
export function StatusMark({ category }: { category: ColumnCategory }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
      {category === "in_progress" && <rect x="0.5" y="0.5" width="4.5" height="9" fill="currentColor" />}
      {category === "done" && <rect x="0.5" y="0.5" width="9" height="9" fill="currentColor" />}
    </svg>
  );
}

/** Story points on a fixed magnitude ramp, so size reads before the number. */
const RAMP: [number, number][] = [
  [1, 5],
  [2, 7],
  [3, 9],
  [5, 11],
  [8, 13],
  [13, 15],
];

function dotSize(points: number) {
  if (points <= 0) return 3;
  for (const [limit, size] of RAMP) if (points <= limit) return size;
  return 17;
}

export function PointsDot({ points }: { points: number | null }) {
  if (points == null) return <span className="text-pencil" aria-label="No estimate">—</span>;
  const size = dotSize(points);
  return (
    <span className="inline-flex items-center gap-1.5" title={`${formatPoints(points)} story points`}>
      <span className="inline-flex w-[17px] justify-center" aria-hidden>
        <span className="rounded-full bg-ink" style={{ width: size, height: size }} />
      </span>
      <span className="font-mono relative top-px text-[13px] leading-none">{formatPoints(points)}</span>
    </span>
  );
}

/** The epic's line ink, drawn in the ruled margin. */
export function EpicTick({ epicNumber, title }: { epicNumber: number; title: string }) {
  return (
    <span
      className="block h-full w-[3px]"
      style={{ background: epicInk(epicNumber) }}
      title={`Epic: ${title}`}
      aria-label={`Epic: ${title}`}
      role="img"
    />
  );
}
