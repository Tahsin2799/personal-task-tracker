"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatPoints, shortDate } from "@/lib/format";
import { addDays, daysBetween } from "@/lib/day-math";
import type { BoardSprint, BoardTask } from "@/lib/queries";
import { StatusMark, TypeGlyph } from "@/components/marks";
import { AssigneeStamp, TYPES } from "./bits";
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

  if (!sprint) {
    const open = board.tasks.filter((t) => work(t) && !t.completed_at);
    return (
      <div className="flex flex-1 flex-col">
        <BoardTally />
        <div className="grid border-b border-rule-strong lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <Section id="throughput" title="Throughput" className="lg:border-r lg:border-rule">
            <Throughput />
          </Section>
          <Section id="open-work" title="Open work" note={`${open.length} entries`}>
            <Breakdown tasks={open} />
          </Section>
        </div>
        <p className="border-b border-rule px-4 py-3 text-[14px] text-pencil md:px-8">
          Burndown and velocity join this page once a sprint starts.{" "}
          <Link href={`/b/${board.id}/backlog`} className="text-ink underline decoration-rule-mid underline-offset-4 hover:decoration-ink">
            Plan one in the Backlog
          </Link>
        </p>
        <div className="ruled-fill flex-1" aria-hidden />
      </div>
    );
  }

  const tasks = board.tasks.filter((t) => t.sprint_id === sprint.id && work(t));
  return (
    <div className="flex flex-1 flex-col">
      <SprintTally sprint={sprint} tasks={tasks} today={board.today} />
      <div className="grid border-b border-rule-strong lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <Section
          id="burndown"
          title="Burndown"
          className="lg:border-r lg:border-rule"
          action={
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
          }
        >
          <Burndown sprint={sprint} tasks={tasks} today={board.today} />
        </Section>
        <Section id="sprint-work" title="In this sprint" note={`${tasks.length} entries`}>
          <Breakdown tasks={tasks} />
        </Section>
      </div>
      <div className="grid border-b border-rule-strong lg:grid-cols-2">
        <Section id="velocity" title="Velocity" className="border-b border-rule lg:border-r lg:border-b-0">
          <Velocity />
        </Section>
        <Section id="throughput" title="Throughput">
          <Throughput />
        </Section>
      </div>
      <div className="ruled-fill flex-1" aria-hidden />
    </div>
  );
}

