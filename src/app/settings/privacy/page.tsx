import { Card } from "@/components/ui";
import { getPolicyVersion } from "@/server/auth/constants";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { TrustCenter, type TrustCenterState } from "@/features/launch/trust-center";
import { parseServerEnvironment } from "@/lib/env/schema";

const fixtureStates = new Set<TrustCenterState>([
  "ready",
  "first-use",
  "success",
  "loading",
  "error",
  "interrupted",
  "stale",
  "permission",
  "provider-disabled",
]);

export default async function PrivacySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const fixture = await isTestFixtureRequest();
  const requested = (await searchParams).state as TrustCenterState | undefined;
  const state = fixture && requested && fixtureStates.has(requested) ? requested : "ready";
  const scannerConfigured = fixture
    ? state !== "provider-disabled"
    : Boolean(parseServerEnvironment().UPLOAD_SCANNER_PROVIDER);
  if (fixture) {
    return (
      <TrustCenter policyVersion={getPolicyVersion()} scannerConfigured={scannerConfigured} state={state}>
        <Card>
          <p className="card-eyebrow">Privacy & consent</p>
          <h2>Consent history</h2>
          <p className="settings-muted">No account history is loaded in this evidence fixture.</p>
        </Card>
      </TrustCenter>
    );
  }
  const { user, client } = await requireConsentedUser();
  if (!user) return null;
  const { data: consents } = await client
    .from("user_consents")
    .select("consent_type, granted, policy_version, recorded_at")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: false })
    .limit(20);
  return (
    <TrustCenter policyVersion={getPolicyVersion()} scannerConfigured={scannerConfigured}>
      <Card>
        <p className="card-eyebrow">Privacy & consent</p>
        <h2>Consent history</h2>
        <p className="settings-muted">
          Current policy version: <strong>{getPolicyVersion()}</strong>. New choices are added to history so
          you can see what changed.
        </p>
        <div className="consent-history">
          {(consents ?? []).map((consent) => (
            <div key={`${consent.recorded_at}-${consent.consent_type}`}>
              <span>{consent.consent_type.replaceAll("_", " ")}</span>
              <strong className={consent.granted ? "is-granted" : "is-withheld"}>
                {consent.granted ? "Granted" : "Withheld"}
              </strong>
            </div>
          ))}
        </div>
      </Card>
    </TrustCenter>
  );
}
