import type { MaintenanceItem, CheckState, Task, TaskPriority } from "./types";

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const STATUS_RANK = { active: 0, pending: 1, blocked: 2, completed: 3 } as const;

/** Active first, then pending by priority then production sequence; blocked and completed last. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.sequence - b.sequence,
  );
}

export type ClaimResult = { ok: true } | { ok: false; reason: string };

/** A task can be claimed only if it's pending, unassigned, and the operator has no other active task. */
export function canClaim(task: Task, operatorId: string, all: Task[]): ClaimResult {
  if (task.status === "active" && task.assignee === operatorId) return { ok: false, reason: "You already accepted this task." };
  if (task.status === "active") return { ok: false, reason: "Another operator has already claimed this task." };
  if (task.status === "blocked") return { ok: false, reason: task.blockedReason ?? "This task is blocked." };
  if (task.status === "completed") return { ok: false, reason: "This task is already finished." };
  if (all.some((t) => t.status === "active" && t.assignee === operatorId))
    return { ok: false, reason: "Finish your current task before accepting another." };
  return { ok: true };
}

/** Shift can close only when every required end check is marked done (skipped requires a note) and no task is left active without handover. */
export function canFinishShift(
  items: MaintenanceItem[],
  checks: Record<string, CheckState>,
  hasActive: boolean,
  handoverNote: string,
): boolean {
  const required = items.filter((i) => i.phase === "end" && i.kind === "required");
  const allAnswered = required.every((i) => checks[i.id] === "done" || checks[i.id] === "skipped");
  const anySkipped = required.some((i) => checks[i.id] === "skipped");
  const needsNote = hasActive || anySkipped;
  return allAnswered && (!needsNote || handoverNote.trim().length >= 5);
}
