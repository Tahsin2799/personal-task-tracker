"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { signIn } from "../actions";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          defaultValue={state?.values?.email}
          className="field"
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <Link href="/forgot-password" className="auth-text-link">
            Forgot it?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Signing in…" className="auth-submit">
        <span>Sign in</span>
        <ArrowRight aria-hidden="true" size={21} strokeWidth={1.8} />
      </SubmitButton>
      <div className="auth-invite">
        <strong>Invited, but haven&apos;t set a password?</strong>
        <p>Use your invited email to get a setup link.</p>
        <Link href="/forgot-password?setup=1" className="auth-text-link">
          Set your password →
        </Link>
      </div>
    </form>
  );
}
