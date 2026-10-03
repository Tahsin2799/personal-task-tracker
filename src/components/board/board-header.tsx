"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { useBoard } from "./board-context";

/** The board's page header plus its view tabs, cut like index tabs standing on the double rule. */
export function BoardHeader() {
  const board = useBoard();
  const pathname = usePathname();
  const base = `/b/${board.id}`;
  const active = board.sprints.find((s) => s.status === "active");
  const work = board.tasks.filter((t) => t.type !== "epic" && t.type !== "subtask");

  const tabs = [
    { href: base, label: "Board" },
    { href: `${base}/table`, label: "Table" },
    { href: `${base}/calendar`, label: "Calendar" },
    { href: `${base}/backlog`, label: "Backlog" },
    { href: `${base}/epics`, label: "Epics" },
    { href: `${base}/reports`, label: "Reports" },
    { href: `${base}/activity`, label: "Activity" },
    { href: `${base}/settings`, label: "Settings" },
  ];

  return (
    <>
      <PageHeader
        crumb={{ href: `/w/${board.workspace.id}`, label: board.workspace.is_personal ? "Personal" : board.workspace.name }}
        title={board.name}
        fields={[
          { label: "Key", value: board.key },
          { label: "Open", value: work.filter((t) => !t.completed_at).length },
          ...(active ? [{ label: "Sprint", value: active.name }] : []),
        ]}
      />
      <nav aria-label="Board views" className="-mt-px flex gap-1 overflow-x-auto border-b border-rule-strong px-4 pt-2 md:px-8">
        {tabs.map((tab) => {
          const current = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              // Views render from the board already on the page, so prefetching one in full is cheap.
              prefetch
              aria-current={current ? "page" : undefined}
              className={`stamp -mb-px shrink-0 border border-b-0 px-3.5 py-1.5 text-[13px] ${
                current
                  ? "border-rule-strong bg-page text-ink"
                  : "border-transparent text-pencil hover:border-rule hover:bg-page-sunk hover:text-ink"
              }`}
              style={current ? { borderBottom: "1px solid var(--page)" } : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
