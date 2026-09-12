import Link from "next/link";
import { Card } from "@/components/ui";
import { WayfoundLogo } from "@/components/wayfound-logo";

export default function LegalPage() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <WayfoundLogo variant="dark" />
        <Link href="/register">Return to WAYFOUND</Link>
      </header>
      <section className="legal-intro">
        <p className="card-eyebrow">Effective 12 September 2026 · version 2026-09-12.v1</p>
        <h1>Privacy, terms and product boundaries</h1>
        <p>Clear rules for using WAYFOUND during the paid beta.</p>
      </section>
      <div className="legal-grid">
        <Card as="article">
          <h2>Privacy notice</h2>
          <p>
            We process account, Passport, application, practice and billing-status data to provide features
            you request. Optional email and Telegram alerts require separate consent.
          </p>
          <p>
            Files are private, scanned before promotion and served through expiring access links. Operational
            analytics use limited event names and never include raw CV, document, payment or contact contents.
          </p>
        </Card>
        <Card as="article">
          <h2>Terms of use</h2>
          <p>
            Use accurate information, keep your account secure and do not misuse the service, interfere with
            providers or upload harmful material. You remain responsible for reviewing and submitting every
            external application.
          </p>
          <p>
            Paid access begins only after payment verification. Cancellation affects future renewal; verified
            access remains available through the paid-through date where applicable.
          </p>
        </Card>
        <Card as="article">
          <h2>Important disclaimer</h2>
          <p>
            WAYFOUND provides decision support and preparation tools—not legal, immigration, recruitment or
            admissions advice. Matches and readiness explanations are evidence-based guidance, not promises of
            eligibility, sponsorship, employment, admission or a visa.
          </p>
        </Card>
        <Card as="article">
          <h2>Retention and deletion</h2>
          <ul>
            <li>Account records remain while your account is active.</li>
            <li>Speaking recordings use the retention period you choose.</li>
            <li>Temporary quarantine objects are removed after scanning or failure handling.</li>
            <li>
              Operational rate-limit data expires automatically; limited funnel events are retained for 30
              days by default.
            </li>
            <li>Account deletion enters a visible grace period before permanent processing.</li>
          </ul>
          <p>
            You can request an export or deletion from Account settings and change optional alerts at any
            time.
          </p>
        </Card>
      </div>
      <footer className="legal-footer">
        Questions about privacy or account requests can be raised through the authenticated support channel
        during beta.
      </footer>
    </main>
  );
}
