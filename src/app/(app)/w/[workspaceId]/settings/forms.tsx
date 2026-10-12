"use client";

import { useActionState } from "react";
import { inviteMember, renameWorkspace } from "../../../actions";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function InviteRow({
  workspaceId,
  people,
}: {
  workspaceId: string;
  people: { email: string; display_name: string }[];
}) {
  const [state, formAction] = useActionState(inviteMember, undefined);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-rule-strong pt-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="min-w-[220px] flex-1">
        <label htmlFor="invite-email" className="field-label">
          Add or invite by email
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="name@example.com"
          list="invite-people"
          defaultValue={state?.values?.email}
          className="field"
        />
        <datalist id="invite-people">
          {people.map((p) => (
            <option key={p.email} value={p.email}>
              {p.display_name}
            </option>
          ))}
        </datalist>
      </div>
      <div className="w-[120px]">
        <label htmlFor="invite-role" className="field-label">
          Role
        </label>
        <select id="invite-role" name="role" defaultValue={state?.values?.role ?? "member"} className="field">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
      <p className="w-full text-[12px] text-pencil">People with an account join right away; anyone new gets an email to set a password.</p>
      <FormMessage state={state} className="w-full" />
    </form>
  );
}

export function RenameForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [state, formAction] = useActionState(renameWorkspace, undefined);

  return (
    <form action={formAction} className="space-y-3 pt-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <label htmlFor="workspace-name" className="sr-only">
        Workspace name
      </label>
      <input id="workspace-name" name="name" defaultValue={name} required maxLength={80} className="field" />
      <SubmitButton pendingLabel="Saving…" variant="plain">
        Save name
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
