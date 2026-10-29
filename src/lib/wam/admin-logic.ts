import type { Attendance, CustomerOrder, Employee, FinancialRecord, Job, MaintenancePlan, Material, StockBalance } from "./admin-types";

export const DAY = 86400000;
export type RangeKey = "1" | "7" | "30" | "90";
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "1", label: "Today" }, { key: "7", label: "7 days" }, { key: "30", label: "30 days" }, { key: "90", label: "90 days" },
];

export function startOfDay(t: number) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }

/** Selected window = last N calendar days including today; previous = the N days before it. */
export function windows(range: RangeKey, now = Date.now()) {
  const days = Number(range);
  const end = startOfDay(now) + DAY;
  const start = end - days * DAY;
  return { start, end, prevStart: start - days * DAY, prevEnd: start, days };
}
const inWin = (iso: string | undefined, s: number, e: number) => !!iso && new Date(iso).getTime() >= s && new Date(iso).getTime() < e;

export const IN_PRODUCTION: CustomerOrder["status"][] = ["in_production", "qc"];
export const isClosed = (o: CustomerOrder) => o.status === "delivered" || o.status === "cancelled";
export const isOverdue = (o: CustomerOrder, now = Date.now()) => !isClosed(o) && new Date(o.deadline).getTime() < startOfDay(now);

export function completedJobsIn(jobs: Job[], s: number, e: number) {
  return jobs.filter((j) => j.status === "completed" && inWin(j.completedAt, s, e));
}

/** Percent change; null when no meaningful comparison (previous = 0). */
export function delta(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

export type PlanState = "overdue" | "due" | "upcoming" | "ok";
export function planNextDue(p: MaintenancePlan) { return new Date(p.lastDoneAt).getTime() + p.intervalDays * DAY; }
export function planState(p: MaintenancePlan, now = Date.now()): PlanState {
  const next = startOfDay(planNextDue(p));
  const t0 = startOfDay(now);
  if (next < t0) return "overdue";
  if (next === t0) return "due";
  if (next <= t0 + 7 * DAY) return "upcoming";
  return "ok";
}

export function stockOf(materialId: string, balances: StockBalance[]) {
  return balances.filter((b) => b.materialId === materialId).reduce((a, b) => a + b.qty, 0);
}
export function lowStock(materials: Material[], balances: StockBalance[]) {
  return materials
    .map((m) => ({ m, qty: stockOf(m.id, balances) }))
    .filter((x) => x.qty < x.m.minQty)
    .sort((a, b) => a.qty / a.m.minQty - b.qty / b.m.minQty);
}

export const outstanding = (f: FinancialRecord) => Math.max(0, f.amount - f.paid);
export function receivables(recs: FinancialRecord[]) {
  return recs.filter((f) => f.type === "sale").reduce((a, f) => a + outstanding(f), 0);
}
export function payables(recs: FinancialRecord[]) {
  return recs.filter((f) => f.type === "purchase" || f.type === "expense").reduce((a, f) => a + outstanding(f), 0);
}
/** Net recorded sales = sales minus refunds (not profit). */
export function netSales(recs: FinancialRecord[]) {
  return recs.reduce((a, f) => a + (f.type === "sale" ? f.amount : f.type === "refund" ? -f.amount : 0), 0);
}
export function costs(recs: FinancialRecord[]) {
  return recs.reduce((a, f) => a + (f.type === "purchase" || f.type === "expense" ? f.amount : 0), 0);
}

/** Present today counts only explicit "present" rows; missing rows are "not recorded". */
export function attendanceToday(att: Attendance[], emps: Employee[], now = Date.now()) {
  const t0 = startOfDay(now);
  const rows = att.filter((a) => startOfDay(new Date(a.date).getTime()) === t0);
  const active = emps.filter((e) => e.status !== "inactive");
  return {
    present: rows.filter((a) => a.status === "present").length,
    absent: rows.filter((a) => a.status === "absent").length,
    leave: rows.filter((a) => a.status === "leave").length,
    notRecorded: active.filter((e) => !rows.some((a) => a.employeeId === e.id)).length,
    workforce: active.length,
  };
}

export const eur = (n: number) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Athens" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" });
