"use client";

import { useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { setTheme } from "@/app/(app)/actions";

export type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Day page", icon: Sun },
  { value: "dark", label: "Night page", icon: Moon },
  { value: "system", label: "Follow system", icon: Monitor },
];

/** Day / night / system. `tone` picks the ink set: on the yellow cover or on a page. */
export function ThemeSwitch({ theme, tone, showLabels = false }: { theme: Theme; tone: "cover" | "page"; showLabels?: boolean }) {
  const [pending, startTransition] = useTransition();
  const frame = tone === "cover" ? "border-cover-ink/40" : "border-rule-strong";
  const on = tone === "cover" ? "bg-cover-ink text-cover" : "bg-ink text-page";
  const off = tone === "cover" ? "text-cover-pencil hover:bg-cover-deep" : "text-pencil hover:bg-page-sunk hover:text-ink";

  return (
    <div role="group" aria-label="Theme" className={`flex border ${frame}`}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          title={label}
          disabled={pending}
          onClick={() => startTransition(() => setTheme(value))}
          className={`flex flex-1 items-center justify-center gap-2 py-1.5 ${theme === value ? on : off}`}
        >
          <Icon size={14} strokeWidth={1.7} aria-hidden />
          <span className={showLabels ? "stamp text-[12px]" : "sr-only"}>{label}</span>
        </button>
      ))}
    </div>
  );
}
