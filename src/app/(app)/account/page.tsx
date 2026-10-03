import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { ThemeSwitch } from "@/components/theme-switch";
import { getViewer } from "@/lib/queries";
import { signOut } from "../../(auth)/actions";
import { DisplayNameForm } from "./display-name-form";
import { EmailPrefs } from "./email-prefs";
import { NewWorkspaceForm } from "./new-workspace-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const [{ profile }, store] = await Promise.all([getViewer(), cookies()]);
  const theme = store.get("theme")?.value;

  return (
    <>
      <PageHeader title={profile.display_name} fields={[{ label: "Email", value: profile.email }]} />
      <div className="grid max-w-[1040px] gap-x-12 gap-y-10 px-4 py-6 md:grid-cols-2 md:px-8">
        <section aria-labelledby="name-heading">
          <h2 id="name-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Display name
          </h2>
          <DisplayNameForm name={profile.display_name} />
        </section>
        <section aria-labelledby="theme-heading">
          <h2 id="theme-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Page
          </h2>
          <div className="pt-3">
            <ThemeSwitch theme={theme === "light" || theme === "dark" ? theme : "system"} tone="page" showLabels />
          </div>
        </section>
        <section aria-labelledby="email-heading">
          <h2 id="email-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Email
          </h2>
          <EmailPrefs
            email={profile.email}
            timeZone={profile.time_zone}
            notifications={profile.email_notifications}
            reminders={profile.email_due_reminders}
          />
        </section>
        <section aria-labelledby="workspace-heading">
          <h2 id="workspace-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            New team workspace
          </h2>
          <NewWorkspaceForm />
        </section>
        <section aria-labelledby="session-heading">
          <h2 id="session-heading" className="stamp border-b border-rule-strong pb-1.5 text-[14px]">
            Session
          </h2>
          <form action={signOut} className="pt-3">
            <button type="submit" className="btn">
              Sign out
            </button>
          </form>
        </section>
      </div>
      <div className="ruled-fill flex-1" aria-hidden />
    </>
  );
}
