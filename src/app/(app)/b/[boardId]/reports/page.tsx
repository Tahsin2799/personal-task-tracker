import { Suspense } from "react";
import type { Metadata } from "next";
import { Reports } from "@/components/board/reports";
import { getBoard } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const board = await getBoard((await params).boardId);
  return { title: `Reports · ${board.name}` };
}

export default function Page() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}
