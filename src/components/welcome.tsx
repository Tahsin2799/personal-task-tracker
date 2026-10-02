"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { finishOnboarding } from "@/app/(app)/search-actions";

/** First-run checklist for a new account; ticks itself off as the person explores. */
export function Welcome({
  personalBoard,
  teamId,
  steps,
}: {
  personalBoard: string | null;
  teamId: string | null;
  steps: { entry: boolean; team: boolean; teammate: boolean };
}) {
  const [pending, start] = useTransition();
  const items = [
    {
      done: steps.entry,
      title: "Write your first entry",
      body: "Open your private My Tasks board and type into “+ Create entry”.",
      href: personalBoard ? `/b/${personalBoard}` : null,
      cta: "Open My Tasks",
    },
    {
      done: steps.team,
      title: "Start a team workspace",
      body: "Shared boards for a lab, a project or a side business. Use “New team workspace” in the spine.",
      href: "/account",
      cta: "Create one",
    },
    {
      done: steps.teammate,
      title: "Invite someone",
      body: "Up to five people in total. They get an email to set a password.",
      href: teamId ? `/w/${teamId}/settings` : null,
      cta: "Invite",
    },
  ];
  const left = items.filter((i) => !i.done).length;
  const dismiss = (
    <button type="button" disabled={pending} onClick={() => start(() => finishOnboarding())} className="btn btn-quiet ml-auto min-h-8">
      {left === 0 ? "Done" : "Dismiss"}
    </button>
  );

  // Everything ticked: one ruled line, so today's work stays at the top of the page.
  if (left === 0) {
    return (
      <section aria-label="Welcome" className="flex items-center gap-3 border-b border-rule bg-page-sunk px-4 py-2 md:px-8">
        <Check size={14} strokeWidth={2.5} className="text-done" aria-hidden />
        <p className="text-[14px]">Your field book is set up. Press ⌘K any time to find anything.</p>
        {dismiss}
      </section>
    );
  }

  return (
    <section aria-labelledby="welcome-heading" className="border-b border-rule-strong bg-page-sunk">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 pt-4 pb-2 md:px-8">
        <h2 id="welcome-heading" className="stamp text-[17px]">
          Welcome to your field book
        </h2>
        <p className="text-[14px] text-pencil">
          {left} thing{left === 1 ? "" : "s"} to try. Press ⌘K any time to find anything.
        </p>
        {dismiss}
      </div>
      <ol>
        {items.map((item, i) => (
          <li key={item.title} className="flex min-h-[41px] flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule px-4 py-2 md:px-8">
            <span
              className={`font-mono flex size-5 shrink-0 items-center justify-center border text-[11px] ${
                item.done ? "border-done bg-done text-page" : "border-ink"
              }`}
            >
              {item.done ? <Check size={12} strokeWidth={3} aria-label="Done" /> : i + 1}
            </span>
            <span className={`text-[15px] font-semibold ${item.done ? "text-pencil line-through" : ""}`}>{item.title}</span>
            <span className="min-w-0 flex-1 basis-[240px] text-[14px] text-pencil">{item.body}</span>
            {!item.done && item.href && (
              <Link href={item.href} className="btn min-h-8">
                {item.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