function Section({
  id,
  title,
  note,
  action,
  className = "",
  children,
}: {
  id: string;
  title: string;
  note?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={`min-w-0 px-4 py-5 md:px-8 ${className}`}>
      <div className="flex min-h-8 flex-wrap items-center gap-x-6 gap-y-2">
        <h2 id={`${id}-heading`} className="stamp text-[15px]">
          {title}
        </h2>
        {note && <span className="font-mono text-[12px] text-pencil">{note}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

/* ----------------------------------------------------------------- tallies */

type Cell = { label: string; value: string; sub?: string; tone?: "attention" };

function TallyStrip({ cells }: { cells: Cell[] }) {
  return (
    <dl className="grid grid-cols-2 border-b border-rule-strong sm:grid-cols-3 xl:grid-cols-6">
      {cells.map((c) => (
        <div key={c.label} className="-mr-px -mb-px border-r border-b border-rule px-4 py-3 md:px-6">
          <dt className="stamp text-[11px] text-pencil">{c.label}</dt>
          <dd className={`font-mono mt-1 text-[24px] leading-tight ${c.tone === "attention" ? "font-semibold text-attention" : ""}`}>{c.value}</dd>
          {c.sub && (
            <dd className="mt-0.5 text-[12px] leading-snug text-pencil">
              {c.sub}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function SprintTally({ sprint, tasks, today }: { sprint: BoardSprint; tasks: BoardTask[]; today: string }) {
  const scope = pts(tasks);
  const done = pts(tasks.filter((t) => t.completed_at));
  const committed = sprint.committed_points ?? scope;
  const change = scope - committed;
  const end = sprint.end_date!;
  const left = daysBetween(today, end);
  const length = Math.max(1, daysBetween(sprint.start_date!, end));
  const doneCount = tasks.filter((t) => t.completed_at).length;
  const share = scope > 0 ? Math.round((done / scope) * 100) : 0;
  const elapsed = Math.min(1, Math.max(0, daysBetween(sprint.start_date!, today) / length));
  const expected = committed * elapsed;
  const gap = Math.round((done - expected) * 10) / 10;
  const active = sprint.status === "active";

  return (
    <TallyStrip
      cells={[
        {
          label: sprint.status === "active" ? "Sprint · active" : "Sprint · completed",
          value: sprint.name,
          sub: `${shortDate(sprint.start_date!)} – ${shortDate(end)}${sprint.goal ? ` · ${sprint.goal}` : ""}`,
        },
        active
          ? { label: "Days left", value: String(Math.max(0, left)), sub: left < 0 ? `ended ${-left}d ago` : `of ${length}`, tone: left < 0 ? "attention" : undefined }
          : { label: "Finished", value: sprint.completed_at ? shortDate(sprint.completed_at.slice(0, 10)) : "—", sub: `${length}-day sprint` },
        { label: "Committed", value: formatPoints(committed), sub: change === 0 ? "scope unchanged" : `scope ${change > 0 ? "+" : "−"}${formatPoints(Math.abs(change))} since start` },
        { label: "Done", value: formatPoints(done), sub: `${share}% · ${doneCount} of ${tasks.length} entries` },
        { label: "Remaining", value: formatPoints(scope - done), sub: `${tasks.length - doneCount} entries open` },
        active
          ? {
              label: "Pace",
              value: gap >= 0 ? "On pace" : `−${formatPoints(-gap)}`,
              sub: `${gap >= 0 ? "" : "pts behind · "}expected ${formatPoints(Math.round(expected * 10) / 10)} pts done by today`,
              tone: gap < -0.5 ? "attention" : undefined,
            }
          : { label: "Delivered", value: `${committed > 0 ? Math.round((done / committed) * 100) : 0}%`, sub: "of the commitment" },
      ]}
    />
  );
}

function BoardTally() {
  const board = useBoard();
  const items = board.tasks.filter(work);
  const open = items.filter((t) => !t.completed_at);
  const recent = items.filter((t) => t.completed_at && daysBetween(t.completed_at.slice(0, 10), board.today) < 30);
  const overdue = open.filter((t) => t.due_date && t.due_date < board.today);
  const soon = open.filter((t) => t.due_date && t.due_date >= board.today && daysBetween(board.today, t.due_date) <= 7);
  const unestimated = open.filter((t) => t.story_points == null);
  const unassigned = open.filter((t) => !t.assignee_id);
  return (
    <TallyStrip
      cells={[
        { label: "Open", value: String(open.length), sub: `${formatPoints(pts(open))} pts` },
        { label: "Done · 30 days", value: String(recent.length), sub: `${formatPoints(pts(recent))} pts` },
        { label: "Overdue", value: String(overdue.length), sub: overdue.length ? "past their due date" : "nothing late", tone: overdue.length ? "attention" : undefined },
        { label: "Due · 7 days", value: String(soon.length), sub: "due this coming week" },
        { label: "Unestimated", value: String(unestimated.length), sub: "open, no points" },
        { label: "Unassigned", value: String(unassigned.length), sub: "open, no owner" },
      ]}
    />
  );
}

/* ----------------------------------------------------------------- breakdown */

const CATEGORIES = [
  { key: "done", label: "Done", fill: DONE },
  { key: "in_progress", label: "In progress", fill: PLAN },
  { key: "todo", label: "To do", fill: "transparent" },
] as const;

function Breakdown({ tasks }: { tasks: BoardTask[] }) {
  const board = useBoard();
  const category = (t: BoardTask) => (t.completed_at ? "done" : (board.columns.find((c) => c.id === t.column_id)?.category ?? "todo"));
  const byCategory = CATEGORIES.map((c) => {
    const list = tasks.filter((t) => category(t) === c.key);
    return { ...c, count: list.length, points: pts(list) };
  }).filter((c) => c.count > 0 || c.key !== "done" || tasks.some((t) => t.completed_at));
  const usePoints = pts(tasks) > 0;
  const total = usePoints ? pts(tasks) : tasks.length;

  const people = [...board.members.map((m) => ({ id: m.id as string | null, name: m.name })), { id: null, name: "Unassigned" }]
    .map((p) => {
      const list = tasks.filter((t) => t.assignee_id === p.id);
      const finished = list.filter((t) => t.completed_at);
      return { ...p, count: list.length, total: usePoints ? pts(list) : list.length, done: usePoints ? pts(finished) : finished.length };
    })
    .filter((p) => p.count > 0)
    .sort((a, b) => b.total - a.total);

  const types = TYPES.filter((type) => type !== "epic" && type !== "subtask")
    .map((type) => ({ type, count: tasks.filter((t) => t.type === type).length }))
    .filter((t) => t.count > 0);

  if (tasks.length === 0) return <p className="mt-3 text-[15px] text-pencil">Nothing here yet.</p>;

  return (
    <div className="mt-3 space-y-5">
      <div>
        <div
          role="img"
          aria-label={byCategory.map((c) => `${c.label} ${usePoints ? `${formatPoints(c.points)} pts` : c.count}`).join(", ")}
          className="flex h-3 border border-rule-strong"
        >
          {byCategory.map((c) => {
            const v = usePoints ? c.points : c.count;
            return v > 0 ? <span key={c.key} style={{ width: `${(v / total) * 100}%`, background: c.fill }} /> : null;
          })}
        </div>
        <ul className="mt-2">
          {byCategory.map((c) => (
            <li key={c.key} className="flex min-h-8 items-center gap-3 border-b border-rule text-[14px] last:border-b-0">
              <StatusMark category={c.key} />
              <span className="flex-1">{c.label}</span>
              <span className="font-mono text-[13px]">{c.count}</span>
              <span className="font-mono w-[64px] text-right text-[12px] text-pencil">{usePoints ? `${formatPoints(c.points)} pts` : ""}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="stamp text-[11px] text-pencil">By person</h3>
        <ul className="mt-1">
          {people.map((p) => (
            <li key={p.id ?? "none"} className="flex min-h-10 items-center gap-3 border-b border-rule py-1.5 last:border-b-0">
              {p.id ? <AssigneeStamp name={p.name} size="sm" /> : <span className="size-6 shrink-0 border border-dashed border-pencil" aria-hidden />}
              <span className="min-w-0 flex-1 text-[14px] leading-snug">{p.name}</span>
              <span
                role="meter"
                aria-label={`${p.name} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={p.total ? Math.round((p.done / p.total) * 100) : 0}
                className="relative block h-2.5 w-[72px] shrink-0 border border-rule-strong"
              >
                <span className="absolute inset-y-0 left-0" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%`, background: DONE }} />
              </span>
              <span className="font-mono w-[64px] shrink-0 text-right text-[12px] text-pencil">
                {formatPoints(p.done)}/{formatPoints(p.total)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[12px] text-pencil">Done of total, in {usePoints ? "points" : "entries"}.</p>
      </div>

      {types.length > 0 && (
        <div>
          <h3 className="stamp text-[11px] text-pencil">By type</h3>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {types.map((t) => (
              <li key={t.type} className="flex items-center gap-1.5 text-[14px]">
                <TypeGlyph type={t.type} />
                <span className="capitalize">{t.type}</span>
                <span className="font-mono text-[13px] text-pencil">{t.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- throughput */

const WEEKS = 10;

/** Monday of the week holding `iso`. */
function weekStart(iso: string) {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, -((day + 6) % 7));
}

function Throughput() {
  const board = useBoard();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const first = addDays(weekStart(board.today), -7 * (WEEKS - 1));
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(first, 7 * i);
    const end = addDays(start, 6);
    const list = board.tasks.filter((t) => work(t) && t.completed_at && t.completed_at.slice(0, 10) >= start && t.completed_at.slice(0, 10) <= end);
    return { start, count: list.length, points: pts(list) };
  });
  const total = weeks.reduce((s, w) => s + w.count, 0);
  const avg = total / WEEKS;

  const height = 220;
  const m = { top: 20, right: 8, bottom: 30, left: 32 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const max = niceMax(Math.max(...weeks.map((wk) => wk.count)));
  const band = w / WEEKS;
  const bar = Math.min(24, band - 12);
  const y = (v: number) => m.top + h - (v / max) * h;
  const step = band < 64 ? 2 : 1;

  return (
    <figure className="mt-3">
      <figcaption className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px] text-pencil">
        <Legend color={DONE} label="Entries finished per week" />
        <Legend color="var(--ink)" label="Average" thin />
        <span className="font-mono text-[12px]">{formatPoints(Math.round(avg * 10) / 10)} / wk</span>
      </figcaption>
      <p aria-live="polite" className="mt-1 flex min-h-6 flex-wrap items-center gap-x-4 border-y border-rule px-1 text-[13px]">
        {hover != null ? (
          <>
            <span className="font-semibold">Week of {shortDate(weeks[hover].start)}</span>
            <span>
              <Swatch color={DONE} /> Finished <span className="font-mono">{weeks[hover].count}</span>
            </span>
            <span className="text-pencil">
              <span className="font-mono">{formatPoints(weeks[hover].points)}</span> pts
            </span>
          </>
        ) : (
          <span className="text-pencil">{total === 0 ? "Nothing finished in the last ten weeks." : "Point at a week for its numbers."}</span>
        )}
      </p>
      <div ref={ref} className="relative mt-2">
        <svg width={width} height={height} role="img" aria-label={`${total} entries finished over the last ${WEEKS} weeks, about ${formatPoints(Math.round(avg * 10) / 10)} a week.`} className="block">
          {ticks(max).map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + w} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="font-mono fill-pencil text-[11px]">
                {t}
              </text>
            </g>
          ))}
          {total > 0 && <line x1={m.left} x2={m.left + w} y1={y(avg)} y2={y(avg)} stroke="var(--ink)" strokeWidth={1} shapeRendering="crispEdges" />}
          {weeks.map((wk, i) => {
            const cx = m.left + band * i + (band - bar) / 2;
            return (
              <g key={wk.start}>
                {hover === i && <rect x={m.left + band * i} y={m.top} width={band} height={h} fill="var(--page-sunk)" />}
                {wk.count > 0 && <path d={column(cx, bar, y(wk.count), m.top + h)} fill={DONE} />}
                {wk.count > 0 && (
                  <text x={cx + bar / 2} y={y(wk.count) - 6} textAnchor="middle" className="font-mono fill-ink text-[11px]">
                    {wk.count}
                  </text>
                )}
                {(WEEKS - 1 - i) % step === 0 && (
                  <text x={m.left + band * i + band / 2} y={height - 8} textAnchor="middle" className="font-mono fill-pencil text-[11px]">
                    {i === WEEKS - 1 ? "THIS WK" : shortDate(wk.start)}
                  </text>
                )}
                <rect
                  x={m.left + band * i}
                  y={m.top}
                  width={band}
                  height={h + m.bottom}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <TableView caption="Entries finished per week" head={["Week of", "Entries", "Points"]}>
        {weeks.map((wk) => (
          <tr key={wk.start} className="border-t border-rule">
            <td className="py-1 pr-4">{shortDate(wk.start)}</td>
            <td className="py-1 pr-4">{wk.count}</td>
            <td className="py-1">{formatPoints(wk.points)}</td>
          </tr>
        ))}
      </TableView>
    </figure>
  );
}

/** A bar with a 4px rounded data end and a square foot. */
function column(x: number, width: number, top: number, bottom: number) {
  const r = Math.min(4, (bottom - top) / 2, width / 2);
  return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${bottom}Z`;
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

  const height = 300;
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
  const height = 220;
  const m = { top: 20, right: 8, bottom: 30, left: 32 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const max = niceMax(Math.max(...rows.map((r) => Math.max(r.committed, r.completed))));
  const band = w / rows.length;
  const bar = Math.min(24, (band - 24) / 2);
  const y = (v: number) => m.top + h - (v / max) * h;

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
                <path d={column(cx, bar, y(r.committed), m.top + h)} fill={PLAN} />
                <path d={column(cx + bar + 2, bar, y(r.completed), m.top + h)} fill={DONE} />
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
