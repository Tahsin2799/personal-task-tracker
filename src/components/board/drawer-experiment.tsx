"use client";

import { useRef } from "react";
import { FlaskConical, X } from "lucide-react";
import type { BoardTask } from "@/lib/queries";
import type { Json } from "@/lib/supabase/database.types";
import { updateTask } from "@/app/(app)/b/[boardId]/actions";
import { useBoard } from "./board-context";

export type Experiment = {
  hypothesis: string;
  protocol: { text: string; done: boolean }[];
  results: string;
  outcome: "supported" | "refuted" | "inconclusive" | null;
};

export function readExperiment(value: Json | null): Experiment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return {
    hypothesis: typeof v.hypothesis === "string" ? v.hypothesis : "",
    protocol: Array.isArray(v.protocol)
      ? v.protocol.flatMap((s) =>
          s && typeof s === "object" && "text" in s ? [{ text: String((s as { text: unknown }).text), done: Boolean((s as { done?: unknown }).done) }] : [],
        )
      : [],
    results: typeof v.results === "string" ? v.results : "",
    outcome: v.outcome === "supported" || v.outcome === "refuted" || v.outcome === "inconclusive" ? v.outcome : null,
  };
}

/** Research entries: hypothesis, protocol checklist, results and outcome, kept on the entry itself. */
export function DrawerExperiment({ task }: { task: BoardTask }) {
  const board = useBoard();
  const exp = readExperiment(task.experiment);
  const stepRef = useRef<HTMLInputElement>(null);

  function save(next: Experiment | null) {
    const value = next as unknown as Json;
    void board.run({ type: "patch", id: task.id, patch: { experiment: value } }, () => updateTask(board.id, task.id, { experiment: value }));
  }

  if (!exp) {
    return (
      <section className="px-5 pt-6">
        <button
          type="button"
          onClick={() => save({ hypothesis: "", protocol: [], results: "", outcome: null })}
          className="btn btn-quiet min-h-8 px-2"
        >
          <FlaskConical size={14} strokeWidth={1.7} aria-hidden />
          Track as an experiment
        </button>
      </section>
    );
  }

  const done = exp.protocol.filter((s) => s.done).length;

  return (
    <section className="mx-5 mt-6 border border-rule-strong" aria-labelledby="experiment-heading">
      <header className="flex items-center gap-2 border-b border-rule-strong bg-page-sunk px-3 py-2">
        <FlaskConical size={15} strokeWidth={1.7} aria-hidden />
        <h3 id="experiment-heading" className="stamp text-[13px]">
          Experiment
        </h3>
        <button type="button" onClick={() => save(null)} className="ml-auto text-[12px] text-pencil hover:text-ink hover:underline">
          Stop tracking
        </button>
      </header>
      <div className="space-y-4 px-3 py-3">
        <div>
          <label htmlFor="exp-hypothesis" className="field-label">
            Hypothesis
          </label>
          <textarea
            id="exp-hypothesis"
            defaultValue={exp.hypothesis}
            rows={2}
            placeholder="What you expect, and why"
            onBlur={(e) => e.target.value !== exp.hypothesis && save({ ...exp, hypothesis: e.target.value })}
            className="w-full resize-y border-b border-rule-strong bg-transparent py-1 text-[15px] [field-sizing:content] placeholder:text-pencil focus:bg-page-sunk focus:outline-none"
          />
        </div>
        <div>
          <p className="field-label">
            Protocol <span className="font-mono">{exp.protocol.length > 0 && `${done}/${exp.protocol.length}`}</span>
          </p>
          <ol className="border-t border-rule">
            {exp.protocol.map((step, i) => (
              <li key={i} className="flex min-h-9 items-center gap-3 border-b border-rule">
                <span className="font-mono w-5 text-right text-[12px] text-pencil">{i + 1}.</span>
                <input
                  type="checkbox"
                  checked={step.done}
                  aria-label={`Step ${i + 1} done`}
                  onChange={() => save({ ...exp, protocol: exp.protocol.map((s, j) => (j === i ? { ...s, done: !s.done } : s)) })}
                  className="check"
                />
                <span className={`flex-1 text-[14px] ${step.done ? "text-pencil line-through" : ""}`}>{step.text}</span>
                <button
                  type="button"
                  aria-label={`Remove step ${i + 1}`}
                  onClick={() => save({ ...exp, protocol: exp.protocol.filter((_, j) => j !== i) })}
                  className="p-1 text-pencil hover:text-ink"
                >
                  <X size={13} strokeWidth={1.7} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const text = stepRef.current?.value.trim();
              if (!text) return;
              if (stepRef.current) stepRef.current.value = "";
              save({ ...exp, protocol: [...exp.protocol, { text, done: false }] });
            }}
          >
            <label htmlFor="exp-step" className="sr-only">
              Add a protocol step
            </label>
            <input id="exp-step" ref={stepRef} placeholder="+ Add a step" className="field min-h-9 border-rule-mid text-[14px]" />
          </form>
        </div>
        <div>
          <label htmlFor="exp-results" className="field-label">
            Results
          </label>
          <textarea
            id="exp-results"
            defaultValue={exp.results}
            rows={2}
            placeholder="What happened: numbers, observations, links to data"
            onBlur={(e) => e.target.value !== exp.results && save({ ...exp, results: e.target.value })}
            className="w-full resize-y border-b border-rule-strong bg-transparent py-1 text-[15px] [field-sizing:content] placeholder:text-pencil focus:bg-page-sunk focus:outline-none"
          />
        </div>
        <div>
          <p className="field-label" id="exp-outcome">
            Outcome
          </p>
          <div role="radiogroup" aria-labelledby="exp-outcome" className="flex border border-rule-strong">
            {(["supported", "refuted", "inconclusive"] as const).map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={exp.outcome === o}
                onClick={() => save({ ...exp, outcome: exp.outcome === o ? null : o })}
                className={`stamp flex-1 py-1.5 text-[12px] ${exp.outcome === o ? "bg-ink text-page" : "text-pencil hover:bg-page-sunk hover:text-ink"}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
