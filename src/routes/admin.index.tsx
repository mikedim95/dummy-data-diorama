import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Boxes, Briefcase, CheckCircle2, Clock, Cog, Euro, Info, ShieldAlert, Users, Wrench } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTheme, KpiCard, ORDER_STATUS, Panel, PageHeader, useDrill, type AdminSearch } from "@/components/admin/ui";
import { MANAGER, useOverview } from "@/lib/wam/admin-api";
import { eur, RANGES } from "@/lib/wam/admin-logic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Workshop Overview · WAM Management" },
      { name: "description", content: "Production and business performance at a glance." },
      { property: "og:title", content: "Workshop Overview · WAM Management" },
      { property: "og:description", content: "Production and business performance at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const search = Route.useSearch() as AdminSearch;
  const range = search.range ?? "7";
  const ov = useOverview(range);
  const { go, open } = useDrill();
  const k = ov.kpi;
  const rl = RANGES.find((r) => r.key === range)!.label.toLowerCase();

  return (
    <>
      <PageHeader title="Workshop Overview" subtitle="Your production and business performance at a glance." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Active orders" value={k.active} sub="In production or QC" icon={Briefcase} onClick={() => go("/admin/orders", { f: "active" })} />
        <KpiCard label="Completed jobs" value={k.completed} deltaPct={k.completedDelta} sub={`Steps · ${rl}`} icon={CheckCircle2} onClick={() => go("/admin/production", { f: "completed" })} />
        <KpiCard label="Overdue orders" value={k.overdue} tone={k.overdue ? "critical" : "success"} sub="Past deadline, undelivered" icon={Clock} onClick={() => go("/admin/orders", { f: "overdue" })} />
        <KpiCard label="Employees present" value={<>{k.present}<span className="text-lg text-muted-foreground">/{k.workforce}</span></>} sub={k.notRecorded ? `${k.notRecorded} not recorded yet` : "All recorded"} icon={Users} onClick={() => go("/admin/employees", { f: "today" })} />
        <KpiCard label="Machine availability" value={<>{k.avail}<span className="text-lg text-muted-foreground">/{k.machines}</span></>} sub={`${k.inMaint} maintenance · ${k.oos} out of service`} tone={k.oos ? "warning" : "default"} icon={Cog} onClick={() => go("/admin/machines")} />
        <KpiCard label="Maintenance due" value={k.maintDue} sub={`${k.maintOverdue} overdue plans`} tone={k.maintOverdue ? "warning" : "default"} icon={Wrench} onClick={() => go("/admin/machines", { f: "due" })} />
        <KpiCard label="Low stock items" value={k.low} sub="Below minimum level" tone={k.low ? "warning" : "default"} icon={Boxes} onClick={() => go("/admin/inventory", { f: "low" })} />
        {MANAGER.canSeeFinance && <KpiCard label="Outstanding receivables" value={eur(k.receivables)} sub="Unpaid & partially paid sales" icon={Euro} onClick={() => go("/admin/finance", { f: "receivable" })} />}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Jobs completed over time" action={<span className="text-[11px] text-muted-foreground">Click a point for that day's jobs</span>}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ov.series} onClick={(e) => { const p = ov.series[Number(e?.activeTooltipIndex ?? -1)]; if (p) open(`day:${p.key}${range === "90" ? "W" : ""}`); }} className="cursor-pointer">
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--gold)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <Tooltip contentStyle={chartTheme.tooltip} cursor={{ stroke: "var(--gold)", strokeOpacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="prev" name="Previous period" stroke="var(--muted-foreground)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                <Area type="monotone" dataKey="jobs" name="Completed steps" stroke="var(--gold)" strokeWidth={2} fill="url(#gold)" activeDot={{ r: 5, fill: "var(--gold)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Requires attention" wood action={<span className="text-[11px] text-gold">{ov.alerts.length}</span>}>
          {ov.alerts.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No critical operational issues detected.</p> : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {ov.alerts.map((a) => {
                const Icon = a.sev === "critical" ? ShieldAlert : a.sev === "warning" ? AlertTriangle : Info;
                return (
                  <li key={a.id}>
                    <button onClick={() => go(a.to, { f: a.f, d: a.d })} className="press flex w-full gap-3 rounded-xl border border-border bg-surface p-3 text-left hover:border-brass">
                      <Icon className={cn("mt-0.5 size-4 shrink-0", a.sev === "critical" ? "text-critical" : a.sev === "warning" ? "text-warning" : "text-muted-foreground")} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{a.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.body}</div>
                        <div className="mt-1 text-xs font-medium text-gold">{a.action} →</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Orders by status" action={<button className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => go("/admin/orders", { f: "cancelled" })}>{ov.cancelled} cancelled →</button>}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ov.pipeline.map((p) => ({ ...p, label: ORDER_STATUS[p.status] }))} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 6" horizontal={false} />
                <XAxis type="number" stroke={chartTheme.axis} fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" stroke={chartTheme.axis} fontSize={11} width={110} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTheme.tooltip} cursor={{ fill: "var(--elevated)" }} formatter={(v) => [v, "Orders"]} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} className="cursor-pointer" onClick={(d) => go("/admin/orders", { f: (d as unknown as { status: string }).status })}>
                  {ov.pipeline.map((p) => <Cell key={p.status} fill={p.status === "in_production" ? "var(--gold)" : p.status === "delivered" ? "var(--success)" : "var(--brass)"} fillOpacity={p.status === "in_production" ? 1 : 0.7} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground">Delivered = delivered in selected period.</p>
        </Panel>

        <Panel title="Work assigned by machine" action={<span className="text-[11px] text-muted-foreground">Job counts, not utilisation</span>}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ov.workload} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 6" horizontal={false} />
                <XAxis type="number" stroke={chartTheme.axis} fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke={chartTheme.axis} fontSize={11} width={110} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTheme.tooltip} cursor={{ fill: "var(--elevated)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {(["pending", "active", "completed"] as const).map((key) => (
                  <Bar key={key} dataKey={key} name={key[0]!.toUpperCase() + key.slice(1)} stackId="a" fill={key === "active" ? "var(--gold)" : key === "completed" ? "var(--success)" : "var(--muted-foreground)"} fillOpacity={key === "pending" ? 0.5 : 0.9} className="cursor-pointer" onClick={(d) => open(`machine:${(d as unknown as { code: string }).code}`)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {MANAGER.canSeeFinance && (
          <Panel title="Sales and expenses · last 6 months" action={<span className="text-[11px] text-muted-foreground">Sales net of refunds</span>}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ov.months} onClick={(e) => { const m = ov.months[Number(e?.activeTooltipIndex ?? -1)]; if (m) go("/admin/finance", { f: `month:${m.key}` }); }} className="cursor-pointer">
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `€${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={chartTheme.tooltip} cursor={{ fill: "var(--elevated)" }} formatter={(v) => eur(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sales" name="Recorded sales" fill="var(--gold)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="costs" name="Purchases & expenses" fill="var(--walnut)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}

        <Panel title="Inventory health" action={<button className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => go("/admin/inventory", { f: "low" })}>All low stock →</button>}>
          {ov.low.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">All materials above minimum.</p> : (
            <ul className="space-y-3">
              {ov.low.map(({ m, qty }) => {
                const pct = Math.min(100, (qty / m.minQty) * 100);
                return (
                  <li key={m.id}>
                    <button onClick={() => open(`material:${m.id}`)} className="press w-full text-left">
                      <div className="flex justify-between text-sm"><span className="truncate">{m.name}</span><span className="font-mono text-xs text-muted-foreground">{qty} / {m.minQty} {m.unit}</span></div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", pct < 50 ? "bg-critical" : "bg-warning")} style={{ width: `${pct}%` }} /></div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
