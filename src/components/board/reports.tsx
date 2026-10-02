"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPoints, shortDate } from "@/lib/format";
import { addDays, daysBetween } from "@/lib/day-math";
import type { BoardSprint, BoardTask } from "@/lib/queries";
import { useBoard } from "./board-context";

const PLAN = "var(--chart-plan)";
const DONE = "var(--chart-done)";
const IDEAL = "var(--pencil)";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 5;
  const step = v <= 10 ? 2 : v <= 25 ? 5 : v <= 60 ? 10 : 20;
  return Math.ceil(v / step) * step;
}

function ticks(max: number) {
  const step = max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 10 : 20;
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(v);
  return out;
}

const work = (t: BoardTask) => t.type !== "epic" && t.type !== "subtask";
const pts = (list: BoardTask[]) => list.reduce((s, t) => s + (t.story_points ?? 0), 0);

export function Reports() {
  const board = useBoard();
  const reportable = board.sprints.filter((s) => s.status !== "planned" && s.start_date && s.end_date);
  const fallback = board.sprints.find((s) => s.status === "active") ?? reportable.at(-1);
  const [sprintId, setSprintId] = useState(fallback?.id ?? "");
  const sprint = reportable.find((s) => s.id === sprintId) ?? fallback;

  return (
    <div className="flex flex-1 flex-col">
      {sprint ? (
        <section aria-labelledby="burndown-heading" className="border-b border-rule-strong px-4 py-5 md:px-8">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <h2 id="burndown-heading" className="stamp text-[15px]">
              Burndown
            </h2>
            <div className="w-[200px]">
              <label htmlFor="report-sprint" className="sr-only">
                Sprint
              </label>
              <select id="report-sprint" value={sprint.id} onChange={(e) => setSprintId(e.target.value)} className="field min-h-8 text-[14px]">
                {reportable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === "active" ? " (active)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Burndown sprint={sprint} tasks={board.tasks.filter((t) => t.sprint_id === sprint.id && work(t))} today={board.today} />
        </section>
      ) : (
        <p className="border-b border-rule px-4 py-6 text-[15px] text-pencil md:px-8">
          Start a sprint from the Backlog to see its burndown here.
        </p>
      )}
      <section aria-labelledby="velocity-heading" className="border-b border-rule-strong px-4 py-5 md:px-8">
        <h2 id="velocity-heading" className="stamp text-[15px]">
          Velocity
        </h2>
        <Velocity />
      </section>
      <div className="ruled-fill flex-1" aria-hidden />
    </div>
  );
}

/* ----------------------------------------------------------------- burndown */

function Burndown({ sprint, tasks, today }: { sprint: BoardSprint; tasks: BoardTask[]; today: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const start = sprint.start_date!;
  const end = sprint.end_date!;
  const length = Math.max(1, daysBetween(start, end));
  const scope = pts(tasks);
  const committed = sprint.committed_points ?? scope;
  const lastDay = Math.min(length, Math.max(0, daysBetween(start, sprint.completed_at?.slice(0, 10) ?? today)));

  const days = useMemo(
    () =>
      Array.from({ length: length + 1 }, (_, i) => {
        const date = addDays(start, i);
        const finished = pts(tasks.filter((t) => t.completed_at && t.completed_at.slice(0, 10) <= date));
        return {
          i,
          date,
          ideal: committed - (committed * i) / length,
          remaining: i <= lastDay ? Math.max(0, scope - finished) : null,
        };
      }),
    [length, start, tasks, committed, scope, lastDay],
  );

  const height = 260;
  const m = { top: 20, right: 64, bottom: 30, left: 40 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const max = niceMax(Math.max(committed, scope));
  const x = (i: number) => m.left + (i / length) * w;
  const y = (v: number) => m.top + h - (v / max) * h;
  const actual = days.filter((d) => d.remaining != null);
  const last = actual.at(-1);
  const remainingNow = last?.remaining ?? scope;
  const behind = last && last.remaining! > last.ideal + 0.5;

  const path = (pts: { i: number; v: number }[]) => pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const step = Math.max(1, Math.ceil(length / Math.floor(w / 56)));

  return (
    <figure className="mt-3">
      <figcaption className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px] text-pencil">
        <Legend color={PLAN} label="Remaining" />
        <Legend color={IDEAL} label="Ideal" />
        <span className="font-mono text-[12px]">
          committed {formatPoints(committed)} · scope now {formatPoints(scope)} · remaining {formatPoints(remainingNow)}
        </span>
        {behind && sprint.status === "active" && (
          <span className="text-attention">
            Behind the ideal line by <span className="font-mono">{formatPoints(Math.round((last!.remaining! - last!.ideal) * 10) / 10)}</span> pts
          </span>
        )}
      </figcaption>
      <div ref={ref} className="relative mt-2">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Burndown for ${sprint.name}: ${formatPoints(remainingNow)} of ${formatPoints(scope)} points remaining.`}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - box.left - m.left) / w) * length);
            setHover(i >= 0 && i <= length ? i : null);
          }}
          onPointerLeave={() => setHover(null)}
          className="block touch-none"
        >
          {ticks(max).map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + w} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="font-mono fill-pencil text-[11px]">
                {t}
              </text>
            </g>
          ))}
          {days
            // Stepped labels plus the last day, dropping a stepped label that would crowd the last one.
            .filter((d) => d.i === length || (d.i % step === 0 && length - d.i >= step))
            .map((d) => (
              <text key={d.i} x={x(d.i)} y={height - 8} textAnchor="middle" className="font-mono fill-pencil text-[11px]">
                {shortDate(d.date)}
              </text>
            ))}
          {daysBetween(start, today) >= 0 && daysBetween(start, today) <= length && sprint.status === "active" && (
            <g>
              <line x1={x(daysBetween(start, today))} x2={x(daysBetween(start, today))} y1={m.top} y2={m.top + h} stroke="var(--rule-strong)" strokeWidth={1} />
              <text x={x(daysBetween(start, today))} y={m.top - 4} textAnchor="middle" className="stamp fill-pencil text-[11px]">
                Today
              </text>
            </g>
          )}
          <path d={path(days.map((d) => ({ i: d.i, v: d.ideal })))} fill="none" stroke={IDEAL} strokeWidth={2} strokeLinecap="round" />
          <path d={path(actual.map((d) => ({ i: d.i, v: d.remaining! })))} fill="none" stroke={PLAN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {last && (
            <>
              <circle cx={x(last.i)} cy={y(last.remaining!)} r={5} fill={PLAN} stroke="var(--page)" strokeWidth={2} />
              <text x={x(last.i) + 10} y={y(last.remaining!)} dy="0.32em" className="font-mono fill-ink text-[12px]">
                {formatPoints(last.remaining!)} left
              </text>
            </>
          )}
          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + h} stroke="var(--ink)" strokeWidth={1} />
              {days[hover].remaining != null && <circle cx={x(hover)} cy={y(days[hover].remaining!)} r={4} fill={PLAN} stroke="var(--page)" strokeWidth={2} />}
              <circle cx={x(hover)} cy={y(days[hover].ideal)} r={4} fill={IDEAL} stroke="var(--page)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hover != null && (
          <Tooltip left={Math.min(x(hover) + 12, width - 170)} top={m.top}>
            <p className="font-mono text-[12px] text-pencil">
              {shortDate(days[hover].date)} · day {hover}
            </p>
            <p>
              <Swatch color={PLAN} /> Remaining{" "}
              <span className="font-mono">{days[hover].remaining != null ? formatPoints(days[hover].remaining!) : "—"}</span>
            </p>
            <p>
              <Swatch color={IDEAL} /> Ideal <span className="font-mono">{formatPoints(Math.round(days[hover].ideal * 10) / 10)}</span>
            </p>
          </Tooltip>
        )}
      </div>
      <TableView caption={`Burndown, ${sprint.name}`} head={["Day", "Date", "Remaining", "Ideal"]}>
        {days.map((d) => (
          <tr key={d.i} className="border-t border-rule">
            <td className="py-1 pr-4">{d.i}</td>
            <td className="py-1 pr-4">{shortDate(d.date)}</td>
            <td className="py-1 pr-4">{d.remaining != null ? formatPoints(d.remaining) : "—"}</td>
            <td className="py-1">{formatPoints(Math.round(d.ideal * 10) / 10)}</td>
          </tr>
        ))}
      </TableView>
      <p className="mt-2 max-w-[70ch] text-[12px] text-pencil">
        Remaining uses the entries in the sprint now; work added mid-sprint raises the line on the day it counts. Subtasks and epics carry no points here.
      </p>
    </figure>
  );
}

/* ----------------------------------------------------------------- velocity */

function Velocity() {
  const board = useBoard();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const rows = board.sprints
    .filter((s) => s.status === "completed")
    .slice(-8)
    .map((s) => {
      const tasks = board.tasks.filter((t) => t.sprint_id === s.id && work(t));
      return { sprint: s, committed: s.committed_points ?? pts(tasks), completed: pts(tasks.filter((t) => t.completed_at)) };
    });

  if (rows.length === 0) {
    return <p className="mt-3 text-[15px] text-pencil">Velocity appears once the first sprint is completed.</p>;
  }

  const avg = rows.slice(-3).reduce((s, r) => s + r.completed, 0) / Math.min(3, rows.length);
  const height = 240;
  const m = { top: 16, right: 16, bottom: 30, left: 40 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const max = niceMax(Math.max(...rows.map((r) => Math.max(r.committed, r.completed))));
  const band = w / rows.length;
  const bar = Math.min(24, (band - 24) / 2);
  const y = (v: number) => m.top + h - (v / max) * h;
  const column = (cx: number, v: number) => {
    const top = y(v);
    const bottom = m.top + h;
    const r = Math.min(4, (bottom - top) / 2);
    return `M${cx},${bottom}V${top + r}Q${cx},${top} ${cx + r},${top}H${cx + bar - r}Q${cx + bar},${top} ${cx + bar},${top + r}V${bottom}Z`;
  };

  return (
    <figure className="mt-3">
      <figcaption className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px] text-pencil">
        <Legend color={PLAN} label="Committed" />
        <Legend color={DONE} label="Completed" />
        <Legend color="var(--ink)" label={`Average of last ${Math.min(3, rows.length)}`} thin />
        <span className="font-mono text-[12px]">{formatPoints(Math.round(avg * 10) / 10)} pts</span>
      </figcaption>
      {/* Hover readout lives on its own line above the plot, so it never covers a bar or its value. */}
      <p aria-live="polite" className="mt-1 flex min-h-6 flex-wrap items-center gap-x-4 border-y border-rule px-1 text-[13px]">
        {hover != null ? (
          <>
            <span className="font-semibold">{rows[hover].sprint.name}</span>
            <span>
              <Swatch color={PLAN} /> Committed <span className="font-mono">{formatPoints(rows[hover].committed)}</span>
            </span>
            <span>
              <Swatch color={DONE} /> Completed <span className="font-mono">{formatPoints(rows[hover].completed)}</span>
            </span>
          </>
        ) : (
          <span className="text-pencil">Point at a sprint for its numbers.</span>
        )}
      </p>
      <div ref={ref} className="relative mt-2">
        <svg width={width} height={height} role="img" aria-label={`Velocity over ${rows.length} completed sprints, averaging ${formatPoints(Math.round(avg * 10) / 10)} points.`} className="block">
          {ticks(max).map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + w} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="font-mono fill-pencil text-[11px]">
                {t}
              </text>
            </g>
          ))}
          <line x1={m.left} x2={m.left + w} y1={y(avg)} y2={y(avg)} stroke="var(--ink)" strokeWidth={1} shapeRendering="crispEdges" />
          {rows.map((r, i) => {
            const cx = m.left + band * i + band / 2 - bar - 1;
            return (
              <g key={r.sprint.id}>
                {hover === i && <rect x={m.left + band * i} y={m.top} width={band} height={h} fill="var(--page-sunk)" />}
                <path d={column(cx, r.committed)} fill={PLAN} />
                <path d={column(cx + bar + 2, r.completed)} fill={DONE} />
                <rect
                  x={m.left + band * i}
                  y={m.top}
                  width={band}
                  height={h + m.bottom}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
                <text x={cx + bar / 2} y={y(r.committed) - 6} textAnchor="middle" className="font-mono fill-ink text-[11px]">
                  {formatPoints(r.committed)}
                </text>
                <text x={cx + bar * 1.5 + 2} y={y(r.completed) - 6} textAnchor="middle" className="font-mono fill-ink text-[11px]">
                  {formatPoints(r.completed)}
                </text>
                <text x={m.left + band * i + band / 2} y={height - 8} textAnchor="middle" className="fill-pencil text-[12px]">
                  {r.sprint.name}
                </text>
              </g>
            );
          })}
        </svg>

      </div>
      <TableView caption="Velocity by sprint" head={["Sprint", "Committed", "Completed"]}>
        {rows.map((r) => (
          <tr key={r.sprint.id} className="border-t border-rule">
            <td className="py-1 pr-4">{r.sprint.name}</td>
            <td className="py-1 pr-4">{formatPoints(r.committed)}</td>
            <td className="py-1">{formatPoints(r.completed)}</td>
          </tr>
        ))}
      </TableView>
    </figure>
  );
}

/* ----------------------------------------------------------------- pieces */

function Legend({ color, label, thin = false }: { color: string; label: string; thin?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <span className={`inline-block w-4 ${thin ? "h-px" : "h-[2px]"}`} style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="mr-1 inline-block size-2 align-middle" style={{ background: color }} aria-hidden />;
}

function Tooltip({ left, top, children }: { left: number; top: number; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute z-10 w-[160px] space-y-0.5 border border-ink bg-page px-3 py-2 text-[13px]" style={{ left, top }}>
      {children}
    </div>
  );
}

function TableView({ caption, head, children }: { caption: string; head: string[]; children: React.ReactNode }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[13px] text-pencil hover:text-ink">Show as table</summary>
      <table className="font-mono mt-2 text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="stamp text-[11px] text-pencil">
            {head.map((h) => (
              <th key={h} scope="col" className="pr-4 pb-1">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </details>
  );
}
