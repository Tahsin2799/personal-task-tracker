"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { AuthPage } from "@/components/auth-page";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const { setup } = use(searchParams);
  const firstTime = setup === "1";
  const [state, formAction] = useActionState(requestPasswordReset, undefined);

  return (
    <AuthPage title={firstTime ? "Set up your password" : "Reset password"}>
      <form action={formAction} className="space-y-5">
        <p className="text-[15px] text-pencil">
          {firstTime
            ? "Enter your account email. We'll email you a link to set your first password."
            : "We'll email you a link to choose a new password."}
        </p>
        <div>
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required autoFocus className="field" />
        </div>
        <FormMessage
          state={firstTime && state?.ok
            ? { ok: "If that address has an account, a password setup link is on its way. Check your inbox and spam folder. The link expires in an hour." }
            : state}
        />
        <SubmitButton pendingLabel="Sending…" className="w-full">
          {firstTime ? "Send password setup link" : "Send reset link"}
        </SubmitButton>
        {firstTime && (
          <p className="text-[13px] text-pencil">
            You need an existing account or invitation. If no email arrives, ask a workspace owner to check your account.
          </p>
        )}
        <Link href="/login" className="inline-block text-[13px] text-pencil hover:text-ink hover:underline">
          Back to sign in
        </Link>
      </form>
    </AuthPage>
  );
}
