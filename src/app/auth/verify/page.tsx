import { AuthShell } from "@/components/auth-shell";

export default function VerifyPage() {
  return (
    <AuthShell eyebrow="Check your inbox">
      <div className="auth-card auth-message-card">
        <p className="card-eyebrow">One more step</p>
        <h2>Verify your email</h2>
        <p>
          We sent a secure link to your inbox. Open it on this device to finish setting up your WAYFOUND
          account.
        </p>
        <div className="auth-message-note">
          If you do not see it soon, check spam or request another link from the sign-in screen.
        </div>
        <a className="ui-button ui-button-secondary" href="/login">
          Return to sign in <span aria-hidden="true">→</span>
        </a>
      </div>
    </AuthShell>
  );
}
