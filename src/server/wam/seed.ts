import { createHash, randomUUID } from "node:crypto";
import type { Database, Row } from "./database";

export const demoId = (value: string) => {
  const hex = createHash("sha256").update(`wam-demo:${value}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * 86400000 + hours * 3600000).toISOString();

export async function insert(db: Database, table: string, row: Row) {
  const keys = Object.keys(row);
  const values = Object.values(row).map((value) => value ?? null);
  await db.query(
    `INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    values,
  );
}

export async function seedDemo(
  db: Database,
  authProvider: "local-demo" | "seed-preview" = "local-demo",
) {
  if ((await db.query('SELECT 1 FROM "EMPLOYEE" LIMIT 1')).rows.length) return;
  const D = await import("../../lib/wam/admin-data");
  const O = await import("../../lib/wam/mock-data");
  await db.transaction(async (tx) => {
    await tx.query(
      "SELECT set_config('wam.change_reason','Local sample data initialization',true)",
    );
    for (const e of [
      ...D.EMPLOYEES,
      {
        id: "WAM-MANAGER-01",
        name: authProvider === "seed-preview" ? "WAM Preview Manager" : "Local WAM Manager",
        department: "Management",
        title: "Manager",
        status: "active",
      },
    ]) {
      await insert(tx, "EMPLOYEE", {
        id: demoId(e.id),
        employee_code: e.id,
        full_name: e.name,
        job_title: e.title,
        is_active: e.status !== "inactive",
      });
      await tx.query(
        'INSERT INTO "DEPARTMENT"(id,name) VALUES($1,$2) ON CONFLICT(name) DO NOTHING',
        [demoId(e.department), e.department],
      );
      await insert(tx, "EMPLOYEE_DEPARTMENT", {
        employee_id: demoId(e.id),
        department_id: demoId(e.department),
      });
      if (["OP-104", "OP-117", "WAM-MANAGER-01"].includes(e.id)) {
        await insert(tx, "USER_ACCOUNT", {
          id: demoId(`account:${e.id}`),
          employee_id: demoId(e.id),
          auth_provider: authProvider === "seed-preview" ? "password-preview" : "password-local",
          login_email:
            e.id === "WAM-MANAGER-01"
              ? "admin@wam.example"
              : e.id === "OP-104"
                ? "nikos@wam.example"
                : "eleni@wam.example",
          auth_subject: e.id,
          role: e.id === "WAM-MANAGER-01" ? "ADMIN" : "PRODUCTION",
        });
      }
    }
    for (const c of D.CUSTOMERS)
      await insert(tx, "CUSTOMER", {
        id: demoId(c.id),
        name: c.name,
        email: c.email,
        city: c.city,
      });
    const locations = new Set([
      ...D.ADMIN_MACHINES.map((m) => m.location),
      ...D.STOCK_BALANCES.map((s) => s.location),
    ]);
    for (const name of locations)
      await insert(tx, "LOCATION", { id: demoId(name), name, type: "Workshop" });
    for (const m of D.ADMIN_MACHINES)
      await insert(tx, "MACHINE", {
        id: demoId(m.code),
        equipment_code: m.code,
        name: m.name,
        model: m.model,
        type: m.code.includes("CNC") ? "CNC" : m.code.includes("LSR") ? "LASER" : "PRODUCTION",
        location_id: demoId(m.location),
        status:
          m.status === "operational"
            ? "ACTIVE"
            : m.status === "maintenance"
              ? "MAINTENANCE"
              : "OUT_OF_SERVICE",
      });
    for (const m of D.MATERIALS) {
      await tx.query('INSERT INTO "SUPPLIER"(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING', [
        demoId(m.supplier),
        m.supplier,
      ]);
      await insert(tx, "MATERIAL", {
        id: demoId(m.id),
        material_code: m.code,
        name: m.name,
        type: "RAW_MATERIAL",
        unit: m.unit,
        standard_unit_cost: m.unitCost,
        min_stock: m.minQty,
      });
      await insert(tx, "SUPPLIER_MATERIAL", {
        supplier_id: demoId(m.supplier),
        material_id: demoId(m.id),
        unit_price: m.unitCost,
      });
    }
    for (const s of D.STOCK_BALANCES)
      await insert(tx, "STOCK_MOVEMENT", {
        request_key: randomUUID(),
        material_id: demoId(s.materialId),
        to_location_id: demoId(s.location),
        quantity: s.qty,
        movement_type: "ADJUSTMENT",
        reason: "Demo opening stock",
        performed_by_employee_id: demoId("OP-155"),
      });
    await insert(tx, "ASSET", {
      name: "Digital caliper",
      equipment_code: "WAM-TOOL-01",
      location_id: demoId("Tool cabinet"),
      category: "Measuring instrument",
    });

    const products = [
      ...O.TASKS,
      ...Array.from({ length: 12 }, (_, i) => ({
        ...O.TASKS[i % O.TASKS.length]!,
        id: `history-${i}`,
        status: "completed" as const,
      })),
      { ...O.TASKS[0]!, id: "awaiting-approval", status: "approval" },
      { ...O.TASKS[1]!, id: "planned-order", status: "planned" },
    ];
    for (let index = 0; index < products.length; index++) {
      const p = products[index]!;
      const historical = p.status === "completed";
      const orderId = demoId(`order:${p.id}`),
        jobId = demoId(`job:${p.id}`),
        templateId = demoId(`template:${p.id}`);
      const customer = D.CUSTOMERS.find((c) => c.name === p.customer)!;
      const material = D.MATERIALS[[0, 1, 2, 0, 3, 4, 5][index % 7]!]!;
      const submitted = historical ? ago(10 + index * 3) : ago(4);
      const started = historical ? ago(9 + index * 3) : ago(1);
      const finished = historical ? ago(8 + index * 3) : ago(1, 1);
      await insert(tx, "TEMPLATE", {
        id: templateId,
        template_code: `DEMO-${index + 1}`,
        name: p.title,
        revision: 1,
        design_file: `demo/${p.template}`,
        design_checksum: createHash("sha256")
          .update(`sample placeholder ${p.template}`)
          .digest("hex"),
      });
      await insert(tx, "CUSTOMER_ORDER", {
        id: orderId,
        order_number: `WAM-DEMO-${String(index + 1).padStart(4, "0")}`,
        title: p.title,
        customer_id: demoId(customer.id),
        intake_employee_id: demoId("WAM-MANAGER-01"),
        template_id: templateId,
        quantity: p.quantity,
        submitted_at: submitted,
        due_at: historical ? finished : ago(index % 3 === 0 ? 1 : -5),
      });
      await insert(tx, "JOB", {
        id: jobId,
        order_id: orderId,
        sequence_no: 1,
        name: p.title,
        machine_id: demoId(p.machine),
        instructions: p.instructions,
        priority: p.priority.toUpperCase(),
        estimated_minutes: p.estMin,
        blocked_reason: p.blockedReason,
      });
      await insert(tx, "JOB_MATERIAL", {
        job_id: jobId,
        material_id: demoId(material.id),
        planned_quantity: 1,
        unit_cost: material.unitCost,
      });
      await tx.query(
        'INSERT INTO "MACHINE_MATERIAL"(machine_id,material_id) VALUES($1,$2) ON CONFLICT(machine_id,material_id) DO NOTHING',
        [demoId(p.machine), demoId(material.id)],
      );
      if (p.status === "approval") continue;
      await tx.query(
        "UPDATE \"CUSTOMER_ORDER\" SET status='PLANNED',approved_template_id=template_id,customer_approved_at=$2,approved_by_contact='Sample customer' WHERE id=$1",
        [orderId, submitted],
      );
      if (p.status === "planned") continue;
      await tx.query("UPDATE \"CUSTOMER_ORDER\" SET status='IN_PRODUCTION' WHERE id=$1", [orderId]);
      if (historical) {
        await tx.query(
          "UPDATE \"JOB\" SET status='IN_PROGRESS',responsible_employee_id=$2,started_at=$3 WHERE id=$1",
          [jobId, demoId(p.machine.includes("LSR") ? "OP-117" : "OP-104"), started],
        );
        await tx.query(
          "UPDATE \"JOB\" SET status='COMPLETED',completed_quantity=$2,completed_at=$3 WHERE id=$1",
          [jobId, p.quantity, finished],
        );
        await tx.query("UPDATE \"CUSTOMER_ORDER\" SET status='QC' WHERE id=$1", [orderId]);
        await tx.query(
          "UPDATE \"CUSTOMER_ORDER\" SET status='READY',qc_result='PASSED',qc_employee_id=$2,qc_checked_at=$3,qc_notes='Sample QC passed' WHERE id=$1",
          [orderId, demoId("OP-140"), finished],
        );
        await tx.query(
          "UPDATE \"CUSTOMER_ORDER\" SET status='DELIVERED',delivered_at=$2 WHERE id=$1",
          [orderId, finished],
        );
        await insert(tx, "FINANCIAL_RECORD", {
          customer_order_id: orderId,
          type: "SALE",
          reference_number: `DEMO-INV-${index}`,
          amount: 600 + index * 100,
          paid_amount: index % 3 ? 600 + index * 100 : 0,
          record_date: finished.slice(0, 10),
          due_date: ago(-10).slice(0, 10),
          category: "Sample product sales",
        });
      }
    }
    const manager = demoId("WAM-MANAGER-01");
    for (const p of D.MAINTENANCE_PLANS) {
      await insert(tx, "MAINTENANCE_PLAN", {
        id: demoId(p.id),
        machine_id: demoId(p.machineCode),
        title: p.title,
        instructions:
          "Sample plan: replace with approved manufacturer instructions before operational use.",
        interval_days: p.intervalDays,
        next_due_date: ago(-p.intervalDays).slice(0, 10),
        created_by_employee_id: manager,
      });
      await insert(tx, "MACHINE_MAINTENANCE", {
        machine_id: demoId(p.machineCode),
        plan_id: demoId(p.id),
        request_key: randomUUID(),
        title: p.title,
        performed_at: p.lastDoneAt,
        performed_by_employee_id: manager,
        recorded_by_employee_id: manager,
        notes: "Sample service history",
      });
    }
    for (const [code, checks] of Object.entries(O.MAINTENANCE))
      for (const item of checks) {
        await insert(tx, "MAINTENANCE_PLAN", {
          id: demoId(item.id),
          machine_id: demoId(code),
          title: item.title,
          instructions: item.instructions,
          operator_check_phase: item.phase.toUpperCase(),
          priority:
            item.priority === "safety" ? "SAFETY" : item.priority === "high" ? "HIGH" : "NORMAL",
          maintenance_type: "INSPECTION",
          operator_can_complete: item.kind === "required",
          created_by_employee_id: manager,
        });
      }
    await insert(tx, "DOCUMENT", {
      title: "Sample workshop reference",
      category: "manual",
      file_path: "demo/reference-not-supplied.pdf",
      uploaded_by_employee_id: manager,
      original_filename: "reference-not-supplied.pdf",
    });
    await tx.query(
      'INSERT INTO "DOCUMENT_LINK"(document_id,machine_id) SELECT id,$1 FROM "DOCUMENT" WHERE file_path=\'demo/reference-not-supplied.pdf\'',
      [demoId("WAM-CNC-01")],
    );
  });
}
