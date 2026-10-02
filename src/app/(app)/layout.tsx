import { cookies } from "next/headers";
import { Spine } from "@/components/spine";
import { TimeZoneSync } from "@/components/time-zone-sync";
import { LiveRefresh } from "@/components/live-refresh";
import { getMyWork, getSections, getUnreadCount, getViewer } from "@/lib/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [{ profile }, sections, myWork, unread, store] = await Promise.all([
    getViewer(),
    getSections(),
    getMyWork(),
    getUnreadCount(),
    cookies(),
  ]);

  const boardSection = Object.fromEntries(sections.flatMap((s) => s.boards.map((b) => [b.id, s.id])));
  const theme = store.get("theme")?.value;
  const tz = store.get("tz")?.value;

  return (
    <div className="flex min-h-dvh flex-col bg-page md:grid md:grid-cols-[256px_minmax(0,1fr)]">
      <div className="bg-cover">
        <Spine
          sections={sections}
          boardSection={boardSection}
          viewerName={profile.display_name}
          theme={theme === "light" || theme === "dark" ? theme : "system"}
          openCount={myWork.filter((t) => !t.completed_at).length}
          unread={unread}
        />
      </div>
      <main className="flex min-w-0 flex-1 flex-col border-t border-rule-strong bg-page md:border-t-0 md:border-l">
        {children}
      </main>
      <TimeZoneSync current={tz ? decodeURIComponent(tz) : undefined} />
      <LiveRefresh channel={`inbox:${profile.id}`} watch={[{ table: "notifications", filter: `user_id=eq.${profile.id}` }]} />
    </div>
  );
}
