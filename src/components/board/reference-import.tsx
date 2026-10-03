"use client";

import { useMemo, useRef, useState } from "react";
import { importReferences } from "@/app/(app)/b/[boardId]/actions";
import { parseBibtex, referenceNotes, shortAuthors, type BibEntry } from "@/lib/bibtex";
import { useBoard } from "./board-context";
import { labelInk } from "./bits";

const DOI = /10\.\d{4,9}\/[^\s"<>]+/gi;
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Upload a .bib file, tick the references to keep, and they become entries in a column. */
export function ReferenceImport() {
  const board = useBoard();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<string | null>(null);
  const [entries, setEntries] = useState<BibEntry[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [columnId, setColumnId] = useState(board.columns.find((c) => c.category === "todo")?.id ?? board.columns[0]?.id ?? "");
  const [labelId, setLabelId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // What the board already holds, so a re-import doesn't double up.
  const known = useMemo(() => {
    const dois = new Set<string>();
    const titles = new Set<string>();
    for (const t of board.tasks) {
      titles.add(normal(t.title));
      for (const d of t.description?.match(DOI) ?? []) dois.add(d.toLowerCase());
    }
    return { dois, titles };
  }, [board.tasks]);
  const duplicate = (e: BibEntry) => (e.doi && known.dois.has(e.doi.toLowerCase())) || known.titles.has(normal(e.title));

  async function read(f: File | undefined) {
    setMessage(null);
    if (!f) return;
    const found = parseBibtex(await f.text());
    setFile(f.name);
    setEntries(found);
    setChosen(new Set(found.flatMap((e, n) => (duplicate(e) ? [] : [n]))));
    if (!found.length) setMessage({ text: "No references with a title were found in that file.", error: true });
  }

  async function add() {
    setBusy(true);
    const items = entries.filter((_, n) => chosen.has(n)).map((e) => ({ title: e.title, description: referenceNotes(e) }));
    const result = await importReferences(board.id, { columnId, labelId: labelId || null, items });
    setBusy(false);
    if (result.error) return setMessage({ text: result.error, error: true });
    setMessage({ text: `Added ${result.count} ${result.count === 1 ? "entry" : "entries"} to ${board.columns.find((c) => c.id === columnId)?.name}.` });
    setEntries([]);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const dupes = entries.filter(duplicate).length;

  return (
    <div className="pt-3">
      <p className="max-w-[60ch] text-[14px] leading-snug text-pencil">
        For reading lists: each reference in a BibTeX file (exported from Zotero, Mendeley, JabRef or Google Scholar) becomes an entry, with
        its authors, year and venue in the notes and its DOI as a reference link.
      </p>
      <label className="btn mt-3 inline-flex cursor-pointer">
        {file ? "Choose another file…" : "Choose a .bib file…"}
        <input ref={fileRef} type="file" accept=".bib,.bibtex,text/x-bibtex,text/plain" className="sr-only" onChange={(e) => void read(e.target.files?.[0])} />
      </label>

      {entries.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-rule-strong pb-1.5 text-[13px]">
            <span className="font-mono text-[12px]">{file}</span>
            <span className="text-pencil">
              {entries.length} found{dupes > 0 && ` · ${dupes} already on this board`}
            </span>
            <button
              type="button"
              className="ml-auto text-pencil underline decoration-rule-mid underline-offset-4 hover:text-ink"
              onClick={() => setChosen(chosen.size === entries.length ? new Set() : new Set(entries.map((_, n) => n)))}
            >
              {chosen.size === entries.length ? "Clear all" : "Choose all"}
            </button>
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {entries.map((e, n) => (
              <li key={`${e.key}-${n}`} className="border-b border-rule">
                <label className="flex cursor-pointer items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    className="check mt-0.5"
                    checked={chosen.has(n)}
                    onChange={(ev) => {
                      const next = new Set(chosen);
                      if (ev.target.checked) next.add(n);
                      else next.delete(n);
                      setChosen(next);
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[15px] leading-snug">{e.title}</span>
                    <span className="block text-[12px] leading-snug text-pencil">
                      {[shortAuthors(e.authors), e.year, e.venue].filter(Boolean).join(" · ")}
                      {duplicate(e) && <span className="text-attention"> · already on this board</span>}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="field-label">Column</span>
              <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className="field min-h-9 w-auto text-[14px]">
                {board.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Label</span>
              <span className="flex items-center gap-2">
                {labelId && <span className="size-2 shrink-0" style={{ background: labelInk(board.labels.find((l) => l.id === labelId)?.color ?? "") }} aria-hidden />}
                <select value={labelId} onChange={(e) => setLabelId(e.target.value)} className="field min-h-9 w-auto text-[14px]">
                  <option value="">No label</option>
                  {board.labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <button type="button" disabled={busy || chosen.size === 0} onClick={() => void add()} className="btn btn-primary">
              {busy ? "Adding…" : `Add ${chosen.size} ${chosen.size === 1 ? "entry" : "entries"}`}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className={`mt-3 text-[14px] ${message.error ? "text-attention" : "text-pencil"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
