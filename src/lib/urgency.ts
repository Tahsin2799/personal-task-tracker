/** The one ranking for "most urgent first", shared by My Work and the Inbox's Due soon. */
type Rankable = {
  milestone: boolean;
  priority: "highest" | "high" | "medium" | "low" | "lowest";
  due_date: string | null;
  number: number;
};

const PRIORITY_RANK = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 } as const;

/** Milestones first, then priority, then the date (undated last), then the key. */
export function byUrgency(a: Rankable, b: Rankable) {
  return (
    Number(b.milestone) - Number(a.milestone) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
    a.number - b.number
  );
}
