import { Suspense } from "react";
import type { Metadata } from "next";
import { TableView } from "@/components/board/table-view";
import { getBoardName } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const name = await getBoardName((await params).boardId);
  return { title: `Table · ${name}` };
}

export default function Page() {
  return (
    <Suspense>
      <TableView />
    </Suspense>
  );
}
