import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && publicKey && secretKey);
const testCase = live ? it : it.skip;
const admin = live
  ? createClient(url!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const createdUsers: string[] = [];
const quarantinePaths: string[] = [];
const userClient = (key: string) =>
  createClient(url!, publicKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: key },
  });

async function clearPriorFixtures() {
  if (!admin) return;
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  expect(users.error).toBeNull();
  for (const user of users.data.users.filter((item) =>
    /^phase14-[ab]-.*@example\.test$/.test(item.email ?? ""),
  )) {
    const collect = async (prefix: string): Promise<string[]> => {
      const listed = await admin.storage
        .from("user-document-quarantine")
        .list(prefix, { limit: 1000, offset: 0 });
      const paths: string[] = [];
      for (const entry of listed.data ?? []) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id) paths.push(path);
        else paths.push(...(await collect(path)));
      }
      return paths;
    };
    const paths = await collect(user.id);
    if (paths.length) await admin.storage.from("user-document-quarantine").remove(paths);
    expect((await admin.auth.admin.deleteUser(user.id)).error).toBeNull();
  }
}

describe("Phase 14 hosted launch security", () => {
  beforeAll(clearPriorFixtures, 45_000);
  afterAll(async () => {
    if (!admin) return;
    if (quarantinePaths.length) await admin.storage.from("user-document-quarantine").remove(quarantinePaths);
    for (const userId of createdUsers) expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
  }, 45_000);

  testCase(
    "enforces service-only operations, isolation, immutability, idempotency and atomic limits",
    async () => {
      const password = `Phase14-${crypto.randomUUID()}-Safe!`;
      const [createdA, createdB] = await Promise.all(
        ["a", "b"].map((suffix) =>
          admin!.auth.admin.createUser({
            email: `phase14-${suffix}-${crypto.randomUUID()}@example.test`,
            password,
            email_confirm: true,
          }),
        ),
      );
      expect(createdA.error).toBeNull();
      expect(createdB.error).toBeNull();
      const userA = createdA.data.user!.id;
      const userB = createdB.data.user!.id;
      createdUsers.push(userA, userB);
      const clientA = userClient(`phase14-a-${crypto.randomUUID()}`);
      const clientB = userClient(`phase14-b-${crypto.randomUUID()}`);
      const anonymous = userClient(`phase14-anon-${crypto.randomUUID()}`);
      expect(
        (await clientA.auth.signInWithPassword({ email: createdA.data.user!.email!, password })).error,
      ).toBeNull();
      expect(
        (await clientB.auth.signInWithPassword({ email: createdB.data.user!.email!, password })).error,
      ).toBeNull();

      expect((await anonymous.from("product_analytics_events").select("id")).error).not.toBeNull();
      expect(
        (
          await clientA
            .from("product_analytics_events")
            .insert({ event_type: "registration", idempotency_key: crypto.randomUUID() })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.rpc("phase14_consume_rate_limit", {
            candidate_scope: "forged",
            candidate_subject_hash: "a".repeat(64),
            maximum_requests: 5,
            window_seconds: 60,
          })
        ).error,
      ).not.toBeNull();

      const idempotencyKey = crypto.randomUUID();
      const analytics = await admin!
        .from("product_analytics_events")
        .insert({
          user_id: userA,
          event_type: "registration",
          idempotency_key: idempotencyKey,
          properties: { channel: "email" },
        })
        .select("id")
        .single();
      expect(analytics.error).toBeNull();
      expect(
        (
          await admin!.from("product_analytics_events").insert({
            user_id: userA,
            event_type: "registration",
            idempotency_key: idempotencyKey,
            properties: {},
          })
        ).error?.code,
      ).toBe("23505");
      expect(
        (
          await admin!
            .from("product_analytics_events")
            .update({ event_type: "return_session" })
            .eq("id", analytics.data!.id)
        ).error,
      ).not.toBeNull();

      const scanIdA = crypto.randomUUID();
      const scanIdB = crypto.randomUUID();
      const pathA = `${userA}/${scanIdA}/upload.pdf`;
      const pathB = `${userB}/${scanIdB}/upload.pdf`;
      const common = {
        purpose: "passport_document",
        original_filename: "synthetic.pdf",
        content_type: "application/pdf",
        size_bytes: 12,
        checksum_sha256: "a".repeat(64),
        provider: "test_fixture",
        status: "pending",
      };
      expect(
        (
          await admin!.from("document_scan_records").insert([
            {
              ...common,
              id: scanIdA,
              user_id: userA,
              idempotency_key: crypto.randomUUID(),
              quarantine_path: pathA,
            },
            {
              ...common,
              id: scanIdB,
              user_id: userB,
              idempotency_key: crypto.randomUUID(),
              quarantine_path: pathB,
            },
          ])
        ).error,
      ).toBeNull();
      expect((await clientA.from("document_scan_records").select("user_id")).data).toEqual([
        { user_id: userA },
      ]);
      expect(
        (await clientA.from("document_scan_records").update({ status: "clean" }).eq("id", scanIdA)).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.from("document_scan_records").insert({
            ...common,
            id: crypto.randomUUID(),
            user_id: userB,
            idempotency_key: crypto.randomUUID(),
            quarantine_path: `${userB}/${crypto.randomUUID()}/upload.pdf`,
          })
        ).error,
      ).not.toBeNull();

      const bytes = new TextEncoder().encode("synthetic quarantine fixture");
      expect(
        (
          await admin!.storage
            .from("user-document-quarantine")
            .upload(pathB, bytes, { contentType: "application/pdf" })
        ).error,
      ).toBeNull();
      quarantinePaths.push(pathB);
      expect((await anonymous.storage.from("user-document-quarantine").download(pathB)).error).not.toBeNull();
      expect((await clientA.storage.from("user-document-quarantine").download(pathB)).error).not.toBeNull();
      expect((await clientB.storage.from("user-document-quarantine").download(pathB)).error).not.toBeNull();

      const subjectHash = crypto.randomUUID().replaceAll("-", "").padEnd(64, "a");
      const attempts = await Promise.all(
        Array.from({ length: 5 }, () =>
          admin!.rpc("phase14_consume_rate_limit", {
            candidate_scope: "phase14.integration",
            candidate_subject_hash: subjectHash,
            maximum_requests: 2,
            window_seconds: 60,
          }),
        ),
      );
      expect(attempts.every((result) => !result.error)).toBe(true);
      expect(attempts.filter((result) => result.data?.[0]?.allowed).length).toBe(2);

      expect((await admin!.auth.admin.deleteUser(userA)).error).toBeNull();
      createdUsers.splice(createdUsers.indexOf(userA), 1);
      expect(
        (await admin!.from("document_scan_records").select("id").eq("user_id", userA)).data,
      ).toHaveLength(0);
      expect(
        (await admin!.from("product_analytics_events").select("user_id").eq("id", analytics.data!.id)).data,
      ).toEqual([{ user_id: null }]);
    },
    60_000,
  );
});
