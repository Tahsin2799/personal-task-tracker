import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <AuthPage title="Sign in">
      {error === "link" && (
        <p role="alert" className="mb-4 text-sm text-attention">
          That link has expired or was already used. Ask for a new invite, or reset your password below.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : ""} />
    </AuthPage>
  );
}
