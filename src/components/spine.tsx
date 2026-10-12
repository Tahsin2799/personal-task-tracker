"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Flag, LogOut, Plus, Settings2, X } from "lucide-react";
import { createWorkspace } from "@/app/(app)/actions";
import { signOut } from "@/app/(auth)/actions";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { ThemeSwitch, type Theme } from "@/components/theme-switch";
import { CommandPalette } from "@/components/command-palette";
import { initials } from "@/lib/format";
import { singleKeysAllowed } from "@/lib/shortcuts";
import type { Section } from "@/lib/queries";

export function Spine({
  sections,
  boardSection,
  viewerName,
  theme,
  openCount,
  unread,
  accountRole,
  milestones,
}: {
  sections: Section[];
  boardSection: Record<string, string>;
  viewerName: string;
  theme: Theme;
  openCount: number;
  unread: number;
  accountRole: "admin" | "owner" | "user";
  milestones: { id: string; href: string; key: string; title: string; when: string; late: boolean }[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  const activeSectionId =
    pathname.match(/^\/w\/([^/]+)/)?.[1] ?? boardSection[pathname.match(/^\/b\/([^/]+)/)?.[1] ?? ""] ?? null;
  const onIndex = pathname === "/";

  // 0 opens the index, 1–9 pull the matching section tab, a the admin page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!singleKeysAllowed(e)) return;
      if (e.key === "0") router.push("/");
      else if (e.key === "a" && accountRole === "admin") router.push("/admin");
      const n = Number(e.key);
      if (n >= 1 && n <= sections.length) router.push(`/w/${sections[n - 1].id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, sections, accountRole]);

  return (
    <aside className="relative z-10 flex flex-col bg-cover text-cover-ink md:sticky md:top-0 md:h-dvh">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 md:px-5 md:pt-5">
        <Link href="/" className="flex items-center gap-3 rounded-[2px]" aria-label="Bird-Watcher, My Work">
          <Image
            src="/brand/munia-mark.jpg"
            alt=""
            width={40}
            height={40}
            priority
            className="size-10 border border-cover-ink object-cover"
          />
          <span className="font-stamp text-[22px] font-bold uppercase leading-none tracking-[0.04em]">
            Bird-Watcher
          </span>
        </Link>
        {/* Below md the spine is a band: account, theme and sign-out live on the account page. */}
        <Link
          href="/account"
          aria-label="Account, theme and sign out"
          className="ml-auto flex size-9 items-center justify-center rounded-[2px] border border-cover-ink/40 bg-cover-deep text-[12.5px] font-semibold tracking-[0.02em] md:hidden"
        >
          {initials(viewerName)}
        </Link>
      </div>

      <div className="px-4 pb-3 md:px-5">
        <CommandPalette sections={sections} />
      </div>

      <nav aria-label="Workspaces" className="flex min-h-0 flex-1 flex-col">
        {/* Scrolls when there are many workspaces; reaches 1px past the spine so the active tab still meets the page.
            On phones the band scrolls sideways and fades at the right edge to say so. */}
        <div
          className="flex gap-1 overflow-x-auto px-4 pb-0 [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] md:-mr-px md:block md:min-h-0 md:space-y-0.5 md:overflow-x-hidden md:overflow-y-auto md:px-0 md:pb-2 md:[mask-image:none]"
          style={{ scrollbarColor: "color-mix(in oklab, var(--cover-ink) 30%, transparent) transparent" }}
        >
          <ThumbTab href="/" active={onIndex} number={0} label="My Work" trailing={String(openCount)} />
          <ThumbTab
            href="/inbox"
            active={pathname === "/inbox"}
            number="i"
            label="Inbox"
            trailing={unread ? String(unread) : ""}
            trailingLabel={`${unread} unread`}
            attention={unread > 0}
          />
          {accountRole === "admin" && <ThumbTab href="/admin" active={pathname === "/admin"} number="a" label="Admin" />}
          <p className="stamp hidden px-5 pt-6 pb-2 text-[11px] text-cover-pencil md:block">Workspaces</p>
          <ul className="contents md:block md:space-y-0.5">
            {sections.map((s, i) => (
              <li key={s.id} className="contents md:block">
                <ThumbTab
                  href={`/w/${s.id}`}
                  active={s.id === activeSectionId}
                  number={i + 1}
                  label={s.isPersonal ? "Personal" : s.name}
                  written
                />
                {s.id === activeSectionId && (
                  <ul className="relative z-10 hidden border-l border-rule-strong bg-page pt-1 pb-2 text-ink md:ml-5 md:block">
                    {s.boards.map((b) => {
                      const current = pathname === `/b/${b.id}`;
                      return (
                        <li key={b.id}>
                          <Link
                            href={`/b/${b.id}`}
                            prefetch
                            aria-current={current ? "page" : undefined}
                            className={`flex items-baseline gap-2 py-1 pr-3 pl-4 text-[14px] hover:bg-page-sunk ${
                              current ? "font-semibold" : ""
                            }`}
                          >
                            <span className="font-mono flex w-11 shrink-0 items-center gap-1.5 text-[12px] text-pencil">
                              <span
                                className="size-2 shrink-0"
                                style={{ background: b.color ? `var(--${b.color.replace("ink", "ink-epic")})` : "transparent" }}
                                aria-hidden
                              />
                              {b.key}
                            </span>
                            <span className="truncate">{b.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                    <li>
                      <Link
                        href={`/w/${s.id}/settings`}
                        className="flex items-center gap-2 py-1 pr-3 pl-4 text-[13px] text-pencil hover:bg-page-sunk hover:text-ink"
                      >
                        <Settings2 size={13} strokeWidth={1.6} aria-hidden />
                        {s.isPersonal ? "Workspace settings" : "Members & settings"}
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
        {accountRole !== "user" && <NewSection />}
        {milestones.length > 0 && (
          // The cover's lower half carries what's coming: every workspace's milestones, a month ahead.
          <section aria-labelledby="milestones-heading" className="mx-5 mt-6 hidden shrink-0 border-t border-cover-ink/20 pt-3 md:block">
            {/* A caption, not a heading: the page's own title should be the first heading read. */}
            <p id="milestones-heading" className="stamp text-[11px] text-cover-pencil">
              Milestones · 30 days
            </p>
            <ul className="mt-1.5">
              {milestones.map((m) => (
                <li key={m.id}>
                  <Link
                    href={m.href}
                    title={`${m.key} ${m.title}`}
                    className="-mx-1.5 flex items-start gap-2 rounded-[2px] px-1.5 py-1 text-[13px] leading-snug hover:bg-cover-deep/70"
                  >
                    <Flag size={11} strokeWidth={2} className="mt-[3px] shrink-0" aria-hidden />
                    <span className="line-clamp-2 min-w-0 flex-1">{m.title}</span>
                    <span className={`tnum shrink-0 text-[12px] ${m.late ? "font-semibold text-cover-ink" : "text-cover-pencil"}`}>
                      {m.when}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </nav>

      <div className="hidden border-t border-cover-ink/25 px-5 py-3 md:block">
        <div className="flex items-center justify-between gap-2">
          <Link href="/account" className="truncate text-[14px] font-medium hover:underline">
            {viewerName}
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn btn-quiet min-h-8 px-2 text-cover-ink hover:bg-cover-deep hover:text-cover-ink" aria-label="Sign out" title="Sign out">
              <LogOut size={15} strokeWidth={1.6} aria-hidden />
            </button>
          </form>
        </div>
        <div className="mt-2">
          <ThemeSwitch theme={theme} tone="cover" />
        </div>
      </div>
    </aside>
  );
}

function ThumbTab({
  href,
  active,
  number,
  label,
  trailing,
  trailingLabel,
  attention = false,
  written = false,
}: {
  href: string;
  active: boolean;
  number: number | string;
  label: string;
  /** Only what's waiting for you (open entries, unread), so the number always means one thing. */
  trailing?: string;
  /** A name someone typed (a workspace): written in Barlow, sentence case, not stamped. */
  written?: boolean;
  trailingLabel?: string;
  attention?: boolean;
}) {
  return (
    <Link
      href={href}
      // The spine is always on screen and short: load each page in full ahead of the click.
      prefetch
      aria-current={active ? "page" : undefined}
      className={`group flex shrink-0 items-center gap-3 border border-b-0 px-3 py-2 transition-[background-color,border-color] duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:ml-5 md:border-r-0 md:border-b md:py-2 md:pl-3 ${
        active
          ? "relative z-10 border-rule-strong bg-page text-ink"
          : "border-transparent hover:bg-cover-deep/70 md:mr-px"
      }`}
    >
      {/* Index numbers are keyboard shortcuts: shown where there's a keyboard. */}
      <span className={`tnum hidden w-3 shrink-0 text-right text-[12px] md:inline-block ${active ? "text-pencil" : "text-cover-pencil"}`} aria-hidden>
        {number}
      </span>
      <span
        className={`truncate leading-tight ${
          written ? "text-[16px] font-semibold" : "font-stamp text-[17px] font-semibold uppercase tracking-[0.03em]"
        }`}
      >
        {label}
      </span>
      {trailing && (
        <span
          className={`tnum ml-auto text-[11px] ${active ? (attention ? "font-semibold text-ink" : "text-pencil") : attention ? "font-semibold text-cover-ink" : "text-cover-pencil"}`}
        >
          <span aria-hidden>{trailing}</span>
          <span className="sr-only">{trailingLabel ?? `${trailing} open`}</span>
        </span>
      )}
    </Link>
  );
}

function NewSection() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createWorkspace, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <div className="hidden px-5 pt-1 md:block">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 py-1 text-[14px] text-cover-pencil hover:text-cover-ink"
        >
          <Plus size={14} strokeWidth={1.8} aria-hidden />
          New team workspace
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-5 mt-1 hidden space-y-2 md:block">
      <label htmlFor="new-section" className="stamp block text-[11px] text-cover-pencil">
        Team workspace name
      </label>
      <input
        ref={inputRef}
        id="new-section"
        name="name"
        required
        maxLength={80}
        placeholder="e.g. Field Lab"
        defaultValue={state?.values?.name}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="field border-cover-ink/60 text-cover-ink placeholder:text-cover-pencil hover:bg-cover-deep/50 focus:bg-cover-deep/50"
      />
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Creating…" variant="plain" className="border-cover-ink text-cover-ink hover:bg-cover-deep">
          Create
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-quiet px-2 text-cover-pencil hover:bg-cover-deep hover:text-cover-ink"
          aria-label="Cancel"
        >
          <X size={15} strokeWidth={1.6} aria-hidden />
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
