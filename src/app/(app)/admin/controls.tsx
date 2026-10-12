"use client";

import { useActionState, useState, useTransition } from "react";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import {
  addWorkspaceMember,
  createWorkspaceFor,
  invitePerson,
  renameWorkspaceAsAdmin,
  type Outcome,
} from "./actions";

type Option = { value: string; label: string; disabled?: boolean };

/** A select that saves as soon as it changes, and snaps back if the database refuses. */
export function ActionSelect({
  label,
  value,
  options,
  action,
}: {
  label: string;
  value: string;
  options: Option[];
  action: (value: string) => Promise<Outcome>;
}) {
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <span className="block">
      <select
        aria-label={label}
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setCurrent(next);
          setError(undefined);
          start(async () => {
            const result = await action(next);
            if (result?.error) {
              setError(result.error);
              setCurrent(value);
            }
          });
        }}
        className="field min-h-8 py-1 text-[14px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="mt-1 block text-[12px] text-attention">
          {error}
        </span>
      )}
    </span>
  );
}

/** A button that runs a server action; with `confirm`, the first press asks inline instead of a browser dialog. */
export function ActionButton({
  children,
  action,
  confirm,
  pendingLabel = "Working…",
  danger = false,
}: {
  children: React.ReactNode;
  action: () => Promise<Outcome>;
  confirm?: string;
  pendingLabel?: string;
  danger?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<Outcome>();
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setResult(await action());
      setArmed(false);
    });

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      {armed ? (
        <>
          <span className="text-[13px] text-attention">{confirm}</span>
          <button type="button" disabled={pending} onClick={run} className="btn btn-danger min-h-8 px-2 text-[13px]">
            {pending ? pendingLabel : "Yes"}
          </button>
          <button type="button" disabled={pending} onClick={() => setArmed(false)} className="btn btn-quiet min-h-8 px-2 text-[13px]">
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => (confirm ? setArmed(true) : run())}
          className={`btn btn-quiet min-h-8 px-2 text-[13px] ${danger ? "hover:text-attention" : ""}`}
        >
          {pending ? pendingLabel : children}
        </button>
      )}
      {result?.error && (
        <span role="alert" className="basis-full text-right text-[12px] text-attention">
          {result.error}
        </span>
      )}
      {result?.ok && (
        <span role="status" className="basis-full text-right text-[12px] text-pencil">
          {result.ok}
        </span>
      )}
    </span>
  );
}

export function InvitePersonForm({ workspaces, seatsLeft }: { workspaces: Option[]; seatsLeft: number }) {
  const [state, formAction] = useActionState(invitePerson, undefined);

  return (
    <form action={formAction} className="mt-2 grid gap-x-4 gap-y-3 border-t border-rule-strong pt-4 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_140px_minmax(160px,220px)_120px_auto] lg:items-end">
      <div>
        <label htmlFor="admin-invite-email" className="field-label">
          Invite by email
        </label>
        <input
          id="admin-invite-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="name@example.com"
          defaultValue={state?.values?.email}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="admin-invite-account" className="field-label">
          Account
        </label>
        <select id="admin-invite-account" name="account_role" defaultValue={state?.values?.account_role ?? "user"} className="field">
          <option value="user">User</option>
          <option value="owner" disabled={seatsLeft <= 0}>
            Owner{seatsLeft <= 0 ? " (no seats)" : ""}
          </option>
        </select>
      </div>
      <div>
        <label htmlFor="admin-invite-workspace" className="field-label">
          Add to workspace
        </label>
        <select id="admin-invite-workspace" name="workspace_id" defaultValue={state?.values?.workspace_id ?? ""} className="field">
          <option value="">None for now</option>
          {workspaces.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="admin-invite-ws-role" className="field-label">
          As
        </label>
        <select id="admin-invite-ws-role" name="workspace_role" defaultValue={state?.values?.workspace_role ?? "member"} className="field">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <SubmitButton pendingLabel="Inviting…">Invite</SubmitButton>
      <FormMessage state={state} className="sm:col-span-2 lg:col-span-5" />
    </form>
  );
}

export function CreateWorkspaceForm({ owners }: { owners: Option[] }) {
  const [state, formAction] = useActionState(createWorkspaceFor, undefined);

  return (
    <form action={formAction} className="grid gap-x-4 gap-y-3 pt-3 sm:grid-cols-[minmax(200px,1fr)_minmax(160px,240px)_auto] sm:items-end">
      <div>
        <label htmlFor="admin-ws-name" className="field-label">
          New team workspace
        </label>
        <input
          id="admin-ws-name"
          name="name"
          required
          maxLength={80}
          placeholder="e.g. Field Lab"
          defaultValue={state?.values?.name}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="admin-ws-owner" className="field-label">
          Owner
        </label>
        <select id="admin-ws-owner" name="owner_id" required defaultValue={state?.values?.owner_id ?? ""} className="field">
          <option value="" disabled>
            Choose an owner
          </option>
          {owners.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
      <FormMessage state={state} className="sm:col-span-3" />
    </form>
  );
}

export function RenameWorkspaceForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [state, formAction] = useActionState(renameWorkspaceAsAdmin, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <label htmlFor={`rename-${workspaceId}`} className="sr-only">
        Workspace name
      </label>
      <input
        id={`rename-${workspaceId}`}
        name="name"
        defaultValue={name}
        required
        maxLength={80}
        className="field min-h-9 w-auto min-w-0 flex-1 basis-[200px] py-1 font-stamp text-[20px] font-semibold uppercase tracking-[0.02em]"
      />
      <SubmitButton pendingLabel="Saving…" variant="quiet" className="min-h-8 px-2 text-[13px]">
        Rename
      </SubmitButton>
      <FormMessage state={state} className="basis-full" />
    </form>
  );
}

export function AddMemberForm({ workspaceId, candidates }: { workspaceId: string; candidates: Option[] }) {
  const [state, formAction] = useActionState(addWorkspaceMember, undefined);

  if (!candidates.length) {
    return <p className="border-t border-rule pt-2 text-[13px] text-pencil">Everyone with an account is already here. Invite someone new above.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-x-3 gap-y-2 border-t border-rule pt-3">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <div className="min-w-[200px] flex-1">
        <label htmlFor={`add-${workspaceId}`} className="field-label">
          Add someone with an account
        </label>
        <select id={`add-${workspaceId}`} name="user_id" required defaultValue={state?.values?.user_id ?? ""} className="field">
          <option value="" disabled>
            Choose a person
          </option>
          {candidates.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="w-[120px]">
        <label htmlFor={`add-role-${workspaceId}`} className="field-label">
          As
        </label>
        <select id={`add-role-${workspaceId}`} name="role" defaultValue={state?.values?.role ?? "member"} className="field">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <SubmitButton pendingLabel="Adding…" variant="plain">
        Add
      </SubmitButton>
      <FormMessage state={state} className="w-full" />
    </form>
  );
}
