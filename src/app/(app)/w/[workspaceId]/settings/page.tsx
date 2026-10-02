import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getViewer, getWorkspace, getWorkspaceMembers } from "@/lib/queries";
import { initials } from "@/lib/format";
import { removeMember } from "../../../actions";
import { InviteRow, RenameForm } from "./forms";

export const metadata: Metadata = { title: "Members & settings" };

export default async function WorkspaceSettingsPage({ params }: PageProps<"/w/[workspaceId]/settings">) {
  const { workspaceId } = await params;
  const [{ profile }, workspace, members] = await Promise.all([
    getViewer(),
    getWorkspace(workspaceId),
    getWorkspaceMembers(workspaceId),
  ]);

  const myRole = members.find((m) => m.profile?.id === profile.id)?.role ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";
  const title = workspace.is_personal ? "Personal" : workspace.name;

  return (
    <>
      <PageHeader
        title={`${title} settings`}
        crumb={{ href: `/w/${workspace.id}`, label: title }}
        fields={workspace.is_personal ? [] : [{ label: "Members", value: members.length }]}
      />

      <div className="grid gap-x-12 gap-y-10 px-4 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="members-heading" className="min-w-0">
          <h2 id="members-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Members
          </h2>
          {workspace.is_personal ? (
            <p className="max-w-[60ch] py-4 text-[15px] text-pencil">
              Personal workspaces are private to you and can&apos;t have other members. Create a team workspace from the
              spine to work with others.
            </p>
          ) : (
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Members of {title}</caption>
              <thead>
                <tr className="stamp text-[11px] text-pencil">
                  <th scope="col" className="py-2 pr-3">Name</th>
                  <th scope="col" className="hidden py-2 pr-3 md:table-cell">Email</th>
                  <th scope="col" className="w-[90px] py-2 pr-3">Role</th>
                  <th scope="col" className="w-[90px] py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const p = m.profile!;
                  const isMe = p.id === profile.id;
                  const removable = m.role !== "owner" && (canManage || isMe);
                  return (
                    <tr key={p.id} className="border-t border-rule">
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="font-mono flex size-7 shrink-0 items-center justify-center border border-ink text-[11px] font-semibold"
                          >
                            {initials(p.display_name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[15px]">
                              {p.display_name}
                              {isMe && <span className="text-pencil"> (you)</span>}
                            </span>
                            <span className="block truncate text-[12px] text-pencil md:hidden">{p.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="hidden truncate py-2.5 pr-3 text-[14px] text-pencil md:table-cell">{p.email}</td>
                      <td className="stamp py-2.5 pr-3 text-[13px]">{m.role}</td>
                      <td className="py-2.5 text-right">
                        {removable && (
                          <form action={removeMember.bind(null, workspace.id, p.id)}>
                            <button type="submit" className="btn btn-quiet min-h-8 px-2 text-[13px]">
                              {isMe ? "Leave" : "Remove"}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!workspace.is_personal && canManage && <InviteRow workspaceId={workspace.id} />}
          {!workspace.is_personal && !canManage && (
            <p className="mt-4 text-[13px] text-pencil">Only owners and admins can invite people.</p>
          )}
        </section>

        <section aria-labelledby="name-heading">
          <h2 id="name-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Name
          </h2>
          {canManage ? (
            <RenameForm workspaceId={workspace.id} name={workspace.name} />
          ) : (
            <p className="py-4 text-[15px]">{workspace.name}</p>
          )}
        </section>
      </div>
      <div className="ruled-fill flex-1" aria-hidden />
    </>
  );
}
