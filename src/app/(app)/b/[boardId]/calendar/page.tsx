import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarView } from "@/components/board/calendar-view";
import { getBoard } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const board = await getBoard((await params).boardId);
  return { title: `Calendar · ${board.name}` };
}

export default function Page() {
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  );
}
