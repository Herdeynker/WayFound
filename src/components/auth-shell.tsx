import { WayfoundLogo } from "./wayfound-logo";

export function AuthShell({
  children,
  eyebrow = "Your next step is a bigger story.",
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="WAYFOUND introduction">
        <WayfoundLogo />
        <div className="auth-brand-copy">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1>Find where you fit.</h1>
          <p>Trusted pathways, clearer preparation and a wider future — built around your real story.</p>
        </div>
        <div className="auth-route-art" aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
      </section>
      <section className="auth-form-panel">{children}</section>
    </main>
  );
}
