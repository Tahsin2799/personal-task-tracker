"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusMark } from "@/components/marks";
import type { BoardLabel } from "@/lib/queries";
import { archiveBoard, createLabel, deleteLabel, updateBoard, updateLabel } from "@/app/(app)/b/[boardId]/actions";
import { useBoard } from "./board-context";
import { LABEL_INKS, labelInk } from "./bits";
import { ReferenceImport } from "./reference-import";

const CATEGORY = { todo: "To do", in_progress: "In progress", done: "Done" } as const;

export function BoardSettings() {
  const board = useBoard();
  const [confirmArchive, setConfirmArchive] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid gap-x-12 gap-y-10 px-4 py-6 md:px-8 xl:grid-cols-2">
        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Board
          </h2>
          <form
            className="space-y-4 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void board.run(null, () =>
                updateBoard(board.id, { name: String(f.get("name") ?? ""), description: String(f.get("description") ?? "") }),
              );
            }}
          >
            <div>
              <label htmlFor="board-name" className="field-label">
                Name
              </label>
              <input id="board-name" name="name" defaultValue={board.name} required maxLength={80} className="field" />
            </div>
            <div>
              <label htmlFor="board-description" className="field-label">
                Description
              </label>
              <input id="board-description" name="description" defaultValue={board.description ?? ""} placeholder="What this board tracks" className="field" />
            </div>
            <p className="text-[13px] text-pencil">
              Key <span className="font-mono text-ink">{board.key}</span> prefixes every entry ({board.key}-1, {board.key}-2…) and can&apos;t change once
              entries exist.
            </p>
            <button type="submit" className="btn">
              Save board
            </button>
          </form>
          <div className="pt-6">
            <p className="field-label" id="board-colour">
              Board colour
            </p>
            <div role="radiogroup" aria-labelledby="board-colour" className="flex items-center gap-1.5">
              <button
                type="button"
                role="radio"
                aria-checked={!board.color}
                onClick={() => void board.run(null, () => updateBoard(board.id, { color: null }))}
                className={`stamp h-7 border px-2 text-[11px] ${!board.color ? "border-ink" : "border-rule-mid text-pencil"}`}
              >
                Plain
              </button>
              {LABEL_INKS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={board.color === c}
                  aria-label={`Ink ${c.slice(4)}`}
                  onClick={() => void board.run(null, () => updateBoard(board.id, { color: c }))}
                  className={`size-7 border ${board.color === c ? "border-ink outline-2 outline-ink" : "border-transparent"}`}
                  style={{ background: labelInk(c) }}
                />
              ))}
            </div>
            <p className="mt-2 text-[13px] text-pencil">Tints the board&apos;s lanes and marks it in the spine.</p>
          </div>
        </section>

        <section aria-labelledby="labels-heading">
          <h2 id="labels-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Labels
          </h2>
          <ul>
            {board.labels.map((l) => (
              <LabelRow key={l.id} label={l} uses={board.taskLabels.filter((r) => r.label_id === l.id).length} />
            ))}
          </ul>
          <NewLabel />
        </section>

        <section aria-labelledby="columns-heading">
          <h2 id="columns-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Columns
          </h2>
          <ul>
            {board.columns.map((c) => (
              <li key={c.id} className="flex min-h-[41px] items-center gap-3 border-b border-rule text-[15px]">
                <StatusMark category={c.category} />
                <span className="flex-1">{c.name}</span>
                <span className="text-[13px] text-pencil">{CATEGORY[c.category]}</span>
                <span className="font-mono w-16 text-right text-[12px] text-pencil">{c.wip_limit != null ? `WIP ${c.wip_limit}` : ""}</span>
                <span className="font-mono w-20 text-right text-[12px] text-pencil">
                  {board.tasks.filter((t) => t.column_id === c.id).length} entries
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-pencil">
            Rename, re-categorise, set WIP limits, reorder or add columns directly on the{" "}
            <Link href={`/b/${board.id}`} className="underline hover:text-ink">
              board
            </Link>
            : click a column&apos;s name, or drag its grip.
          </p>
        </section>

        <section aria-labelledby="import-heading">
          <h2 id="import-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Import references
          </h2>
          <ReferenceImport />
        </section>

        {board.canManage && (
          <section aria-labelledby="archive-heading">
            <h2 id="archive-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
              Archive
            </h2>
            <p className="max-w-[60ch] pt-3 text-[14px] text-pencil">
              Archiving hides the board from the spine and from My Work. Its entries are kept.
            </p>
            {confirmArchive ? (
              <form action={archiveBoard.bind(null, board.id, board.workspace.id)} className="mt-3 flex gap-2">
                <button type="submit" className="btn btn-danger">
                  Archive {board.name}
                </button>
                <button type="button" onClick={() => setConfirmArchive(false)} className="btn btn-quiet">
                  Keep it
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setConfirmArchive(true)} className="btn mt-3">
                Archive board…
              </button>
            )}
          </section>
        )}
      </div>
      <div className="ruled-fill flex-1" aria-hidden />
    </div>
  );
}

function InkPicker({ value, onChange, name }: { value: string; onChange: (ink: string) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={`Ink for ${name}`} className="flex gap-1">
      {LABEL_INKS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Ink ${c.slice(4)}`}
          onClick={() => onChange(c)}
          className={`size-5 border ${value === c ? "border-ink outline-2 outline-ink" : "border-transparent"}`}
          style={{ background: labelInk(c) }}
        />
      ))}
    </div>
  );
}

function LabelRow({ label, uses }: { label: BoardLabel; uses: number }) {
  const board = useBoard();
  return (
    <li className="flex min-h-[41px] flex-wrap items-center gap-3 border-b border-rule py-1">
      <input
        aria-label={`Rename label ${label.name}`}
        defaultValue={label.name}
        maxLength={40}
        onBlur={(e) => e.target.value.trim() && e.target.value.trim().toLowerCase() !== label.name && void board.run(null, () => updateLabel(board.id, label.id, { name: e.target.value }))}
        className="field min-h-8 w-40 text-[14px]"
      />
      <InkPicker value={label.color} name={label.name} onChange={(color) => void board.run(null, () => updateLabel(board.id, label.id, { color }))} />
      <span className="font-mono ml-auto text-[12px] text-pencil">{uses} uses</span>
      <button type="button" className="btn btn-quiet min-h-8 px-2" onClick={() => void board.run(null, () => deleteLabel(board.id, label.id))}>
        Delete
      </button>
    </li>
  );
}

function NewLabel() {
  const board = useBoard();
  const [ink, setInk] = useState<string>(LABEL_INKS[0]);
  return (
    <form
      className="flex flex-wrap items-end gap-3 pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const result = await board.run(null, () => createLabel(board.id, String(new FormData(form).get("name") ?? ""), ink));
        if (!result?.error) form.reset();
      }}
    >
      <div className="w-40">
        <label htmlFor="label-name" className="field-label">
          New label
        </label>
        <input id="label-name" name="name" required maxLength={40} placeholder="e.g. reading" className="field min-h-9 text-[14px]" />
      </div>
      <InkPicker value={ink} onChange={setInk} name="the new label" />
      <button type="submit" className="btn">
        Add label
      </button>
    </form>
  );
}
