// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectDatabase, migrate, type Database } from "./database";
import { bootstrapPasswords } from "./passwords";
import { demoId, seedDemo } from "./seed";
import { handleWamRequest } from "./api";
import { authenticate, sessionCookie } from "./auth";
import { adminSnapshot, operatorSnapshot } from "./read-models";

let db: Database;
let directory: string;
let operatorCookie: string;
let managerCookie: string;
const origin = "http://localhost:3000";
const runtime = globalThis as typeof globalThis & { wamDatabase?: Promise<Database> };
async function request(path: string, cookie = "", input?: unknown, method = "POST") {
  const response = await handleWamRequest(
    new Request(`${origin}/api/wam/${path}`, {
      method: input === undefined ? "GET" : method,
      headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    }),
  );
  const jar = new Map(
    cookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const split = part.indexOf("=");
        return [part.slice(0, split), part.slice(split + 1)] as [string, string];
      }),
  );
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";")[0]!;
    const split = pair.indexOf("=");
    if (value.includes("Max-Age=0")) jar.delete(pair.slice(0, split));
    else jar.set(pair.slice(0, split), pair.slice(split + 1));
  }
  const updated = [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
  if (cookie === operatorCookie) operatorCookie = updated;
  if (cookie === managerCookie) managerCookie = updated;
  return response;
}
const accountFor = (cookie: string) =>
  authenticate(db, new Request(origin, { headers: { Cookie: cookie } }));

beforeAll(async () => {
  process.env["WAM_LOCAL_DEMO"] = "true";
  process.env["WAM_LOCAL_PASSWORD"] = "WamLocal!2026";
  directory = await mkdtemp(join(tmpdir(), "wam-backend-"));
  process.env["WAM_UPLOAD_DIR"] = join(directory, "uploads");
  db = await connectDatabase(undefined, "memory://");
  await migrate(db);
  await seedDemo(db);
  await bootstrapPasswords(db, "local");
  runtime.wamDatabase = Promise.resolve(db);
  operatorCookie = sessionCookie(demoId("account:OP-104")).split(";")[0]!;
  managerCookie = sessionCookie(demoId("account:WAM-MANAGER-01")).split(";")[0]!;
}, 30000);
afterAll(async () => {
  delete runtime.wamDatabase;
  await db?.close();
  if (directory && directory.startsWith(join(tmpdir(), "wam-backend-")))
    await rm(directory, { recursive: true, force: true });
});

