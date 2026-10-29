// Single data boundary for the management dashboard. Today it reads DEMO data;
// swap these functions for server queries (with manager role checks) later.
import { useMemo } from "react";
import type * as Data from "./admin-data";
import {
  attendanceToday, completedJobsIn, costs, delta, isOverdue, IN_PRODUCTION, lowStock, netSales,
  planNextDue, planState, receivables, payables, windows, type RangeKey, DAY, startOfDay, outstanding,
} from "./admin-logic";

export const DEMO_MODE = true;

type Snapshot = {
  CUSTOMERS: typeof Data.CUSTOMERS; ADMIN_MACHINES: typeof Data.ADMIN_MACHINES; EMPLOYEES: typeof Data.EMPLOYEES;
  ATTENDANCE: typeof Data.ATTENDANCE; MAINTENANCE_PLANS: typeof Data.MAINTENANCE_PLANS; MAINTENANCE_RECORDS: typeof Data.MAINTENANCE_RECORDS;
  ORDERS: typeof Data.ORDERS; JOBS: typeof Data.JOBS; MATERIALS: typeof Data.MATERIALS; STOCK_BALANCES: typeof Data.STOCK_BALANCES;
  STOCK_MOVEMENTS: typeof Data.STOCK_MOVEMENTS; FINANCIAL_RECORDS: typeof Data.FINANCIAL_RECORDS; DOCUMENTS: typeof Data.DOCUMENTS;
};
/** Filled from the server (role-checked) by the /admin layout before any page renders. */
export const db = {} as Snapshot;
const D = db;
/** Signed-in manager. canSeeFinance mirrors the server's decision; it only hides UI — the server already withheld the data. */
export const MANAGER = { name: "", role: "Manager", canSeeFinance: false };
export function loadSnapshot(data: Snapshot, email: string, canSeeFinance: boolean) {
  Object.assign(db, data);
  MANAGER.name = email;
  MANAGER.role = canSeeFinance ? "Manager · Finance" : "Manager";
  MANAGER.canSeeFinance = canSeeFinance;
}
export const customer = (id: string) => D.CUSTOMERS.find((c) => c.id === id);
export const order = (id: string) => D.ORDERS.find((o) => o.id === id);
export const machine = (code: string) => D.ADMIN_MACHINES.find((m) => m.code === code);
export const employee = (id?: string) => D.EMPLOYEES.find((e) => e.id === id);
export const material = (id?: string) => D.MATERIALS.find((m) => m.id === id);
export const jobsOfOrder = (id: string) => D.JOBS.filter((j) => j.orderId === id).sort((a, b) => a.sequence - b.sequence);
export const docsFor = (type: string, id: string) => D.DOCUMENTS.filter((d) => d.links.some((l) => l.type === type && l.id === id));

