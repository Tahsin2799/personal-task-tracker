import { Suspense } from "react";
import type { Metadata } from "next";
import { Backlog } from "@/components/board/backlog";
import { getBoardName } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const name = await getBoardName((await params).boardId);
  return { title: `Backlog · ${name}` };
}

export default function Page() {
  return (
    <Suspense>
      <Backlog />
    </Suspense>
  );
}
