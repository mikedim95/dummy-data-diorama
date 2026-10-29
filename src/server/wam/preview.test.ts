// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDatabase, migrate, type Database } from "./database";
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
  it("exposes only mode flags and keeps local PIN login disabled", async () => {
    expect(await (await request("config")).json()).toEqual({ localDemo: false, preview: true });
    expect((await request("login", { id: "WAM-MANAGER-01", pin: "1234" })).status).toBe(403);
    expect(
      (await request("preview-login", { id: "WAM-MANAGER-01", password: "1234" })).status,
    ).toBe(401);
    expect(
      (await request("preview-login", { id: "OP-104", password: managerPassword })).status,
    ).toBe(401);
  });

  it("issues secure manager sessions with database-backed role checks", async () => {
    const response = await request("preview-login", {
      id: "WAM-MANAGER-01",
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
    expect(account.auth_provider).toBe("seed-preview");
    expect((await adminSnapshot(db, account)).canSeeFinance).toBe(true);
  });

  it("rejects HTTP, foreign origins, and cookies from another login mode", async () => {
    expect(
      (
        await request(
          "preview-login",
          { id: "WAM-MANAGER-01", password: managerPassword },
          "",
          "http:",
        )
      ).status,
    ).toBe(403);
    const crossOrigin = new Request(origin + "/api/wam/preview-login", {
      method: "POST",
      headers: { Origin: "https://other.example", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "WAM-MANAGER-01", password: managerPassword }),
    });
    expect((await handleWamRequest(crossOrigin)).status).toBe(403);
    expect(
      (await request("session", undefined, sessionCookie(demoId("account:WAM-MANAGER-01")))).status,
    ).toBe(401);
  });

  it("supports Render TLS termination and preserves operator restrictions", async () => {
    const proxied = new Request("http://127.0.0.1:10000/api/wam/preview-login", {
      method: "POST",
      headers: { Origin: origin, "X-Forwarded-Proto": "https", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "OP-104", password: operatorPassword }),
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
        (await request("preview-login", { id: "WAM-MANAGER-01", password: "1234" })).status,
      ).toBe(403);
      expect((await (await request("config")).json()).preview).toBe(false);
    } finally {
      process.env["WAM_PREVIEW_ADMIN_PASSWORD"] = managerPassword;
    }
  });
});
