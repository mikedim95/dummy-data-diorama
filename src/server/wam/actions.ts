import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { ApiError, type Account, requireRole } from "./auth";
import { type Database, withActor } from "./database";
import { insert } from "./seed";
import { metadata, readAttendance, readMaintenance, readJobs, taskFromRow } from "./read-models";
import { canClaim, canFinishShift } from "../../lib/wam/logic";
import type { CheckState } from "../../lib/wam/types";

export async function startShift(db: Database, account: Account) {
  requireRole(account, ["PRODUCTION", "ADMIN", "MANAGER"]);
  await withActor(db, account.id, "Operator sign in", async (tx) => {
    await tx.query('SELECT id FROM "EMPLOYEE" WHERE id=$1 FOR UPDATE', [account.employee_id]);
    const previous = await readAttendance(tx, account);
    if (previous?.["check_in_at"] && !previous["check_out_at"]) return;
    await tx.query(
      `INSERT INTO "ATTENDANCE"(employee_id,status,check_in_at,recorded_by_employee_id,notes) VALUES($1,'PRESENT',now(),$1,'{}')
      ON CONFLICT(employee_id,attendance_date) DO UPDATE SET status='PRESENT',check_in_at=now(),check_out_at=NULL,recorded_by_employee_id=$1,notes='{}'`,
      [account.employee_id],
    );
  });
}

export async function changeShift(
  db: Database,
  account: Account,
  action:
    | { type: "machine"; code: string }
    | {
        type: "check";
        phase: "start" | "end";
        id: string;
        state: CheckState | null;
        requestKey: string;
      },
) {
  requireRole(account, ["PRODUCTION", "ADMIN", "MANAGER"]);
  await withActor(db, account.id, "Operator machine/check update", async (tx) => {
    await tx.query('SELECT id FROM "EMPLOYEE" WHERE id=$1 FOR UPDATE', [account.employee_id]);
    const attendance = await readAttendance(tx, account);
    if (!attendance || attendance["check_out_at"])
      throw new ApiError(409, "Sign in to start a shift first.");
    const notes = metadata(attendance["notes"]);
    if (action.type === "machine") {
      const machine = (
        await tx.query('SELECT id FROM "MACHINE" WHERE equipment_code=$1 AND is_active', [
          action.code,
        ])
      ).rows[0];
      if (!machine) throw new ApiError(404, "Machine not found.");
      if (notes["machineCode"] !== action.code)
        Object.assign(notes, { machineCode: action.code, startChecks: {}, endChecks: {} });
    } else {
      const items = (await readMaintenance(tx))[notes["machineCode"]] ?? [];
      const item = items.find((check) => check.id === action.id && check.phase === action.phase);
      if (!item || item.kind !== "required")
        throw new ApiError(403, "This check cannot be completed by an operator.");
      const key = action.phase === "start" ? "startChecks" : "endChecks";
      notes[key] ??= {};
      if (action.state) notes[key][action.id] = action.state;
      else delete notes[key][action.id];
      if (action.state === "done") {
        const plan = (
          await tx.query('SELECT * FROM "MAINTENANCE_PLAN" WHERE id=$1 FOR UPDATE', [action.id])
        ).rows[0]!;
        if (
          plan["requires_machine_stop"] &&
          (
            await tx.query(
              "SELECT 1 FROM \"JOB\" WHERE machine_id=$1 AND status='IN_PROGRESS' LIMIT 1",
              [plan["machine_id"]],
            )
          ).rows.length
        )
          throw new ApiError(409, "Stop active machine work before completing this service.");
        const previous = (
          await tx.query(
            'SELECT plan_id,performed_by_employee_id FROM "MACHINE_MAINTENANCE" WHERE request_key=$1',
            [action.requestKey],
          )
        ).rows[0];
        if (
          previous &&
          (previous["plan_id"] !== action.id ||
            previous["performed_by_employee_id"] !== account.employee_id)
        )
          throw new ApiError(
            409,
            "That retry key was already used for a different maintenance completion.",
          );
        if (!previous) {
          await insert(tx, "MACHINE_MAINTENANCE", {
            machine_id: plan["machine_id"],
            plan_id: plan["id"],
            maintenance_type: plan["maintenance_type"],
            request_key: action.requestKey,
            title: plan["title"],
            performed_by_employee_id: account.employee_id,
            recorded_by_employee_id: account.employee_id,
          });
        }
      }
    }
    await tx.query('UPDATE "ATTENDANCE" SET notes=$2,recorded_by_employee_id=$3 WHERE id=$1', [
      attendance["id"],
      JSON.stringify(notes),
      account.employee_id,
    ]);
  });
}

