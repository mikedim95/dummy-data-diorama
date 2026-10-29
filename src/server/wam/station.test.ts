// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { connectDatabase, migrate, type Database } from "./database";
import { seedDemo, demoId } from "./seed";
import { bootstrapPasswords } from "./passwords";
import { handleWamRequest } from "./api";
import { sessionCookie } from "./auth";

let db: Database;
const origin = "http://127.0.0.1:3000";
const runtime = globalThis as typeof globalThis & { wamDatabase?: Promise<Database> };
class BrowserSession {
  jar = new Map<string, string>();
  async call(path: string, input?: unknown) {
    const response = await handleWamRequest(
      new Request(origin + "/api/wam/" + path, {
        method: input === undefined ? "GET" : "POST",
        headers: {
          Cookie: [...this.jar].map(([key, value]) => `${key}=${value}`).join("; "),
          Origin: origin,
          "Content-Type": "application/json",
        },
        ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      }),
    );
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0]!;
      const split = pair.indexOf("=");
      if (cookie.includes("Max-Age=0")) this.jar.delete(pair.slice(0, split));
      else this.jar.set(pair.slice(0, split), pair.slice(split + 1));
    }
    return response;
  }
  async login(email = "nikos@wam.example") {
    const response = await this.call("login", { email, password: "WamLocal!2026" });
    expect(response.status).toBe(200);
    return response.json();
  }
}
const browser = new BrowserSession();
beforeAll(async () => {
  process.env["WAM_LOCAL_DEMO"] = "true";
  process.env["WAM_LOCAL_PASSWORD"] = "WamLocal!2026";
  db = await connectDatabase(undefined, "memory://");
  await migrate(db);
  await seedDemo(db);
  await bootstrapPasswords(db, "local");
  runtime.wamDatabase = Promise.resolve(db);
}, 30000);
afterAll(async () => {
  delete runtime.wamDatabase;
  await db.close();
});
describe.sequential("Machine-specific operator work", () => {
  it("lands on profile and returns no jobs or checks before selecting a machine", async () => {
    expect(await browser.login()).toMatchObject({ destination: "/profile" });
    const snapshot = await (await browser.call("operator")).json();
    expect(snapshot.machineCode).toBeNull();
    expect(snapshot.tasks).toEqual([]);
    expect(snapshot.maintenance).toEqual({});
    expect(
      (await browser.call(`tasks/${demoId("job:t1042")}/claim`, { recordVersion: 1 })).status,
    ).toBe(409);
  });
  it("returns only the scanned machine's work, retains that context on reload and rejects foreign jobs", async () => {
    const snapshot = await (await browser.call("machine", { code: "WAM-CNC-01" })).json();
    expect(snapshot.machineCode).toBe("WAM-CNC-01");
    expect(snapshot.tasks.length).toBeGreaterThan(0);
    expect(snapshot.tasks.every((task: { machine: string }) => task.machine === "WAM-CNC-01")).toBe(
      true,
    );
    expect(Object.keys(snapshot.maintenance)).toEqual(["WAM-CNC-01"]);
    expect((await (await browser.call("session")).json()).destination).toBe("/work");
    expect((await (await browser.call("operator")).json()).tasks).toEqual(snapshot.tasks);
    expect(
      (await browser.call(`tasks/${demoId("job:t2051")}/claim`, { recordVersion: 1 })).status,
    ).toBe(403);
  });
  it("changes the job list on a new scan and rejects an earlier or altered scan context", async () => {
    const before = await (await browser.call("operator")).json();
    const plan = before.maintenance["WAM-CNC-01"].find(
      (item: { phase: string; kind: string }) => item.phase === "start" && item.kind === "required",
    );
    expect(
      (
        await browser.call("checks", {
          phase: "start",
          id: plan.id,
          state: "done",
          requestKey: randomUUID(),
        })
      ).status,
    ).toBe(200);
    const oldContext = browser.jar.get("wam_station")!;
    const snapshot = await (await browser.call("machine", { code: "WAM-LSR-02" })).json();
    expect(snapshot.tasks.length).toBeGreaterThan(0);
    expect(snapshot.tasks.every((task: { machine: string }) => task.machine === "WAM-LSR-02")).toBe(
      true,
    );
    expect(snapshot.startChecks).toEqual({});
    expect(
      (await db.query('SELECT count(*)::int AS n FROM "SHIFT_CHECK" WHERE plan_id=$1', [plan.id]))
        .rows[0]!["n"],
    ).toBe(1);
    const current = browser.jar.get("wam_station")!;
    browser.jar.set("wam_station", oldContext);
    expect((await (await browser.call("operator")).json()).tasks).toEqual([]);
    browser.jar.set("wam_station", current.slice(0, -1) + (current.endsWith("a") ? "b" : "a"));
    expect((await (await browser.call("operator")).json()).machineCode).toBeNull();
    browser.jar.set("wam_station", current);
  });
  it("requires a new scan after another login without erasing workstation history", async () => {
    const oldContext = browser.jar.get("wam_station")!;
    expect(await browser.login()).toMatchObject({ destination: "/profile" });
    expect(browser.jar.has("wam_station")).toBe(false);
    expect((await (await browser.call("operator")).json()).tasks).toEqual([]);
    browser.jar.set("wam_station", oldContext);
    expect((await (await browser.call("operator")).json()).tasks).toEqual([]);
    expect((await db.query('SELECT count(*)::int AS n FROM "OPERATOR_SHIFT"')).rows[0]!["n"]).toBe(
      2,
    );
    await browser.call("machine", { code: "WAM-LSR-02" });
    const other = new BrowserSession();
    await other.login("eleni@wam.example");
    other.jar.set("wam_station", browser.jar.get("wam_station")!);
    expect((await (await other.call("operator")).json()).tasks).toEqual([]);
    await browser.call("logout", {});
    expect(browser.jar.size).toBe(0);
  });
  it("never treats a cloud scan-context cookie as authenticated identity", async () => {
    const other = new BrowserSession();
    other.jar.set(
      "wam_session",
      sessionCookie(demoId("account:OP-104"), false, "cloud").split(";")[0]!.split("=")[1]!,
    );
    expect((await other.call("operator")).status).toBe(401);
  });
});
