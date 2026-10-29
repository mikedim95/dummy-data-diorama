import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, CheckCircle2, MapPin, Wrench } from "lucide-react";
import { DataList, KpiCard, Panel, PageHeader, Pill, useDrill, type AdminSearch } from "@/components/admin/ui";
import { db, machine } from "@/lib/wam/admin-api";
import { fmtDate, planNextDue, planState, windows } from "@/lib/wam/admin-logic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/machines")({
  head: () => ({ meta: [{ title: "Machines & Maintenance · WAM Management" }, { name: "description", content: "Equipment register and maintenance plans." }, { property: "og:title", content: "Machines & Maintenance · WAM Management" }, { property: "og:description", content: "Equipment register and maintenance plans." }] }),
  component: Machines,
});

function Machines() {
  const s = Route.useSearch() as AdminSearch;
  const { open, go } = useDrill();
  const w = windows(s.range ?? "7");
  const plans = db.MAINTENANCE_PLANS.map((p) => ({ ...p, state: planState(p), next: planNextDue(p) })).sort((a, b) => a.next - b.next);
  const doneInPeriod = db.MAINTENANCE_RECORDS.filter((r) => new Date(r.doneAt).getTime() >= w.start);
  const shown = s.f === "due" ? plans.filter((p) => p.state === "overdue" || p.state === "due") : s.f ? plans.filter((p) => p.state === s.f) : plans;

  return (
    <>
      <PageHeader title="Machines & Maintenance" subtitle="Status comes from the machine register. No live telemetry is connected." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {db.ADMIN_MACHINES.map((m) => {
          const mp = plans.filter((p) => p.machineCode === m.code);
          const alert = mp.some((p) => p.state === "overdue");
          const next = mp[0];
          return (
            <button key={m.code} onClick={() => open(`machine:${m.code}`)} className={cn("bg-metal press animate-rise overflow-hidden rounded-[14px] border text-left transition-colors hover:border-gold/60", alert ? "border-warning/40" : "border-border")}>
              <div className="bg-walnut flex items-center justify-between px-4 py-2"><span className="font-mono text-[11px] text-gold">{m.code}</span>{alert && <AlertTriangle className="size-4 text-warning" />}</div>
              <div className="p-4">
                <div className="font-display font-bold">{m.name}</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {m.location}</div>
                <div className="mt-3 flex items-center justify-between">
                  <Pill tone={m.status === "operational" ? "success" : m.status === "maintenance" ? "warning" : "critical"}>{m.status.replace(/_/g, " ")}</Pill>
                  <span className="text-xs text-muted-foreground">{db.JOBS.filter((j) => j.machineCode === m.code && j.status !== "completed").length} open jobs</span>
                </div>
                {next && Number.isFinite(next.next) && <div className="mt-2 text-[11px] text-muted-foreground">Next: {next.title} · <span className={next.state === "overdue" ? "text-critical" : ""}>{fmtDate(new Date(next.next).toISOString())}</span></div>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Overdue plans" value={plans.filter((p) => p.state === "overdue").length} tone="critical" icon={AlertTriangle} onClick={() => go("/admin/machines", { f: "overdue" })} />
        <KpiCard label="Due today" value={plans.filter((p) => p.state === "due").length} tone="warning" icon={Wrench} onClick={() => go("/admin/machines", { f: "due" })} />
        <KpiCard label="Upcoming (7 days)" value={plans.filter((p) => p.state === "upcoming").length} icon={CalendarClock} onClick={() => go("/admin/machines", { f: "upcoming" })} />
        <KpiCard label="Completed in period" value={doneInPeriod.length} tone="success" icon={CheckCircle2} onClick={() => go("/admin/machines", { f: "done" })} />
      </div>

      {s.f === "done" ? (
        <Panel className="mt-5" title="Maintenance completed in period">
          <DataList rows={doneInPeriod} rowKey={(r) => r.id} onRow={(r) => open(`machine:${r.machineCode}`)} cols={[
            { key: "d", label: "Date", render: (r) => fmtDate(r.doneAt) }, { key: "m", label: "Machine", render: (r) => machine(r.machineCode)?.name },
            { key: "t", label: "Task", render: (r) => r.title }, { key: "b", label: "By", render: (r) => r.by }, { key: "n", label: "Note", render: (r) => <span className="text-muted-foreground">{r.note}</span> },
          ]} />
        </Panel>
      ) : (
        <Panel className="mt-5" title={`Maintenance plans · ${shown.length}`}>
          <DataList rows={shown} rowKey={(p) => p.id} onRow={(p) => open(`machine:${p.machineCode}`)} cols={[
            { key: "m", label: "Machine", render: (p) => machine(p.machineCode)?.name }, { key: "t", label: "Plan", render: (p) => p.title },
            { key: "i", label: "Interval", render: (p) => p.intervalDays ? `${p.intervalDays} days` : "Operator guidance" }, { key: "l", label: "Last done", render: (p) => p.lastDoneAt ? fmtDate(p.lastDoneAt) : "—" },
            { key: "n", label: "Next due", render: (p) => Number.isFinite(p.next) ? fmtDate(new Date(p.next).toISOString()) : "No due date" },
            { key: "s", label: "State", render: (p) => <Pill tone={p.state === "overdue" ? "critical" : p.state === "due" ? "warning" : p.state === "upcoming" ? "gold" : "success"}>{p.state === "ok" ? "On schedule" : p.state}</Pill> },
          ]} />
        </Panel>
      )}
    </>
  );
}
