"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Columns3, Inbox, LayoutList, Monitor, Moon, Search, Sun, User } from "lucide-react";
import { TypeGlyph } from "@/components/marks";
import { taskKey } from "@/lib/format";
import type { Section } from "@/lib/queries";
import { searchEntries } from "@/app/(app)/search-actions";
import { setTheme } from "@/app/(app)/actions";

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
};

type Hit = Awaited<ReturnType<typeof searchEntries>>[number];

function isTyping(target: EventTarget | null) {
  return Boolean((target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']"));
}

/** ⌘K: jump anywhere, find any entry. "?" lists the keyboard shortcuts. */
export function CommandPalette({ sections }: { sections: Section[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [, startSearch] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const openPalette = useCallback(() => {
    setQuery("");
    setHits([]);
    setActive(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector("[role=dialog][aria-modal=true]")) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      } else if (e.key === "/") {
        const filter = document.getElementById("filter-q");
        e.preventDefault();
        if (filter) filter.focus();
        else openPalette();
      } else if (e.key === "c") {
        const add = document.querySelector<HTMLInputElement>("input[id^='add-']");
        if (add) {
          e.preventDefault();
          add.focus();
        }
      } else if (e.key === "i") {
        router.push("/inbox");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, open, openPalette]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const t = setTimeout(() => startSearch(async () => setHits(await searchEntries(query))), 140);
    return () => clearTimeout(t);
  }, [query, open]);

  const go = (href: string) => () => {
    setOpen(false);
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    const pages: Item[] = [
      { id: "my-work", group: "Go to", label: "My Work", hint: "0", icon: <LayoutList size={15} strokeWidth={1.6} />, run: go("/") },
      { id: "inbox", group: "Go to", label: "Inbox", hint: "i", icon: <Inbox size={15} strokeWidth={1.6} />, run: go("/inbox") },
      { id: "account", group: "Go to", label: "Account", icon: <User size={15} strokeWidth={1.6} />, run: go("/account") },
    ].filter((i) => match(i.label));
    const places: Item[] = sections.flatMap((s, n) => [
      ...(match(s.isPersonal ? "Personal" : s.name)
        ? [{ id: `w-${s.id}`, group: "Workspaces", label: s.isPersonal ? "Personal" : s.name, hint: String(n + 1), icon: <Columns3 size={15} strokeWidth={1.6} />, run: go(`/w/${s.id}`) }]
        : []),
      ...s.boards
        .filter((b) => match(`${b.name} ${b.key}`))
        .map((b) => ({
          id: `b-${b.id}`,
          group: "Boards",
          label: b.name,
          hint: b.key,
          icon: <span className="font-mono w-[15px] text-[11px]">{b.key.slice(0, 2)}</span>,
          run: go(`/b/${b.id}`),
        })),
    ]);
    const entries: Item[] =
      q.length >= 2
        ? hits.map((h) => ({
            id: `t-${h.id}`,
            group: "Entries",
            label: h.title,
            hint: taskKey(h.board_key, h.number),
            icon: <TypeGlyph type={h.type} />,
            run: go(`/b/${h.board_id}?task=${h.id}`),
          }))
        : [];
    const themes: Item[] = [
      { id: "day", group: "Page", label: "Day page", icon: <Sun size={15} strokeWidth={1.6} />, run: () => { setOpen(false); void setTheme("light"); } },
      { id: "night", group: "Page", label: "Night page", icon: <Moon size={15} strokeWidth={1.6} />, run: () => { setOpen(false); void setTheme("dark"); } },
      { id: "system", group: "Page", label: "Follow system theme", icon: <Monitor size={15} strokeWidth={1.6} />, run: () => { setOpen(false); void setTheme("system"); } },
    ].filter((i) => match(i.label));
    return [...entries, ...pages, ...places, ...themes];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go() is stable in effect
  }, [query, hits, sections]);

  const groups = items.reduce<Record<string, Item[]>>((acc, i) => ((acc[i.group] ??= []).push(i), acc), {});
  const flat = Object.values(groups).flat();

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="flex w-full items-center gap-2 border border-cover-ink/40 px-2.5 py-1.5 text-left text-[13px] text-cover-pencil hover:bg-cover-deep hover:text-cover-ink"
      >
        <Search size={14} strokeWidth={1.7} aria-hidden />
        Search
        <kbd className="font-mono ml-auto text-[11px]">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search and jump"
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-[620px] border-2 border-ink bg-page text-ink"
          >
            <div className="flex items-center gap-3 border-b-[3px] border-double border-rule-strong px-4">
              <Search size={17} strokeWidth={1.7} className="text-pencil" aria-hidden />
              <input
                ref={input}
                value={query}
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={flat[active] ? `pal-${flat[active].id}` : undefined}
                placeholder="Find an entry, board or page…"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, flat.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    flat[active]?.run();
                  }
                }}
                className="min-h-12 flex-1 bg-transparent text-[17px] placeholder:text-pencil focus:outline-none"
              />
              <kbd className="font-mono text-[11px] text-pencil">ESC</kbd>
            </div>
            <ul id="palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto py-1">
              {flat.length === 0 && <li className="px-4 py-3 text-[14px] text-pencil">Nothing matches “{query}”.</li>}
              {Object.entries(groups).map(([group, list]) => (
                <li key={group} role="presentation">
                  <p className="stamp px-4 pt-2 pb-1 text-[11px] text-pencil">{group}</p>
                  <ul role="presentation">
                    {list.map((item) => {
                      const index = flat.indexOf(item);
                      return (
                        <li
                          key={item.id}
                          id={`pal-${item.id}`}
                          role="option"
                          aria-selected={index === active}
                          onMouseEnter={() => setActive(index)}
                          onClick={item.run}
                          className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-[15px] ${index === active ? "bg-page-sunk" : ""}`}
                        >
                          <span className="flex w-[15px] justify-center text-pencil" aria-hidden>
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.hint && <span className="font-mono text-[12px] text-pencil">{item.hint}</span>}
                          {index === active && <ArrowRight size={14} strokeWidth={1.7} className="text-pencil" aria-hidden />}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="border-t border-rule px-4 py-2 text-[12px] text-pencil">
              ↑↓ to move · ↵ to open · <kbd className="font-mono">?</kbd> for all shortcuts
            </p>
          </div>
        </div>
      )}

      {help && <ShortcutSheet onClose={() => setHelp(false)} />}
    </>
  );
}

const SHORTCUTS: [string, string][] = [
  ["⌘K / Ctrl K", "Search entries, boards and pages"],
  ["0", "My Work"],
  ["1 – 9", "Workspace by its tab number"],
  ["i", "Inbox"],
  ["c", "Create an entry (on a board)"],
  ["/", "Filter the board, or open search"],
  ["Esc", "Close the open entry or dialog"],
  ["⌘↵", "Send a comment"],
  ["?", "This sheet"],
];

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-4 pt-[14vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-[460px] border-2 border-ink bg-page">
        <h2 id="shortcuts-title" className="stamp rule-double px-5 pt-4 pb-2 text-[17px]">
          Keyboard shortcuts
        </h2>
        <dl className="px-5 py-2">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex min-h-[37px] items-center gap-4 border-b border-rule last:border-0">
              <dt className="w-28">
                <kbd className="font-mono border border-rule-strong px-1.5 py-0.5 text-[12px]">{k}</kbd>
              </dt>
              <dd className="text-[14px]">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="px-5 pb-4">
          <button type="button" onClick={onClose} className="btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
