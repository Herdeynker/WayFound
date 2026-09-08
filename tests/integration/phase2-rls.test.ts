import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, describe, expect, it } from "vitest";

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

describe("Phase 2 RLS isolation", () => {
  afterAll(async () => {
    for (const userId of createdUsers) await admin?.auth.admin.deleteUser(userId);
  });

  testCase(
    "denies anonymous access and isolates user A from user B",
    async () => {
      const password = `Phase2-${crypto.randomUUID()}-Safe!`;
      const emailA = `phase2-a-${crypto.randomUUID()}@example.test`;
      const emailB = `phase2-b-${crypto.randomUUID()}@example.test`;
      const { data: createdA, error: createAError } = await admin!.auth.admin.createUser({
        email: emailA,
        password,
        email_confirm: true,
      });
      const { data: createdB, error: createBError } = await admin!.auth.admin.createUser({
        email: emailB,
        password,
        email_confirm: true,
      });
      expect(createAError).toBeNull();
      expect(createBError).toBeNull();
      const userAId = createdA.user!.id;
      const userBId = createdB.user!.id;
      createdUsers.push(userAId, userBId);
      const clientA = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: "phase2-rls-a" },
      });
      const clientB = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: "phase2-rls-b" },
      });
      expect((await clientA.auth.signInWithPassword({ email: emailA, password })).error).toBeNull();
      expect((await clientB.auth.signInWithPassword({ email: emailB, password })).error).toBeNull();

      const anonymous = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: "phase2-rls-anon" },
      });
      const anonymousRead = await anonymous.from("profiles").select("id");
      expect(anonymousRead.error).not.toBeNull();
      const ownRead = await clientA.from("profiles").select("id").eq("id", userAId);
      expect(ownRead.error).toBeNull();
      expect(ownRead.data).toHaveLength(1);
      const otherRead = await clientA.from("profiles").select("id").eq("id", userBId);
      expect(otherRead.error).toBeNull();
      expect(otherRead.data).toHaveLength(0);
      const crossUserWrite = await clientA
        .from("profiles")
        .update({ display_name: "should-not-change" })
        .eq("id", userBId);
      expect(crossUserWrite.error).toBeNull();
      const untouched = await admin!.from("profiles").select("display_name").eq("id", userBId).single();
      expect(untouched.data?.display_name).not.toBe("should-not-change");
    },
    30_000,
  );
});
