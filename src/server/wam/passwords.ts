import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Database } from "./database";

const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 200)
    throw new Error("Passwords must contain between 12 and 200 characters.");
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded?: string) {
  const match = /^scrypt\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(encoded ?? "");
  // Unknown accounts still perform the same expensive password derivation.
  const actual = await derive(password, match ? Buffer.from(match[1]!, "hex") : Buffer.alloc(16));
  const expected = match ? Buffer.from(match[2]!, "hex") : Buffer.alloc(64);
  return timingSafeEqual(actual, expected) && !!match;
}
export async function bootstrapPasswords(db: Database, mode: "local" | "preview") {
  const accounts = (
    await db.query(
      'SELECT u.id,u.auth_subject,p.password_hash FROM "USER_ACCOUNT" u LEFT JOIN wam_internal.password_credentials p ON p.account_id=u.id WHERE u.auth_provider=$1 AND u.auth_subject=ANY($2::text[])',
      [`password-${mode}`, ["WAM-MANAGER-01", "OP-104", "OP-117"]],
    )
  ).rows;
  for (const account of accounts) {
    const password =
      mode === "local"
        ? (process.env["WAM_LOCAL_PASSWORD"] ?? "WamLocal!2026")
        : process.env[
            account["auth_subject"] === "WAM-MANAGER-01"
              ? "WAM_PREVIEW_ADMIN_PASSWORD"
              : "WAM_PREVIEW_OPERATOR_PASSWORD"
          ];
    if (!password || password.length < 12)
      throw new Error("Password authentication is not configured.");
    if (account["password_hash"] && (await verifyPassword(password, account["password_hash"])))
      continue;
    await db.query(
      "INSERT INTO wam_internal.password_credentials(account_id,password_hash) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=now()",
      [account["id"], await hashPassword(password)],
    );
  }
}
