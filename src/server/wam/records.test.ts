// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { connectDatabase, migrate, type Database } from "./database";
import { seedDemo, demoId } from "./seed";
import { RECORD_ENTITIES } from "../../lib/wam/record-catalog";
import { recordsWorkspace, createRecord, changeRecord } from "./records";
import type { Account } from "./auth";

let db: Database;
const manager: Account = {
  id: demoId("account:WAM-MANAGER-01"),
  employee_id: demoId("WAM-MANAGER-01"),
  employee_code: "WAM-MANAGER-01",
  full_name: "Manager",
  job_title: "Manager",
  role: "ADMIN",
  auth_provider: "local",
  managerAccess: true,
  financeAccess: true,
};
const restricted = { ...manager, role: "MANAGER", financeAccess: false };
const upload = {
  name: "drawing.pdf",
  data:
    "data:application/pdf;base64," +
    Buffer.from("%PDF-1.7\nWAM integration sample").toString("base64"),
};
beforeAll(async () => {
  db = await connectDatabase(undefined, "memory://");
  await migrate(db);
  await seedDemo(db);
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe.sequential("Complete database management", () => {
  it("connects suppliers, assets, compatibility, maintenance and finance through their real relationships", async () => {
    const supplier = (await createRecord(db, manager, "SUPPLIER", {
      values: { name: "Registry supplier" },
    }))!;
    const location = (await createRecord(db, manager, "LOCATION", {
      values: { name: "Registry storage" },
    }))!;
    const machine = (await createRecord(db, manager, "MACHINE", {
      values: {
        name: "Registry machine",
        model: "Model R",
        location_id: location["id"],
        supplier_id: supplier["id"],
      },
    }))!;
    const asset = (await createRecord(db, manager, "ASSET", {
      values: {
        name: "Registry accessory",
        machine_id: machine["id"],
        supplier_id: supplier["id"],
      },
    }))!;
    expect(asset["machine_id"]).toBe(machine["id"]);
    const material = (await createRecord(db, manager, "MATERIAL", {
      values: {
        material_code: "REG-MAT",
        name: "Registry stock",
        type: "RAW_MATERIAL",
        unit: "sheet",
      },
    }))!;
    await createRecord(db, manager, "SUPPLIER_MATERIAL", {
      values: { supplier_id: supplier["id"], material_id: material["id"], unit_price: 12.5 },
    });
    await createRecord(db, manager, "MACHINE_MATERIAL", {
      values: { machine_id: machine["id"], material_id: material["id"], purpose: "Cutting" },
    });
    const quotes = await recordsWorkspace(db, restricted, {
      entity: "SUPPLIER_MATERIAL",
      search: "Registry",
    });
    expect(quotes.total).toBe(1);
    expect(quotes.rows[0]).not.toHaveProperty("unit_price");
    const plan = (await createRecord(db, manager, "MAINTENANCE_PLAN", {
      values: {
        machine_id: machine["id"],
        title: "Registry inspection",
        instructions: "Inspect guard",
        interval_days: 30,
        next_due_date: "2026-10-29",
      },
    }))!;
    await createRecord(db, manager, "MACHINE_MAINTENANCE", {
      values: {
        machine_id: machine["id"],
        title: "Registry inspection completed",
        maintenance_type: "PREVENTIVE",
        performed_by_employee_id: manager.employee_id,
        plan_id: plan["id"],
      },
      requestKey: randomUUID(),
    });
    const updated = (
      await db.query('SELECT last_completed_at,next_due_date FROM "MAINTENANCE_PLAN" WHERE id=$1', [
        plan["id"],
      ])
    ).rows[0]!;
    expect(updated["last_completed_at"]).toBeTruthy();
    expect(new Date(updated["next_due_date"]).getTime()).toBeGreaterThan(
      new Date("2026-10-29").getTime(),
    );
    const sale = (await createRecord(db, manager, "FINANCIAL_RECORD", {
      values: { customer_id: demoId("C01"), type: "SALE", amount: 100, record_date: "2026-10-29" },
    }))!;
    await changeRecord(db, manager, "FINANCIAL_RECORD", sale["id"], {
      values: { paid_amount: 50 },
      version: sale["record_version"],
    });
    const refund = (await createRecord(db, manager, "FINANCIAL_RECORD", {
      values: {
        original_record_id: sale["id"],
        type: "SALE_REFUND",
        amount: 10,
        record_date: "2026-10-29",
      },
    }))!;
    expect(refund["customer_id"]).toBe(sale["customer_id"]);
    expect(refund["currency"]).toBe(sale["currency"]);
  });
  it("covers every public business table and only real columns, with every collection readable", async () => {
    const tables = (
      await db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      )
    ).rows.map((row) => row["table_name"]);
    expect(RECORD_ENTITIES.map((item) => item.key).sort()).toEqual(tables.sort());
    const columns = (
      await db.query(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
      )
    ).rows;
    for (const entity of RECORD_ENTITIES) {
      for (const field of entity.fields)
        expect(
          columns.some(
            (row) => row["table_name"] === entity.key && row["column_name"] === field.key,
          ),
          `${entity.key}.${field.key}`,
        ).toBe(true);
      const page = await recordsWorkspace(db, manager, { entity: entity.key });
      expect(page.entities).toHaveLength(28);
      expect(page.rows).toBeInstanceOf(Array);
      await recordsWorkspace(db, manager, { entity: entity.key, search: "test", offset: 0 });
    }
  });
  it("creates, edits, versions and searches people and relationships without accepting arbitrary fields", async () => {
    const employee = await createRecord(db, manager, "EMPLOYEE", {
      values: { full_name: "Registry Operator", job_title: "Technician" },
    });
    const department = await createRecord(db, manager, "DEPARTMENT", {
      values: { name: "Registry Department" },
    });
    const membership = await createRecord(db, manager, "EMPLOYEE_DEPARTMENT", {
      values: { employee_id: employee!["id"], department_id: department!["id"] },
    });
    const edited = await changeRecord(db, manager, "EMPLOYEE", employee!["id"], {
      values: { email: "registry@example.com" },
      version: employee!["record_version"],
    });
    expect(edited!["record_version"]).toBe(2);
    await expect(
      changeRecord(db, manager, "EMPLOYEE", employee!["id"], {
        values: { email: "stale@example.com" },
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await recordsWorkspace(db, manager, { entity: "EMPLOYEE_DEPARTMENT", search: "Registry" }))
        .total,
    ).toBe(1);
    await changeRecord(
      db,
      manager,
      "EMPLOYEE_DEPARTMENT",
      membership!["id"],
      { version: membership!["record_version"] },
      true,
    );
    await expect(
      createRecord(db, manager, "CUSTOMER", {
        values: { name: "Spoof", created_at: "2020-01-01" },
      }),
    ).rejects.toThrow();
    await expect(
      recordsWorkspace(db, { ...manager, role: "PRODUCTION" }, { entity: "CUSTOMER" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      changeRecord(db, manager, "USER_ACCOUNT", manager.id, {
        values: { is_active: false },
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("uploads real immutable design revisions and enforces financial document visibility", async () => {
    const template = await createRecord(db, manager, "TEMPLATE", {
      values: { template_code: "REG-DESIGN", name: "Registry Design", revision: 1 },
      file: upload,
    });
    expect(template!["design_checksum"]).toBe(
      createHash("sha256")
        .update(Buffer.from(upload.data.split(",")[1]!, "base64"))
        .digest("hex"),
    );
    const link = (
      await db.query('SELECT document_id FROM "DOCUMENT_LINK" WHERE template_id=$1', [
        template!["id"],
      ])
    ).rows[0]!;
    expect(
      (
        await db.query(
          "SELECT octet_length(content) AS size FROM wam_internal.document_content WHERE document_id=$1",
          [link["document_id"]],
        )
      ).rows[0]!["size"],
    ).toBeGreaterThan(0);
    await expect(
      changeRecord(db, manager, "TEMPLATE", template!["id"], { values: { name: "Overwrite" } }),
    ).rejects.toMatchObject({ status: 405 });
    const doc = await createRecord(db, manager, "DOCUMENT", {
      values: { title: "Private invoice", category: "invoice", visibility: "RESTRICTED" },
      file: upload,
    });
    const safe = await recordsWorkspace(db, restricted, { entity: "DOCUMENT" });
    expect(safe.rows.some((row) => row["id"] === doc!["id"])).toBe(false);
    expect(safe.lookups["DOCUMENT"]!.some((row) => row.id === doc!["id"])).toBe(false);
    await expect(
      createRecord(db, restricted, "DOCUMENT", {
        values: { title: "Denied", visibility: "RESTRICTED" },
        file: upload,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      recordsWorkspace(db, restricted, { entity: "FINANCIAL_RECORD" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      recordsWorkspace(db, restricted, { entity: "USER_ACCOUNT" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("posts stock exactly once and prevents direct balance or history changes", async () => {
    const values = {
      material_id: demoId("M01"),
      to_location_id: demoId("Rack R1"),
      quantity: 2,
      movement_type: "RECEIPT",
      reason: "Registry verification",
    };
    const requestKey = randomUUID();
    const first = await createRecord(db, restricted, "STOCK_MOVEMENT", { values, requestKey });
    const again = await createRecord(db, restricted, "STOCK_MOVEMENT", { values, requestKey });
    expect(again!["id"]).toBe(first!["id"]);
    expect(again).not.toHaveProperty("financial_record_id");
    await expect(
      createRecord(db, manager, "STOCK_MOVEMENT", {
        values: { ...values, quantity: 3 },
        requestKey,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(createRecord(db, manager, "STOCK_BALANCE", { values: {} })).rejects.toMatchObject({
      status: 405,
    });
    await expect(
      changeRecord(db, manager, "JOB_ACTIVITY", randomUUID(), { values: { notes: "edit" } }),
    ).rejects.toMatchObject({ status: 405 });
  });
});
