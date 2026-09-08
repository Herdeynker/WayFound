import { AccountSettings } from "@/features/auth/account-settings";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";

export default async function AccountSettingsPage() {
  if (await isTestFixtureRequest()) {
    return (
      <AccountSettings
        email="demo@example.test"
        preferences={{ email_enabled: false, telegram_enabled: false }}
        exportRequested={false}
        deletionRequested={false}
      />
    );
  }
  const { user, client } = await requireConsentedUser();
  if (!user) return null;
  const [{ data: preferences }, { data: exportRequests }, { data: deletionRequests }] = await Promise.all([
    client
      .from("notification_preferences")
      .select("email_enabled, telegram_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
    client
      .from("data_export_requests")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"]),
    client
      .from("account_deletion_requests")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"]),
  ]);
  return (
    <AccountSettings
      email={user.email ?? "your verified email"}
      preferences={preferences ?? { email_enabled: false, telegram_enabled: false }}
      exportRequested={(exportRequests?.length ?? 0) > 0}
      deletionRequested={(deletionRequests?.length ?? 0) > 0}
      deletionRequestId={deletionRequests?.[0]?.id}
    />
  );
}
