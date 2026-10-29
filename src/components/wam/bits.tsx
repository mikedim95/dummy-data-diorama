import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Ban, PlayCircle, ShieldAlert, AlertTriangle, ArrowUp, Info } from "lucide-react";
import type { MaintenancePriority, TaskPriority, TaskStatus } from "@/lib/wam/types";
import { cn } from "@/lib/utils";

const STATUS = {
  pending: { label: "Pending", icon: Circle, cls: "text-muted-foreground border-border" },
  active: { label: "In progress", icon: PlayCircle, cls: "text-gold border-gold/60" },
  completed: { label: "Completed", icon: CheckCircle2, cls: "text-success border-success/50" },
  blocked: { label: "Blocked", icon: Ban, cls: "text-warning border-warning/50" },
} as const;

export function StatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", s.cls)}>
      <s.icon className="size-3" /> {s.label}
    </span>
  );
}

const PRIO: Record<TaskPriority, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "text-critical" },
  high: { label: "High", cls: "text-warning" },
  normal: { label: "Normal", cls: "text-muted-foreground" },
  low: { label: "Low", cls: "text-muted-foreground" },
};
export function PriorityLabel({ p }: { p: TaskPriority }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", PRIO[p].cls)}>
      {(p === "urgent" || p === "high") && <ArrowUp className="size-3" />}
      {PRIO[p].label}
    </span>
  );
}

const MPRIO: Record<MaintenancePriority, { label: string; icon: typeof Info; cls: string } | null> = {
  safety: { label: "Safety critical", icon: ShieldAlert, cls: "bg-critical/15 text-critical" },
  overdue: { label: "Overdue", icon: AlertTriangle, cls: "bg-warning/15 text-warning" },
  high: { label: "High", icon: ArrowUp, cls: "bg-brass/15 text-brass" },
  normal: null,
};
export function MaintPriority({ p }: { p: MaintenancePriority }) {
  const m = MPRIO[p];
  if (!m) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase", m.cls)}>
      <m.icon className="size-3" /> {m.label}
    </span>
  );
}

export function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono tabular-nums">{fmtElapsed(now - new Date(since).getTime())}</span>;
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[10px] font-semibold tracking-[0.2em] text-brass uppercase", className)}>{children}</div>;
}
