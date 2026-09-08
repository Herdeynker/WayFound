import { AuthShell } from "@/components/auth-shell";
import { ConsentForm } from "@/features/auth/consent-form";
import { requireUser } from "@/server/auth/guards";
import { getPolicyVersion } from "@/server/auth/constants";

export default async function ConsentPage() {
  const { user } = await requireUser();
  if (!user)
    return (
      <AuthShell>
        <div className="auth-card">
          <h2>Sign in to continue</h2>
          <p>Your consent choices are private to your account.</p>
          <a className="ui-button ui-button-primary" href="/login">
            Sign in <span aria-hidden="true">→</span>
          </a>
        </div>
      </AuthShell>
    );
  return (
    <AuthShell eyebrow="A clear path starts with clear choices.">
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
    </AuthShell>
  );
}
