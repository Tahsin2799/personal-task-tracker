"use client";

import { useActionState } from "react";
import { createWorkspace } from "../actions";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function NewWorkspaceForm() {
  const [state, formAction] = useActionState(createWorkspace, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-x-4 gap-y-3 pt-3">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="workspace-name" className="field-label">
          Name
        </label>
        <input
          id="workspace-name"
          name="name"
          required
          maxLength={80}
          placeholder="e.g. Field Lab"
          defaultValue={state?.values?.name}
          className="field"
        />
      </div>
      <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
      <FormMessage state={state} className="w-full" />
    </form>
  );
}
