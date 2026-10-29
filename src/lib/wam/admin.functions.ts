import { createServerFn } from "@tanstack/react-start";

export const getAdminSnapshot = createServerFn({ method: "POST" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { getDatabase } = await import("../../server/wam/database");
  const { authenticate } = await import("../../server/wam/auth");
  const { adminSnapshot } = await import("../../server/wam/read-models");
  const db = await getDatabase();
  const account = await authenticate(db, getRequest());
  if (!["ADMIN", "MANAGER"].includes(account.role) || !account.managerAccess)
    return { allowed: false as const, email: account.full_name };
  return adminSnapshot(db, account);
});
