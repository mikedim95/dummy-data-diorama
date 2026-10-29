import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database";
import { verifyPassword } from "./passwords";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Account = {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  job_title: string;
  role: string;
  auth_provider: string;
  login_email?: string | null;
  managerAccess?: boolean;
  financeAccess?: boolean;
};
const runtime = globalThis as typeof globalThis & {
  wamSessionSecret?: string;
  wamLoginAttempts?: Map<string, { count: number; since: number }>;
};
const secret = () =>
  process.env["WAM_SESSION_SECRET"] ??
  (runtime.wamSessionSecret ??= randomBytes(32).toString("hex"));
const signature = (value: string) =>
  createHmac("sha256", secret()).update(value).digest("base64url");
export const localDemoEnabled = () =>
  process.env["WAM_LOCAL_DEMO"] === "true" && process.env["NODE_ENV"] !== "production";
export function previewEnabled() {
  if (process.env["WAM_PREVIEW_MODE"] !== "true") return false;
  const origin = process.env["WAM_PUBLIC_ORIGIN"];
  return (
    !!origin &&
    /^https:\/\/[^/]+$/.test(origin) &&
    (process.env["WAM_SESSION_SECRET"]?.length ?? 0) >= 32 &&
    (process.env["WAM_PREVIEW_ADMIN_PASSWORD"]?.length ?? 0) >= 20 &&
    (process.env["WAM_PREVIEW_OPERATOR_PASSWORD"]?.length ?? 0) >= 20
  );
}
export function requestOrigin(request: Request) {
  return process.env["WAM_PUBLIC_ORIGIN"] ?? new URL(request.url).origin;
}

export function sessionCookie(
  accountId: string,
  secure = false,
  mode: "local" | "preview" = "local",
) {
  const body = Buffer.from(
    JSON.stringify({ sub: accountId, mode, expires: Date.now() + 8 * 3600000 }),
  ).toString("base64url");
  return `wam_session=${body}.${signature(body)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure ? "; Secure" : ""}`;
}
export const clearSessionCookie = "wam_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";

export async function authenticate(db: Database, request: Request): Promise<Account> {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("wam_session="))
    ?.slice(12);
  let accountId: string | undefined;
  let cookieProvider: string | undefined;
  let cloudRoles: string[] | undefined;
  if (cookie && (localDemoEnabled() || previewEnabled())) {
    const [body, signed] = cookie.split(".");
    if (body && signed) {
      const expected = Buffer.from(signature(body));
      const received = Buffer.from(signed);
      if (expected.length === received.length && timingSafeEqual(expected, received)) {
        try {
          const payload = JSON.parse(Buffer.from(body, "base64url").toString());
          if (
            typeof payload.sub === "string" &&
            payload.expires > Date.now() &&
            ((payload.mode === "local" &&
              localDemoEnabled() &&
              ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)) ||
              (payload.mode === "preview" && previewEnabled()))
          ) {
            accountId = payload.sub;
            cookieProvider = payload.mode === "preview" ? "password-preview" : "password-local";
          }
        } catch {
          /* Malformed cookies are treated as signed out. */
        }
      }
    }
  }
  if (!accountId) {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    const url = process.env["SUPABASE_URL"],
      key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!token || !url || !key) throw new ApiError(401, "Sign in to continue.");
    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims?.sub) throw new ApiError(401, "Your session has expired.");
    accountId = (
      await db.query(
        "SELECT id FROM \"USER_ACCOUNT\" WHERE auth_provider='supabase' AND auth_subject=$1",
        [data.claims.sub],
      )
    ).rows[0]?.["id"];
    const { data: roles, error: roleError } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", data.claims.sub);
    if (roleError) throw new ApiError(403, "Could not verify cloud account roles.");
    cloudRoles = (roles ?? []).map((row: { role: string }) => row.role);
  }
  const account = (
    await db.query<Account>(
      'SELECT u.id,u.employee_id,u.role,u.auth_provider,u.login_email,e.employee_code,e.full_name,e.job_title FROM "USER_ACCOUNT" u JOIN "EMPLOYEE" e ON e.id=u.employee_id WHERE u.id=$1 AND u.is_active AND e.is_active',
      [accountId ?? null],
    )
  ).rows[0];
  if (!account)
    throw new ApiError(403, "An active WAM account linked to an active employee is required.");
  if (cookieProvider && account.auth_provider !== cookieProvider)
    throw new ApiError(401, "Sign in to continue.");
  return {
    ...account,
    managerAccess:
      ["ADMIN", "MANAGER"].includes(account.role) &&
      (!cloudRoles || cloudRoles.includes("manager")),
    financeAccess: cloudRoles ? cloudRoles.includes("finance") : account.role === "ADMIN",
  };
}

