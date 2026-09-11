import Link from "next/link";
import type { Route } from "next";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  if (!(await isTestFixtureRequest())) await requireConsentedUser();
  return (
    <main className="settings-page">
      <div className="settings-header">
        <Link className="settings-back" href="/dashboard">
          ← Dashboard
        </Link>
        <p className="card-eyebrow">Private account space</p>
        <h1>Settings</h1>
        <p>Manage access, alerts and the choices that shape your WAYFOUND experience.</p>
      </div>
      <nav className="settings-tabs" aria-label="Settings navigation">
        <Link href="/settings/account">Account</Link>
        <Link href="/settings/privacy">Privacy & consent</Link>
        <Link href="/settings/notifications">Notifications</Link>
        <Link href={"/settings/billing" as Route}>Billing</Link>
      </nav>
      {children}
    </main>
  );
}
