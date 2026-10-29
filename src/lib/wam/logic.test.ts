import { describe, expect, it } from "vitest";
import { canClaim, canFinishShift, sortTasks } from "./logic";
import { TASKS, MAINTENANCE } from "./mock-data";

describe("WAM rules", () => {
  it("sorts active first, then pending by priority", () => {
    const tasks = TASKS.filter((t) => t.machine === "WAM-CNC-01").map((t) => (t.id === "t1043" ? { ...t, status: "active" as const } : t));
    expect(sortTasks(tasks).map((t) => t.job)).toEqual(["1043", "1047", "1042", "1039"]);
  });
  it("prevents claiming a task already claimed by someone else", () => {
    const t = { ...TASKS[0], status: "active" as const, assignee: "OP-117" };
    expect(canClaim(t, "OP-104", [t]).ok).toBe(false);
  });
  it("prevents an operator holding two active tasks", () => {
    const a = { ...TASKS[0], status: "active" as const, assignee: "OP-104" };
    expect(canClaim(TASKS[1], "OP-104", [a, TASKS[1]]).ok).toBe(false);
  });
  it("requires a handover note when work is still active", () => {
    const items = MAINTENANCE["WAM-CNC-01"];
    const checks = Object.fromEntries(items.filter((i) => i.phase === "end").map((i) => [i.id, "done" as const]));
    expect(canFinishShift(items, checks, true, "")).toBe(false);
    expect(canFinishShift(items, checks, true, "Left at profile pass 2")).toBe(true);
  });
});
