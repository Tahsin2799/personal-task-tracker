import { formatPoints, shortDate } from "./format";

type Data = Record<string, unknown>;

/** How an activity row reads: "<actor> <verb> <entry> <rest>". */
export function describeActivity(kind: string, d: Data): { verb: string; rest: string } {
  switch (kind) {
    case "created":
      return { verb: "created", rest: "" };
    case "moved":
      return { verb: "moved", rest: `from ${d.from ?? "?"} to ${d.to ?? "?"}` };
    case "assigned":
      return d.to ? { verb: "assigned", rest: `to ${d.to}` } : { verb: "unassigned", rest: "" };
    case "sprint":
      return { verb: "moved", rest: `to ${d.to}` };
    case "priority":
      return { verb: "reprioritised", rest: `${d.from} → ${d.to}` };
    case "points":
      return { verb: "estimated", rest: d.to != null ? `at ${formatPoints(Number(d.to))} pts` : "as unestimated" };
    case "due":
      return d.to ? { verb: "scheduled", rest: `for ${shortDate(String(d.to))}` } : { verb: "unscheduled", rest: "" };
    case "renamed":
      return { verb: "renamed", rest: `(was “${d.from}”)` };
    case "type":
      return { verb: "changed", rest: `from ${d.from} to ${d.to}` };
    case "epic":
      return d.to ? { verb: "added", rest: `to epic “${d.to}”` } : { verb: "took", rest: "out of its epic" };
    case "archived":
      return { verb: "archived", rest: "" };
    case "commented":
      return { verb: "commented on", rest: "" };
    default:
      return { verb: kind, rest: "" };
  }
}
