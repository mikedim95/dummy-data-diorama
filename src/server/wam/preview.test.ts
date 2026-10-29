// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDatabase, migrate, type Database } from "./database";
import { bootstrapPasswords } from "./passwords";
import { seedDemo, demoId } from "./seed";
import { handleWamRequest } from "./api";
import { authenticate, sessionCookie } from "./auth";
import { adminSnapshot } from "./read-models";

const origin = "https://preview.wam.example";
const managerPassword = "test-manager-password-long-enough";
const operatorPassword = "test-operator-password-long-enough";
const runtime = globalThis as typeof globalThis & { wamDatabase?: Promise<Database> };
let db: Database;
const previousEnvironment = { ...process.env };
function request(path: string, input?: unknown, cookie = "", protocol = "https:") {
  return handleWamRequest(
    new Request(`${protocol}//preview.wam.example/api/wam/${path}`, {
      method: input === undefined ? "GET" : "POST",
      headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    }),
  );
}
beforeAll(async () => {
  process.env["NODE_ENV"] = "production";
  process.env["WAM_PREVIEW_MODE"] = "true";
  process.env["WAM_PUBLIC_ORIGIN"] = origin;
  process.env["WAM_SESSION_SECRET"] = "test-preview-session-secret-long-enough";
  process.env["WAM_PREVIEW_ADMIN_PASSWORD"] = managerPassword;
  process.env["WAM_PREVIEW_OPERATOR_PASSWORD"] = operatorPassword;
  db = await connectDatabase(undefined, "memory://");
  await migrate(db);
  await seedDemo(db, "seed-preview");
  await bootstrapPasswords(db, "preview");
  runtime.wamDatabase = Promise.resolve(db);
}, 30000);
afterAll(async () => {
  delete runtime.wamDatabase;
  await db?.close();
  for (const key of [
    "NODE_ENV",
    "WAM_PREVIEW_MODE",
    "WAM_PUBLIC_ORIGIN",
    "WAM_SESSION_SECRET",
    "WAM_PREVIEW_ADMIN_PASSWORD",
    "WAM_PREVIEW_OPERATOR_PASSWORD",
  ]) {
    if (previousEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[key];
  }
});

describe.sequential("Password-protected hosted preview", () => {
  it("stores per-account salted hashes privately and keeps provisioning repeatable", async () => {
    const before = (
      await db.query(
        "SELECT account_id,password_hash,updated_at FROM wam_internal.password_credentials ORDER BY account_id",
      )
    ).rows;
    expect(before).toHaveLength(3);
    expect(new Set(before.map((row) => row["password_hash"]))).toHaveProperty("size", 3);
    expect(JSON.stringify(before)).not.toContain(managerPassword);
    expect(JSON.stringify(before)).not.toContain(operatorPassword);
    await bootstrapPasswords(db, "preview");
    expect(
      (
        await db.query(
          "SELECT account_id,password_hash,updated_at FROM wam_internal.password_credentials ORDER BY account_id",
        )
      ).rows,
    ).toEqual(before);
    await expect(
      db.query('UPDATE "USER_ACCOUNT" SET login_email=$1 WHERE id=$2', [
        "admin@wam.example",
        demoId("account:OP-104"),
      ]),
    ).rejects.toThrow(/unique|duplicate/);
  });
  it("uses the same endpoint for both roles and resolves identity by normalized email", async () => {
    const manager = await request("login", {
      email: " ADMIN@wam.example ",
      password: managerPassword,
    });
    expect(manager.status).toBe(200);
    expect(await manager.json()).toMatchObject({
      role: "ADMIN",
      destination: "/admin",
      email: "admin@wam.example",
    });
    const operator = await request("login", {
      email: "nikos@wam.example",
      password: operatorPassword,
    });
    expect(operator.status).toBe(200);
    expect(await operator.json()).toMatchObject({ role: "PRODUCTION", destination: "/scan" });
    expect(
      (
        await request("login", {
          email: "nikos@wam.example",
          password: operatorPassword,
          role: "ADMIN",
        })
      ).status,
    ).toBe(400);
    expect(
      (await request("preview-login", { email: "admin@wam.example", password: managerPassword }))
        .status,
    ).toBe(401);
    const wrong = await request("login", {
      email: "admin@wam.example",
      password: "wrong-password",
    });
    const unknown = await request("login", {
      email: "unknown@wam.example",
      password: "wrong-password",
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });
  it("rechecks database roles and activation instead of trusting the email or session role", async () => {
    const signed = await request("login", {
      email: "nikos@wam.example",
      password: operatorPassword,
    });
    const cookie = signed.headers.get("set-cookie")!.split(";")[0]!;
    const id = demoId("account:OP-104");
    await db.query("UPDATE \"USER_ACCOUNT\" SET role='MANAGER' WHERE id=$1", [id]);
    expect(await (await request("session", undefined, cookie)).json()).toMatchObject({
      role: "MANAGER",
      destination: "/admin",
    });
    const changed = await request("login", {
      email: "nikos@wam.example",
      password: operatorPassword,
    });
    expect(await changed.json()).toMatchObject({ role: "MANAGER", destination: "/admin" });
    await db.query("UPDATE \"USER_ACCOUNT\" SET role='PRODUCTION',is_active=false WHERE id=$1", [
      id,
    ]);
    expect((await request("session", undefined, cookie)).status).toBe(403);
    expect(
      (await request("login", { email: "nikos@wam.example", password: operatorPassword })).status,
    ).toBe(401);
    await db.query('UPDATE "USER_ACCOUNT" SET is_active=true WHERE id=$1', [id]);
  });
  it("exposes only mode flags and keeps local PIN login disabled", async () => {
    expect(await (await request("config")).json()).toEqual({ localDemo: false, preview: true });
    expect((await request("login", { id: "WAM-MANAGER-01", pin: "1234" })).status).toBe(400);
    expect((await request("login", { email: "admin@wam.example", password: "1234" })).status).toBe(
      401,
    );
    expect(
      (await request("login", { email: "nikos@wam.example", password: managerPassword })).status,
    ).toBe(401);
  });

  it("issues secure manager sessions with database-backed role checks", async () => {
    const response = await request("login", {
      email: "admin@wam.example",
      password: managerPassword,
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain(managerPassword);
    const account = await authenticate(
      db,
      new Request(origin, { headers: { Cookie: cookie.split(";")[0]! } }),
    );
    expect(account.auth_provider).toBe("password-preview");
    expect((await adminSnapshot(db, account)).canSeeFinance).toBe(true);
  });

  it("rejects HTTP, foreign origins, and cookies from another login mode", async () => {
    expect(
      (
        await request(
          "login",
          { email: "admin@wam.example", password: managerPassword },
          "",
          "http:",
        )
      ).status,
    ).toBe(403);
    const crossOrigin = new Request(origin + "/api/wam/login", {
      method: "POST",
      headers: { Origin: "https://other.example", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@wam.example", password: managerPassword }),
    });
    expect((await handleWamRequest(crossOrigin)).status).toBe(403);
    expect(
      (await request("session", undefined, sessionCookie(demoId("account:WAM-MANAGER-01")))).status,
    ).toBe(401);
  });

  it("supports Render TLS termination and preserves operator restrictions", async () => {
    const proxied = new Request("http://127.0.0.1:10000/api/wam/login", {
      method: "POST",
      headers: { Origin: origin, "X-Forwarded-Proto": "https", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nikos@wam.example", password: operatorPassword }),
    });
    const response = await handleWamRequest(proxied);
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
    expect((await request("operator", undefined, cookie)).status).toBe(200);
    expect((await request("audit", undefined, cookie)).status).toBe(403);
  });

  it("fails closed when hosted preview passwords are weak or disabled", async () => {
    process.env["WAM_PREVIEW_ADMIN_PASSWORD"] = "1234";
    try {
      expect(
        (await request("login", { email: "admin@wam.example", password: "1234" })).status,
      ).toBe(403);
      expect((await (await request("config")).json()).preview).toBe(false);
    } finally {
      process.env["WAM_PREVIEW_ADMIN_PASSWORD"] = managerPassword;
    }
  });
});
