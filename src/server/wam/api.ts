import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { getDatabase, withActor } from "./database";
import {
  ApiError,
  authenticate,
  clearSessionCookie,
  localDemoEnabled,
  localLogin,
  previewEnabled,
  previewLogin,
  requestOrigin,
  requireRole,
  sessionCookie,
} from "./auth";
import { operatorSnapshot } from "./read-models";
import { changeShift, finishShift, mutateTask, startShift } from "./actions";
import { insert } from "./seed";
import { authorizeDocument } from "./documents";
import { recordsWorkspace, createRecord, changeRecord } from "./records";

const uuid = z.string().uuid();
const note = z.string().max(10000);
const mutation = z.object({
  recordVersion: z.number().int().positive(),
  text: note.optional(),
  photos: z.array(z.string().max(4300000)).max(3).optional(),
});
const json = (value: unknown, status = 200, headers?: Record<string, string>) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });
async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(415, "Send application/json.");
  const limit = 16 * 1024 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new ApiError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.length;
    if (length > limit) {
      await reader.cancel();
      throw new ApiError(413, "Request is too large.");
    }
    chunks.push(next.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Invalid JSON.");
  }
}

export async function handleWamRequest(request: Request): Promise<Response> {
  try {
    const path = new URL(request.url).pathname.replace(/^\/api\/wam\/?/, "").replace(/\/$/, "");
    const method = request.method;
    if (!["GET", "POST", "PATCH", "DELETE"].includes(method))
      return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST, PATCH, DELETE" });
    if (method !== "GET" && request.headers.get("origin") !== requestOrigin(request))
      throw new ApiError(403, "A matching Origin header is required.");
    if (path === "config" && method === "GET")
      return json({ localDemo: localDemoEnabled(), preview: previewEnabled() });
    const db = await getDatabase();
    if (path === "health" && method === "GET") {
      const { rows } = await db.query(
        "SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      );
      return json({
        status: "ok",
        database: "PostgreSQL",
        tables: rows[0]?.["tables"],
        sampleData: localDemoEnabled() || previewEnabled(),
      });
    }
    if (path === "preview-login" && method === "POST") {
      const input = z
        .object({ id: z.string().min(1).max(80), password: z.string().min(1).max(200) })
        .strict()
        .parse(await body(request));
      const account = await previewLogin(db, request, input.id, input.password);
      if (account.role === "PRODUCTION") await startShift(db, account);
      return json({ role: account.role, employeeCode: account.employee_code }, 200, {
        "Set-Cookie": sessionCookie(account.id, true, "preview"),
      });
    }
    if (path === "login" && method === "POST") {
      const input = z
        .object({ id: z.string().min(1).max(80), pin: z.string().min(1).max(100) })
        .parse(await body(request));
      const account = await localLogin(db, request, input.id, input.pin);
      if (account.role === "PRODUCTION") await startShift(db, account);
      return json({ role: account.role, employeeCode: account.employee_code }, 200, {
        "Set-Cookie": sessionCookie(account.id, new URL(request.url).protocol === "https:"),
      });
    }
    const account = await authenticate(db, request);
    const resource = /^records\/([A-Z_]+)(?:\/([0-9a-f-]+))?$/.exec(path);
    if (resource) {
      if (method === "GET" && !resource[2]) {
        const params = new URL(request.url).searchParams;
        const offset = z.coerce
          .number()
          .int()
          .min(0)
          .max(1000000)
          .parse(params.get("offset") ?? 0);
        const search = z
          .string()
          .max(200)
          .parse(params.get("search") ?? "");
        return json(await recordsWorkspace(db, account, { entity: resource[1]!, offset, search }));
      }
      if (method === "POST" && !resource[2])
        return json(await createRecord(db, account, resource[1]!, await body(request)), 201);
      if ((method === "PATCH" || method === "DELETE") && resource[2])
        return json(
          await changeRecord(
            db,
            account,
            resource[1]!,
            resource[2],
            await body(request),
            method === "DELETE",
          ),
        );
      throw new ApiError(405, "Method not allowed for this record collection.");
    }
    if (path === "session" && method === "GET")
      return json({
        role: account.role,
        name: account.full_name,
        employeeCode: account.employee_code,
      });
    if (path === "logout" && method === "POST")
      return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie });
    if (path === "operator" && method === "GET") {
      requireRole(account, ["PRODUCTION", "ADMIN", "MANAGER"]);
      return json(await operatorSnapshot(db, account));
    }
    if (path === "shift/start" && method === "POST") {
      await startShift(db, account);
      return json(await operatorSnapshot(db, account));
    }
    if (path === "machine" && method === "POST") {
      const { code } = z.object({ code: z.string().max(40) }).parse(await body(request));
      await changeShift(db, account, { type: "machine", code });
      return json(await operatorSnapshot(db, account));
    }
    if (path === "checks" && method === "POST") {
      const input = z
        .object({
          phase: z.enum(["start", "end"]),
          id: uuid,
          state: z.enum(["done", "skipped"]).nullable(),
          requestKey: uuid,
        })
        .parse(await body(request));
      await changeShift(db, account, { type: "check", ...input });
      return json(await operatorSnapshot(db, account));
    }
    if (path === "shift/finish" && method === "POST") {
      const { handover } = z.object({ handover: note }).parse(await body(request));
      await finishShift(db, account, handover);
      return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie });
    }
    const task = /^tasks\/([^/]+)\/(claim|activity|complete)$/.exec(path);
    if (task && method === "POST") {
      await mutateTask(
        db,
        account,
        uuid.parse(task[1]),
        task[2] as "claim" | "activity" | "complete",
        mutation.parse(await body(request)),
      );
      return json(await operatorSnapshot(db, account));
    }
    const file = /^files\/([^/]+)$/.exec(path);
    if (file && method === "GET") {
      const id = uuid.parse(file[1]);
      const doc = (await db.query('SELECT * FROM "DOCUMENT" WHERE id=$1', [id])).rows[0];
      if (!doc || !/^(uploads|database-uploads)\//.test(doc["file_path"]))
        throw new ApiError(404, "File not found.");
      await authorizeDocument(db, account, doc);
      const stored = doc["file_path"].startsWith("database-uploads/")
        ? (
            await db.query(
              "SELECT encode(content,'base64') AS base64 FROM wam_internal.document_content WHERE document_id=$1",
              [id],
            )
          ).rows[0]
        : undefined;
      const bytes = doc["file_path"].startsWith("database-uploads/")
        ? stored
          ? Buffer.from(stored["base64"], "base64")
          : null
        : await readFile(resolve(process.env["WAM_UPLOAD_DIR"] ?? ".data/uploads", id)).catch(
            () => {
              throw new ApiError(404, "File is missing from storage.");
            },
          );
      if (!bytes) throw new ApiError(404, "File is missing from storage.");
      return new Response(bytes, {
        headers: {
          "Content-Type": doc["mime_type"],
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          ...(!["image/jpeg", "image/png", "image/webp"].includes(doc["mime_type"])
            ? {
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc["original_filename"] ?? doc["title"])}`,
                "Content-Security-Policy": "default-src 'none'; sandbox",
              }
            : {}),
        },
      });
    }
    if (path === "customers" && method === "POST") {
      requireRole(account, ["ADMIN", "MANAGER", "OFFICE"]);
      const input = z
        .object({
          name: z.string().trim().min(1).max(180),
          contact_name: z.string().max(150).optional(),
          phone: z.string().max(40).optional(),
          email: z.string().email().max(255).optional(),
          notes: note.optional(),
        })
        .strict()
        .parse(await body(request));
      return json(
        await withActor(
          db,
          account.id,
          "Create customer",
          async (tx) =>
            (
              await tx.query(
                'INSERT INTO "CUSTOMER"(name,contact_name,phone,email,notes) VALUES($1,$2,$3,$4,$5) RETURNING *',
                [
                  input.name,
                  input.contact_name ?? null,
                  input.phone ?? null,
                  input.email ?? null,
                  input.notes ?? null,
                ],
              )
            ).rows[0],
        ),
        201,
      );
    }
    if (path === "orders" && method === "POST") {
      requireRole(account, ["ADMIN", "MANAGER", "OFFICE"]);
      const input = z
        .object({
          order_number: z.string().trim().min(1).max(40),
          title: z.string().trim().min(1).max(180),
          customer_id: uuid,
          template_id: uuid.optional(),
          quantity: z.number().int().positive(),
          due_at: z.string().datetime({ offset: true }).optional(),
          special_requests: note.optional(),
        })
        .strict()
        .parse(await body(request));
      return json(
        await withActor(db, account.id, "Create customer order", async (tx) => {
          await insert(tx, "CUSTOMER_ORDER", { ...input, intake_employee_id: account.employee_id });
          return (
            await tx.query('SELECT * FROM "CUSTOMER_ORDER" WHERE order_number=$1', [
              input.order_number,
            ])
          ).rows[0];
        }),
        201,
      );
    }
    const order = /^orders\/([^/]+)$/.exec(path);
    if (order && method === "PATCH") {
      requireRole(account, ["ADMIN", "MANAGER"]);
      const id = uuid.parse(order[1]);
      const input = z
        .object({
          record_version: z.number().int().positive(),
          status: z
            .enum([
              "SUBMITTED",
              "PLANNED",
              "IN_PRODUCTION",
              "QC",
              "READY",
              "DELIVERED",
              "CANCELLED",
            ])
            .optional(),
          template_id: uuid.optional(),
          approved_template_id: uuid.optional(),
          approved_by_contact: z.string().trim().min(1).max(180).optional(),
          customer_approved_at: z.string().datetime({ offset: true }).optional(),
          qc_result: z.enum(["NOT_CHECKED", "PASSED", "FAILED"]).optional(),
          qc_notes: note.optional(),
          cancellation_reason: note.optional(),
        })
        .strict()
        .parse(await body(request));
      const result = await withActor(db, account.id, "Update order workflow", async (tx) => {
        const { record_version, ...fields } = input;
        const changes: Record<string, unknown> = { ...fields };
        if (input.qc_result) {
          changes["qc_employee_id"] =
            input.qc_result === "NOT_CHECKED" ? null : account.employee_id;
          changes["qc_checked_at"] =
            input.qc_result === "NOT_CHECKED" ? null : new Date().toISOString();
        }
        if (input.status === "DELIVERED") changes["delivered_at"] = new Date().toISOString();
        const keys = Object.keys(changes);
        if (!keys.length) throw new ApiError(400, "Supply a workflow change.");
        const row = (
          await tx.query(
            `UPDATE "CUSTOMER_ORDER" SET ${keys.map((key, i) => `"${key}"=$${i + 3}`).join(",")} WHERE id=$1 AND record_version=$2 RETURNING *`,
            [id, record_version, ...Object.values(changes)],
          )
        ).rows[0];
        if (!row)
          throw new ApiError(
            409,
            "The order changed or no longer exists. Reload it and try again.",
          );
        return row;
      });
      return json(result);
    }
    if (path === "jobs" && method === "POST") {
      requireRole(account, ["ADMIN", "MANAGER"]);
      const input = z
        .object({
          order_id: uuid,
          sequence_no: z.number().int().positive(),
          name: z.string().trim().min(1).max(180),
          machine_id: uuid.optional(),
          notes: note.optional(),
        })
        .strict()
        .parse(await body(request));
      await withActor(db, account.id, "Plan production step", (tx) => insert(tx, "JOB", input));
      return json({ ok: true }, 201);
    }
    if (path === "stock-movements" && method === "POST") {
      requireRole(account, ["ADMIN", "MANAGER", "PRODUCTION"]);
      const input = z
        .object({
          request_key: uuid,
          material_id: uuid,
          from_location_id: uuid.optional(),
          to_location_id: uuid.optional(),
          job_id: uuid.optional(),
          quantity: z.number().positive(),
          movement_type: z.enum(["RECEIPT", "TRANSFER", "CONSUMPTION", "RETURN", "ADJUSTMENT"]),
          reason: note.optional(),
        })
        .strict()
        .parse(await body(request));
      if (
        account.role === "PRODUCTION" &&
        (!["CONSUMPTION", "RETURN"].includes(input.movement_type) ||
          !input.job_id ||
          !(
            await db.query(
              "SELECT 1 FROM \"JOB\" WHERE id=$1 AND responsible_employee_id=$2 AND status='IN_PROGRESS'",
              [input.job_id, account.employee_id],
            )
          ).rows.length)
      )
        throw new ApiError(403, "Operators may post usage only against their active job.");
      const result = await withActor(db, account.id, "Post stock movement", async (tx) => {
        await tx.query(
          'INSERT INTO "STOCK_MOVEMENT"(request_key,material_id,from_location_id,to_location_id,job_id,quantity,movement_type,reason,performed_by_employee_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(request_key) DO NOTHING',
          [
            input.request_key,
            input.material_id,
            input.from_location_id ?? null,
            input.to_location_id ?? null,
            input.job_id ?? null,
            input.quantity,
            input.movement_type,
            input.reason ?? null,
            account.employee_id,
          ],
        );
        const row = (
          await tx.query('SELECT * FROM "STOCK_MOVEMENT" WHERE request_key=$1', [input.request_key])
        ).rows[0]!;
        if (
          row["material_id"] !== input.material_id ||
          Number(row["quantity"]) !== input.quantity ||
          row["movement_type"] !== input.movement_type ||
          row["from_location_id"] !== (input.from_location_id ?? null) ||
          row["to_location_id"] !== (input.to_location_id ?? null) ||
          row["job_id"] !== (input.job_id ?? null) ||
          row["performed_by_employee_id"] !== account.employee_id ||
          row["reason"] !== (input.reason ?? null)
        )
          throw new ApiError(
            409,
            "That retry key was already used for a different stock movement.",
          );
        return row;
      });
      if (!account.financeAccess) delete result["financial_record_id"];
      return json(result, 201);
    }
    if (path === "audit" && method === "GET") {
      requireRole(account, ["ADMIN", "MANAGER"]);
      return json(
        (
          await db.query(
            'SELECT id,actor_user_id,entity_type,entity_id,action,changed_columns,occurred_at FROM "AUDIT_LOG" ORDER BY occurred_at DESC LIMIT 200',
          )
        ).rows,
      );
    }
    throw new ApiError(404, "Endpoint not found.");
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        },
        400,
      );
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return json({ error: "A record with this reference already exists." }, 409);
    if (code === "23503")
      return json({ error: "A referenced record does not exist or is still in use." }, 409);
    if (["23514", "P0001", "40001", "40P01"].includes(code ?? ""))
      return json(
        {
          error:
            code === "P0001"
              ? (error as Error).message
              : "This change violates a database rule or conflicts with another update.",
        },
        409,
      );
    console.error("WAM API failure", error);
    return json({ error: "The database request failed. Check the server log." }, 500);
  }
}
