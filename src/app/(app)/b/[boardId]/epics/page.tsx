import { Suspense } from "react";
import type { Metadata } from "next";
import { Epics } from "@/components/board/epics";
import { getBoardName } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const name = await getBoardName((await params).boardId);
  return { title: `Epics · ${name}` };
}

export default function Page() {
  return (
    <Suspense>
      <Epics />
    </Suspense>
  );
}
