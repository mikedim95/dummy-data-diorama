import { describe, expect, it } from "vitest";
import { attendanceToday, delta, isOverdue, lowStock, netSales, planState, receivables, windows } from "./admin-logic";
import type { CustomerOrder, FinancialRecord } from "./admin-types";

const NOW = new Date("2026-10-29T12:00:00").getTime();
const order = (o: Partial<CustomerOrder>): CustomerOrder => ({ id: "o", customerId: "c", title: "t", quantity: 1, templateRev: "r", approval: "approved", status: "in_production", createdAt: "", deadline: "2026-10-28T09:00:00", ...o });

describe("management KPIs", () => {
  it("counts an undelivered order past its deadline as overdue, but not a delivered one", () => {
    expect(isOverdue(order({}), NOW)).toBe(true);
    expect(isOverdue(order({ status: "delivered" }), NOW)).toBe(false);
  });
  it("compares against an equal-length previous window", () => {
    const w = windows("7", NOW);
    expect(w.end - w.start).toBe(w.prevEnd - w.prevStart);
    expect(w.prevEnd).toBe(w.start);
  });
  it("shows no comparison when the previous period is zero", () => {
    expect(delta(5, 0)).toBeNull();
    expect(delta(15, 10)).toBe(50);
  });
  it("marks a maintenance plan overdue after its interval", () => {
    expect(planState({ id: "p", machineCode: "m", title: "t", intervalDays: 7, lastDoneAt: "2026-10-20T08:00:00" }, NOW)).toBe("overdue");
    expect(planState({ id: "p", machineCode: "m", title: "t", intervalDays: 7, lastDoneAt: "2026-10-27T08:00:00" }, NOW)).toBe("upcoming");
  });
  it("flags materials whose total stock across locations is below minimum", () => {
    const mats = [{ id: "a", code: "A", name: "A", unit: "kg", minQty: 10, supplier: "", unitCost: 1 }];
    expect(lowStock(mats, [{ materialId: "a", location: "x", qty: 6 }, { materialId: "a", location: "y", qty: 3 }])).toHaveLength(1);
    expect(lowStock(mats, [{ materialId: "a", location: "x", qty: 6 }, { materialId: "a", location: "y", qty: 5 }])).toHaveLength(0);
  });
  it("subtracts refunds from sales and counts only unpaid sale balances as receivables", () => {
    const f = (type: FinancialRecord["type"], amount: number, paid: number): FinancialRecord => ({ id: type, ref: "", type, category: "", counterparty: "", amount, paid, date: "", dueDate: "" });
    const recs = [f("sale", 1000, 400), f("refund", 100, 100), f("purchase", 500, 0)];
    expect(netSales(recs)).toBe(900);
    expect(receivables(recs)).toBe(600);
  });
  it("does not treat a missing attendance row as absent", () => {
    const r = attendanceToday([{ id: "1", employeeId: "a", date: "2026-10-29T00:00:00", status: "present" }], [
      { id: "a", name: "", department: "", title: "", status: "active" },
      { id: "b", name: "", department: "", title: "", status: "active" },
    ], NOW);
    expect(r).toMatchObject({ present: 1, absent: 0, notRecorded: 1 });
  });
});
