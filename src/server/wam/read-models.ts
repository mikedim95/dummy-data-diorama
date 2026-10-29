import type { Database, Row } from "./database";
import type { Account } from "./auth";
import { requireRole, localDemoEnabled, previewEnabled } from "./auth";
import type { Activity, MaintenanceItem, Task } from "../../lib/wam/types";
import type { Snapshot } from "../../lib/wam/admin-api";

export const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : value ? String(value) : undefined;
export function metadata(value: unknown): Row {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return { instructions: value };
  }
}
const n = (value: unknown) => Number(value ?? 0);
const machineStatus = (status: string) =>
  status === "ACTIVE"
    ? ("operational" as const)
    : status === "MAINTENANCE"
      ? ("maintenance" as const)
      : ("out_of_service" as const);
const jobStatus = (row: Row) =>
  row["status"] === "COMPLETED"
    ? ("completed" as const)
    : row["status"] === "IN_PROGRESS"
      ? ("active" as const)
      : (row["machine_status"] && row["machine_status"] !== "ACTIVE") ||
          row["preceding"] ||
          row["blocked_reason"]
        ? ("blocked" as const)
        : ("pending" as const);

export async function readJobs(db: Database) {
  return (
    await db.query(`SELECT j.*,o.order_number,o.title AS order_title,o.quantity,o.status AS order_status,o.approval_required,o.approved_template_id,o.template_id,o.customer_approved_at,o.due_at,
    c.name AS customer_name,m.equipment_code,m.status AS machine_status,e.employee_code,t.design_file,t.revision,
    EXISTS(SELECT 1 FROM "JOB" previous WHERE previous.order_id=j.order_id AND previous.sequence_no<j.sequence_no AND previous.status<>'COMPLETED') AS preceding,
    (SELECT count(*)::int FROM "JOB" sibling WHERE sibling.order_id=j.order_id) AS step_count,
    coalesce((SELECT jsonb_agg(jsonb_build_object('materialId',mat.id,'name',mat.name,'unit',mat.unit,'plannedQuantity',jm.planned_quantity,
      'actualQuantity',coalesce((SELECT sum(CASE WHEN sm.movement_type='CONSUMPTION' THEN sm.quantity WHEN sm.movement_type='RETURN' THEN -sm.quantity ELSE 0 END) FROM "STOCK_MOVEMENT" sm WHERE sm.job_id=j.id AND sm.material_id=mat.id),0)))
      FROM "JOB_MATERIAL" jm JOIN "MATERIAL" mat ON mat.id=jm.material_id WHERE jm.job_id=j.id),'[]'::jsonb) AS planned_materials,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'at',a.occurred_at,'by',coalesce(actor.full_name,a.author_name,'System'),'type',lower(a.kind),'text',a.notes,
      'photos',coalesce((SELECT jsonb_agg('/api/wam/files/'||l.document_id::text) FROM "DOCUMENT_LINK" l WHERE l.job_activity_id=a.id),'[]'::jsonb)) ORDER BY a.occurred_at,a.id)
      FROM "JOB_ACTIVITY" a LEFT JOIN "EMPLOYEE" actor ON actor.id=a.actor_employee_id WHERE a.job_id=j.id),'[]'::jsonb) AS activities,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'filename',d.original_filename,'url','/api/wam/files/'||d.id::text,'available',EXISTS(SELECT 1 FROM wam_internal.document_content dc WHERE dc.document_id=d.id)))
      FROM "DOCUMENT" d WHERE d.visibility<>'RESTRICTED' AND upper(coalesce(d.category,'')) NOT IN ('INVOICE','FINANCIAL')
      AND EXISTS(SELECT 1 FROM "DOCUMENT_LINK" l WHERE l.document_id=d.id AND (l.job_id=j.id OR l.template_id=o.template_id OR l.machine_id=j.machine_id))),'[]'::jsonb) AS reference_files
    FROM "JOB" j JOIN "CUSTOMER_ORDER" o ON o.id=j.order_id JOIN "CUSTOMER" c ON c.id=o.customer_id
    LEFT JOIN "MACHINE" m ON m.id=j.machine_id LEFT JOIN "EMPLOYEE" e ON e.id=j.responsible_employee_id LEFT JOIN "TEMPLATE" t ON t.id=o.template_id
    ORDER BY o.submitted_at DESC,j.sequence_no`)
  ).rows;
}

