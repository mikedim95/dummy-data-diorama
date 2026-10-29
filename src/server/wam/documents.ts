import { requireScannedShift } from "./read-models";
import { createHash, randomUUID } from "node:crypto";
import { ApiError, type Account } from "./auth";
import type { Database } from "./database";
import { insert } from "./seed";

export function decodeUpload(data: string, limit = 10 * 1024 * 1024) {
  const match = /^data:[^;,]*;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(data);
  if (!match) throw new ApiError(400, "Choose a valid file to upload.");
  const bytes = Buffer.from(match[1]!, "base64");
  if (!bytes.length || bytes.length > limit)
    throw new ApiError(413, "Files must be between 1 byte and 10 MB.");
  const mime = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? "image/jpeg"
      : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP"
        ? "image/webp"
        : bytes.subarray(0, 5).toString() === "%PDF-"
          ? "application/pdf"
          : "application/octet-stream";
  return { bytes, mime, checksum: createHash("sha256").update(bytes).digest("hex") };
}

export async function saveDocument(
  db: Database,
  account: Account,
  input: {
    title: string;
    category?: string | null;
    visibility?: string | null;
    filename: string;
    data: string;
  },
  limit?: number,
) {
  const { bytes, mime, checksum } = decodeUpload(input.data, limit);
  const id = randomUUID();
  const path = `database-uploads/${id}`;
  const filename =
    input.filename
      .replace(/^.*[\\/]/, "")
      .replace(/\p{Cc}/gu, "")
      .slice(0, 255) || "document";
  await insert(db, "DOCUMENT", {
    id,
    title: input.title,
    category: input.category ?? "TECHNICAL",
    visibility: input.visibility ?? "INTERNAL",
    file_path: path,
    original_filename: filename,
    mime_type: mime,
    file_size_bytes: bytes.length,
    file_checksum: checksum,
    uploaded_by_employee_id: account.employee_id,
  });
  await db.query(
    "INSERT INTO wam_internal.document_content(document_id,content) VALUES($1,decode($2,'base64'))",
    [id, bytes.toString("base64")],
  );
  return { id, path, checksum };
}

export async function authorizeDocument(
  db: Database,
  account: Account,
  doc: { [column: string]: unknown },
) {
  const financial =
    doc["visibility"] === "RESTRICTED" ||
    ["INVOICE", "FINANCIAL"].includes(String(doc["category"]).toUpperCase());
  if (financial && !account.financeAccess)
    throw new ApiError(403, "Finance permission is required for this document.");
  if (["ADMIN", "MANAGER"].includes(account.role) && account.managerAccess === false)
    throw new ApiError(403, "Management permission is required.");
  if (account.role === "PRODUCTION") {
    const shift = await requireScannedShift(db, account);
    const match = await db.query(
      `SELECT 1 FROM "DOCUMENT_LINK" l WHERE l.document_id=$1 AND (
      EXISTS(SELECT 1 FROM "JOB" j WHERE (j.id=l.job_id OR j.order_id=l.customer_order_id OR j.order_id IN (SELECT id FROM "CUSTOMER_ORDER" WHERE template_id=l.template_id))
        AND j.machine_id=$2)
      OR l.machine_id=$2
      OR l.maintenance_plan_id IN (SELECT p.id FROM "MAINTENANCE_PLAN" p WHERE p.machine_id=$2)) LIMIT 1`,
      [doc["id"], shift["machine_id"]],
    );
    if (!match.rows.length)
      throw new ApiError(403, "This document is not linked to your work or selected machine.");
  } else if (!["ADMIN", "MANAGER", "OFFICE", "FINANCE"].includes(account.role)) {
    throw new ApiError(403, "Your account does not have document access.");
  }
}
