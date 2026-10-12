import { Bug, BookMarked, ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, CornerDownRight, Flag, Minus, Zap, type LucideIcon } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import { epicInk, formatPoints } from "@/lib/format";

type TaskType = Database["public"]["Enums"]["task_type"];
type ColumnCategory = Database["public"]["Enums"]["column_category"];

// A plain task is the default type, so it's unmarked (as medium priority is): a ticked box read as "done".
const TYPE_GLYPHS: Record<Exclude<TaskType, "task">, { icon: LucideIcon; label: string }> = {
  epic: { icon: Zap, label: "Epic" },
  story: { icon: BookMarked, label: "Story" },
  bug: { icon: Bug, label: "Bug" },
  subtask: { icon: CornerDownRight, label: "Subtask" },
};

export function TypeGlyph({ type, className = "" }: { type: TaskType; className?: string }) {
  if (type === "task") return <span aria-hidden className={`inline-block size-[15px] shrink-0 ${className}`} />;
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

const PRIORITY_ICON = {
  highest: { icon: ChevronsUp, className: "text-attention" },
  high: { icon: ChevronUp, className: "text-ink" },
  low: { icon: ChevronDown, className: "text-pencil" },
  lowest: { icon: ChevronsDown, className: "text-pencil" },
} as const;

/**
 * Priority as a printed chevron; medium is the unmarked default. Where priority is a ranked column
 * (My Work's margin), medium prints a faint dash so the column reads as one.
 */
export function PriorityMark({
  priority,
  markMedium = false,
}: {
  priority: "highest" | "high" | "medium" | "low" | "lowest";
  markMedium?: boolean;
}) {
  if (priority === "medium") {
    return markMedium ? <Minus size={15} strokeWidth={2} className="shrink-0 text-pencil/50" aria-label="medium priority" role="img" /> : null;
  }
  const { icon: Icon, className } = PRIORITY_ICON[priority];
  return <Icon size={15} strokeWidth={2} className={`shrink-0 ${className}`} aria-label={`${priority} priority`} role="img" />;
}

/** The milestone stamp: deadlines, submissions and grants, printed in a 1px ink border. */
export function MilestoneStamp() {
  return (
    <span className="stamp inline-flex shrink-0 items-center gap-1 border border-ink px-1.5 text-[11px] leading-[18px]">
      <Flag size={11} strokeWidth={2} aria-hidden /> Milestone
    </span>
  );
}