export function taskFromRow(row: Row): Task {
  const waiting = !["IN_PRODUCTION", "QC", "READY", "DELIVERED"].includes(row["order_status"]);
  const status = waiting && row["status"] !== "COMPLETED" ? "blocked" : jobStatus(row);
  return {
    id: row["id"],
    job: row["order_number"],
    title: row["name"],
    customer: row["customer_name"],
    machine: row["equipment_code"] ?? "Manual",
    priority: row["priority"].toLowerCase(),
    estMin: row["estimated_minutes"],
    status,
    sequence: row["sequence_no"],
    material:
      row["planned_materials"].map((material: { name: string }) => material.name).join(", ") ||
      "Not specified",
    plannedMaterials: row["planned_materials"],
    referenceFiles: row["reference_files"],
    quantity: row["quantity"],
    template: row["design_file"] ?? "Not assigned",
    orderStage: `Stage ${row["sequence_no"]} of ${row["step_count"]}`,
    instructions: row["instructions"] ?? "",
    files: row["design_file"] ? [row["design_file"]] : [],
    ...(status === "blocked"
      ? {
          blockedReason: waiting
            ? "Order is awaiting planning or customer approval."
            : row["preceding"]
              ? "Complete preceding production steps first."
              : (row["blocked_reason"] ?? "Machine is unavailable."),
        }
      : {}),
    ...(row["employee_code"] ? { assignee: row["employee_code"] } : {}),
    ...(row["started_at"] ? { startedAt: iso(row["started_at"])! } : {}),
    ...(row["completed_at"] ? { completedAt: iso(row["completed_at"])! } : {}),
    activity: row["activities"] as Activity[],
    recordVersion: row["record_version"],
  };
}

export async function readMaintenance(db: Database) {
  const rows = (
    await db.query('SELECT * FROM "OPERATOR_MAINTENANCE" ORDER BY equipment_code,title,plan_id')
  ).rows;
  const result: Record<string, MaintenanceItem[]> = {};
  for (const row of rows) {
    const item: MaintenanceItem = {
      id: row["plan_id"],
      phase: row["operator_check_phase"] === "END" ? "end" : "start",
      title: row["title"],
      kind: row["operator_can_complete"] ? "required" : "info",
      priority:
        row["reminder_status"] === "OVERDUE"
          ? "overdue"
          : row["priority"] === "SAFETY"
            ? "safety"
            : row["priority"] === "HIGH"
              ? "high"
              : "normal",
      instructions: row["instructions"],
      ...(row["next_due_date"]
        ? { dueNote: `Due ${iso(row["next_due_date"])!.slice(0, 10)}` }
        : {}),
    };
    (result[row["equipment_code"]] ??= []).push(item);
  }
  return result;
}

export async function readAttendance(db: Database, account: Account) {
  // Keep an overnight shift attached to its original Athens check-in date.
  return (
    await db.query(
      "SELECT * FROM \"ATTENDANCE\" WHERE employee_id=$1 AND (check_out_at IS NULL AND check_in_at IS NOT NULL OR attendance_date=(now() AT TIME ZONE 'Europe/Athens')::date) ORDER BY check_in_at DESC NULLS LAST LIMIT 1",
      [account.employee_id],
    )
  ).rows[0];
}

