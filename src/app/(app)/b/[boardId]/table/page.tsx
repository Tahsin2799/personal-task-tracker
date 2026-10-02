import { Suspense } from "react";
import type { Metadata } from "next";
import { TableView } from "@/components/board/table-view";
import { getBoard } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const board = await getBoard((await params).boardId);
  return { title: `Table · ${board.name}` };
}

export default function Page() {
  return (
    <Suspense>
      <TableView />
    </Suspense>
  );
}
