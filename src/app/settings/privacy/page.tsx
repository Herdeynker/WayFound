import { Card } from "@/components/ui";
import { getPolicyVersion } from "@/server/auth/constants";
import { requireConsentedUser } from "@/server/auth/guards";

export default async function PrivacySettingsPage() {
  const { user, client } = await requireConsentedUser();
  if (!user) return null;
  const { data: consents } = await client
    .from("user_consents")
    .select("consent_type, granted, policy_version, recorded_at")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: false })
    .limit(20);
  return (
    <Card>
      <p className="card-eyebrow">Privacy & consent</p>
      <h2>Consent history</h2>
      <p className="settings-muted">
        Current policy version: <strong>{getPolicyVersion()}</strong>. New choices are added to history so you
        can see what changed.
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
  );
}
