"use client";

import Link from "next/link";
import { useActionState } from "react";
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
          <Link href="/forgot-password" className="text-[13px] text-pencil hover:text-ink hover:underline">
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
      <SubmitButton pendingLabel="Opening the book…" className="w-full">
        Sign in
      </SubmitButton>
      <p className="text-[13px] text-pencil">
        Bird-Watcher is invite-only. Ask a workspace owner to invite your email.
      </p>
    </form>
  );
}