export async function finishShift(db: Database, account: Account, handover: string) {
  requireRole(account, ["PRODUCTION", "ADMIN", "MANAGER"]);
  await withActor(db, account.id, "Shift handover and sign out", async (tx) => {
    await tx.query('SELECT id FROM "EMPLOYEE" WHERE id=$1 FOR UPDATE', [account.employee_id]);
    const attendance = await readAttendance(tx, account);
    if (!attendance || attendance["check_out_at"])
      throw new ApiError(409, "There is no open shift.");
    const notes = metadata(attendance["notes"]);
    const items = ((await readMaintenance(tx))[notes["machineCode"]] ?? []).filter(
      (item) => item.phase === "end",
    );
    const active =
      (
        await tx.query(
          "SELECT 1 FROM \"JOB\" WHERE responsible_employee_id=$1 AND status='IN_PROGRESS' LIMIT 1",
          [account.employee_id],
        )
      ).rows.length > 0;
    if (!canFinishShift(items, notes["endChecks"] ?? {}, active, handover))
      throw new ApiError(
        409,
        "Complete the end checks and add a handover for skipped checks or active work.",
      );
    await tx.query(
      'UPDATE "ATTENDANCE" SET check_out_at=now(),notes=$2,recorded_by_employee_id=$3 WHERE id=$1',
      [attendance["id"], JSON.stringify({ ...notes, handover }), account.employee_id],
    );
  });
}

