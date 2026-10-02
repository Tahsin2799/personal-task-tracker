"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Download, FileText, ImageIcon, Paperclip, Star, Trash2 } from "lucide-react";
import { describeActivity } from "@/lib/activity-words";
import { initials, shortDate } from "@/lib/format";
import type { BoardTask } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { updateTask } from "@/app/(app)/b/[boardId]/actions";
import {
  addComment,
  deleteAttachment,
  deleteComment,
  editComment,
  getTaskFeed,
  registerAttachment,
  type FeedActivity,
  type FeedAttachment,
  type TaskFeed,
} from "@/app/(app)/b/[boardId]/feed-actions";
import { useBoard } from "./board-context";

/** Loads an entry's comments, history and files, and reloads when the board says they changed. */
export function useTaskFeed(taskId: string) {
  const [feed, setFeed] = useState<TaskFeed | null>(null);
  const reload = useCallback(() => {
    void getTaskFeed(taskId).then(setFeed);
  }, [taskId]);

  useEffect(() => {
    let live = true;
    void getTaskFeed(taskId).then((f) => live && setFeed(f));
    const onChange = (e: Event) => {
      const table = (e as CustomEvent<{ table: string }>).detail?.table;
      if (["comments", "activity", "attachments", "tasks"].includes(table)) reload();
    };
    window.addEventListener("board:changed", onChange);
    return () => {
      live = false;
      window.removeEventListener("board:changed", onChange);
    };
  }, [taskId, reload]);

  return { feed, reload };
}

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return shortDate(iso.slice(0, 10));
}

const MENTION = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

/** Comment text with @mentions printed as names and links made clickable. */
function CommentBody({ body }: { body: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION)) {
    parts.push(body.slice(last, m.index));
    parts.push(
      <span key={m.index} className="font-semibold">
        @{m[1]}
      </span>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(body.slice(last));
  return <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</p>;
}

/* ---------------------------------------------------------------- comments + history */

export function DrawerConversation({ task, feed, reload }: { task: BoardTask; feed: TaskFeed | null; reload: () => void }) {
  const [tab, setTab] = useState<"comments" | "history">("comments");
  const count = feed?.comments.length ?? 0;
  return (
    <section className="px-5 pt-6" aria-label="Conversation">
      <div role="tablist" aria-label="Conversation" className="flex gap-1 border-b border-rule-strong">
        {(["comments", "history"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`stamp -mb-px border border-b-0 px-3 py-1.5 text-[12px] ${
              tab === t ? "border-rule-strong bg-page text-ink" : "border-transparent text-pencil hover:text-ink"
            }`}
            style={tab === t ? { borderBottom: "1px solid var(--page)" } : undefined}
          >
            {t === "comments" ? `Comments${count ? ` ${count}` : ""}` : "History"}
          </button>
        ))}
      </div>
      {tab === "comments" ? <Comments task={task} feed={feed} reload={reload} /> : <History items={feed?.activity ?? null} />}
    </section>
  );
}

