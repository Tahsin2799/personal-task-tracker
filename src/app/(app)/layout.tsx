import { cookies } from "next/headers";
import { Spine } from "@/components/spine";
import { TimeZoneSync } from "@/components/time-zone-sync";
import { LiveRefresh } from "@/components/live-refresh";
import { daysBetween, viewerToday } from "@/lib/dates";
import { taskKey } from "@/lib/format";
import { getOpenCount, getSections, getUnreadCount, getUpcomingMilestones, getViewer } from "@/lib/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Today comes from the time-zone cookie (no database), so the milestone read joins the one parallel wave.
  const today = await viewerToday();
  const [{ profile }, sections, openCount, unread, upcoming, store] = await Promise.all([
    getViewer(),
    getSections(),
    getOpenCount(),
    getUnreadCount(),
    getUpcomingMilestones(today),
    cookies(),
  ]);
  const milestones = upcoming.map((m) => {
    const days = daysBetween(today, m.due_date!);
    return {
      id: m.id,
      href: `/b/${m.board!.id}?task=${m.id}`,
      key: taskKey(m.board!.key, m.number),
      title: m.title,
      when: days < 0 ? `${-days}d late` : days === 0 ? "Today" : `in ${days}d`,
      late: days < 0,
    };
  });

  const boardSection = Object.fromEntries(sections.flatMap((s) => s.boards.map((b) => [b.id, s.id])));
  const theme = store.get("theme")?.value;
  const tz = store.get("tz")?.value;

  return (
    <div className="flex min-h-dvh flex-col bg-page md:grid md:grid-cols-[256px_minmax(0,1fr)]">
      <a
        href="#content"
        className="btn btn-primary sr-only fixed top-3 left-3 z-50 focus:not-sr-only focus:px-3.5"
      >
        Skip to content
      </a>
      <div className="bg-cover">
        <Spine
          sections={sections}
          boardSection={boardSection}
          viewerName={profile.display_name}
          theme={theme === "light" || theme === "dark" ? theme : "system"}
          openCount={openCount}
          unread={unread}
          accountRole={profile.account_role}
          milestones={milestones}
        />
      </div>
      <main id="content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col border-t border-rule-strong bg-page outline-none md:border-t-0 md:border-l">
        {children}
      </main>
      <TimeZoneSync current={tz ? decodeURIComponent(tz) : undefined} saved={profile.time_zone} />
      <LiveRefresh channel={`inbox:${profile.id}`} watch={[{ table: "notifications", filter: `user_id=eq.${profile.id}` }]} />
    </div>
  );
}