export function requireRole(account: Account, roles: string[]) {
  if (
    !roles.includes(account.role) ||
    (["ADMIN", "MANAGER"].includes(account.role) && account.managerAccess === false) ||
    (account.role === "FINANCE" && account.financeAccess === false)
  )
    throw new ApiError(403, "Your account does not have permission for this action.");
}

function limitAttempts(key: string) {
  const attempts = (runtime.wamLoginAttempts ??= new Map());
  const previous = attempts.get(key);
  const attempt =
    previous && Date.now() - previous.since < 60000 ? previous : { count: 0, since: Date.now() };
  attempts.set(key, attempt);
  if (++attempt.count > 8) throw new ApiError(429, "Too many attempts. Try again in a minute.");
  if (attempts.size > 1000)
    for (const [entry, value] of attempts)
      if (Date.now() - value.since > 60000) attempts.delete(entry);
  return attempts;
}

export const secureRequest = (request: Request) =>
  new URL(request.url).protocol === "https:" ||
  request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";

export async function passwordLogin(
  db: Database,
  request: Request,
  email: string,
  password: string,
) {
  const preview = process.env["WAM_PREVIEW_MODE"] === "true";
  const host = new URL(request.url).hostname;
  if (
    preview &&
    (!previewEnabled() ||
      !secureRequest(request) ||
      request.headers.get("origin") !== requestOrigin(request))
  )
    throw new ApiError(403, "Password sign-in requires the configured secure origin.");
  if (!preview && (!localDemoEnabled() || !["localhost", "127.0.0.1", "[::1]"].includes(host)))
    throw new ApiError(403, "Local password sign-in is disabled.");
  const key = email.trim().toLowerCase();
  const attempts = limitAttempts(`password:${key}`);
  const account = (
    await db.query<Account & { password_hash: string }>(
      'SELECT u.id,u.employee_id,u.role,u.auth_provider,u.login_email,e.employee_code,e.full_name,e.job_title,p.password_hash FROM "USER_ACCOUNT" u JOIN "EMPLOYEE" e ON e.id=u.employee_id JOIN wam_internal.password_credentials p ON p.account_id=u.id WHERE lower(u.login_email)=$1 AND u.auth_provider=$2 AND u.is_active AND e.is_active',
      [key, preview ? "password-preview" : "password-local"],
    )
  ).rows[0];
  const valid = await verifyPassword(password, account?.password_hash);
  if (!valid || !account) throw new ApiError(401, "Email or password not recognised.");
  attempts.delete(`password:${key}`);
  const { password_hash: discard, ...identity } = account;
  return {
    ...identity,
    managerAccess: ["ADMIN", "MANAGER"].includes(identity.role),
    financeAccess: identity.role === "ADMIN",
  };
}

export async function cloudPasswordLogin(
  db: Database,
  request: Request,
  email: string,
  password: string,
) {
  const url = process.env["SUPABASE_URL"],
    key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new ApiError(403, "Password authentication is not configured.");
  if (process.env["NODE_ENV"] === "production" && !secureRequest(request))
    throw new ApiError(403, "Password sign-in requires the configured secure origin.");
  const attempts = limitAttempts(`cloud:${email}`);
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new ApiError(401, "Email or password not recognised.");
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.set("authorization", `Bearer ${data.session.access_token}`);
  const account = await authenticate(db, new Request(request.url, { headers }));
  attempts.delete(`cloud:${email}`);
  return {
    account,
    session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
  };
}

export async function accountSession(db: Database, account: Account) {
  const shift =
    account.role === "PRODUCTION"
      ? (
          await db.query(
            "SELECT machine_id FROM \"OPERATOR_SHIFT\" WHERE employee_id=$1 AND status='OPEN'",
            [account.employee_id],
          )
        ).rows[0]
      : undefined;
  return {
    id: account.id,
    email: account.login_email ?? null,
    role: account.role,
    name: account.full_name,
    employeeCode: account.employee_code,
    destination:
      account.role === "PRODUCTION" ? (shift?.["machine_id"] ? "/work" : "/scan") : "/admin",
  };
}
