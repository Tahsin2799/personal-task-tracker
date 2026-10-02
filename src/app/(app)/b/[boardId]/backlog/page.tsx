import { Suspense } from "react";
import type { Metadata } from "next";
import { Backlog } from "@/components/board/backlog";
import { getBoard } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const board = await getBoard((await params).boardId);
  return { title: `Backlog · ${board.name}` };
}

export default function Page() {
  return (
    <Suspense>
      <Backlog />
    </Suspense>
  );
}
