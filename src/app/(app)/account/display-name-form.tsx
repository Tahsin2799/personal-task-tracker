"use client";

import { useActionState } from "react";
import { updateDisplayName } from "../actions";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function DisplayNameForm({ name }: { name: string }) {
  const [state, formAction] = useActionState(updateDisplayName, undefined);

  return (
    <form action={formAction} className="space-y-3 pt-3">
      <label htmlFor="display-name" className="sr-only">
        Display name
      </label>
      <input id="display-name" name="display_name" defaultValue={name} required maxLength={80} className="field" />
      <SubmitButton pendingLabel="Saving…" variant="plain">
        Save
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
