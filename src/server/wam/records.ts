import { randomUUID } from "node:crypto";
import { z } from "zod";
import { RECORD_ENTITIES, type RecordEntity, type RecordField } from "../../lib/wam/record-catalog";
import { ApiError, requireRole, type Account } from "./auth";
import { withActor, type Database, type Row } from "./database";
import { insert } from "./seed";
import { saveDocument } from "./documents";

const quote = (key: string) => `"${key}"`;
export function entityFor(key: string, account: Account) {
  requireRole(account, ["ADMIN", "MANAGER"]);
  const entity = RECORD_ENTITIES.find((item) => item.key === key);
  if (!entity) throw new ApiError(404, "Record collection not found.");
  if (
    (entity.adminOnly && account.role !== "ADMIN") ||
    (entity.financeOnly && !account.financeAccess)
  )
    throw new ApiError(403, "You do not have permission for this collection.");
  return entity;
}
function fieldsFor(entity: RecordEntity, account: Account) {
  return entity.fields.filter((field) => !field.finance || account.financeAccess);
}
function validator(field: RecordField) {
  let schema: z.ZodType =
    field.type === "reference"
      ? z.string().uuid()
      : field.type === "boolean"
        ? z.boolean()
        : field.type === "integer"
          ? z.number().int().min(-2147483648).max(2147483647)
          : field.type === "decimal"
            ? z.union([z.number().finite(), z.string().regex(/^-?\d{1,12}(\.\d{1,4})?$/)])
            : field.type === "date"
              ? z.iso.date()
              : field.type === "datetime"
                ? z.iso.datetime({ offset: true })
                : field.type === "enum"
                  ? z.enum(field.options as [string, ...string[]])
                  : z
                      .string()
                      .trim()
                      .min(field.required ? 1 : 0)
                      .max(field.max ?? 20000);
  if (field.nullable) schema = schema.nullable();
  return schema;
}
function parseFields(entity: RecordEntity, account: Account, values: unknown, editing: boolean) {
  const allowed = editing ? entity.editFields : entity.createFields;
  const shape: Record<string, z.ZodType> = {};
  for (const field of fieldsFor(entity, account).filter((field) => allowed.includes(field.key))) {
    const schema = validator(field);
    shape[field.key] = !editing && field.required ? schema : schema.optional();
  }
  return z.object(shape).strict().parse(values) as Record<string, unknown>;
}

export async function recordsWorkspace(
  db: Database,
  account: Account,
  input: { entity: string; offset?: number; search?: string },
) {
  const entity = entityFor(input.entity, account);
  const fields = fieldsFor(entity, account);
  const visibleEntities = RECORD_ENTITIES.filter(
    (item) =>
      (!item.adminOnly || account.role === "ADMIN") && (!item.financeOnly || account.financeAccess),
  );
  const lookups: Record<string, { id: string; label: string }[]> = {};
  const lookupRows: Record<string, Row[]> = {};
  // Only label fields are fetched for relationship pickers, including when price fields are hidden.
  for (const resource of RECORD_ENTITIES) {
    if (
      (resource.financeOnly && !account.financeAccess) ||
      (resource.adminOnly && account.role !== "ADMIN")
    )
      continue;
    const columns = [...new Set(["id", ...resource.labelFields])];
    lookupRows[resource.key] = (
      await db.query(
        `SELECT ${columns.map(quote).join(",")} FROM ${quote(resource.key)}${resource.key === "DOCUMENT" && !account.financeAccess ? " WHERE visibility<>'RESTRICTED' AND upper(coalesce(category,'')) NOT IN ('INVOICE','FINANCIAL')" : ""} ORDER BY id LIMIT 1000`,
      )
    ).rows;
  }
  const label = (key: string, row: Row, depth = 0): string => {
    const spec = RECORD_ENTITIES.find((item) => item.key === key)!;
    return (
      spec.labelFields
        .map((column) => {
          const value = row[column];
          const reference = spec.fields.find((field) => field.key === column)?.reference;
          if (reference && depth < 3) {
            const target = lookupRows[reference]?.find((item) => item["id"] === value);
            return target ? label(reference, target, depth + 1) : "Unassigned";
          }
          return value instanceof Date ? value.toISOString() : value == null ? "" : String(value);
        })
        .filter(Boolean)
        .join(" · ") || String(row["id"])
    );
  };
  for (const [key, rows] of Object.entries(lookupRows))
    lookups[key] = rows.map((row) => ({ id: row["id"], label: label(key, row) }));
  const parameters: unknown[] = [];
  let where = "";
  if (input.search?.trim()) {
    parameters.push(`%${input.search.trim()}%`);
    const own = fields.map((field) => `r.${quote(field.key)}::text ILIKE $1`);
    for (const field of fields.filter((field) => field.reference)) {
      const target = RECORD_ENTITIES.find((item) => item.key === field.reference)!;
      own.push(
        `EXISTS(SELECT 1 FROM ${quote(target.key)} ref WHERE ref.id=r.${quote(field.key)} AND concat_ws(' ',${target.labelFields.map((column) => `ref.${quote(column)}::text`).join(",")}) ILIKE $1)`,
      );
    }
    where = ` WHERE (${own.join(" OR ")})`;
  }
  if (entity.key === "DOCUMENT" && !account.financeAccess)
    where += `${where ? " AND" : " WHERE"} r.visibility<>'RESTRICTED' AND upper(coalesce(r.category,'')) NOT IN ('INVOICE','FINANCIAL')`;
  const total = Number(
    (
      await db.query(
        `SELECT count(*)::int AS total FROM ${quote(entity.key)} r${where}`,
        parameters,
      )
    ).rows[0]?.["total"] ?? 0,
  );
  const selected = [
    ...new Set([
      "id",
      ...fields.map((field) => field.key),
      ...(entity.key === "AUDIT_LOG" ||
      entity.key === "JOB_ACTIVITY" ||
      entity.key === "STOCK_BALANCE" ||
      entity.key === "STOCK_MOVEMENT" ||
      entity.key === "TEMPLATE"
        ? []
        : ["record_version"]),
    ]),
  ];
  parameters.push(input.offset ?? 0);
  const rows = (
    await db.query(
      `SELECT ${selected.map((column) => `r.${quote(column)}`).join(",")} FROM ${quote(entity.key)} r${where} ORDER BY ${entity.key === "AUDIT_LOG" || entity.key === "JOB_ACTIVITY" ? "r.occurred_at DESC," : ""} r.id LIMIT 100 OFFSET $${parameters.length}`,
      parameters,
    )
  ).rows;
  return {
    entities: visibleEntities.map((item) => ({
      ...item,
      fields: fieldsFor(item, account),
      createFields: item.createFields.filter((key) =>
        fieldsFor(item, account).some((field) => field.key === key),
      ),
      editFields: item.editFields.filter((key) =>
        fieldsFor(item, account).some((field) => field.key === key),
      ),
    })),
    rows,
    lookups,
    total,
    offset: input.offset ?? 0,
    pageSize: 100,
    canSeeFinance: !!account.financeAccess,
  };
}

