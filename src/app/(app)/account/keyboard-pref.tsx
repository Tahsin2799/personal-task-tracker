"use client";

import { useOptimistic, useTransition } from "react";
import { setSingleKeyShortcuts } from "../actions";

/** WCAG 2.1.4: single-character shortcuts can be turned off (speech input, screen-reader focus mode). */
export function KeyboardPref({ on }: { on: boolean }) {
  const [enabled, setEnabled] = useOptimistic(on);
  const [, start] = useTransition();

  return (
    <div className="pt-3">
      <label className="flex cursor-pointer items-start gap-3 border-b border-rule py-2.5">
        <input
          type="checkbox"
          className="check mt-0.5"
          checked={enabled}
          onChange={(e) => {
            const next = e.target.checked;
            start(async () => {
              setEnabled(next);
              await setSingleKeyShortcuts(next);
            });
          }}
        />
        <span>
          <span className="block text-[15px]">Single-key shortcuts</span>
          <span className="block text-[13px] leading-snug text-pencil">
            Letters and numbers act on the page: j and k to move, x to finish, 1–9 for workspaces. Turn them off if you use
            speech input or a screen reader&apos;s focus mode. ⌘K / Ctrl K always works.
          </span>
        </span>
      </label>
    </div>
  );
}