export function useOverview(range: RangeKey) {
  return useMemo(() => {
    const w = windows(range);
    const now = Date.now();
    const openOrders = D.ORDERS.filter((o) => IN_PRODUCTION.includes(o.status));
    const overdue = D.ORDERS.filter((o) => isOverdue(o, now));
    const done = completedJobsIn(D.JOBS, w.start, w.end);
    const donePrev = completedJobsIn(D.JOBS, w.prevStart, w.prevEnd);
    const att = attendanceToday(D.ATTENDANCE, D.EMPLOYEES, now);
    const avail = D.ADMIN_MACHINES.filter((m) => m.status === "operational").length;
    const plans = D.MAINTENANCE_PLANS.map((p) => ({ p, state: planState(p, now), next: planNextDue(p) }));
    const dueNow = plans.filter((x) => x.state === "overdue" || x.state === "due");
    const low = lowStock(D.MATERIALS, D.STOCK_BALANCES);
    const recv = receivables(D.FINANCIAL_RECORDS);

    // Daily (≤30d) or weekly (90d) completed production steps; previous period aligned.
    const bucket = w.days > 30 ? 7 : 1;
    const series: { key: string; label: string; start: number; jobs: number; prev: number }[] = [];
    for (let s = w.start; s < w.end; s += bucket * DAY) {
      const e = Math.min(s + bucket * DAY, w.end);
      const shift = w.days * DAY;
      series.push({
        key: new Date(s).toISOString(), start: s,
        label: new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        jobs: completedJobsIn(D.JOBS, s, e).length,
        prev: completedJobsIn(D.JOBS, s - shift, e - shift).length,
      });
    }
    if (w.days === 1) {
      // Today: hourly would be noisy with demo data, so show the last 7 days for context.
      series.length = 0;
      for (let s = w.end - 7 * DAY; s < w.end; s += DAY) series.push({ key: new Date(s).toISOString(), start: s, label: new Date(s).toLocaleDateString("en-GB", { weekday: "short" }), jobs: completedJobsIn(D.JOBS, s, s + DAY).length, prev: completedJobsIn(D.JOBS, s - 7 * DAY, s - 6 * DAY).length });
    }

    const pipelineOrder = ["submitted", "planned", "awaiting_approval", "in_production", "qc", "ready", "delivered"] as const;
    const pipeline = pipelineOrder.map((s) => ({
      status: s,
      count: D.ORDERS.filter((o) => o.status === s && (s !== "delivered" || (o.deliveredAt && new Date(o.deliveredAt).getTime() >= w.start))).length,
    }));
    const cancelled = D.ORDERS.filter((o) => o.status === "cancelled").length;

    const workload = D.ADMIN_MACHINES.map((m) => {
      const js = D.JOBS.filter((j) => j.machineCode === m.code);
      return { code: m.code, name: m.name, pending: js.filter((j) => j.status === "pending" || j.status === "blocked").length, active: js.filter((j) => j.status === "active").length, completed: completedJobsIn(js, w.start, w.end).length };
    });

    const months: { key: string; label: string; sales: number; costs: number }[] = [];
    const t = new Date(); t.setDate(1); t.setHours(0, 0, 0, 0);
    for (let k = 5; k >= 0; k--) {
      const s = new Date(t.getFullYear(), t.getMonth() - k, 1).getTime();
      const e = new Date(t.getFullYear(), t.getMonth() - k + 1, 1).getTime();
      const recs = D.FINANCIAL_RECORDS.filter((f) => new Date(f.date).getTime() >= s && new Date(f.date).getTime() < e);
      months.push({ key: new Date(s).toISOString().slice(0, 7), label: new Date(s).toLocaleDateString("en-GB", { month: "short" }), sales: netSales(recs), costs: costs(recs) });
    }

    const blocked = D.JOBS.filter((j) => j.status === "blocked");
    const awaitingApproval = D.ORDERS.filter((o) => o.status === "awaiting_approval");
    const qc = D.ORDERS.filter((o) => o.status === "qc");
    const downWithWork = D.ADMIN_MACHINES.filter((m) => m.status !== "operational" && D.JOBS.some((j) => j.machineCode === m.code && j.status !== "completed"));

    type Alert = { id: string; sev: "critical" | "warning" | "info"; title: string; body: string; action: string; to: string; f?: string; d?: string };
    const alerts: Alert[] = [];
    if (overdue.length) alerts.push({ id: "ov", sev: "critical", title: `${overdue.length} order${overdue.length > 1 ? "s" : ""} overdue`, body: `${overdue.filter((o) => o.status === "in_production").length} still in production, ${overdue.filter((o) => o.status === "qc").length} in quality control.`, action: "View orders", to: "/admin/orders", f: "overdue" });
    plans.filter((x) => x.state === "overdue").slice(0, 3).forEach((x) => alerts.push({ id: x.p.id, sev: "warning", title: `${D.ADMIN_MACHINES.find((m) => m.code === x.p.machineCode)?.name} — ${x.p.title} overdue`, body: `Due ${Math.round((startOfDay(now) - startOfDay(x.next)) / DAY)} day(s) ago (every ${x.p.intervalDays} days).`, action: "View machine", to: "/admin/machines", d: `machine:${x.p.machineCode}` }));
    downWithWork.forEach((m) => alerts.push({ id: `dw-${m.code}`, sev: "critical", title: `${m.name} unavailable with scheduled work`, body: `${D.JOBS.filter((j) => j.machineCode === m.code && j.status !== "completed").length} open step(s) assigned.`, action: "View machine", to: "/admin/machines", d: `machine:${m.code}` }));
    if (blocked.length) alerts.push({ id: "bl", sev: "warning", title: `${blocked.length} production step${blocked.length > 1 ? "s" : ""} blocked`, body: blocked[0]!.blockedReason ?? "", action: "View steps", to: "/admin/production", f: "blocked" });
    if (low.length) alerts.push({ id: "ls", sev: "warning", title: `${low.length} materials below minimum`, body: low.slice(0, 2).map((x) => x.m.name).join(", ") + (low.length > 2 ? "…" : ""), action: "View inventory", to: "/admin/inventory", f: "low" });
    if (awaitingApproval.length) alerts.push({ id: "aa", sev: "info", title: `${awaitingApproval.length} orders awaiting design approval`, body: "Customer sign-off needed before planning.", action: "View orders", to: "/admin/orders", f: "awaiting_approval" });
    if (qc.length) alerts.push({ id: "qc", sev: "info", title: `${qc.length} orders awaiting quality control`, body: "Ready for inspection.", action: "View orders", to: "/admin/orders", f: "qc" });

    return {
      w, alerts, series, pipeline, cancelled, workload, months, low, plans,
      kpi: {
        active: openOrders.length,
        activePrev: null as number | null,
        completed: done.length, completedDelta: delta(done.length, donePrev.length),
        overdue: overdue.length,
        present: att.present, workforce: att.workforce, notRecorded: att.notRecorded,
        avail, machines: D.ADMIN_MACHINES.length, inMaint: D.ADMIN_MACHINES.filter((m) => m.status === "maintenance").length, oos: D.ADMIN_MACHINES.filter((m) => m.status === "out_of_service").length,
        maintOverdue: plans.filter((x) => x.state === "overdue").length, maintDue: dueNow.length,
        low: low.length,
        receivables: recv, payables: payables(D.FINANCIAL_RECORDS),
        overdueUnpaid: D.FINANCIAL_RECORDS.filter((f) => outstanding(f) > 0 && new Date(f.dueDate).getTime() < startOfDay(now)).reduce((a, f) => a + outstanding(f), 0),
      },
    };
  }, [range]);
}