describe.sequential("WAM v4 PostgreSQL backend", () => {
  it("loads all 25 tables and all DBML columns; migration and seeding are repeatable", async () => {
    const before = (await db.query('SELECT count(*)::int AS n FROM "AUDIT_LOG"')).rows[0]!["n"];
    await migrate(db);
    await seedDemo(db);
    expect((await request("health")).status).toBe(200);
    expect((await (await request("health")).json()).tables).toBe(28);
    const schema = await readFile("database/schema/WAM_unified_25_tables_v4.dbml", "utf8");
    const actual = (
      await db.query(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
      )
    ).rows;
    const tables = [...schema.matchAll(/^Table (\w+)[^\n]*\{\r?\n([\s\S]*?)^\}/gm)];
    expect(tables).toHaveLength(25);
    for (const match of tables) {
      const columns = [
        ...match[2]!.matchAll(
          /^ {2}(\w+)\s+(?:uuid|varchar|char|text|boolean|date|timestamptz|int|numeric|bigint|jsonb)\b/gm,
        ),
      ].map((column) => column[1]);
      for (const column of columns)
        expect(
          actual.some((row) => row["table_name"] === match[1] && row["column_name"] === column),
          `${match[1]}.${column}`,
        ).toBe(true);
    }
    expect((await db.query('SELECT count(*)::int AS n FROM "AUDIT_LOG"')).rows[0]!["n"]).toBe(
      before,
    );
  });

  it("requires authentication, checks passwords server-side, and rejects cross-origin writes", async () => {
    expect((await request("operator")).status).toBe(401);
    expect(
      (await request("login", "", { email: "nikos@wam.example", password: "wrong-password" }))
        .status,
    ).toBe(401);
    const crossSite = await handleWamRequest(
      new Request(`${origin}/api/wam/login`, {
        method: "POST",
        headers: { Origin: "https://other.example", "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nikos@wam.example", password: "WamLocal!2026" }),
      }),
    );
    expect(crossSite.status).toBe(403);
    const login = await request("login", "", {
      email: "nikos@wam.example",
      password: "WamLocal!2026",
    });
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    const data = await (await request("operator", operatorCookie)).json();
    expect(data.operator).not.toHaveProperty("pin");
  });

  it("keeps local login disabled in production", async () => {
    const previous = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    try {
      expect(
        (await request("login", "", { email: "admin@wam.example", password: "WamLocal!2026" }))
          .status,
      ).toBe(403);
    } finally {
      process.env["NODE_ENV"] = previous;
    }
  });

  it("rechecks employee activation on every request", async () => {
    await db.query('UPDATE "EMPLOYEE" SET is_active=false WHERE id=$1', [demoId("OP-117")]);
    const cookie = sessionCookie(demoId("account:OP-117")).split(";")[0]!;
    expect((await request("operator", cookie)).status).toBe(403);
    await db.query('UPDATE "EMPLOYEE" SET is_active=true WHERE id=$1', [demoId("OP-117")]);
  });

  it("creates intake orders and rejects stale management updates or actor overrides", async () => {
    const customerResponse = await request("customers", managerCookie, {
      name: "Backend test customer",
    });
    expect(customerResponse.status).toBe(201);
    const customer = await customerResponse.json();
    const orderResponse = await request("orders", managerCookie, {
      order_number: "WAM-TEST-0001",
      title: "Backend test order",
      customer_id: customer.id,
      quantity: 4,
    });
    expect(orderResponse.status).toBe(201);
    const order = await orderResponse.json();
    expect(order.approval_required).toBe(true);
    expect(order.intake_employee_id).toBe(demoId("WAM-MANAGER-01"));
    expect(
      (
        await request(
          `orders/${order.id}`,
          managerCookie,
          { record_version: 99, status: "CANCELLED", cancellation_reason: "Test cancellation" },
          "PATCH",
        )
      ).status,
    ).toBe(409);
    const cancelled = await request(
      `orders/${order.id}`,
      managerCookie,
      {
        record_version: order.record_version,
        status: "CANCELLED",
        cancellation_reason: "Test cancellation",
      },
      "PATCH",
    );
    expect(cancelled.status).toBe(200);
    expect((await cancelled.json()).record_version).toBe(2);
    expect((await request("customers", operatorCookie, { name: "Unauthorized" })).status).toBe(403);
    expect(
      (await request("customers", managerCookie, { name: "Spoof", actor_user_id: randomUUID() }))
        .status,
    ).toBe(400);
  });

  it("rejects operator management access and redacts finance for managers", async () => {
    const operator = await accountFor(operatorCookie);
    await expect(adminSnapshot(db, operator)).rejects.toMatchObject({ status: 403 });
    expect((await request("audit", operatorCookie)).status).toBe(403);
    const manager = await accountFor(managerCookie);
    const full = await adminSnapshot(db, manager);
    const restricted = await adminSnapshot(db, {
      ...manager,
      role: "MANAGER",
      financeAccess: false,
    });
    expect(full.data.ORDERS.length).toBeGreaterThan(10);
    expect(full.data.FINANCIAL_RECORDS.length).toBeGreaterThan(0);
    expect(restricted.canSeeFinance).toBe(false);
    expect(restricted.data.FINANCIAL_RECORDS).toEqual([]);
    expect(restricted.data.MATERIALS.every((material) => material.unitCost === 0)).toBe(true);
  });

  it("requires approval of the selected revision before production and preserves immutable templates", async () => {
    const orderId = demoId("order:awaiting-approval");
    await db.query("UPDATE \"CUSTOMER_ORDER\" SET status='PLANNED' WHERE id=$1", [orderId]);
    await expect(
      db.query("UPDATE \"CUSTOMER_ORDER\" SET status='IN_PRODUCTION' WHERE id=$1", [orderId]),
    ).rejects.toThrow(/approval/i);
    await expect(
      db.query("UPDATE \"TEMPLATE\" SET name='changed' WHERE id=$1", [
        demoId("template:awaiting-approval"),
      ]),
    ).rejects.toThrow(/immutable/i);
  });

  it("persists checks and prevents concurrent task claims by the same operator", async () => {
    expect((await request("machine", operatorCookie, { code: "WAM-CNC-01" })).status).toBe(200);
    const task = demoId("job:t1042");
    expect(
      (await request(`tasks/${task}/claim`, operatorCookie, { recordVersion: 1 })).status,
    ).toBe(409);
    const snapshot = await (await request("operator", operatorCookie)).json();
    for (const check of snapshot.maintenance["WAM-CNC-01"].filter(
      (item: { kind: string; phase: string }) => item.kind === "required" && item.phase === "start",
    )) {
      const response = await request("checks", operatorCookie, {
        phase: "start",
        id: check.id,
        state: "done",
        requestKey: randomUUID(),
      });
      expect(response.status).toBe(200);
    }
    const responses = await Promise.all(
      [task, demoId("job:t1043")].map((id) =>
        request(`tasks/${id}/claim`, operatorCookie, { recordVersion: 1 }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const persisted = await operatorSnapshot(db, await accountFor(operatorCookie));
    expect(Object.keys(persisted.startChecks)).toHaveLength(5);
    expect(
      persisted.tasks.filter((task) => task.status === "active" && task.assignee === "OP-104"),
    ).toHaveLength(1);
  });

  it("detects stale writes, stores task activity and photos, completes the quantity and moves the order to QC", async () => {
    const snapshot = await operatorSnapshot(db, await accountFor(operatorCookie));
    const task = snapshot.tasks.find(
      (task) => task.status === "active" && task.assignee === "OP-104",
    )!;
    expect(
      (
        await request(`tasks/${task.id}/activity`, operatorCookie, {
          recordVersion: 1,
          text: "stale",
        })
      ).status,
    ).toBe(409);
    const photo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=";
    process.env["WAM_PHOTO_STORAGE"] = "database";
    const saved = await request(`tasks/${task.id}/activity`, operatorCookie, {
      recordVersion: task.recordVersion,
      text: "Photo from backend test",
      photos: [photo],
    });
    expect(saved.status).toBe(200);
    const updated = (await saved.json()).tasks.find((item: { id: string }) => item.id === task.id);
    const photoPath = updated.activity.at(-1).photos[0].replace("/api/wam/", "");
    const content = (
      await db.query("SELECT encode(content,'base64') AS base64 FROM wam_internal.document_content")
    ).rows[0]!;
    expect(Buffer.from(content["base64"], "base64").toString("base64")).toBe(photo.split(",")[1]);
    expect((await request(photoPath, operatorCookie)).headers.get("content-type")).toBe(
      "image/png",
    );
    const completed = await request(`tasks/${task.id}/complete`, operatorCookie, {
      recordVersion: updated.recordVersion,
      text: "Finished successfully",
    });
    expect(completed.status).toBe(200);
    const row = (
      await db.query(
        'SELECT j.completed_quantity,o.quantity,o.status FROM "JOB" j JOIN "CUSTOMER_ORDER" o ON o.id=j.order_id WHERE j.id=$1',
        [task.id],
      )
    ).rows[0]!;
    expect(row["completed_quantity"]).toBe(row["quantity"]);
    expect(row["status"]).toBe("QC");
    await expect(
      db.query("UPDATE \"JOB\" SET notes='changed' WHERE id=$1", [task.id]),
    ).rejects.toThrow(/planning|immutable/i);
    const audit = (
      await db.query(
        "SELECT actor_user_id,after_data FROM \"AUDIT_LOG\" WHERE entity_type='JOB' AND entity_id=$1 ORDER BY occurred_at DESC LIMIT 1",
        [task.id],
      )
    ).rows[0]!;
    expect(audit["actor_user_id"]).toBe(demoId("account:OP-104"));
    expect(audit["after_data"]).not.toHaveProperty("notes");
  });

  it("posts stock once per retry key, rejects conflicting retries, and protects balances", async () => {
    const material_id = demoId("M01"),
      to_location_id = demoId("Rack R1");
    const input = {
      request_key: randomUUID(),
      material_id,
      to_location_id,
      quantity: 3,
      movement_type: "RECEIPT",
      reason: "Backend test",
    };
    const balance = async () =>
      Number(
        (
          await db.query(
            'SELECT quantity FROM "STOCK_BALANCE" WHERE material_id=$1 AND location_id=$2',
            [material_id, to_location_id],
          )
        ).rows[0]!["quantity"],
      );
    const before = await balance();
    expect((await request("stock-movements", managerCookie, input)).status).toBe(201);
    expect((await request("stock-movements", managerCookie, input)).status).toBe(201);
    expect(await balance()).toBeCloseTo(before + 3);
    expect(
      (await request("stock-movements", managerCookie, { ...input, quantity: 4 })).status,
    ).toBe(409);
    expect(
      (
        await request("stock-movements", managerCookie, {
          ...input,
          request_key: randomUUID(),
          movement_type: "ADJUSTMENT",
          from_location_id: to_location_id,
          to_location_id: undefined,
          quantity: 999999,
        })
      ).status,
    ).toBe(409);
    expect(await balance()).toBeCloseTo(before + 3);
    await expect(
      db.query('UPDATE "STOCK_BALANCE" SET quantity=99 WHERE material_id=$1', [material_id]),
    ).rejects.toThrow(/managed/i);
    await expect(db.query('DELETE FROM "AUDIT_LOG"')).rejects.toThrow(/append-only/i);
  });

  it("requires end checks before recording and closing the shift", async () => {
    expect((await request("shift/finish", operatorCookie, { handover: "" })).status).toBe(409);
    const snapshot = await operatorSnapshot(db, await accountFor(operatorCookie));
    for (const check of snapshot.maintenance["WAM-CNC-01"]!.filter(
      (item) => item.kind === "required" && item.phase === "end",
    )) {
      expect(
        (
          await request("checks", operatorCookie, {
            phase: "end",
            id: check.id,
            state: "done",
            requestKey: randomUUID(),
          })
        ).status,
      ).toBe(200);
    }
    const result = await request("shift/finish", operatorCookie, {
      handover: "All work handed over.",
    });
    expect(result.status).toBe(200);
    expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(
      (
        await db.query('SELECT check_out_at FROM "ATTENDANCE" WHERE employee_id=$1', [
          demoId("OP-104"),
        ])
      ).rows[0]!["check_out_at"],
    ).toBeTruthy();
  });
});
