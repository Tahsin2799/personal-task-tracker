"use client";

import { useActionState } from "react";
import { setPassword } from "../actions";
import { AuthPage } from "@/components/auth-page";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export default function SetPasswordPage() {
  const [state, formAction] = useActionState(setPassword, undefined);

  return (
    <AuthPage title="Set your password">
      <form action={formAction} className="space-y-5">
        <p className="text-[15px] text-pencil">At least 8 characters. You&apos;ll use it with your email to sign in.</p>
        <div>
          <label htmlFor="password" className="field-label">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            autoFocus
            className="field"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="field-label">
            Repeat it
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="field"
          />
        </div>
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Saving…" className="w-full">
          Save and open the book
        </SubmitButton>
      </form>
    </AuthPage>
  );
}