export async function readOpenShift(db: Database, account: Account) {
  return (
    await db.query(
      'SELECT s.*,m.equipment_code AS machine_code FROM "OPERATOR_SHIFT" s LEFT JOIN "MACHINE" m ON m.id=s.machine_id WHERE s.employee_id=$1 AND s.status=\'OPEN\' ORDER BY s.started_at DESC LIMIT 1',
      [account.employee_id],
    )
  ).rows[0];
}
export async function readShiftChecks(db: Database, shiftId: string) {
  const rows = (
    await db.query('SELECT plan_id,phase,state FROM "SHIFT_CHECK" WHERE shift_id=$1', [shiftId])
  ).rows;
  const result: {
    startChecks: Record<string, "done" | "skipped">;
    endChecks: Record<string, "done" | "skipped">;
  } = { startChecks: {}, endChecks: {} };
  for (const row of rows)
    result[row["phase"] === "START" ? "startChecks" : "endChecks"][row["plan_id"]] =
      row["state"].toLowerCase();
  return result;
}
export async function operatorSnapshot(db: Database, account: Account) {
  const shift = await readOpenShift(db, account);
  const checks = shift
    ? await readShiftChecks(db, shift["id"])
    : { startChecks: {}, endChecks: {} };
  const machines = (
    await db.query(
      'SELECT m.*,l.name AS location_name FROM "MACHINE" m LEFT JOIN "LOCATION" l ON l.id=m.location_id WHERE m.is_active ORDER BY m.equipment_code',
    )
  ).rows;
  return {
    operator: {
      id: account.employee_code,
      name: account.full_name,
      role: account.job_title ?? account.role,
    },
    machineCode: shift?.["machine_code"] ?? null,
    shiftStartedAt: iso(shift?.["started_at"]) ?? null,
    ...checks,
    machines: machines.map((m) => ({
      code: m["equipment_code"],
      name: m["name"],
      model: m["model"] ?? "",
      location: m["location_name"] ?? "",
      status:
        m["status"] === "ACTIVE"
          ? ("operational" as const)
          : m["status"] === "MAINTENANCE"
            ? ("attention" as const)
            : ("down" as const),
    })),
    tasks: (await readJobs(db))
      .filter((row) => !["CANCELLED", "DELIVERED"].includes(row["order_status"]))
      .map(taskFromRow),
    maintenance: await readMaintenance(db),
    materialOptions: (
      await db.query(
        'SELECT id,name,unit,material_code FROM "MATERIAL" WHERE is_active ORDER BY name',
      )
    ).rows.map((m) => ({
      id: m["id"],
      name: m["name"],
      unit: m["unit"],
      code: m["material_code"],
    })),
    stockLocations: (await db.query('SELECT id,name FROM "LOCATION" ORDER BY name')).rows.map(
      (l) => ({ id: l["id"], name: l["name"] }),
    ),
    stockBalances: (
      await db.query('SELECT material_id,location_id,quantity FROM "STOCK_BALANCE"')
    ).rows.map((b) => ({
      materialId: b["material_id"],
      locationId: b["location_id"],
      quantity: Number(b["quantity"]),
    })),
  };
}

