import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/queries";
import { longDate } from "@/lib/format";
import {
  deleteWorkspaceAsAdmin,
  removeAccount,
  removeWorkspaceMember,
  sendSetupLink,
  setAccountRole,
  setWorkspaceMember,
} from "./actions";
import {
  ActionButton,
  ActionSelect,
  AddMemberForm,
  CreateWorkspaceForm,
  InvitePersonForm,
  RenameWorkspaceForm,
} from "./controls";

export const metadata: Metadata = { title: "Admin" };

const MAX_OWNERS = 5;
const ACCOUNT_LABEL = { admin: "Admin", owner: "Owner", user: "User" } as const;

type Member = {
  id: string;
  display_name: string;
  email: string;
  role: "owner" | "admin" | "member";
  account_role: "admin" | "owner" | "user";
};

export default async function AdminPage() {
  const { supabase, profile } = await getViewer();
  if (profile.account_role !== "admin") notFound();

  const [{ data: people, error: peopleError }, { data: workspaces, error: workspacesError }] = await Promise.all([
    supabase.rpc("admin_people"),
    supabase.rpc("admin_workspaces"),
  ]);
  if (peopleError) throw peopleError;
  if (workspacesError) throw workspacesError;

  const seatsUsed = people.filter((p) => p.account_role !== "user").length;
  const seatsLeft = MAX_OWNERS - seatsUsed;
  const users = people.length - seatsUsed;
  const ownerOptions = people
    .filter((p) => p.account_role !== "user")
    .map((p) => ({ value: p.id, label: `${p.display_name} (${p.email})` }));

  return (
    <>
      <PageHeader
        title="Admin"
        fields={[
          { label: "Owner seats", value: `${seatsUsed} / ${MAX_OWNERS}`, attention: seatsLeft <= 0 },
          { label: "Users", value: users },
          { label: "Team workspaces", value: workspaces.length },
        ]}
      />

      <div className="grid gap-y-12 px-4 py-6 md:px-8">
        <section aria-labelledby="people-heading" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule-strong pb-1.5">
            <h2 id="people-heading" className="stamp text-[14px]">
              People
            </h2>
            <p className="text-[13px] text-pencil">
              Owners get a Personal workspace and can create team workspaces. Users work in the workspaces they&apos;re added to.
            </p>
          </div>
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Everyone with a Bird-Watcher account</caption>
            <thead>
              <tr className="stamp text-[11px] text-pencil">
                <th scope="col" className="py-2 pr-3">Name</th>
                <th scope="col" className="w-[130px] py-2 pr-3">Account</th>
                <th scope="col" className="hidden w-[110px] py-2 pr-3 sm:table-cell">Workspaces</th>
                <th scope="col" className="hidden w-[170px] py-2 pr-3 md:table-cell">Last sign-in</th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const isMe = p.id === profile.id;
                const pending = !p.last_sign_in_at;
                return (
                  <tr key={p.id} className="border-t border-rule align-top">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-3">
                        <Avatar name={p.display_name} />
                        <span className="min-w-0">
                          <span className="block truncate text-[15px]">
                            {p.display_name}
                            {isMe && <span className="text-pencil"> (you)</span>}
                          </span>
                          <span className="block truncate text-[12px] text-pencil">{p.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {p.account_role === "admin" ? (
                        <span className="stamp inline-block py-1.5 text-[13px]">Admin</span>
                      ) : (
                        <ActionSelect
                          key={`${p.id}-${p.account_role}`}
                          label={`Account role for ${p.display_name}`}
                          value={p.account_role}
                          options={[
                            { value: "owner", label: "Owner", disabled: p.account_role !== "owner" && seatsLeft <= 0 },
                            { value: "user", label: "User" },
                          ]}
                          action={setAccountRole.bind(null, p.id)}
                        />
                      )}
                    </td>
                    <td className="tnum hidden py-2.5 pr-3 text-[13px] sm:table-cell">
                      {p.team_workspaces}
                      {p.owned_workspaces > 0 && <span className="text-pencil"> · owns {p.owned_workspaces}</span>}
                    </td>
                    <td className={`hidden py-2.5 pr-3 text-[13px] md:table-cell ${pending ? "text-attention" : "text-pencil"}`}>
                      {pending ? "Not yet, invite pending" : longDate(p.last_sign_in_at!.slice(0, 10))}
                    </td>
                    <td className="py-2 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        {pending && (
                          <ActionButton action={sendSetupLink.bind(null, p.email)} pendingLabel="Sending…">
                            Send setup link
                          </ActionButton>
                        )}
                        {!isMe && p.account_role !== "admin" && (
                          <ActionButton
                            action={removeAccount.bind(null, p.id)}
                            confirm={`Remove ${p.display_name}? Their comments go too.`}
                            pendingLabel="Removing…"
                            danger
                          >
                            Remove
                          </ActionButton>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <InvitePersonForm workspaces={workspaces.map((w) => ({ value: w.id, label: w.name }))} seatsLeft={seatsLeft} />
        </section>

        <section aria-labelledby="workspaces-heading" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule-strong pb-1.5">
            <h2 id="workspaces-heading" className="stamp text-[14px]">
              Team workspaces
            </h2>
            <p className="text-[13px] text-pencil">You manage names and people here. Boards stay visible to members only.</p>
          </div>
          <CreateWorkspaceForm owners={ownerOptions} />

          {workspaces.length === 0 ? (
            <p className="py-6 text-[15px] text-pencil">No team workspaces yet.</p>
          ) : (
            <ul className="mt-8 space-y-8">
              {workspaces.map((w) => {
                const members = w.members as Member[];
                const memberIds = new Set(members.map((m) => m.id));
                const owner = members.find((m) => m.role === "owner");
                return (
                  <li key={w.id} className="-mx-4 md:-mx-8" aria-label={w.name}>
                    {/* A section band, like a sprint in the backlog: the name to edit, its tallies, and the delete. */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-b border-t-rule-strong border-b-rule bg-page-sunk px-4 py-1.5 md:px-8">
                      <div className="min-w-[220px] flex-1">
                        <RenameWorkspaceForm key={w.name} workspaceId={w.id} name={w.name} />
                      </div>
                      <p className="text-[13px] text-pencil">
                        Owner <span className="text-ink">{owner?.display_name ?? "none"}</span> ·{" "}
                        <span className="tnum">{w.board_count}</span> board{w.board_count === 1 ? "" : "s"} · since{" "}
                        <span className="tnum">{longDate(w.created_at.slice(0, 10))}</span>
                      </p>
                      <ActionButton
                        action={deleteWorkspaceAsAdmin.bind(null, w.id)}
                        confirm={`Delete ${w.name} and its ${w.board_count} board${w.board_count === 1 ? "" : "s"} for everyone?`}
                        pendingLabel="Deleting…"
                        danger
                      >
                        Delete
                      </ActionButton>
                    </div>

                    <table className="w-full border-collapse text-left">
                      <caption className="sr-only">Members of {w.name}</caption>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.id} className="border-b border-rule align-middle">
                            <td className="py-2 pr-3 pl-4 md:pl-8">
                              <span className="flex items-center gap-3">
                                <Avatar name={m.display_name} size="sm" />
                                <span className="min-w-0">
                                  <span className="block truncate text-[14px]">{m.display_name}</span>
                                  <span className="block truncate text-[12px] text-pencil">
                                    {m.email} · {ACCOUNT_LABEL[m.account_role].toLowerCase()} account
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td className="w-[136px] py-2 pr-2">
                              {m.role === "owner" ? (
                                <span className="stamp inline-block py-1.5 text-[13px]">Owner</span>
                              ) : (
                                <ActionSelect
                                  key={`${m.id}-${m.role}`}
                                  label={`${m.display_name}'s role in ${w.name}`}
                                  value={m.role}
                                  options={[
                                    { value: "member", label: "Member" },
                                    { value: "admin", label: "Admin" },
                                    ...(m.account_role === "user" ? [] : [{ value: "owner", label: "Make owner" }]),
                                  ]}
                                  action={setWorkspaceMember.bind(null, w.id, m.id)}
                                />
                              )}
                            </td>
                            <td className="w-[1%] py-2 pr-4 text-right whitespace-nowrap md:pr-8">
                              {m.role !== "owner" && (
                                <ActionButton
                                  action={removeWorkspaceMember.bind(null, w.id, m.id)}
                                  confirm="Remove?"
                                  pendingLabel="Removing…"
                                  danger
                                >
                                  Remove
                                </ActionButton>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="px-4 md:px-8">
                      <AddMemberForm
                        workspaceId={w.id}
                        candidates={people
                          .filter((p) => !memberIds.has(p.id))
                          .map((p) => ({ value: p.id, label: `${p.display_name} (${ACCOUNT_LABEL[p.account_role].toLowerCase()})` }))}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