function Comments({ task, feed, reload }: { task: BoardTask; feed: TaskFeed | null; reload: () => void }) {
  const board = useBoard();
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();

  if (!feed) return <p className="py-4 text-[14px] text-pencil">Loading…</p>;

  return (
    <div>
      <ol className="divide-y divide-rule">
        {feed.comments.map((c) => (
          <li key={c.id} className="flex gap-3 py-3">
            <span aria-hidden className="font-mono flex size-7 shrink-0 items-center justify-center border border-pencil text-[11px] font-semibold">
              {initials(c.author.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px]">
                <span className="font-semibold">{c.author.name}</span>{" "}
                <span className="text-pencil">
                  {when(c.created_at)}
                  {c.edited_at && " · edited"}
                </span>
              </p>
              {editing === c.id ? (
                <Composer
                  initial={c.body}
                  submitLabel="Save"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (body) => {
                    const r = await board.run(null, () => editComment(board.id, c.id, body));
                    if (!r?.error) {
                      setEditing(null);
                      reload();
                    }
                    return !r?.error;
                  }}
                />
              ) : (
                <CommentBody body={c.body} />
              )}
              {c.author.id === board.viewerId && editing !== c.id && (
                <div className="mt-1 flex gap-3 text-[12px] text-pencil">
                  <button type="button" className="hover:text-ink hover:underline" onClick={() => setEditing(c.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="hover:text-attention hover:underline"
                    onClick={() => start(async () => {
                      await board.run(null, () => deleteComment(board.id, c.id));
                      reload();
                    })}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {feed.comments.length === 0 && <p className="py-3 text-[14px] text-pencil">No comments yet. Type @ to mention someone.</p>}
      <Composer
        submitLabel="Comment"
        onSubmit={async (body) => {
          const r = await board.run(null, () => addComment(board.id, task.id, body));
          if (!r?.error) reload();
          return !r?.error;
        }}
      />
    </div>
  );
}

/** Comment box with @mention suggestions drawn from the workspace's members. */
function Composer({
  initial = "",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const board = useBoard();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const matches = query == null ? [] : board.members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);

  function detect() {
    const el = ref.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const m = before.match(/(?:^|\s)@([\p{L}\p{N} ]{0,20})$/u);
    setQuery(m && !m[1].includes("  ") ? m[1] : null);
    setActive(0);
  }

  function pick(member: { id: string; name: string }) {
    const el = ref.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const after = el.value.slice(el.selectionStart);
    const start = before.lastIndexOf("@");
    const token = `@[${member.name}](${member.id}) `;
    el.value = before.slice(0, start) + token + after;
    const caret = start + token.length;
    el.setSelectionRange(caret, caret);
    el.focus();
    setQuery(null);
  }

  async function submit() {
    const body = ref.current?.value ?? "";
    if (!body.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit(body);
    setBusy(false);
    if (ok && ref.current && !onCancel) ref.current.value = "";
  }

  return (
    <div className="relative pt-2">
      <label htmlFor={onCancel ? undefined : "new-comment"} className="sr-only">
        Comment
      </label>
      <textarea
        id={onCancel ? undefined : "new-comment"}
        ref={ref}
        defaultValue={initial}
        rows={2}
        placeholder={onCancel ? undefined : "Write a comment… (@ to mention, ⌘↵ to send)"}
        onInput={detect}
        onClick={detect}
        onKeyDown={(e) => {
          if (matches.length && query != null) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(matches[active]);
              return;
            }
            if (e.key === "Escape") {
              e.stopPropagation();
              setQuery(null);
              return;
            }
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape" && onCancel) {
            e.stopPropagation();
            onCancel();
          }
        }}
        className="w-full resize-y border border-rule-mid bg-page px-3 py-2 text-[15px] [field-sizing:content] placeholder:text-pencil focus:border-ink focus:outline-none"
      />
      {query != null && matches.length > 0 && (
        <ul role="listbox" aria-label="Mention someone" className="absolute left-0 z-10 mt-1 w-64 border border-ink bg-page py-1">
          {matches.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[14px] ${i === active ? "bg-page-sunk" : ""}`}
              >
                <span className="font-mono flex size-6 items-center justify-center border border-pencil text-[11px] font-semibold">{initials(m.name)}</span>
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => void submit()} disabled={busy} className="btn btn-primary min-h-8">
          {busy ? "Sending…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-quiet min-h-8">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}


function History({ items }: { items: FeedActivity[] | null }) {
  if (!items) return <p className="py-4 text-[14px] text-pencil">Loading…</p>;
  if (items.length === 0) return <p className="py-3 text-[14px] text-pencil">No changes recorded yet. Edits made from now on are listed here.</p>;
  return (
    <ol className="divide-y divide-rule">
      {items.map((a) => (
        <li key={a.id} className="flex items-baseline gap-3 py-2 text-[14px]">
          <span className="font-mono w-16 shrink-0 text-[12px] text-pencil">{when(a.created_at)}</span>
          <span>
            <span className="font-semibold">{a.actor ?? "Someone"}</span> {describeActivity(a.kind, a.data).verb} it {describeActivity(a.kind, a.data).rest}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------------- attachments */

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DrawerAttachments({ task, files, reload }: { task: BoardTask; files: FeedAttachment[] | null; reload: () => void }) {
  const board = useBoard();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const supabase = createClient();
    for (const file of Array.from(list)) {
      if (file.size > 50 * 1024 * 1024) {
        board.setNote(`${file.name} is over the 50 MB limit.`);
        continue;
      }
      setUploading(file.name);
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
      const path = `${board.id}/${task.id}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type || undefined });
      if (error) {
        board.setNote(`Couldn't upload ${file.name}: ${error.message}`);
        continue;
      }
      await board.run(null, () =>
        registerAttachment(board.id, task.id, { name: file.name, path, size: file.size, mime: file.type || null }),
      );
    }
    setUploading(null);
    if (input.current) input.current.value = "";
    reload();
  }

  return (
    <section
      className="px-5 pt-6"
      aria-labelledby="files-heading"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void upload(e.dataTransfer.files);
      }}
    >
      <div className="flex items-baseline justify-between">
        <h3 id="files-heading" className="field-label">
          Files {files && files.length > 0 && <span className="font-mono">{files.length}</span>}
        </h3>
        <button type="button" onClick={() => input.current?.click()} className="btn btn-quiet min-h-7 px-2 text-[12px]">
          <Paperclip size={13} strokeWidth={1.7} aria-hidden />
          Attach
        </button>
        <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} onChange={(e) => void upload(e.target.files)} />
      </div>
      <ul className="border-t border-rule">
        {(files ?? []).map((f) => {
          const image = f.mime?.startsWith("image/");
          const isCover = task.cover_attachment_id === f.id;
          return (
            <li key={f.id} className="flex min-h-[41px] items-center gap-3 border-b border-rule text-[14px]">
              {image && f.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                <img src={f.url} alt="" className="size-8 shrink-0 border border-rule-mid object-cover" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center border border-rule-mid text-pencil">
                  {image ? <ImageIcon size={15} strokeWidth={1.6} aria-hidden /> : <FileText size={15} strokeWidth={1.6} aria-hidden />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{f.name}</span>
                <span className="font-mono block text-[11px] text-pencil">
                  {bytes(f.size)} · {f.uploader ?? "someone"} · {shortDate(f.created_at.slice(0, 10))}
                </span>
              </span>
              {image && (
                <button
                  type="button"
                  aria-pressed={isCover}
                  title={isCover ? "Remove as card cover" : "Use as card cover"}
                  onClick={() =>
                    void board.run(
                      { type: "patch", id: task.id, patch: { cover_attachment_id: isCover ? null : f.id } },
                      () => updateTask(board.id, task.id, { cover_attachment_id: isCover ? null : f.id }),
                    )
                  }
                  className={`p-1.5 ${isCover ? "text-ink" : "text-pencil hover:text-ink"}`}
                >
                  <Star size={15} strokeWidth={1.7} fill={isCover ? "currentColor" : "none"} aria-hidden />
                  <span className="sr-only">{isCover ? "Cover" : "Make cover"}</span>
                </button>
              )}
              {f.url && (
                <a href={f.url} download={f.name} target="_blank" rel="noreferrer" className="p-1.5 text-pencil hover:text-ink" title="Download">
                  <Download size={15} strokeWidth={1.7} aria-hidden />
                  <span className="sr-only">Download {f.name}</span>
                </a>
              )}
              <button
                type="button"
                title="Delete file"
                onClick={async () => {
                  await board.run(null, () => deleteAttachment(board.id, f.id));
                  reload();
                }}
                className="p-1.5 text-pencil hover:text-attention"
              >
                <Trash2 size={15} strokeWidth={1.7} aria-hidden />
                <span className="sr-only">Delete {f.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="py-2 text-[13px] text-pencil">
        {uploading ? `Uploading ${uploading}…` : files && files.length === 0 ? "Drop datasets, figures, PDFs or notebooks here (up to 50 MB each)." : "Drop more files here to attach them."}
      </p>
    </section>
  );
}
