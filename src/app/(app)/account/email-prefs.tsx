"use client";

import { useOptimistic, useTransition } from "react";
import { updateEmailPrefs } from "../actions";

type Prefs = { email_notifications: boolean; email_due_reminders: boolean };

export function EmailPrefs({ email, timeZone, notifications, reminders }: { email: string; timeZone: string; notifications: boolean; reminders: boolean }) {
  const [prefs, setPrefs] = useOptimistic<Prefs, Partial<Prefs>>({ email_notifications: notifications, email_due_reminders: reminders }, (p, change) => ({ ...p, ...change }));
  const [, startTransition] = useTransition();

  function toggle(change: Partial<Prefs>) {
    startTransition(async () => {
      setPrefs(change);
      await updateEmailPrefs(change);
    });
  }

  return (
    <div className="pt-3">
      <label className="flex cursor-pointer items-start gap-3 border-b border-rule py-2.5">
        <input type="checkbox" className="check mt-0.5" checked={prefs.email_notifications} onChange={(e) => toggle({ email_notifications: e.target.checked })} />
        <span>
          <span className="block text-[15px]">Inbox by email</span>
          <span className="block text-[13px] leading-snug text-pencil">Assignments, mentions and comments you haven&apos;t read in the app after a few minutes, batched into one email.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 border-b border-rule py-2.5">
        <input type="checkbox" className="check mt-0.5" checked={prefs.email_due_reminders} onChange={(e) => toggle({ email_due_reminders: e.target.checked })} />
        <span>
          <span className="block text-[15px]">Morning due-date reminder</span>
          <span className="block text-[13px] leading-snug text-pencil">Around 07:00 your time: your entries that are overdue, due today or due tomorrow. Skipped when there are none.</span>
        </span>
      </label>
      <p className="mt-2 text-[13px] leading-snug text-pencil">
        Sent to <span className="text-ink">{email}</span> · your time zone is <span className="font-mono text-[12px]">{timeZone}</span>, taken from this browser.
      </p>
    </div>
  );
}
