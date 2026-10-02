import { Suspense } from "react";
import type { Metadata } from "next";
import { Epics } from "@/components/board/epics";
import { getBoard } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const board = await getBoard((await params).boardId);
  return { title: `Epics · ${board.name}` };
}

export default function Page() {
  return (
    <Suspense>
      <Epics />
    </Suspense>
  );
}
