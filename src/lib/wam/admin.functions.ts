import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const getManagementRecords = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        entity: z.string().regex(/^[A-Z_]+$/),
        offset: z.number().int().min(0).max(1000000).default(0),
        search: z.string().max(200).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { getDatabase } = await import("../../server/wam/database");
    const { authenticate } = await import("../../server/wam/auth");
    const { recordsWorkspace } = await import("../../server/wam/records");
    const database = await getDatabase();
    return recordsWorkspace(database, await authenticate(database, getRequest()), data);
  });
