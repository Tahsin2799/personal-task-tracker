import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarView } from "@/components/board/calendar-view";
import { getBoardName } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const name = await getBoardName((await params).boardId);
  return { title: `Calendar · ${name}` };
}

export default function Page() {
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  );
}
