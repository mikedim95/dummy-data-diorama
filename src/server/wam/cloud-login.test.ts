// @vitest-environment node
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { connectDatabase, migrate, type Database } from "./database";
import { seedDemo, demoId } from "./seed";
import { cloudPasswordLogin } from "./auth";
const sdk = vi.hoisted(() => ({ signIn: vi.fn(), claims: vi.fn(), roles: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { signInWithPassword: sdk.signIn, getClaims: sdk.claims },
    from: () => ({ select: () => ({ eq: sdk.roles }) }),
  }),
}));
let db: Database;
const previous = { ...process.env };
const request = new Request("https://wam.example/api/wam/login", {
  headers: { Cookie: "wam_session=stale-other-account" },
});
beforeAll(async () => {
  process.env["SUPABASE_URL"] = "https://identity.example";
  process.env["SUPABASE_PUBLISHABLE_KEY"] = "test-key";
  db = await connectDatabase(undefined, "memory://");
  await migrate(db);
  await seedDemo(db);
  await db.query(
    "UPDATE \"USER_ACCOUNT\" SET auth_provider='supabase',auth_subject=$1 WHERE id=$2",
    ["verified-subject", demoId("account:WAM-MANAGER-01")],
  );
  sdk.signIn.mockResolvedValue({
    data: {
      session: { access_token: "verified-access-token", refresh_token: "verified-refresh-token" },
    },
    error: null,
  });
  sdk.claims.mockResolvedValue({ data: { claims: { sub: "verified-subject" } }, error: null });
  sdk.roles.mockResolvedValue({ data: [{ role: "manager" }, { role: "finance" }], error: null });
}, 30000);
afterAll(async () => {
  await db.close();
  for (const key of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});
it("checks provider credentials and verified subject before returning the database identity", async () => {
  const signed = await cloudPasswordLogin(db, request, "real-user@example.com", "test-password");
  expect(sdk.signIn).toHaveBeenCalledWith({
    email: "real-user@example.com",
    password: "test-password",
  });
  expect(sdk.claims).toHaveBeenCalledWith("verified-access-token");
  expect(signed.account).toMatchObject({
    id: demoId("account:WAM-MANAGER-01"),
    role: "ADMIN",
    managerAccess: true,
    financeAccess: true,
  });
  expect(signed.session.access_token).toBe("verified-access-token");
  sdk.roles.mockResolvedValueOnce({ data: [], error: null });
  expect(
    (await cloudPasswordLogin(db, request, "real-user@example.com", "test-password")).account
      .managerAccess,
  ).toBe(false);
});
it("does not release a session for invalid credentials or an inactive linked account", async () => {
  sdk.signIn.mockResolvedValueOnce({ data: { session: null }, error: new Error("invalid") });
  await expect(
    cloudPasswordLogin(db, request, "real-user@example.com", "wrong"),
  ).rejects.toMatchObject({ status: 401 });
  await db.query('UPDATE "USER_ACCOUNT" SET is_active=false WHERE id=$1', [
    demoId("account:WAM-MANAGER-01"),
  ]);
  await expect(
    cloudPasswordLogin(db, request, "real-user@example.com", "test-password"),
  ).rejects.toMatchObject({ status: 403 });
});
