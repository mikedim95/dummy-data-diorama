import { randomUUID } from "node:crypto";
import { ApiError, type Account, requireRole } from "./auth";
import { type Database, withActor } from "./database";
import { insert } from "./seed";
import {
  readOpenShift,
  readShiftChecks,
  readMaintenance,
  readJobs,
  taskFromRow,
} from "./read-models";
import { canClaim, canFinishShift } from "../../lib/wam/logic";
import { saveDocument } from "./documents";
import type { CheckState } from "../../lib/wam/types";

export async function startShift(db: Database, account: Account) {
  requireRole(account, ["PRODUCTION", "ADMIN", "MANAGER"]);
  await withActor(db, account.id, "Operator sign in", async (tx) => {
    await tx.query('SELECT id FROM "EMPLOYEE" WHERE id=$1 FOR UPDATE', [account.employee_id]);
    if (await readOpenShift(tx, account)) return;
    const attendance = (
      await tx.query(
        `INSERT INTO "ATTENDANCE"(employee_id,status,check_in_at,recorded_by_employee_id)
      VALUES($1,'PRESENT',now(),$1) ON CONFLICT(employee_id,attendance_date)
      DO UPDATE SET status='PRESENT',check_in_at=coalesce("ATTENDANCE".check_in_at,now()),check_out_at=NULL,recorded_by_employee_id=$1 RETURNING id`,
        [account.employee_id],
      )
    ).rows[0]!;
    await insert(tx, "OPERATOR_SHIFT", {
      employee_id: account.employee_id,
      attendance_id: attendance["id"],
    });
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
    const shift = await readOpenShift(tx, account);
    if (!shift) throw new ApiError(409, "Sign in to start a shift first.");
    if (action.type === "machine") {
      const machine = (
        await tx.query('SELECT id FROM "MACHINE" WHERE equipment_code=$1 AND is_active', [
          action.code,
        ])
      ).rows[0];
      if (!machine) throw new ApiError(404, "Machine not found.");
      if (machine["id"] === shift["machine_id"]) return;
      if (
        (
          await tx.query(
            "SELECT 1 FROM \"JOB\" WHERE responsible_employee_id=$1 AND status='IN_PROGRESS' LIMIT 1",
            [account.employee_id],
          )
        ).rows.length
      )
        throw new ApiError(409, "Finish or hand over your active task before changing machine.");
      if (shift["machine_id"]) {
        // Workstation segments preserve earlier checks instead of erasing them on a machine change.
        await tx.query("UPDATE \"OPERATOR_SHIFT\" SET status='CLOSED',ended_at=now() WHERE id=$1", [
          shift["id"],
        ]);
        await insert(tx, "OPERATOR_SHIFT", {
          employee_id: account.employee_id,
          attendance_id: shift["attendance_id"],
          machine_id: machine["id"],
        });
      } else
        await tx.query('UPDATE "OPERATOR_SHIFT" SET machine_id=$2 WHERE id=$1', [
          shift["id"],
          machine["id"],
        ]);
      return;
    }
    const plan = (
      await tx.query('SELECT * FROM "MAINTENANCE_PLAN" WHERE id=$1 FOR UPDATE', [action.id])
    ).rows[0];
    if (
      !plan ||
      !plan["is_active"] ||
      !plan["operator_can_complete"] ||
      plan["machine_id"] !== shift["machine_id"] ||
      plan["operator_check_phase"] !== action.phase.toUpperCase()
    )
      throw new ApiError(403, "This check cannot be completed on the selected machine.");
    if (!action.state) {
      await tx.query('DELETE FROM "SHIFT_CHECK" WHERE shift_id=$1 AND plan_id=$2 AND phase=$3', [
        shift["id"],
        action.id,
        action.phase.toUpperCase(),
      ]);
      return;
    }
    let maintenanceId: string | null = null;
    if (action.state === "done") {
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
          'SELECT id,plan_id,performed_by_employee_id FROM "MACHINE_MAINTENANCE" WHERE request_key=$1',
          [action.requestKey],
        )
      ).rows[0];
      if (
        previous &&
        (previous["plan_id"] !== action.id ||
          previous["performed_by_employee_id"] !== account.employee_id)
      )
        throw new ApiError(409, "That retry key was already used for another completion.");
      maintenanceId = previous?.["id"] ?? randomUUID();
      if (!previous)
        await insert(tx, "MACHINE_MAINTENANCE", {
          id: maintenanceId,
          machine_id: plan["machine_id"],
          plan_id: plan["id"],
          maintenance_type: plan["maintenance_type"],
          request_key: action.requestKey,
          title: plan["title"],
          performed_by_employee_id: account.employee_id,
          recorded_by_employee_id: account.employee_id,
        });
    }
    await tx.query(
      `INSERT INTO "SHIFT_CHECK"(shift_id,plan_id,phase,state,maintenance_id) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(shift_id,plan_id,phase) DO UPDATE SET state=excluded.state,maintenance_id=coalesce(excluded.maintenance_id,"SHIFT_CHECK".maintenance_id)`,
      [
        shift["id"],
        action.id,
        action.phase.toUpperCase(),
        action.state.toUpperCase(),
        maintenanceId,
      ],
    );
  });
}

