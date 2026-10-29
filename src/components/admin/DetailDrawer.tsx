import { useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Check, ChevronRight, FileText, Lock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { JobPill, OrderPill, Pill, useDrill, type AdminSearch } from "./ui";
import { customer, db, docsFor, employee, jobsOfOrder, machine, material, MANAGER, order } from "@/lib/wam/admin-api";
import { eur, fmtDate, fmtDateTime, isOverdue, outstanding, planNextDue, planState, stockOf, DAY } from "@/lib/wam/admin-logic";
import { cn } from "@/lib/utils";

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex justify-between gap-4 border-b border-border/40 py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
function Sec({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-6"><h3 className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-brass uppercase">{title}</h3>{children}</section>;
}
function LinkRow({ d, children, right }: { d: string; children: ReactNode; right?: ReactNode }) {
  const { open } = useDrill();
  return (
    <button onClick={() => open(d)} className="press flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm hover:border-brass">
      <span className="min-w-0 flex-1 truncate">{children}</span>{right}<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
function Docs({ type, id }: { type: string; id: string }) {
  const ds = docsFor(type, id);
  if (!ds.length) return <p className="text-sm text-muted-foreground">No linked documents.</p>;
  return <div className="space-y-1.5">{ds.map((d) => <LinkRow key={d.id} d={`doc:${d.id}`} right={d.classification === "restricted" && <Lock className="size-3.5 text-warning" />}><FileText className="mr-2 inline size-4 text-brass" />{d.title}</LinkRow>)}</div>;
}

function OrderView({ id }: { id: string }) {
  const o = order(id);
  if (!o) return <NotFound />;
  const jobs = jobsOfOrder(id);
  const flow = ["submitted", "awaiting_approval", "planned", "in_production", "qc", "ready", "delivered"] as const;
  const idx = flow.indexOf(o.status as (typeof flow)[number]);
  const fin = db.FINANCIAL_RECORDS.filter((f) => f.orderId === id);
  return (
    <>
      <Head eyebrow={`Order · ${customer(o.customerId)?.name}`} title={`${o.id} — ${o.title}`} pill={<OrderPill s={o.status} />} />
      {o.status !== "cancelled" && (
        <ol className="mt-5 flex gap-1">
          {flow.map((s, i) => (
            <li key={s} className="flex-1" title={s}>
              <div className={cn("h-1.5 rounded-full", i < idx ? "bg-brass" : i === idx ? "bg-gold" : "bg-muted")} />
            </li>
          ))}
        </ol>
      )}
      <div className="mt-1 text-[11px] text-muted-foreground">Workflow stage {Math.max(idx, 0) + 1} of {flow.length}</div>
      <Sec title="Details">
        <Row k="Customer" v={customer(o.customerId)?.name} />
        <Row k="Quantity" v={o.quantity} />
        <Row k="Template" v={o.templateRev} />
        <Row k="Customer approval" v={<Pill tone={o.approval === "approved" ? "success" : "warning"}>{o.approval.replace("_", " ")}</Pill>} />
        <Row k="Deadline" v={<span className={cn(isOverdue(o) && "text-critical")}>{fmtDate(o.deadline)}{isOverdue(o) && " · overdue"}</span>} />
        {o.deliveredAt && <Row k="Delivered" v={fmtDate(o.deliveredAt)} />}
        <Row k="Assigned" v={[...new Set(jobs.map((j) => employee(j.employeeId)?.name).filter(Boolean))].join(", ") || "—"} />
      </Sec>
      <Sec title="Production steps">
        {jobs.length ? (
          <ol className="space-y-1.5">{jobs.map((j) => <LinkRow key={j.id} d={`job:${j.id}`} right={<JobPill s={j.status} />}><span className="mr-2 font-mono text-xs text-brass">{j.sequence}</span>{j.name.split(" · ")[0]}</LinkRow>)}</ol>
        ) : <p className="text-sm text-muted-foreground">Not planned yet.</p>}
      </Sec>
      <Sec title="Quality control">
        {o.qc ? <div className="rounded-xl border border-border bg-surface p-3 text-sm"><Pill tone={o.qc.result === "pass" ? "success" : "critical"}>{o.qc.result.toUpperCase()}</Pill><p className="mt-2">{o.qc.note}</p><p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(o.qc.at)}</p></div> : <p className="text-sm text-muted-foreground">No inspection recorded.</p>}
      </Sec>
      {MANAGER.canSeeFinance && <Sec title="Financial records">{fin.length ? <div className="space-y-1.5">{fin.map((f) => <LinkRow key={f.id} d={`finance:${f.id}`} right={<span className="font-mono text-xs">{eur(f.amount)}</span>}>{f.ref}</LinkRow>)}</div> : <p className="text-sm text-muted-foreground">None yet.</p>}</Sec>}
      <Sec title="Documents"><Docs type="order" id={id} /></Sec>
    </>
  );
}

function JobView({ id }: { id: string }) {
  const j = db.JOBS.find((x) => x.id === id);
  if (!j) return <NotFound />;
  const o = order(j.orderId);
  const seq = jobsOfOrder(j.orderId);
  const mat = material(j.materialId);
  return (
    <>
      <Head eyebrow={`Production step · ${j.id}`} title={j.name} pill={<JobPill s={j.status} />} />
      {j.blockedReason && <p className="mt-4 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm text-warning">{j.blockedReason}</p>}
      <Sec title="Order sequence">
        <ol className="flex items-center gap-1 overflow-x-auto pb-1">
          {seq.map((s, i) => (
            <li key={s.id} className="flex items-center gap-1">
              <span className={cn("rounded-lg border px-2 py-1 text-[11px] whitespace-nowrap", s.id === j.id ? "border-gold text-gold" : s.status === "completed" ? "border-success/40 text-success" : "border-border text-muted-foreground")}>
                {s.status === "completed" && <Check className="mr-1 inline size-3" />}{s.name.split(" · ")[0]}
              </span>
              {i < seq.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
            </li>
          ))}
        </ol>
      </Sec>
      <Sec title="Details">
        {o && <LinkRow d={`order:${o.id}`} right={<OrderPill s={o.status} />}>{o.id} · {customer(o.customerId)?.name}</LinkRow>}
        <div className="mt-2">
          <Row k="Operator" v={employee(j.employeeId)?.name ?? "Unassigned"} />
          <Row k="Machine" v={machine(j.machineCode)?.name} />
          <Row k="Material" v={mat ? `${mat.name} · ${j.materialQty} ${mat.unit}` : "—"} />
          <Row k="Quantity completed" v={`${j.quantityDone} of ${o?.quantity ?? "?"}`} />
          <Row k="Started" v={j.startedAt ? fmtDateTime(j.startedAt) : "—"} />
          <Row k="Completed" v={j.completedAt ? fmtDateTime(j.completedAt) : "—"} />
        </div>
      </Sec>
      <Sec title="Instructions"><p className="text-sm leading-relaxed">{j.instructions}</p></Sec>
      <Sec title="Documents"><Docs type="job" id={id} /></Sec>
    </>
  );
}

function MachineView({ code }: { code: string }) {
  const m = machine(code);
  if (!m) return <NotFound />;
  const jobs = db.JOBS.filter((j) => j.machineCode === code && j.status !== "completed");
  const plans = db.MAINTENANCE_PLANS.filter((p) => p.machineCode === code);
  const hist = db.MAINTENANCE_RECORDS.filter((r) => r.machineCode === code).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  const mats = [...new Set(db.JOBS.filter((j) => j.machineCode === code && j.materialId).map((j) => j.materialId!))];
  return (
    <>
      <Head eyebrow={`Machine · ${m.code}`} title={m.name} pill={<Pill tone={m.status === "operational" ? "success" : m.status === "maintenance" ? "warning" : "critical"}>{m.status.replace(/_/g, " ")}</Pill>} />
      <Sec title="Information"><Row k="Model" v={m.model} /><Row k="Location" v={m.location} /><Row k="Telemetry" v={<span className="text-muted-foreground">Not available</span>} /></Sec>
      <Sec title={`Open assignments (${jobs.length})`}>{jobs.length ? <div className="space-y-1.5">{jobs.map((j) => <LinkRow key={j.id} d={`job:${j.id}`} right={<JobPill s={j.status} />}>{j.name}</LinkRow>)}</div> : <p className="text-sm text-muted-foreground">No open work.</p>}</Sec>
      <Sec title="Maintenance plans">
        <div className="space-y-1.5">{plans.map((p) => { const s = planState(p); return (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{p.title}</div><div className="text-xs text-muted-foreground">Every {p.intervalDays} days · next {fmtDate(new Date(planNextDue(p)).toISOString())}</div></div>
            <Pill tone={s === "overdue" ? "critical" : s === "due" ? "warning" : s === "upcoming" ? "gold" : "success"}>{s === "ok" ? "On schedule" : s}</Pill>
          </div>); })}</div>
      </Sec>
      <Sec title="Maintenance history">
        <ol className="space-y-2 border-l border-border pl-4">{hist.slice(0, 8).map((h) => <li key={h.id} className="text-sm"><div className="text-[11px] text-muted-foreground">{fmtDateTime(h.doneAt)} · {h.by}</div><div className="font-medium">{h.title}</div><div className="text-xs text-muted-foreground">{h.note}</div></li>)}</ol>
      </Sec>
      <Sec title="Associated materials"><div className="space-y-1.5">{mats.map((id) => <LinkRow key={id} d={`material:${id}`}>{material(id)?.name}</LinkRow>)}</div></Sec>
      <Sec title="Manuals & attachments"><Docs type="machine" id={code} /></Sec>
    </>
  );
}

function EmployeeView({ id }: { id: string }) {
  const e = employee(id);
  if (!e) return <NotFound />;
  const att = db.ATTENDANCE.filter((a) => a.employeeId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  const jobs = db.JOBS.filter((j) => j.employeeId === id);
  const open = jobs.filter((j) => j.status !== "completed");
  const recent = jobs.filter((j) => j.status === "completed").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 5);
  return (
    <>
      <Head eyebrow={`${e.department} · ${e.id}`} title={e.name} pill={<Pill tone={e.status === "active" ? "success" : "warning"}>{e.status.replace("_", " ")}</Pill>} />
      <Sec title="Profile"><Row k="Job title" v={e.title} /><Row k="Department" v={e.department} /><Row k="Open assignments" v={open.length} /></Sec>
      <Sec title="Recent attendance (recorded rows only)">
        <div className="grid grid-cols-7 gap-1">{att.map((a) => <div key={a.id} title={`${fmtDate(a.date)} · ${a.status}`} className={cn("rounded-md py-1.5 text-center text-[10px]", a.status === "present" ? "bg-success/20 text-success" : a.status === "leave" ? "bg-brass/20 text-brass" : "bg-critical/20 text-critical")}>{new Date(a.date).getDate()}</div>)}</div>
      </Sec>
      <Sec title="Open jobs">{open.length ? <div className="space-y-1.5">{open.map((j) => <LinkRow key={j.id} d={`job:${j.id}`} right={<JobPill s={j.status} />}>{j.name}</LinkRow>)}</div> : <p className="text-sm text-muted-foreground">None.</p>}</Sec>
      <Sec title="Recently completed">{recent.map((j) => <LinkRow key={j.id} d={`job:${j.id}`} right={<span className="text-xs text-muted-foreground">{fmtDate(j.completedAt!)}</span>}>{j.name}</LinkRow>)}</Sec>
    </>
  );
}

function MaterialView({ id }: { id: string }) {
  const m = material(id);
  if (!m) return <NotFound />;
  const bal = db.STOCK_BALANCES.filter((b) => b.materialId === id);
  const total = stockOf(id, db.STOCK_BALANCES);
  const mv = db.STOCK_MOVEMENTS.filter((s) => s.materialId === id).slice(0, 10);
  const needing = db.JOBS.filter((j) => j.materialId === id && j.status !== "completed");
  return (
    <>
      <Head eyebrow={`Material · ${m.code}`} title={m.name} pill={<Pill tone={total < m.minQty ? "warning" : "success"}>{total < m.minQty ? "Below minimum" : "In stock"}</Pill>} />
      <Sec title="Stock">
        <Row k="Total on hand" v={`${total} ${m.unit}`} /><Row k="Minimum" v={`${m.minQty} ${m.unit}`} />
        {bal.map((b) => <Row key={b.location} k={`· ${b.location}`} v={`${b.qty} ${m.unit}`} />)}
        <Row k="Supplier" v={m.supplier} />
        {MANAGER.canSeeFinance && <Row k="Standard unit cost" v={`${eur(m.unitCost)} / ${m.unit}`} />}
      </Sec>
      <Sec title="Jobs requiring this material (planned)">{needing.length ? <div className="space-y-1.5">{needing.map((j) => <LinkRow key={j.id} d={`job:${j.id}`} right={<span className="text-xs">{j.materialQty} {m.unit}</span>}>{j.name}</LinkRow>)}</div> : <p className="text-sm text-muted-foreground">None.</p>}</Sec>
      <Sec title="Stock movements (recorded)">
        <div className="space-y-1">{mv.map((s) => <div key={s.id} className="flex items-center justify-between rounded-lg px-1 py-1.5 text-sm"><span><span className="text-xs text-muted-foreground">{fmtDate(s.at)}</span> · {s.note}</span><span className={cn("font-mono text-xs", s.qty > 0 ? "text-success" : "text-foreground")}>{s.qty > 0 ? "+" : ""}{s.qty} {m.unit}</span></div>)}</div>
      </Sec>
      <Sec title="Documents"><Docs type="material" id={id} /></Sec>
    </>
  );
}

function FinanceView({ id }: { id: string }) {
  const f = db.FINANCIAL_RECORDS.find((x) => x.id === id);
  if (!MANAGER.canSeeFinance) return <p className="text-sm text-muted-foreground">You don't have permission to view financial records.</p>;
  if (!f) return <NotFound />;
  const bal = outstanding(f);
  return (
    <>
      <Head eyebrow={`${f.type} · ${f.category}`} title={f.ref} pill={<Pill tone={bal === 0 ? "success" : new Date(f.dueDate).getTime() < Date.now() ? "critical" : "warning"}>{bal === 0 ? "Settled" : f.paid > 0 ? "Partially paid" : "Unpaid"}</Pill>} />
      <Sec title="Record"><Row k={f.type === "sale" || f.type === "refund" ? "Customer" : "Supplier"} v={f.counterparty} /><Row k="Amount" v={eur(f.amount)} /><Row k="Paid" v={eur(f.paid)} /><Row k="Remaining" v={eur(bal)} /><Row k="Date" v={fmtDate(f.date)} /><Row k="Due" v={fmtDate(f.dueDate)} /></Sec>
      {f.orderId && <Sec title="Related order"><LinkRow d={`order:${f.orderId}`}>{f.orderId} · {order(f.orderId)?.title}</LinkRow></Sec>}
      <Sec title="Documents"><Docs type="finance" id={id} /></Sec>
    </>
  );
}

function DocView({ id }: { id: string }) {
  const d = db.DOCUMENTS.find((x) => x.id === id);
  if (!d) return <NotFound />;
  const restricted = d.classification === "restricted" && !MANAGER.canSeeFinance;
  return (
    <>
      <Head eyebrow={`Document · ${d.kind}`} title={d.title} pill={<Pill tone={d.classification === "restricted" ? "warning" : "default"}>{d.classification}</Pill>} />
      <Sec title="Details"><Row k="Uploaded" v={fmtDate(d.uploadedAt)} /><Row k="File" v={<span className="text-muted-foreground">Demo — no file stored</span>} /></Sec>
      {!restricted && <Sec title="Linked to"><div className="space-y-1.5">{d.links.map((l) => <LinkRow key={l.id} d={`${l.type === "finance" ? "finance" : l.type}:${l.id}`}>{l.type} · {l.id}</LinkRow>)}</div></Sec>}
    </>
  );
}

function CustomerView({ id }: { id: string }) {
  const c = customer(id);
  if (!c) return <NotFound />;
  const os = db.ORDERS.filter((o) => o.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  return (
    <>
      <Head eyebrow={`Customer · ${c.city}`} title={c.name} />
      <Sec title="Contact"><Row k="Email" v={c.email} /></Sec>
      <Sec title="Orders">{os.map((o) => <LinkRow key={o.id} d={`order:${o.id}`} right={<OrderPill s={o.status} />}>{o.id} · {o.title}</LinkRow>)}</Sec>
    </>
  );
}

function DayView({ iso }: { iso: string }) {
  const s = new Date(iso).getTime();
  const jobs = db.JOBS.filter((j) => j.completedAt && new Date(j.completedAt).getTime() >= s && new Date(j.completedAt).getTime() < s + DAY * (iso.includes("W") ? 7 : 1));
  return (
    <>
      <Head eyebrow="Completed production steps" title={new Date(s).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} />
      <Sec title={`${jobs.length} step(s)`}>{jobs.length ? <div className="space-y-1.5">{jobs.map((j) => <LinkRow key={j.id} d={`job:${j.id}`} right={<span className="text-xs text-muted-foreground">{employee(j.employeeId)?.name.split(" ")[0]}</span>}>{j.name}</LinkRow>)}</div> : <p className="text-sm text-muted-foreground">No steps completed.</p>}</Sec>
    </>
  );
}

function Head({ eyebrow, title, pill }: { eyebrow: string; title: string; pill?: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold tracking-[0.2em] text-brass uppercase">{eyebrow}</div>
      <SheetTitle className="mt-1 font-display text-xl leading-tight">{title}</SheetTitle>
      <SheetDescription className="sr-only">Record details</SheetDescription>
      {pill && <div className="mt-2">{pill}</div>}
    </div>
  );
}
function NotFound() { return <><SheetTitle>Record not found</SheetTitle><SheetDescription>It may have been removed.</SheetDescription></>; }

const LABEL: Record<string, string> = { order: "Order", job: "Job", machine: "Machine", employee: "Employee", material: "Material", finance: "Finance", doc: "Document", customer: "Customer", day: "Day" };

export function DetailDrawer() {
  const { d } = useSearch({ strict: false }) as AdminSearch;
  const { close } = useDrill();
  const [type, ...rest] = (d ?? "").split(":");
  const id = rest.join(":");
  const body = (() => {
    switch (type) {
      case "order": return <OrderView id={id} />;
      case "job": return <JobView id={id} />;
      case "machine": return <MachineView code={id} />;
      case "employee": return <EmployeeView id={id} />;
      case "material": return <MaterialView id={id} />;
      case "finance": return <FinanceView id={id} />;
      case "doc": return <DocView id={id} />;
      case "customer": return <CustomerView id={id} />;
      case "day": return <DayView iso={id} />;
      default: return null;
    }
  })();
  return (
    <Sheet open={!!d && !!body} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-border bg-surface p-5 sm:max-w-lg">
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          <button onClick={() => history.back()} className="hover:text-foreground">Back</button>
          <ChevronRight className="size-3" /><span>{LABEL[type ?? ""]}</span><ChevronRight className="size-3" /><span className="truncate text-foreground">{id.slice(0, 24)}</span>
        </nav>
        {body}
      </SheetContent>
    </Sheet>
  );
}
