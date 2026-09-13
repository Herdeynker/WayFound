import { Card } from "@/components/ui";

export type DiscoveryOperationsState = "ready" | "disabled" | "quota-exhausted" | "empty" | "error";

const stateCopy: Record<DiscoveryOperationsState, { label: string; title: string; body: string }> = {
  ready: {
    label: "Autonomous discovery active",
    title: "The global opportunity radar is healthy",
    body: "Search stays inside the free allowance, while verified official sources are monitored directly without using search calls.",
  },
  disabled: {
    label: "Provider disabled",
    title: "Discovery is safely paused",
    body: "No search request is being attempted. Existing verified opportunities remain available while a server-only provider key is configured.",
  },
  "quota-exhausted": {
    label: "Free quota protected",
    title: "Broad search has stopped for this window",
    body: "The hard safety limit was reached. Direct official-source monitoring continues without paid overage or a paid fallback.",
  },
  empty: {
    label: "No new results",
    title: "The latest bounded search completed with no leads",
    body: "Nothing was fabricated or published. Query rotation will cover a different country and pathway in the next scheduled cycle.",
  },
  error: {
    label: "Stage needs attention",
    title: "A discovery stage failed safely",
    body: "The lead remains internal. Backoff and retry controls prevent repeated requests, and no incomplete opportunity entered the feed.",
  },
};

export function DiscoveryOperationsPanel({ state = "ready" }: { state?: DiscoveryOperationsState }) {
  const copy = stateCopy[state];
  const searches = state === "quota-exhausted" ? 25 : state === "disabled" ? 0 : 17;
  return (
    <main className="discovery-operations" data-phase15-state={state}>
      <header className="discovery-heading">
        <div>
          <p className="card-eyebrow">WAYFOUND operations · Phase 15</p>
          <h1>Opportunity discovery</h1>
          <p>
            Privacy-safe visibility into autonomous search, direct source monitoring and publication safety.
          </p>
        </div>
        <span className={`discovery-state discovery-state-${state}`}>{copy.label}</span>
      </header>

      <Card className="discovery-hero" as="section">
        <div>
          <span className="discovery-radar" aria-hidden="true">
            ◎
          </span>
          <div>
            <p className="card-eyebrow">Current operating state</p>
            <h2>{copy.title}</h2>
            <p>{copy.body}</p>
          </div>
        </div>
        <div className="discovery-quota" aria-label="Search quota usage">
          <strong>
            {searches}
            <span>/25</span>
          </strong>
          <p>UTC searches today</p>
          <div>
            <span style={{ width: `${(searches / 25) * 100}%` }} />
          </div>
          <small>Monthly safety cap: 750 · Paid overage: off</small>
        </div>
      </Card>

      <section className="discovery-metrics" aria-label="Discovery summary">
        {[
          ["126", "New leads", "Internal until verified"],
          ["38", "Duplicates", "Evidence merged safely"],
          ["14", "Published", "Passed confidence gate"],
          ["31", "User matches", "Deterministic Passport match"],
        ].map(([value, label, detail]) => (
          <Card key={label} className="discovery-metric" as="article">
            <strong>{state === "disabled" ? "—" : value}</strong>
            <h3>{label}</h3>
            <p>{detail}</p>
          </Card>
        ))}
      </section>

      <div className="discovery-detail-grid">
        <Card className="discovery-flow" as="section">
          <p className="card-eyebrow">Safe path to the feed</p>
          <h2>Every result earns its way through</h2>
          <ol>
            {[
              ["01", "Discover", "Brave finds leads; official sources compound coverage."],
              ["02", "Resolve & retrieve", "Only registered, policy-approved domains are fetched."],
              ["03", "Verify", "Facts keep evidence and unknown values stay unknown."],
              ["04", "Publish & match", "Confidence, duplicate and application-link gates run first."],
            ].map(([number, title, body]) => (
              <li key={number}>
                <span>{number}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="discovery-coverage" as="section">
          <p className="card-eyebrow">Rotating coverage</p>
          <h2>9 destinations · 7 pathways</h2>
          <div className="discovery-country-list">
            {[
              "China",
              "United Kingdom",
              "Canada",
              "Australia",
              "Germany",
              "Ireland",
              "Netherlands",
              "United States",
              "New Zealand",
            ].map((country) => (
              <span key={country}>{country}</span>
            ))}
          </div>
          <hr />
          <p className="discovery-note">
            <strong>Origin focus:</strong> Nigeria. Only aggregate taxonomy demand informs queries; Passport
            data never leaves WAYFOUND.
          </p>
        </Card>
      </div>
    </main>
  );
}
