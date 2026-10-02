"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { X } from "lucide-react";
import { initials, shortDate } from "@/lib/format";

export const LABEL_INKS = ["ink-1", "ink-2", "ink-3", "ink-4", "ink-5", "ink-6"] as const;

export const POINT_STEPS = [0.5, 1, 2, 3, 5, 8, 13, 21];

export const PRIORITIES = ["highest", "high", "medium", "low", "lowest"] as const;

export const TYPES = ["story", "task", "bug", "epic", "subtask"] as const;

/** A printed tag: an ink swatch and the label name. Never a pill. */
export function LabelTag({ name, color, onRemove }: { name: string; color: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-rule-mid px-1.5 py-px text-[12px] leading-[18px]">
      <span className="size-2 shrink-0" style={{ background: `var(--${color.replace("ink", "ink-epic")})` }} aria-hidden />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-1 flex items-center px-1 text-pencil hover:text-ink"
          aria-label={`Remove label ${name}`}
        >
          <X size={12} strokeWidth={1.7} aria-hidden />
        </button>
      )}
    </span>
  );
}

export function labelInk(color: string) {
  return `var(--${color.replace("ink", "ink-epic")})`;
}

export function AssigneeStamp({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      title={name}
      className={`font-mono flex shrink-0 items-center justify-center border border-pencil font-semibold text-ink ${
        size === "sm" ? "size-6 text-[11px]" : "size-7 text-[12px]"
      }`}
    >
      {initials(name)}
    </span>
  );
}

export function DueMark({ due, today, done }: { due: string | null; today: string; done: boolean }) {
  if (!due) return null;
  const late = !done && due < today;
  return (
    <span className={`font-mono text-[12px] ${late ? "font-semibold text-attention" : "text-pencil"}`}>
      {due === today && !done ? "TODAY" : shortDate(due)}
    </span>
  );
}

/** Builds hrefs that open (or close) the entry page while keeping the view's other query params. */
export function useTaskHref() {
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (taskId: string | null) => {
      const next = new URLSearchParams(params);
      if (taskId) next.set("task", taskId);
      else next.delete("task");
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, params],
  );
}