export async function createRecord(db: Database, account: Account, key: string, request: unknown) {
  const entity = entityFor(key, account);
  if (!entity.createFields.length)
    throw new ApiError(405, "This history is recorded through its workflow.");
  const envelope = z
    .object({
      values: z.record(z.string(), z.unknown()),
      file: z
        .object({ name: z.string().min(1).max(255), data: z.string().max(14500000) })
        .optional(),
      requestKey: z.string().uuid().optional(),
      reason: z.string().trim().min(3).max(1000).optional(),
    })
    .strict()
    .parse(request);
  const fields = parseFields(entity, account, envelope.values, false);
  if (entity.upload && !envelope.file) throw new ApiError(400, "Choose a file to upload.");
  return withActor(
    db,
    account.id,
    envelope.reason ?? `Create ${entity.label.toLowerCase()}`,
    async (tx) => {
      const id = randomUUID();
      if (key === "DOCUMENT") {
        if (
          (fields["visibility"] === "RESTRICTED" ||
            ["INVOICE", "FINANCIAL"].includes(String(fields["category"]).toUpperCase())) &&
          !account.financeAccess
        )
          throw new ApiError(403, "Finance permission is required.");
        const document = await saveDocument(tx, account, {
          title: String(fields["title"]),
          category: (fields["category"] as string | null) ?? null,
          visibility: (fields["visibility"] as string | null) ?? null,
          filename: envelope.file!.name,
          data: envelope.file!.data,
        });
        return (await tx.query('SELECT * FROM "DOCUMENT" WHERE id=$1', [document.id])).rows[0];
      }
      if (key === "TEMPLATE") {
        const document = await saveDocument(tx, account, {
          title: String(fields["name"]),
          category: "drawing",
          filename: envelope.file!.name,
          data: envelope.file!.data,
        });
        await insert(tx, "TEMPLATE", {
          id,
          ...fields,
          design_file: document.path,
          design_checksum: document.checksum,
        });
        await insert(tx, "DOCUMENT_LINK", { document_id: document.id, template_id: id });
      } else {
        if (key === "CUSTOMER_ORDER") fields["intake_employee_id"] = account.employee_id;
        if (key === "ATTENDANCE" || key === "MACHINE_MAINTENANCE")
          fields["recorded_by_employee_id"] = account.employee_id;
        if (key === "MAINTENANCE_PLAN") fields["created_by_employee_id"] = account.employee_id;
        if (key === "MACHINE_MAINTENANCE" && fields["plan_id"])
          fields["request_key"] = envelope.requestKey ?? randomUUID();
        if (key === "STOCK_MOVEMENT") {
          fields["request_key"] = envelope.requestKey ?? randomUUID();
          fields["performed_by_employee_id"] = account.employee_id;
          const existing = (
            await tx.query('SELECT * FROM "STOCK_MOVEMENT" WHERE request_key=$1', [
              fields["request_key"],
            ])
          ).rows[0];
          if (existing) {
            for (const [column, value] of Object.entries(fields))
              if (
                ["decimal", "integer"].includes(
                  entity.fields.find((field) => field.key === column)?.type ?? "",
                )
                  ? Number(existing[column]) !== Number(value)
                  : String(existing[column] ?? "") !== String(value ?? "")
              )
                throw new ApiError(409, "That retry key belongs to a different stock movement.");
            return sanitize(entity, account, existing);
          }
        }
        if (key === "FINANCIAL_RECORD" && fields["original_record_id"]) {
          const original = (
            await tx.query('SELECT * FROM "FINANCIAL_RECORD" WHERE id=$1', [
              fields["original_record_id"],
            ])
          ).rows[0];
          if (!original) throw new ApiError(404, "Original financial record not found.");
          for (const column of ["customer_order_id", "customer_id", "supplier_id", "currency"])
            if (fields[column] == null) fields[column] = original[column];
        }
        await insert(tx, key, { id, ...fields });
      }
      const result = (await tx.query(`SELECT * FROM ${quote(key)} WHERE id=$1`, [id])).rows[0];
      return sanitize(entity, account, result!);
    },
  );
}

