"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical, Flag, Paperclip, MessageSquare, Repeat } from "lucide-react";
import { TypeGlyph } from "@/components/marks";
import { epicInk, repeatPhrase, taskKey } from "@/lib/format";
import type { BoardTask } from "@/lib/queries";
import { useBoard } from "./board-context";
import { labelInk, useTaskHref } from "./bits";
import { PriorityMark, TileAssignee, TileDue, TilePoints } from "./tile-editors";

/**
 * One entry as a board tile: title first, then labels and epic, then a footer with
 * type, key and priority on the left and the editable points, due date and assignee on the right.
 */
export function EntryCard({ task, lifted = false }: { task: BoardTask; lifted?: boolean }) {
  const board = useBoard();
  const href = useTaskHref();
  const router = useRouter();
  const open = useSearchParams().get("task") === task.id;
  const epic = task.epic_id ? board.tasks.find((t) => t.id === task.epic_id) : undefined;
  const subs = board.tasks.filter((s) => s.parent_id === task.id);
  const labels = board.taskLabels
    .filter((r) => r.task_id === task.id)
    .map((r) => board.labels.find((l) => l.id === r.label_id))
    .filter((l) => l !== undefined);
  const done = Boolean(task.completed_at);
  const comments = board.commentCounts[task.id] ?? 0;
  const files = board.attachmentCounts[task.id] ?? 0;
  const cover = task.cover_attachment_id ? board.covers[task.cover_attachment_id] : undefined;
  const interactive = !lifted;

  return (
    <div
      onClick={interactive ? () => router.push(href(task.id), { scroll: false }) : undefined}
      className={`group cursor-pointer overflow-hidden rounded-[2px] border bg-page ${
        lifted
          ? "-rotate-1 border-ink"
          : open
            ? "border-ink outline-1 outline-ink"
            : "border-rule-mid hover:border-ink"
      }`}
    >
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not optimisable
        <img src={cover} alt="" className="block h-28 w-full border-b border-rule-mid object-cover" draggable={false} />
      )}
      <div className="px-3 pt-2.5 pb-2">
        <Link
          href={href(task.id)}
          scroll={false}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
          className={`block text-[15px] leading-snug group-hover:underline ${done ? "text-pencil" : "text-ink"}`}
        >
          {task.title}
        </Link>

        {(labels.length > 0 || epic || task.milestone || task.experiment || subs.length > 0 || comments > 0 || files > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {task.milestone && (
              <span className="stamp inline-flex items-center gap-1 border border-ink px-1.5 text-[11px] leading-[18px]">
                <Flag size={11} strokeWidth={2} aria-hidden /> Milestone
              </span>
            )}
            {task.experiment && (
              <span className="stamp inline-flex items-center gap-1 border border-rule-strong px-1.5 text-[11px] leading-[18px]">
                <FlaskConical size={11} strokeWidth={2} aria-hidden /> Experiment
              </span>
            )}
            {epic && (
              <span className="inline-flex max-w-full items-center gap-1.5 border border-rule-mid px-1.5 text-[12px] leading-[18px] text-pencil" title={`Epic: ${epic.title}`}>
                <span className="h-3 w-[3px] shrink-0" style={{ background: epicInk(epic.number) }} aria-hidden />
                <span className="truncate">{epic.title}</span>
              </span>
            )}
            {labels.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1 text-[12px] leading-[18px] text-pencil">
                <span className="size-2" style={{ background: labelInk(l.color) }} aria-hidden />
                {l.name}
              </span>
            ))}
            {(subs.length > 0 || comments > 0 || files > 0) && (
              <span className="ml-auto flex items-center gap-2 text-pencil">
                {subs.length > 0 && (
                  <span className="font-mono text-[11px]" title="Subtasks done">
                    {subs.filter((s) => s.completed_at).length}/{subs.length}
                  </span>
                )}
                {comments > 0 && (
                  <span className="font-mono flex items-center gap-0.5 text-[11px]" title={`${comments} comments`}>
                    <MessageSquare size={12} strokeWidth={1.6} aria-hidden />
                    {comments}
                  </span>
                )}
                {files > 0 && (
                  <span className="font-mono flex items-center gap-0.5 text-[11px]" title={`${files} attachments`}>
                    <Paperclip size={12} strokeWidth={1.6} aria-hidden />
                    {files}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center gap-1.5 whitespace-nowrap">
          <TypeGlyph type={task.type} />
          <span className={`font-mono shrink-0 text-[12px] ${done ? "struck" : "text-pencil"}`}>{taskKey(board.key, task.number)}</span>
          <PriorityMark priority={task.priority} />
          {task.repeat_every != null && task.repeat_unit && (
            <Repeat size={13} strokeWidth={1.8} role="img" aria-label={`Repeats ${repeatPhrase(task.repeat_every, task.repeat_unit)}`} className="shrink-0 text-pencil">
              <title>{`Repeats ${repeatPhrase(task.repeat_every, task.repeat_unit)}`}</title>
            </Repeat>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            <TilePoints task={task} interactive={interactive} />
            <TileDue task={task} interactive={interactive} />
            <TileAssignee task={task} interactive={interactive} />
          </span>
        </div>
      </div>
    </div>
  );
}
