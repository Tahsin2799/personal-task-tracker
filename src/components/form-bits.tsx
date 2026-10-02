"use client";

import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: "primary" | "plain" | "danger" | "quiet";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const variantClass = variant === "plain" ? "" : `btn-${variant}`;
  return (
    <button type="submit" disabled={pending} className={`btn ${variantClass} ${className}`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state, className = "" }: { state: ActionState; className?: string }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`text-sm ${state.error ? "text-attention" : "text-pencil"} ${className}`}
    >
      {state.error ?? state.ok}
    </p>
  );
}
