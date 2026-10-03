import { Suspense } from "react";
import type { Metadata } from "next";
import { Reports } from "@/components/board/reports";
import { getBoardName } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }): Promise<Metadata> {
  const name = await getBoardName((await params).boardId);
  return { title: `Reports · ${name}` };
}

export default function Page() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}
