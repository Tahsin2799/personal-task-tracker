"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { AuthPage } from "@/components/auth-page";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(requestPasswordReset, undefined);

  return (
    <AuthPage title="Reset password">
      <form action={formAction} className="space-y-5">
        <p className="text-[15px] text-pencil">We&apos;ll email you a link to choose a new password.</p>
        <div>
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required autoFocus className="field" />
        </div>
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Sending…" className="w-full">
          Send reset link
        </SubmitButton>
        <Link href="/login" className="inline-block text-[13px] text-pencil hover:text-ink hover:underline">
          Back to sign in
        </Link>
      </form>
    </AuthPage>
  );
}
