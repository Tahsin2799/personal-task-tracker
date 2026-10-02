import { Suspense } from "react";
import { BoardNote, BoardProvider } from "@/components/board/board-context";
import { BoardHeader } from "@/components/board/board-header";
import { TaskDrawer } from "@/components/board/task-drawer";
import { LiveRefresh } from "@/components/live-refresh";
import { viewerToday } from "@/lib/dates";
import { getBoard } from "@/lib/queries";

/** Every board view shares one read of the board, the header tabs and the entry drawer (?task=). */
export default async function BoardLayout({ children, params }: LayoutProps<"/b/[boardId]">) {
  const { boardId } = await params;
  const [board, today] = await Promise.all([getBoard(boardId), viewerToday()]);

  return (
    <BoardProvider data={board} today={today}>
      <BoardHeader />
      {children}
      <Suspense>
        <TaskDrawer />
      </Suspense>
      <BoardNote />
      <LiveRefresh
        channel={`board:${board.id}`}
        watch={["tasks", "task_labels", "board_columns", "sprints", "comments", "attachments", "activity"].map((table) => ({
          table,
          filter: `board_id=eq.${board.id}`,
        }))}
      />
    </BoardProvider>
  );
}
