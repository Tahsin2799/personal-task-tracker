"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** The tail of a long ledger group, folded behind one ruled row until asked for. */
export function FoldRows({ count, noun, colSpan, children }: { count: number; noun: string; colSpan: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = (
    <tr data-fold className="border-t border-rule focus-within:bg-page-sunk">
      <td colSpan={colSpan} className="p-0">
        <button
          type="button"
          data-fold-toggle
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-full items-center gap-2 px-4 text-left text-[14px] text-pencil hover:bg-page-sunk hover:text-ink md:pl-[88px]"
        >
          {open ? <ChevronUp size={14} strokeWidth={1.8} aria-hidden /> : <ChevronDown size={14} strokeWidth={1.8} aria-hidden />}
          {open ? (
            "Show fewer"
          ) : (
            <span>
              <span className="tnum">{count}</span> more {noun}
            </span>
          )}
        </button>
      </td>
    </tr>
  );
  return (
    <>
      {open && children}
      {toggle}
    </>
  );
}
