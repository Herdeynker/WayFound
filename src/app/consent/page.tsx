import Link from "next/link";
import { WayfoundLogo } from "@/components/wayfound-logo";
import { ConsentForm } from "@/features/auth/consent-form";
import { isTestFixtureRequest, requireUser } from "@/server/auth/guards";
import { getPolicyVersion } from "@/server/auth/constants";

export default async function ConsentPage() {
  const { user } = await requireUser();
  const fixture = await isTestFixtureRequest();
  if (!user && !fixture)
    return (
      <main className="consent-page" id="main-content">
        <Link aria-label="WAYFOUND home" className="consent-brand" href="/">
          <WayfoundLogo variant="dark" />
        </Link>
        <div className="auth-card">
          <h2>Sign in to continue</h2>
          <p>Your consent choices are private to your account.</p>
          <a className="ui-button ui-button-primary" href="/login">
            Sign in <span aria-hidden="true">→</span>
          </a>
        </div>
      </main>
    );
  return (
    <main className="consent-page" id="main-content">
      <Link aria-label="WAYFOUND home" className="consent-brand" href="/">
        <WayfoundLogo variant="dark" />
      </Link>
      <div className="auth-card consent-card">
        <div className="auth-card-heading">
          <p className="card-eyebrow">Your choices · {getPolicyVersion()}</p>
          <h2>Choose how WAYFOUND helps</h2>
          <p>
            We only use your information to provide the services you choose. Required choices unlock matching
            and private account features.
          </p>
        </div>
        <ConsentForm />
      </div>
    </main>
  );
}
