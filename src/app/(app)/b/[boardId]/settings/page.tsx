import { Suspense } from "react";
import type { Metadata } from "next";
import { BoardSettings } from "@/components/board/board-settings";
import { getBoardName } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const name = await getBoardName((await params).boardId);
  return { title: `Settings · ${name}` };
}

export default function Page() {
  return (
    <Suspense>
      <BoardSettings />
    </Suspense>
  );
}