export async function adminSnapshot(db: Database, account: Account) {
  requireRole(account, ["ADMIN", "MANAGER"]);
  const canSeeFinance = account.financeAccess ?? account.role === "ADMIN";
  const table = async (name: string) => (await db.query(`SELECT * FROM "${name}"`)).rows;
  const [
    customers,
    machines,
    employees,
    attendance,
    plans,
    history,
    orders,
    jobs,
    materials,
    balances,
    movements,
    documents,
    links,
    locations,
    departments,
    memberships,
    supplierMaterials,
    suppliers,
  ] = await Promise.all([
    table("CUSTOMER"),
    table("MACHINE"),
    table("EMPLOYEE"),
    table("ATTENDANCE"),
    table("MAINTENANCE_PLAN"),
    table("MACHINE_MAINTENANCE"),
    table("CUSTOMER_ORDER"),
    readJobs(db),
    table("MATERIAL"),
    table("STOCK_BALANCE"),
    table("STOCK_MOVEMENT"),
    canSeeFinance
      ? table("DOCUMENT")
      : db
          .query(
            "SELECT * FROM \"DOCUMENT\" WHERE visibility<>'RESTRICTED' AND category IS DISTINCT FROM 'invoice'",
          )
          .then((r) => r.rows),
    table("DOCUMENT_LINK"),
    table("LOCATION"),
    table("DEPARTMENT"),
    table("EMPLOYEE_DEPARTMENT"),
    table("SUPPLIER_MATERIAL"),
    table("SUPPLIER"),
  ]);
  const find = (rows: Row[], id: string) => rows.find((row) => row["id"] === id);
  const date = (value: unknown) => iso(value) ?? "";
  const data: Snapshot = {
    CUSTOMERS: customers.map((c) => ({
      id: c["id"],
      name: c["name"],
      city: c["city"] ?? "",
      email: c["email"] ?? "",
    })),
    ADMIN_MACHINES: machines.map((m) => ({
      code: m["equipment_code"],
      name: m["name"],
      model: m["model"] ?? "",
      location: find(locations, m["location_id"])?.["name"] ?? "",
      status: machineStatus(m["status"]),
    })),
    EMPLOYEES: employees.map((e) => ({
      id: e["employee_code"],
      name: e["full_name"],
      title: e["job_title"] ?? "",
      department:
        find(
          departments,
          memberships.find((m) => m["employee_id"] === e["id"])?.["department_id"],
        )?.["name"] ?? "",
      status: e["is_active"] ? "active" : "inactive",
    })),
    ATTENDANCE: attendance.map((a) => ({
      id: a["id"],
      employeeId: find(employees, a["employee_id"])?.["employee_code"] ?? a["employee_id"],
      date: date(a["attendance_date"]).slice(0, 10) + "T12:00:00",
      status: a["status"] === "PRESENT" ? "present" : a["status"] === "ABSENT" ? "absent" : "leave",
      checkIn: iso(a["check_in_at"]),
    })),
    MAINTENANCE_PLANS: plans
      .filter((p) => p["is_active"])
      .map((p) => ({
        id: p["id"],
        machineCode: find(machines, p["machine_id"])?.["equipment_code"] ?? "",
        title: p["title"],
        intervalDays: p["interval_days"] ?? 0,
        lastDoneAt: date(p["last_completed_at"]),
        nextDueDate: iso(p["next_due_date"]),
      })),
    MAINTENANCE_RECORDS: history.map((h) => ({
      id: h["id"],
      planId: h["plan_id"] ?? undefined,
      machineCode: find(machines, h["machine_id"])?.["equipment_code"] ?? "",
      title: h["title"],
      doneAt: date(h["performed_at"]),
      by:
        find(employees, h["performed_by_employee_id"])?.["full_name"] ??
        find(suppliers, h["supplier_id"])?.["name"] ??
        "",
      note: h["notes"] ?? "",
    })),
    ORDERS: orders.map((o) => ({
      id: o["id"],
      number: o["order_number"],
      customerId: o["customer_id"],
      title: o["title"],
      quantity: o["quantity"],
      templateRev: `rev ${jobs.find((j) => j["order_id"] === o["id"])?.["revision"] ?? "—"}`,
      approval:
        !o["approval_required"] ||
        (o["approved_template_id"] === o["template_id"] && !!o["customer_approved_at"])
          ? "approved"
          : "pending",
      status:
        o["status"] === "SUBMITTED" && o["template_id"] && !o["customer_approved_at"]
          ? "awaiting_approval"
          : o["status"].toLowerCase(),
      createdAt: date(o["submitted_at"]),
      deadline: date(o["due_at"]),
      deliveredAt: iso(o["delivered_at"]),
      qc:
        o["qc_result"] === "NOT_CHECKED"
          ? undefined
          : {
              result: o["qc_result"] === "PASSED" ? "pass" : "fail",
              note: o["qc_notes"] ?? "",
              at: date(o["qc_checked_at"]),
            },
    })),
    JOBS: jobs.map((j) => ({
      id: j["id"],
      orderId: j["order_id"],
      name: j["name"],
      sequence: j["sequence_no"],
      machineCode: j["equipment_code"] ?? "",
      employeeId: j["employee_code"] ?? undefined,
      status: jobStatus(j),
      blockedReason: taskFromRow(j).blockedReason,
      instructions: j["instructions"] ?? "",
      materialId: j["planned_materials"][0]?.materialId,
      materialQty: j["planned_materials"][0]?.plannedQuantity,
      quantityDone: j["completed_quantity"],
      startedAt: iso(j["started_at"]),
      completedAt: iso(j["completed_at"]),
    })),
    MATERIALS: materials.map((m) => ({
      id: m["id"],
      code: m["material_code"],
      name: m["name"],
      unit: m["unit"],
      minQty: n(m["min_stock"]),
      supplier:
        find(
          suppliers,
          supplierMaterials.find((s) => s["material_id"] === m["id"])?.["supplier_id"],
        )?.["name"] ?? "",
      unitCost: canSeeFinance ? n(m["standard_unit_cost"]) : 0,
    })),
    STOCK_BALANCES: balances.map((b) => ({
      materialId: b["material_id"],
      location: find(locations, b["location_id"])?.["name"] ?? "",
      qty: n(b["quantity"]),
    })),
    STOCK_MOVEMENTS: movements.map((m) => ({
      id: m["id"],
      materialId: m["material_id"],
      at: date(m["movement_date"]),
      type: m["movement_type"] === "ADJUSTMENT" ? "adjust" : m["from_location_id"] ? "out" : "in",
      qty: n(m["quantity"]) * (m["from_location_id"] ? -1 : 1),
      jobId: m["job_id"] ?? undefined,
      note: m["reason"] ?? "",
    })),
    FINANCIAL_RECORDS: [],
    DOCUMENTS: documents.map((d) => ({
      id: d["id"],
      title: d["title"],
      kind: ["drawing", "manual", "invoice", "photo", "certificate"].includes(d["category"])
        ? d["category"]
        : "drawing",
      classification: d["visibility"] === "RESTRICTED" ? "restricted" : "internal",
      uploadedAt: date(d["uploaded_at"]),
      links: links
        .filter((l) => l["document_id"] === d["id"])
        .flatMap((l) =>
          (
            [
              ["order", l["customer_order_id"]],
              ["machine", find(machines, l["machine_id"])?.["equipment_code"]],
              ["job", l["job_id"]],
              ["material", l["material_id"]],
              ...(canSeeFinance ? [["finance", l["financial_record_id"]]] : []),
            ] as const
          )
            .filter((entry) => !!entry[1])
            .map(([type, id]) => ({
              type: type as "order" | "machine" | "job" | "material" | "finance",
              id: id as string,
            })),
        ),
    })),
  };
  if (canSeeFinance)
    data.FINANCIAL_RECORDS = (await table("FINANCIAL_RECORD")).map((f) => ({
      id: f["id"],
      ref: f["reference_number"] ?? "",
      type: f["type"] === "SALE_REFUND" ? "refund" : f["type"].toLowerCase(),
      category: f["category"] ?? "",
      counterparty:
        find(suppliers, f["supplier_id"])?.["name"] ??
        find(
          customers,
          f["customer_id"] ?? find(orders, f["customer_order_id"])?.["customer_id"],
        )?.["name"] ??
        "",
      amount: n(f["amount"]),
      paid: n(f["paid_amount"]),
      date: date(f["record_date"]),
      dueDate: date(f["due_date"]),
      orderId: f["customer_order_id"] ?? undefined,
    }));
  return {
    allowed: true as const,
    email: account.full_name,
    canSeeFinance,
    sampleData: localDemoEnabled() || previewEnabled(),
    data,
  };
}
