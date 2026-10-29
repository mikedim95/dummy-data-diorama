import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobStatus, OrderStatus } from "@/lib/wam/admin-types";

export type AdminSearch = { range?: "1" | "7" | "30" | "90" | undefined; d?: string | undefined; f?: string | undefined; q?: string | undefined };

/** Navigation helpers that carry the date range into every drill-down. */
export function useDrill() {
  const navigate = useNavigate();
  return {
    open: (d: string) => navigate({ to: ".", search: ((p: AdminSearch) => ({ ...p, d })) as never }),
    close: () => navigate({ to: ".", search: ((p: AdminSearch) => ({ ...p, d: undefined })) as never }),
    go: (to: string, opts: { f?: string | undefined; d?: string | undefined } = {}) =>
      navigate({ to: to as never, search: ((p: AdminSearch) => ({ range: p.range, f: opts.f, d: opts.d })) as never }),
  };
}

export function Panel({ title, action, children, className, wood }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; wood?: boolean }) {
  return (
    <section className={cn("bg-metal overflow-hidden rounded-[14px] border border-border", className)}>
      {title && (
        <header className={cn("flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3", wood && "bg-walnut")}>
          <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function KpiCard({
  label, value, sub, icon: Icon, tone = "default", deltaPct, onClick,
}: {
  label: string; value: ReactNode; sub?: ReactNode; icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "critical" | "warning" | "success"; deltaPct?: number | null; onClick?: () => void;
}) {
  const toneCls = { default: "text-foreground", critical: "text-critical", warning: "text-warning", success: "text-success" }[tone];
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-metal press group animate-rise flex flex-col rounded-[14px] border p-4 text-left transition-colors duration-200 hover:border-gold/60",
        tone === "critical" ? "border-critical/40" : tone === "warning" ? "border-warning/30" : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", tone === "default" ? "text-brass" : toneCls)} />
      </div>
      <div key={String(value)} className={cn("animate-rise mt-3 font-display text-3xl font-bold tabular-nums", toneCls)}>{value}</div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        {deltaPct != null && (
          <span className={cn("inline-flex items-center", deltaPct >= 0 ? "text-success" : "text-critical")}>
            {deltaPct >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(deltaPct)}%
          </span>
        )}
        <span className="truncate">{sub}</span>
        <ChevronRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </button>
  );
}

export const ORDER_STATUS: Record<OrderStatus, string> = {
  submitted: "Submitted", planned: "Planned", awaiting_approval: "Awaiting approval", in_production: "In production",
  qc: "Quality control", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
};
export function OrderPill({ s }: { s: OrderStatus }) {
  const cls: Record<OrderStatus, string> = {
    submitted: "border-border text-muted-foreground", planned: "border-border text-foreground", awaiting_approval: "border-warning/50 text-warning",
    in_production: "border-gold/60 text-gold", qc: "border-brass/60 text-brass", ready: "border-success/50 text-success",
    delivered: "border-success/30 text-success/80", cancelled: "border-border text-muted-foreground line-through",
  };
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", cls[s])}>{ORDER_STATUS[s]}</span>;
}
export function JobPill({ s }: { s: JobStatus }) {
  const map = { pending: ["Pending", "border-border text-muted-foreground"], active: ["Active", "border-gold/60 text-gold"], completed: ["Completed", "border-success/50 text-success"], blocked: ["Blocked", "border-warning/50 text-warning"] } as const;
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", map[s][1])}>{map[s][0]}</span>;
}
export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "critical" | "warning" | "success" | "gold" }) {
  const cls = { default: "border-border text-muted-foreground", critical: "border-critical/50 text-critical", warning: "border-warning/50 text-warning", success: "border-success/50 text-success", gold: "border-gold/60 text-gold" }[tone];
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", cls)}>{children}</span>;
}

export type Col<T> = { key: string; label: string; render: (r: T) => ReactNode; sort?: (r: T) => string | number; className?: string };
export function DataList<T>({ rows, cols, onRow, empty = "Nothing to show.", rowKey }: { rows: T[]; cols: Col<T>[]; onRow?: (r: T) => void; empty?: string; rowKey: (r: T) => string }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
            {cols.map((c) => <th key={c.key} className={cn("px-4 py-2 font-medium", c.className)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={() => onRow?.(r)} className={cn("border-b border-border/40 transition-colors", onRow && "cursor-pointer hover:bg-elevated/60")}>
              {cols.map((c) => <td key={c.key} className={cn("px-4 py-2.5", c.className)}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function FilterChips({ value, options, onChange }: { value?: string | undefined; options: { key: string; label: string; count?: number }[]; onChange: (k: string | undefined) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => onChange(undefined)} className={cn("press h-9 rounded-lg border px-3 text-xs", !value ? "border-gold/70 text-gold" : "border-border text-muted-foreground")}>All</button>
      {options.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key === value ? undefined : o.key)} className={cn("press h-9 rounded-lg border px-3 text-xs", value === o.key ? "border-gold/70 text-gold" : "border-border text-muted-foreground hover:text-foreground")}>
          {o.label}{o.count != null && <span className="ml-1.5 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const chartTheme = {
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
  tooltip: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" },
};
