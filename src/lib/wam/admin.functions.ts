import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns dashboard data only to signed-in managers. Finance records,
 * restricted documents and unit costs are removed unless the caller also has
 * the finance role. All checks run on the server; the data never ships in
 * the browser bundle.
 */
export const getAdminSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) throw new Error("Could not verify access.");
    const set = new Set((roles ?? []).map((r) => r.role));
    const email = (claims as { email?: string }).email ?? "";
    if (!set.has("manager")) return { allowed: false as const, email };

    const canSeeFinance = set.has("finance");
    const D = await import("./admin-data");
    return {
      allowed: true as const,
      email,
      canSeeFinance,
      data: {
        CUSTOMERS: D.CUSTOMERS,
        ADMIN_MACHINES: D.ADMIN_MACHINES,
        EMPLOYEES: D.EMPLOYEES,
        ATTENDANCE: D.ATTENDANCE,
        MAINTENANCE_PLANS: D.MAINTENANCE_PLANS,
        MAINTENANCE_RECORDS: D.MAINTENANCE_RECORDS,
        ORDERS: D.ORDERS,
        JOBS: D.JOBS,
        MATERIALS: canSeeFinance ? D.MATERIALS : D.MATERIALS.map((m) => ({ ...m, unitCost: 0 })),
        STOCK_BALANCES: D.STOCK_BALANCES,
        STOCK_MOVEMENTS: D.STOCK_MOVEMENTS,
        FINANCIAL_RECORDS: canSeeFinance ? D.FINANCIAL_RECORDS : [],
        DOCUMENTS: canSeeFinance ? D.DOCUMENTS : D.DOCUMENTS.filter((d) => d.classification !== "restricted"),
      },
    };
  });
