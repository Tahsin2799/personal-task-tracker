import { Suspense } from "react";
import type { Metadata } from "next";
import { BoardSettings } from "@/components/board/board-settings";
import { getBoard } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const board = await getBoard((await params).boardId);
  return { title: `Settings · ${board.name}` };
}

export default function Page() {
  return (
    <Suspense>
      <BoardSettings />
    </Suspense>
  );
}
