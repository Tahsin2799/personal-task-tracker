import { Suspense } from "react";
import type { Metadata } from "next";
import { Kanban } from "@/components/board/kanban";
import { getBoardName } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const name = await getBoardName((await params).boardId);
  return { title: name };
}

export default function Page() {
  return (
    <Suspense>
      <Kanban />
    </Suspense>
  );
}
