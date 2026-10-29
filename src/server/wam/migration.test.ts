// @vitest-environment node
import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { connectDatabase, migrate } from "./database";
import { insert } from "./seed";

it("upgrades populated v4 records without losing checks, completed-job activity, photos or original notes", async () => {
  const db = await connectDatabase(undefined, "memory://");
  try {
    await migrate(db, "002_document_content.sql");
    const employee = randomUUID(),
      machine = randomUUID(),
      customer = randomUUID(),
      order = randomUUID(),
      job = randomUUID(),
      plan = randomUUID(),
      attendance = randomUUID(),
      document = randomUUID();
    await insert(db, "EMPLOYEE", { id: employee, full_name: "Legacy Operator" });
    await insert(db, "MACHINE", {
      id: machine,
      name: "Legacy CNC",
      equipment_code: "LEG-CNC",
      type: "Legacy model",
    });
    await insert(db, "CUSTOMER", { id: customer, name: "Legacy Customer", notes: "Athens" });
    await insert(db, "CUSTOMER_ORDER", {
      id: order,
      order_number: "LEG-001",
      title: "Legacy order",
      customer_id: customer,
      intake_employee_id: employee,
      approval_required: false,
    });
    const notes = JSON.stringify({
      instructions: "Keep these instructions",
      priority: "high",
      estMin: 37,
      activity: [
        {
          id: "old-id",
          type: "photo",
          at: "2026-10-28T08:00:00Z",
          by: "Legacy Operator",
          text: "Keep this photo",
          photos: [`/api/wam/files/${document}`],
        },
      ],
    });
    await insert(db, "JOB", {
      id: job,
      order_id: order,
      sequence_no: 1,
      name: "Completed legacy step",
      machine_id: machine,
      responsible_employee_id: employee,
      notes,
    });
    await db.exec('ALTER TABLE "JOB" DISABLE TRIGGER job_guard');
    await db.query(
      "UPDATE \"JOB\" SET status='COMPLETED',completed_quantity=1,started_at='2026-10-28T08:00:00Z',completed_at='2026-10-28T09:00:00Z' WHERE id=$1",
      [job],
    );
    await db.exec('ALTER TABLE "JOB" ENABLE TRIGGER job_guard');
    await insert(db, "MAINTENANCE_PLAN", {
      id: plan,
      machine_id: machine,
      title: "Legacy check",
      instructions: JSON.stringify({
        phase: "start",
        priority: "safety",
        instructions: "Check guard",
      }),
      operator_can_complete: true,
      created_by_employee_id: employee,
    });
    const attendanceNotes = JSON.stringify({
      machineCode: "LEG-CNC",
      startChecks: { [plan]: "done" },
      endChecks: {},
      handover: "Original handover",
    });
    await insert(db, "ATTENDANCE", {
      id: attendance,
      employee_id: employee,
      attendance_date: "2026-10-28",
      check_in_at: "2026-10-28T07:00:00Z",
      notes: attendanceNotes,
      recorded_by_employee_id: employee,
    });
    await insert(db, "DOCUMENT", {
      id: document,
      title: "Legacy photo",
      file_path: `database-uploads/${document}.png`,
      uploaded_by_employee_id: employee,
    });
    await insert(db, "DOCUMENT_LINK", { document_id: document, job_id: job });
    await db.query(
      "INSERT INTO wam_internal.document_content(document_id,content) VALUES($1,decode('cHJlc2VydmU=','base64'))",
      [document],
    );
    await migrate(db);
    await migrate(db);
    const preserved = (await db.query('SELECT * FROM "JOB" WHERE id=$1', [job])).rows[0]!;
    expect(preserved["notes"]).toBe(notes);
    expect(preserved["status"]).toBe("COMPLETED");
    expect(preserved["instructions"]).toBe("Keep these instructions");
    expect(preserved["priority"]).toBe("HIGH");
    expect(preserved["estimated_minutes"]).toBe(37);
    const shift = (
      await db.query('SELECT * FROM "OPERATOR_SHIFT" WHERE attendance_id=$1', [attendance])
    ).rows[0]!;
    expect(shift["status"]).toBe("OPEN");
    expect(shift["machine_id"]).toBe(machine);
    expect(
      (await db.query('SELECT * FROM "SHIFT_CHECK" WHERE shift_id=$1', [shift["id"]])).rows,
    ).toHaveLength(1);
    expect(
      (await db.query('SELECT notes FROM "ATTENDANCE" WHERE id=$1', [attendance])).rows[0]![
        "notes"
      ],
    ).toBe(attendanceNotes);
    const activities = (await db.query('SELECT * FROM "JOB_ACTIVITY" WHERE job_id=$1', [job])).rows;
    expect(activities).toHaveLength(1);
    expect(activities[0]!["notes"]).toBe("Keep this photo");
    expect(
      (
        await db.query('SELECT * FROM "DOCUMENT_LINK" WHERE job_activity_id=$1', [
          activities[0]!["id"],
        ])
      ).rows[0]!["document_id"],
    ).toBe(document);
    expect(
      (
        await db.query(
          "SELECT convert_from(content,'UTF8') AS content FROM wam_internal.document_content WHERE document_id=$1",
          [document],
        )
      ).rows[0]!["content"],
    ).toBe("preserve");
    await expect(db.query('DELETE FROM "JOB_ACTIVITY" WHERE job_id=$1', [job])).rejects.toThrow(
      /append-only/,
    );
    await expect(db.query("UPDATE \"JOB\" SET name='changed' WHERE id=$1", [job])).rejects.toThrow(
      /immutable|planning/,
    );
  } finally {
    await db.close();
  }
}, 30000);