export async function mutateTask(
  db: Database,
  account: Account,
  id: string,
  action: "claim" | "activity" | "complete",
  input: { recordVersion: number; text?: string | undefined; photos?: string[] | undefined },
) {
  requireRole(account, ["PRODUCTION", "ADMIN", "MANAGER"]);
  const createdFiles: string[] = [];
  try {
    await withActor(db, account.id, `Operator task ${action}`, async (tx) => {
      // All claims by one employee serialize, even when two browser tabs race on different jobs.
      await tx.query('SELECT id FROM "EMPLOYEE" WHERE id=$1 FOR UPDATE', [account.employee_id]);
      const attendance = await readAttendance(tx, account);
      if (!attendance || attendance["check_out_at"])
        throw new ApiError(409, "Sign in to start a shift first.");
      const row = (await tx.query('SELECT * FROM "JOB" WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!row) throw new ApiError(404, "Task not found.");
      if (row["record_version"] !== input.recordVersion)
        throw new ApiError(409, "This task changed. Refresh and try again.");
      const shift = metadata(attendance["notes"]);
      const machine = (
        await tx.query('SELECT equipment_code,status FROM "MACHINE" WHERE id=$1', [
          row["machine_id"],
        ])
      ).rows[0];
      if (machine?.["equipment_code"] !== shift["machineCode"])
        throw new ApiError(403, "Select this task's machine first.");
      const notes = metadata(row["notes"]);
      notes["activity"] ??= [];
      if (action === "claim") {
        const items = ((await readMaintenance(tx))[shift["machineCode"]] ?? []).filter(
          (item) => item.phase === "start" && item.kind === "required",
        );
        if (!items.every((item) => shift["startChecks"]?.[item.id] === "done"))
          throw new ApiError(409, "Complete all required pre-start machine checks first.");
        const tasks = (await readJobs(tx)).map(taskFromRow);
        const task = tasks.find((task) => task.id === id)!;
        const claim = canClaim(task, account.employee_code, tasks);
        if (!claim.ok) throw new ApiError(409, claim.reason);
        const order = (
          await tx.query('SELECT * FROM "CUSTOMER_ORDER" WHERE id=$1', [row["order_id"]])
        ).rows[0]!;
        if (
          order["approval_required"] &&
          (order["approved_template_id"] !== order["template_id"] || !order["customer_approved_at"])
        )
          throw new ApiError(409, "Customer approval of this exact design revision is required.");
      } else if (
        row["status"] !== "IN_PROGRESS" ||
        row["responsible_employee_id"] !== account.employee_id
      ) {
        throw new ApiError(403, "Only the assigned operator can change an active task.");
      }
      const photos: string[] = [];
      for (const photo of input.photos ?? []) {
        const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photo);
        if (!match) throw new ApiError(400, "Only JPEG, PNG and WebP images are supported.");
        const bytes = Buffer.from(match[2]!, "base64");
        if (bytes.length > 3 * 1024 * 1024)
          throw new ApiError(413, "Each photo must be smaller than 3 MB.");
        const valid =
          match[1] === "jpeg"
            ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
            : match[1] === "png"
              ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : bytes.subarray(0, 4).toString() === "RIFF" &&
                bytes.subarray(8, 12).toString() === "WEBP";
        if (!valid) throw new ApiError(400, "The image contents do not match its type.");
        const documentId = randomUUID();
        const directory = resolve(process.env["WAM_UPLOAD_DIR"] ?? ".data/uploads");
        await mkdir(directory, { recursive: true });
        const filePath = resolve(directory, documentId);
        await writeFile(filePath, bytes, { flag: "wx" });
        createdFiles.push(filePath);
        await insert(tx, "DOCUMENT", {
          id: documentId,
          title: `Task photo ${row["name"]}`,
          category: "photo",
          file_path: `uploads/${documentId}`,
          uploaded_by_employee_id: account.employee_id,
          mime_type: `image/${match[1]}`,
          file_size_bytes: bytes.length,
          file_checksum: createHash("sha256").update(bytes).digest("hex"),
        });
        await insert(tx, "DOCUMENT_LINK", { document_id: documentId, job_id: id });
        photos.push(`/api/wam/files/${documentId}`);
      }
      if (input.text?.trim() || photos.length)
        notes["activity"].push({
          id: randomUUID(),
          at: new Date().toISOString(),
          by: account.full_name,
          type: photos.length ? "photo" : "comment",
          text: input.text?.trim(),
          photos,
        });
      if (action === "claim" || action === "complete")
        notes["activity"].push({
          id: randomUUID(),
          at: new Date().toISOString(),
          by: account.full_name,
          type: "status",
          text: action === "claim" ? "Task accepted · In progress" : "Production step completed",
        });
      const updated =
        action === "claim"
          ? await tx.query(
              "UPDATE \"JOB\" SET status='IN_PROGRESS',responsible_employee_id=$2,started_at=now(),notes=$3 WHERE id=$1 AND record_version=$4 RETURNING id",
              [id, account.employee_id, JSON.stringify(notes), input.recordVersion],
            )
          : action === "complete"
            ? await tx.query(
                'UPDATE "JOB" SET status=\'COMPLETED\',completed_quantity=(SELECT quantity FROM "CUSTOMER_ORDER" WHERE id="JOB".order_id),completed_at=now(),notes=$2 WHERE id=$1 AND record_version=$3 RETURNING id',
                [id, JSON.stringify(notes), input.recordVersion],
              )
            : await tx.query(
                'UPDATE "JOB" SET notes=$2 WHERE id=$1 AND record_version=$3 RETURNING id',
                [id, JSON.stringify(notes), input.recordVersion],
              );
      if (!updated.rows.length)
        throw new ApiError(409, "This task changed. Refresh and try again.");
      if (
        action === "complete" &&
        !(
          await tx.query(
            "SELECT 1 FROM \"JOB\" WHERE order_id=$1 AND status<>'COMPLETED' LIMIT 1",
            [row["order_id"]],
          )
        ).rows.length
      )
        await tx.query("UPDATE \"CUSTOMER_ORDER\" SET status='QC' WHERE id=$1", [row["order_id"]]);
    });
  } catch (error) {
    await Promise.all(createdFiles.map((file) => unlink(file).catch(() => {})));
    throw error;
  }
}
