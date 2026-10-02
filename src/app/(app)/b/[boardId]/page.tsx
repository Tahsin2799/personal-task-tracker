import { Suspense } from "react";
import type { Metadata } from "next";
import { Kanban } from "@/components/board/kanban";
import { getBoard } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const board = await getBoard((await params).boardId);
  return { title: board.name };
}

export default function Page() {
  return (
    <Suspense>
      <Kanban />
    </Suspense>
  );
}