export async function finishShift(db: Database, account: Account, handover: string) {
  requireRole(account, ["PRODUCTION", "ADMIN", "MANAGER"]);
  await withActor(db, account.id, "Shift handover and sign out", async (tx) => {
    await tx.query('SELECT id FROM "EMPLOYEE" WHERE id=$1 FOR UPDATE', [account.employee_id]);
    const shift = await readOpenShift(tx, account);
    if (!shift) throw new ApiError(409, "There is no open shift.");
    const checks = await readShiftChecks(tx, shift["id"]);
    const items = ((await readMaintenance(tx))[shift["machine_code"]] ?? []).filter(
      (item) => item.phase === "end",
    );
    const active =
      (
        await tx.query(
          "SELECT 1 FROM \"JOB\" WHERE responsible_employee_id=$1 AND status='IN_PROGRESS' LIMIT 1",
          [account.employee_id],
        )
      ).rows.length > 0;
    if (!canFinishShift(items, checks.endChecks, active, handover))
      throw new ApiError(
        409,
        "Complete the end checks and add a handover for skipped checks or active work.",
      );
    await tx.query(
      "UPDATE \"OPERATOR_SHIFT\" SET status='CLOSED',ended_at=now(),notes=$2 WHERE id=$1",
      [shift["id"], handover],
    );
    await tx.query(
      'UPDATE "ATTENDANCE" SET check_out_at=now(),recorded_by_employee_id=$2 WHERE id=$1',
      [shift["attendance_id"], account.employee_id],
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
  await withActor(db, account.id, `Operator task ${action}`, async (tx) => {
    // Serialize all claims by an employee, including races between different jobs in two tabs.
    await tx.query('SELECT id FROM "EMPLOYEE" WHERE id=$1 FOR UPDATE', [account.employee_id]);
    const shift = await readOpenShift(tx, account);
    if (!shift) throw new ApiError(409, "Sign in to start a shift first.");
    const row = (await tx.query('SELECT * FROM "JOB" WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!row) throw new ApiError(404, "Task not found.");
    if (row["record_version"] !== input.recordVersion)
      throw new ApiError(409, "This task changed. Refresh and try again.");
    if (row["machine_id"] !== shift["machine_id"])
      throw new ApiError(403, "Select this task's machine first.");
    if (action === "claim") {
      const checks = await readShiftChecks(tx, shift["id"]);
      const required = ((await readMaintenance(tx))[shift["machine_code"]] ?? []).filter(
        (item) => item.phase === "start" && item.kind === "required",
      );
      if (!required.every((item) => checks.startChecks[item.id] === "done"))
        throw new ApiError(409, "Complete all required pre-start machine checks first.");
      const tasks = (await readJobs(tx)).map(taskFromRow);
      const claim = canClaim(
        tasks.find((task) => task.id === id)!,
        account.employee_code,
        tasks,
      );
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
    )
      throw new ApiError(403, "Only the assigned operator can change an active task.");
    const documents: string[] = [];
    for (const photo of input.photos ?? []) {
      const document = await saveDocument(
        tx,
        account,
        {
          title: `Task photo ${row["name"]}`,
          category: "photo",
          filename: "task-photo.png",
          data: photo,
        },
        3 * 1024 * 1024,
      );
      const stored = (await tx.query('SELECT mime_type FROM "DOCUMENT" WHERE id=$1', [document.id]))
        .rows[0]!;
      if (!["image/jpeg", "image/png", "image/webp"].includes(stored["mime_type"]))
        throw new ApiError(400, "Only JPEG, PNG and WebP images are supported.");
      await insert(tx, "DOCUMENT_LINK", { document_id: document.id, job_id: id });
      documents.push(document.id);
    }
    if (input.text?.trim() || documents.length) {
      const activityId = randomUUID();
      await insert(tx, "JOB_ACTIVITY", {
        id: activityId,
        job_id: id,
        actor_employee_id: account.employee_id,
        author_name: account.full_name,
        kind: documents.length ? "PHOTO" : "COMMENT",
        notes: input.text?.trim(),
      });
      for (const documentId of documents)
        await insert(tx, "DOCUMENT_LINK", { document_id: documentId, job_activity_id: activityId });
    }
    if (action === "claim" || action === "complete")
      await insert(tx, "JOB_ACTIVITY", {
        job_id: id,
        actor_employee_id: account.employee_id,
        author_name: account.full_name,
        kind: "STATUS",
        notes: action === "claim" ? "Task accepted · In progress" : "Production step completed",
      });
    const updated =
      action === "claim"
        ? await tx.query(
            "UPDATE \"JOB\" SET status='IN_PROGRESS',responsible_employee_id=$2,started_at=now() WHERE id=$1 AND record_version=$3 RETURNING id",
            [id, account.employee_id, input.recordVersion],
          )
        : action === "complete"
          ? await tx.query(
              'UPDATE "JOB" SET status=\'COMPLETED\',completed_quantity=(SELECT quantity FROM "CUSTOMER_ORDER" WHERE id="JOB".order_id),completed_at=now() WHERE id=$1 AND record_version=$2 RETURNING id',
              [id, input.recordVersion],
            )
          : await tx.query(
              'UPDATE "JOB" SET updated_at=now() WHERE id=$1 AND record_version=$2 RETURNING id',
              [id, input.recordVersion],
            );
    if (!updated.rows.length) throw new ApiError(409, "This task changed. Refresh and try again.");
    if (
      action === "complete" &&
      !(
        await tx.query("SELECT 1 FROM \"JOB\" WHERE order_id=$1 AND status<>'COMPLETED' LIMIT 1", [
          row["order_id"],
        ])
      ).rows.length
    )
      await tx.query("UPDATE \"CUSTOMER_ORDER\" SET status='QC' WHERE id=$1", [row["order_id"]]);
  });
}
