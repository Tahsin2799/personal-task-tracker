import Link from "next/link";
import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PointsDot } from "@/components/marks";
import { getWorkspace } from "@/lib/queries";
import { NewBoardRow } from "./new-board-row";

export async function generateMetadata({ params }: PageProps<"/w/[workspaceId]">): Promise<Metadata> {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);
  return { title: workspace.is_personal ? "Personal" : workspace.name };
}

export default async function WorkspacePage({ params }: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);

  const boards = workspace.boards
    .filter((b) => !b.archived_at)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => {
      const work = b.tasks.filter((t) => t.type !== "epic" && !t.archived_at);
      const open = work.filter((t) => !t.completed_at);
      return {
        ...b,
        open: open.length,
        done: work.length - open.length,
        openPoints: open.reduce((sum, t) => sum + (t.story_points ?? 0), 0),
        sprint: b.sprints.find((s) => s.status === "active") ?? null,
      };
    });

  return (
    <>
      <PageHeader
        title={workspace.is_personal ? "Personal" : workspace.name}
        fields={[
          { label: "Boards", value: boards.length },
          { label: "Open", value: boards.reduce((n, b) => n + b.open, 0) },
        ]}
        actions={
          <Link href={`/w/${workspace.id}/settings`} className="btn">
            <Settings2 size={14} strokeWidth={1.7} aria-hidden />
            {workspace.is_personal ? "Settings" : "Members & settings"}
          </Link>
        }
      />

      {workspace.is_personal && (
        <p className="border-b border-rule px-4 py-2 text-[13px] text-pencil md:px-8">
          Your private section. Nobody else can see these boards.
        </p>
      )}

      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Boards in this workspace</caption>
        <thead>
          <tr className="stamp text-[11px] text-pencil">
            <th scope="col" className="w-[96px] py-2 pl-4 md:pl-8">Key</th>
            <th scope="col" className="py-2 pl-3">Board</th>
            <th scope="col" className="hidden w-[160px] py-2 pl-3 md:table-cell">Active sprint</th>
            <th scope="col" className="w-[72px] py-2 pl-3">Open</th>
            <th scope="col" className="hidden w-[72px] py-2 pl-3 sm:table-cell">Done</th>
            <th scope="col" className="hidden w-[110px] py-2 pr-8 pl-3 md:table-cell">Open pts</th>
          </tr>
        </thead>
        <tbody>
          {boards.map((b) => (
            <tr key={b.id} className="border-t border-rule hover:bg-page-sunk">
              <td className="py-3 pl-4 align-top md:pl-8">
                <span className="font-mono flex items-center gap-2 text-[14px] font-medium">
                  <span
                    className="size-2.5 shrink-0"
                    style={{ background: b.color ? `var(--${b.color.replace("ink", "ink-epic")})` : "transparent" }}
                    aria-hidden
                  />
                  {b.key}
                </span>
              </td>
              <td className="py-3 pr-4 pl-3 align-top">
                <Link href={`/b/${b.id}`} className="font-stamp text-[19px] font-semibold uppercase tracking-[0.02em] hover:underline">
                  {b.name}
                </Link>
                {b.description && <p className="mt-0.5 max-w-[70ch] text-[13px] text-pencil">{b.description}</p>}
              </td>
              <td className="hidden py-3 pl-3 align-top text-[14px] md:table-cell">
                {b.sprint ? b.sprint.name : <span className="text-pencil">—</span>}
              </td>
              <td className="font-mono py-3 pl-3 align-top text-[14px]">{b.open}</td>
              <td className="font-mono hidden py-3 pl-3 align-top text-[14px] text-pencil sm:table-cell">{b.done}</td>
              <td className="hidden py-3 pr-8 pl-3 align-top md:table-cell">
                <PointsDot points={b.openPoints || null} />
              </td>
            </tr>
          ))}
          <NewBoardRow workspaceId={workspace.id} isFirst={boards.length === 0} />
        </tbody>
      </table>
      <div className="ruled-fill flex-1" aria-hidden />
    </>
  );
}