function sanitize(entity: RecordEntity, account: Account, row: Row) {
  if (account.financeAccess) return row;
  const result = { ...row };
  for (const field of entity.fields) if (field.finance) delete result[field.key];
  return result;
}

export async function changeRecord(
  db: Database,
  account: Account,
  key: string,
  id: string,
  request: unknown,
  removing = false,
) {
  const entity = entityFor(key, account);
  z.string().uuid().parse(id);
  if (removing ? !entity.removable : !entity.editFields.length)
    throw new ApiError(
      405,
      "This record is managed through its workflow and cannot be edited here.",
    );
  const envelope = z
    .object({
      values: z.record(z.string(), z.unknown()).default({}),
      version: z.number().int().positive().optional(),
      reason: z.string().trim().min(3).max(1000).optional(),
    })
    .strict()
    .parse(request);
  const fields = parseFields(entity, account, envelope.values, true);
  return withActor(
    db,
    account.id,
    envelope.reason ?? `${removing ? "Remove" : "Update"} ${entity.label.toLowerCase()}`,
    async (tx) => {
      const current = (await tx.query(`SELECT * FROM ${quote(key)} WHERE id=$1 FOR UPDATE`, [id]))
        .rows[0];
      if (!current) throw new ApiError(404, "Record not found.");
      if (current["record_version"] && envelope.version !== current["record_version"])
        throw new ApiError(409, "This record changed. Reload it before saving.");
      if (
        key === "USER_ACCOUNT" &&
        id === account.id &&
        (fields["is_active"] === false || (fields["role"] && fields["role"] !== "ADMIN"))
      )
        throw new ApiError(409, "You cannot remove your own administrator access.");
      if (
        key === "DOCUMENT" &&
        (current["visibility"] === "RESTRICTED" ||
          fields["visibility"] === "RESTRICTED" ||
          [current["category"], fields["category"]].some((value) =>
            ["INVOICE", "FINANCIAL"].includes(String(value).toUpperCase()),
          )) &&
        !account.financeAccess
      )
        throw new ApiError(403, "Finance permission is required for this document.");
      if (removing) {
        await tx.query(`DELETE FROM ${quote(key)} WHERE id=$1`, [id]);
        return { id, removed: true };
      }
      if (key === "CUSTOMER_ORDER") {
        if (fields["approval_required"] === false && !envelope.reason)
          throw new ApiError(400, "Explain the legacy approval exemption before saving.");
        if ("qc_result" in fields) {
          fields["qc_employee_id"] =
            fields["qc_result"] === "NOT_CHECKED" ? null : account.employee_id;
          fields["qc_checked_at"] =
            fields["qc_result"] === "NOT_CHECKED" ? null : new Date().toISOString();
        }
        if (fields["status"] === "DELIVERED") fields["delivered_at"] = new Date().toISOString();
      }
      if (key === "ATTENDANCE" || key === "MACHINE_MAINTENANCE")
        fields["recorded_by_employee_id"] = account.employee_id;
      const columns = Object.keys(fields);
      if (!columns.length) throw new ApiError(400, "No changes were supplied.");
      const row = (
        await tx.query(
          `UPDATE ${quote(key)} SET ${columns.map((column, index) => `${quote(column)}=$${index + 2}`).join(",")} WHERE id=$1 RETURNING *`,
          [id, ...Object.values(fields)],
        )
      ).rows[0]!;
      return sanitize(entity, account, row);
    },
  );
}
