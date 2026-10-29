import { getLocale } from "@/lib/i18n";
import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Check, ChevronRight, FileText, Lock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { JobPill, OrderPill, Pill, useDrill, type AdminSearch } from "./ui";
import {
  customer,
  db,
  docsFor,
  employee,
  jobsOfOrder,
  machine,
  material,
  MANAGER,
  order,
} from "@/lib/wam/admin-api";
import {
  eur,
  fmtDate,
  fmtDateTime,
  isOverdue,
  outstanding,
  planNextDue,
  planState,
  stockOf,
  DAY,
} from "@/lib/wam/admin-logic";
import { cn } from "@/lib/utils";

function Row({ k, v }: { k: string; v: ReactNode }) {
  useLanguage();
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{t(k)}</span>
      <span className="text-right font-medium">{tv(v)}</span>
    </div>
  );
}
function Sec({ title, children }: { title: string; children: ReactNode }) {
  useLanguage();
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-brass uppercase">
        {tv(title)}
      </h3>
      {tv(children)}
    </section>
  );
}
function LinkRow({ d, children, right }: { d: string; children: ReactNode; right?: ReactNode }) {
  useLanguage();
  const { open } = useDrill();
  return (
    <button
      onClick={() => open(d)}
      className="press flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm hover:border-brass"
    >
      <span className="min-w-0 flex-1 truncate">{tv(children)}</span>
      {tv(right)}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
function Docs({ type, id }: { type: string; id: string }) {
  useLanguage();
  const ds = docsFor(type, id);
  if (!ds.length)
    return <p className="text-sm text-muted-foreground">{t("No linked documents.")}</p>;
  return (
    <div className="space-y-1.5">
      {tv(
        ds.map((d) => (
          <LinkRow
            key={d.id}
            d={`doc:${d.id}`}
            right={d.classification === "restricted" && <Lock className="size-3.5 text-warning" />}
          >
            <FileText className="mr-2 inline size-4 text-brass" />
            {tv(d.title)}
          </LinkRow>
        )),
      )}
    </div>
  );
}

function OrderView({ id }: { id: string }) {
  useLanguage();
  const o = order(id);
  if (!o) return <NotFound />;
  const jobs = jobsOfOrder(id);
  const flow = [
    "submitted",
    "awaiting_approval",
    "planned",
    "in_production",
    "qc",
    "ready",
    "delivered",
  ] as const;
  const idx = flow.indexOf(o.status as (typeof flow)[number]);
  const fin = db.FINANCIAL_RECORDS.filter((f) => f.orderId === id);
  return (
    <>
      <Head
        eyebrow={t("Order · {0}", customer(o.customerId)?.name)}
        title={`${o.id} — ${o.title}`}
        pill={<OrderPill s={o.status} />}
      />
      {tv(
        o.status !== "cancelled" && (
          <ol className="mt-5 flex gap-1">
            {tv(
              flow.map((s, i) => (
                <li key={s} className="flex-1" title={tv(s)}>
                  <div
                    className={cn(
                      "h-1.5 rounded-full",
                      i < idx ? "bg-brass" : i === idx ? "bg-gold" : "bg-muted",
                    )}
                  />
                </li>
              )),
            )}
          </ol>
        ),
      )}
      <div className="mt-1 text-[11px] text-muted-foreground">
        {t("Workflow stage")} {tv(Math.max(idx, 0) + 1)} {t("of")} {tv(flow.length)}
      </div>
      <Sec title={t("Details")}>
        <Row k={t("Customer")} v={customer(o.customerId)?.name} />
        <Row k={t("Quantity")} v={o.quantity} />
        <Row k={t("Template")} v={o.templateRev} />
        <Row
          k={t("Customer approval")}
          v={
            <Pill tone={o.approval === "approved" ? "success" : "warning"}>
              {tv(o.approval.replace("_", " "))}
            </Pill>
          }
        />
        <Row
          k={t("Deadline")}
          v={
            <span className={cn(isOverdue(o) && "text-critical")}>
              {tv(fmtDate(o.deadline))}
              {tv(isOverdue(o) && t(" · overdue"))}
            </span>
          }
        />
        {tv(o.deliveredAt && <Row k={t("Delivered")} v={fmtDate(o.deliveredAt)} />)}
        <Row
          k={t("Assigned")}
          v={
            [...new Set(jobs.map((j) => employee(j.employeeId)?.name).filter(Boolean))].join(
              ", ",
            ) || "—"
          }
        />
      </Sec>
      <Sec title={t("Production steps")}>
        {tv(
          jobs.length ? (
            <ol className="space-y-1.5">
              {tv(
                jobs.map((j) => (
                  <LinkRow key={j.id} d={`job:${j.id}`} right={<JobPill s={j.status} />}>
                    <span className="mr-2 font-mono text-xs text-brass">{tv(j.sequence)}</span>
                    {tv(j.name.split(" · ")[0])}
                  </LinkRow>
                )),
              )}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t("Not planned yet.")}</p>
          ),
        )}
      </Sec>
      <Sec title={t("Quality control")}>
        {tv(
          o.qc ? (
            <div className="rounded-xl border border-border bg-surface p-3 text-sm">
              <Pill tone={o.qc.result === "pass" ? "success" : "critical"}>
                {tv(o.qc.result.toUpperCase())}
              </Pill>
              <p className="mt-2">{tv(o.qc.note)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tv(fmtDateTime(o.qc.at))}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("No inspection recorded.")}</p>
          ),
        )}
      </Sec>
      {tv(
        MANAGER.canSeeFinance && (
          <Sec title={t("Financial records")}>
            {tv(
              fin.length ? (
                <div className="space-y-1.5">
                  {tv(
                    fin.map((f) => (
                      <LinkRow
                        key={f.id}
                        d={`finance:${f.id}`}
                        right={<span className="font-mono text-xs">{tv(eur(f.amount))}</span>}
                      >
                        {tv(f.ref)}
                      </LinkRow>
                    )),
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("None yet.")}</p>
              ),
            )}
          </Sec>
        ),
      )}
      <Sec title={t("Documents")}>
        <Docs type="order" id={id} />
      </Sec>
    </>
  );
}

function JobView({ id }: { id: string }) {
  useLanguage();
  const j = db.JOBS.find((x) => x.id === id);
  if (!j) return <NotFound />;
  const o = order(j.orderId);
  const seq = jobsOfOrder(j.orderId);
  const mat = material(j.materialId);
  return (
    <>
      <Head
        eyebrow={t("Production step · {0}", j.id)}
        title={j.name}
        pill={<JobPill s={j.status} />}
      />
      {tv(
        j.blockedReason && (
          <p className="mt-4 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
            {tv(j.blockedReason)}
          </p>
        ),
      )}
      <Sec title={t("Order sequence")}>
        <ol className="flex items-center gap-1 overflow-x-auto pb-1">
          {tv(
            seq.map((s, i) => (
              <li key={s.id} className="flex items-center gap-1">
                <span
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[11px] whitespace-nowrap",
                    s.id === j.id
                      ? "border-gold text-gold"
                      : s.status === "completed"
                        ? "border-success/40 text-success"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {tv(s.status === "completed" && <Check className="mr-1 inline size-3" />)}
                  {tv(s.name.split(" · ")[0])}
                </span>
                {tv(
                  i < seq.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />,
                )}
              </li>
            )),
          )}
        </ol>
      </Sec>
      <Sec title={t("Details")}>
        {tv(
          o && (
            <LinkRow d={`order:${o.id}`} right={<OrderPill s={o.status} />}>
              {tv(o.id)} · {tv(customer(o.customerId)?.name)}
            </LinkRow>
          ),
        )}
        <div className="mt-2">
          <Row k={t("Operator")} v={employee(j.employeeId)?.name ?? "Unassigned"} />
          <Row k={t("Machine")} v={machine(j.machineCode)?.name} />
          <Row k={t("Material")} v={mat ? `${mat.name} · ${j.materialQty} ${mat.unit}` : "—"} />
          <Row k={t("Quantity completed")} v={`${j.quantityDone} of ${o?.quantity ?? "?"}`} />
          <Row k={t("Started")} v={j.startedAt ? fmtDateTime(j.startedAt) : "—"} />
          <Row k={t("Completed")} v={j.completedAt ? fmtDateTime(j.completedAt) : "—"} />
        </div>
      </Sec>
      <Sec title={t("Instructions")}>
        <p className="text-sm leading-relaxed">{tv(j.instructions)}</p>
      </Sec>
      <Sec title={t("Documents")}>
        <Docs type="job" id={id} />
      </Sec>
    </>
  );
}

function MachineView({ code }: { code: string }) {
  useLanguage();
  const m = machine(code);
  if (!m) return <NotFound />;
  const jobs = db.JOBS.filter((j) => j.machineCode === code && j.status !== "completed");
  const plans = db.MAINTENANCE_PLANS.filter((p) => p.machineCode === code);
  const hist = db.MAINTENANCE_RECORDS.filter((r) => r.machineCode === code).sort((a, b) =>
    b.doneAt.localeCompare(a.doneAt),
  );
  const mats = [
    ...new Set(
      db.JOBS.filter((j) => j.machineCode === code && j.materialId).map((j) => j.materialId!),
    ),
  ];
  return (
    <>
      <Head
        eyebrow={t("Machine · {0}", m.code)}
        title={m.name}
        pill={
          <Pill
            tone={
              m.status === "operational"
                ? "success"
                : m.status === "maintenance"
                  ? "warning"
                  : "critical"
            }
          >
            {tv(m.status.replace(/_/g, " "))}
          </Pill>
        }
      />
      <Sec title={t("Information")}>
        <Row k={t("Model")} v={m.model} />
        <Row k={t("Location")} v={m.location} />
        <Row
          k={t("Telemetry")}
          v={<span className="text-muted-foreground">{t("Not available")}</span>}
        />
      </Sec>
      <Sec title={t("Open assignments ({0})", jobs.length)}>
        {tv(
          jobs.length ? (
            <div className="space-y-1.5">
              {tv(
                jobs.map((j) => (
                  <LinkRow key={j.id} d={`job:${j.id}`} right={<JobPill s={j.status} />}>
                    {tv(j.name)}
                  </LinkRow>
                )),
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("No open work.")}</p>
          ),
        )}
      </Sec>
      <Sec title={t("Maintenance plans")}>
        <div className="space-y-1.5">
          {tv(
            plans.map((p) => {
              const s = planState(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{tv(p.title)}</div>
                    <div className="text-xs text-muted-foreground">
                      {tv(
                        Number.isFinite(planNextDue(p))
                          ? t(
                              "Next {0}{1}",
                              fmtDate(new Date(planNextDue(p)).toISOString()),
                              p.intervalDays ? ` · Every ${p.intervalDays} days` : "",
                            )
                          : t("Operator guidance · No due date"),
                      )}
                    </div>
                  </div>
                  <Pill
                    tone={
                      s === "overdue"
                        ? "critical"
                        : s === "due"
                          ? "warning"
                          : s === "upcoming"
                            ? "gold"
                            : "success"
                    }
                  >
                    {tv(s === "ok" ? t("On schedule") : tv(s))}
                  </Pill>
                </div>
              );
            }),
          )}
        </div>
      </Sec>
      <Sec title={t("Maintenance history")}>
        <ol className="space-y-2 border-l border-border pl-4">
          {tv(
            hist.slice(0, 8).map((h) => (
              <li key={h.id} className="text-sm">
                <div className="text-[11px] text-muted-foreground">
                  {tv(fmtDateTime(h.doneAt))} · {tv(h.by)}
                </div>
                <div className="font-medium">{tv(h.title)}</div>
                <div className="text-xs text-muted-foreground">{tv(h.note)}</div>
              </li>
            )),
          )}
        </ol>
      </Sec>
      <Sec title={t("Associated materials")}>
        <div className="space-y-1.5">
          {tv(
            mats.map((id) => (
              <LinkRow key={id} d={`material:${id}`}>
                {tv(material(id)?.name)}
              </LinkRow>
            )),
          )}
        </div>
      </Sec>
      <Sec title={t("Manuals & attachments")}>
        <Docs type="machine" id={code} />
      </Sec>
    </>
  );
}

function EmployeeView({ id }: { id: string }) {
  useLanguage();
  const e = employee(id);
  if (!e) return <NotFound />;
  const att = db.ATTENDANCE.filter((a) => a.employeeId === id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);
  const jobs = db.JOBS.filter((j) => j.employeeId === id);
  const open = jobs.filter((j) => j.status !== "completed");
  const recent = jobs
    .filter((j) => j.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, 5);
  return (
    <>
      <Head
        eyebrow={`${e.department} · ${e.id}`}
        title={e.name}
        pill={
          <Pill tone={e.status === "active" ? "success" : "warning"}>
            {tv(e.status.replace("_", " "))}
          </Pill>
        }
      />
      <Sec title={t("Profile")}>
        <Row k={t("Job title")} v={e.title} />
        <Row k={t("Department")} v={e.department} />
        <Row k={t("Open assignments")} v={open.length} />
      </Sec>
      <Sec title={t("Recent attendance (recorded rows only)")}>
        <div className="grid grid-cols-7 gap-1">
          {tv(
            att.map((a) => (
              <div
                key={a.id}
                title={`${fmtDate(a.date)} · ${a.status}`}
                className={cn(
                  "rounded-md py-1.5 text-center text-[10px]",
                  a.status === "present"
                    ? "bg-success/20 text-success"
                    : a.status === "leave"
                      ? "bg-brass/20 text-brass"
                      : "bg-critical/20 text-critical",
                )}
              >
                {tv(new Date(a.date).getDate())}
              </div>
            )),
          )}
        </div>
      </Sec>
      <Sec title={t("Open jobs")}>
        {tv(
          open.length ? (
            <div className="space-y-1.5">
              {tv(
                open.map((j) => (
                  <LinkRow key={j.id} d={`job:${j.id}`} right={<JobPill s={j.status} />}>
                    {tv(j.name)}
                  </LinkRow>
                )),
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("None.")}</p>
          ),
        )}
      </Sec>
      <Sec title={t("Recently completed")}>
        {tv(
          recent.map((j) => (
            <LinkRow
              key={j.id}
              d={`job:${j.id}`}
              right={
                <span className="text-xs text-muted-foreground">{tv(fmtDate(j.completedAt!))}</span>
              }
            >
              {tv(j.name)}
            </LinkRow>
          )),
        )}
      </Sec>
    </>
  );
}

function MaterialView({ id }: { id: string }) {
  useLanguage();
  const m = material(id);
  if (!m) return <NotFound />;
  const bal = db.STOCK_BALANCES.filter((b) => b.materialId === id);
  const total = stockOf(id, db.STOCK_BALANCES);
  const mv = db.STOCK_MOVEMENTS.filter((s) => s.materialId === id).slice(0, 10);
  const needing = db.JOBS.filter((j) => j.materialId === id && j.status !== "completed");
  return (
    <>
      <Head
        eyebrow={t("Material · {0}", m.code)}
        title={m.name}
        pill={
          <Pill tone={total < m.minQty ? "warning" : "success"}>
            {tv(total < m.minQty ? t("Below minimum") : t("In stock"))}
          </Pill>
        }
      />
      <Sec title={t("Stock")}>
        <Row k={t("Total on hand")} v={`${total} ${m.unit}`} />
        <Row k={t("Minimum")} v={`${m.minQty} ${m.unit}`} />
        {tv(
          bal.map((b) => <Row key={b.location} k={`· ${b.location}`} v={`${b.qty} ${m.unit}`} />),
        )}
        <Row k={t("Supplier")} v={m.supplier} />
        {tv(
          MANAGER.canSeeFinance && (
            <Row k={t("Standard unit cost")} v={`${eur(m.unitCost)} / ${m.unit}`} />
          ),
        )}
      </Sec>
      <Sec title={t("Jobs requiring this material (planned)")}>
        {tv(
          needing.length ? (
            <div className="space-y-1.5">
              {tv(
                needing.map((j) => (
                  <LinkRow
                    key={j.id}
                    d={`job:${j.id}`}
                    right={
                      <span className="text-xs">
                        {tv(j.materialQty)} {tv(m.unit)}
                      </span>
                    }
                  >
                    {tv(j.name)}
                  </LinkRow>
                )),
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("None.")}</p>
          ),
        )}
      </Sec>
      <Sec title={t("Stock movements (recorded)")}>
        <div className="space-y-1">
          {tv(
            mv.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg px-1 py-1.5 text-sm"
              >
                <span>
                  <span className="text-xs text-muted-foreground">{tv(fmtDate(s.at))}</span> ·{" "}
                  {tv(s.note)}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs",
                    s.qty > 0 ? "text-success" : "text-foreground",
                  )}
                >
                  {tv(s.qty > 0 ? "+" : "")}
                  {tv(s.qty)} {tv(m.unit)}
                </span>
              </div>
            )),
          )}
        </div>
      </Sec>
      <Sec title={t("Documents")}>
        <Docs type="material" id={id} />
      </Sec>
    </>
  );
}

function FinanceView({ id }: { id: string }) {
  useLanguage();
  const f = db.FINANCIAL_RECORDS.find((x) => x.id === id);
  if (!MANAGER.canSeeFinance)
    return (
      <p className="text-sm text-muted-foreground">
        {t("You don't have permission to view financial records.")}
      </p>
    );
  if (!f) return <NotFound />;
  const bal = outstanding(f);
  return (
    <>
      <Head
        eyebrow={`${f.type} · ${f.category}`}
        title={f.ref}
        pill={
          <Pill
            tone={
              bal === 0
                ? "success"
                : new Date(f.dueDate).getTime() < Date.now()
                  ? "critical"
                  : "warning"
            }
          >
            {tv(bal === 0 ? t("Settled") : f.paid > 0 ? t("Partially paid") : t("Unpaid"))}
          </Pill>
        }
      />
      <Sec title={t("Record")}>
        <Row
          k={f.type === "sale" || f.type === "refund" ? t("Customer") : t("Supplier")}
          v={f.counterparty}
        />
        <Row k={t("Amount")} v={eur(f.amount)} />
        <Row k={t("Paid")} v={eur(f.paid)} />
        <Row k={t("Remaining")} v={eur(bal)} />
        <Row k={t("Date")} v={fmtDate(f.date)} />
        <Row k={t("Due")} v={fmtDate(f.dueDate)} />
      </Sec>
      {tv(
        f.orderId && (
          <Sec title={t("Related order")}>
            <LinkRow d={`order:${f.orderId}`}>
              {tv(f.orderId)} · {tv(order(f.orderId)?.title)}
            </LinkRow>
          </Sec>
        ),
      )}
      <Sec title={t("Documents")}>
        <Docs type="finance" id={id} />
      </Sec>
    </>
  );
}

function DocView({ id }: { id: string }) {
  useLanguage();
  const d = db.DOCUMENTS.find((x) => x.id === id);
  if (!d) return <NotFound />;
  const restricted = d.classification === "restricted" && !MANAGER.canSeeFinance;
  return (
    <>
      <Head
        eyebrow={t("Document · {0}", d.kind)}
        title={tv(d.title)}
        pill={
          <Pill tone={d.classification === "restricted" ? "warning" : "default"}>
            {tv(d.classification)}
          </Pill>
        }
      />
      <Sec title={t("Details")}>
        <Row k={t("Uploaded")} v={fmtDate(d.uploadedAt)} />
        <Row
          k={t("File")}
          v={<span className="text-muted-foreground">{t("Demo — no file stored")}</span>}
        />
      </Sec>
      {tv(
        !restricted && (
          <Sec title={t("Linked to")}>
            <div className="space-y-1.5">
              {tv(
                d.links.map((l) => (
                  <LinkRow key={l.id} d={`${l.type === "finance" ? "finance" : l.type}:${l.id}`}>
                    {tv(l.type)} · {tv(l.id)}
                  </LinkRow>
                )),
              )}
            </div>
          </Sec>
        ),
      )}
    </>
  );
}

function CustomerView({ id }: { id: string }) {
  useLanguage();
  const c = customer(id);
  if (!c) return <NotFound />;
  const os = db.ORDERS.filter((o) => o.customerId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);
  return (
    <>
      <Head eyebrow={t("Customer · {0}", c.city)} title={c.name} />
      <Sec title={t("Contact")}>
        <Row k={t("Email")} v={c.email} />
      </Sec>
      <Sec title={t("Orders")}>
        {tv(
          os.map((o) => (
            <LinkRow key={o.id} d={`order:${o.id}`} right={<OrderPill s={o.status} />}>
              {tv(o.id)} · {tv(o.title)}
            </LinkRow>
          )),
        )}
      </Sec>
    </>
  );
}

function DayView({ iso }: { iso: string }) {
  useLanguage();
  const s = new Date(iso).getTime();
  const jobs = db.JOBS.filter(
    (j) =>
      j.completedAt &&
      new Date(j.completedAt).getTime() >= s &&
      new Date(j.completedAt).getTime() < s + DAY * (iso.includes("W") ? 7 : 1),
  );
  return (
    <>
      <Head
        eyebrow={t("Completed production steps")}
        title={new Date(s).toLocaleDateString(getLocale(), {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />
      <Sec title={t("{0} step(s)", jobs.length)}>
        {tv(
          jobs.length ? (
            <div className="space-y-1.5">
              {tv(
                jobs.map((j) => (
                  <LinkRow
                    key={j.id}
                    d={`job:${j.id}`}
                    right={
                      <span className="text-xs text-muted-foreground">
                        {tv(employee(j.employeeId)?.name.split(" ")[0])}
                      </span>
                    }
                  >
                    {tv(j.name)}
                  </LinkRow>
                )),
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("No steps completed.")}</p>
          ),
        )}
      </Sec>
    </>
  );
}

function Head({ eyebrow, title, pill }: { eyebrow: string; title: string; pill?: ReactNode }) {
  useLanguage();
  return (
    <div>
      <div className="text-[10px] font-semibold tracking-[0.2em] text-brass uppercase">
        {tv(eyebrow)}
      </div>
      <SheetTitle className="mt-1 font-display text-xl leading-tight">{tv(title)}</SheetTitle>
      <SheetDescription className="sr-only">{t("Record details")}</SheetDescription>
      {tv(pill && <div className="mt-2">{tv(pill)}</div>)}
    </div>
  );
}
function NotFound() {
  useLanguage();
  return (
    <>
      <SheetTitle>{t("Record not found")}</SheetTitle>
      <SheetDescription>{t("It may have been removed.")}</SheetDescription>
    </>
  );
}

const LABEL: Record<string, string> = {
  order: "Order",
  job: "Job",
  machine: "Machine",
  employee: "Employee",
  material: "Material",
  finance: "Finance",
  doc: "Document",
  customer: "Customer",
  day: "Day",
};

export function DetailDrawer() {
  useLanguage();
  const { d } = useSearch({ strict: false }) as AdminSearch;
  const { close } = useDrill();
  const [type, ...rest] = (d ?? "").split(":");
  const id = rest.join(":");
  const body = (() => {
    switch (type) {
      case "order":
        return <OrderView id={id} />;
      case "job":
        return <JobView id={id} />;
      case "machine":
        return <MachineView code={id} />;
      case "employee":
        return <EmployeeView id={id} />;
      case "material":
        return <MaterialView id={id} />;
      case "finance":
        return <FinanceView id={id} />;
      case "doc":
        return <DocView id={id} />;
      case "customer":
        return <CustomerView id={id} />;
      case "day":
        return <DayView iso={id} />;
      default:
        return null;
    }
  })();
  return (
    <Sheet open={!!d && !!body} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-border bg-surface p-5 sm:max-w-lg"
      >
        <nav
          aria-label={t("Breadcrumb")}
          className="mb-3 flex items-center gap-1 text-[11px] text-muted-foreground"
        >
          <button onClick={() => history.back()} className="hover:text-foreground">
            {t("Back")}
          </button>
          <ChevronRight className="size-3" />
          <span>{tv(LABEL[type ?? ""])}</span>
          <ChevronRight className="size-3" />
          <span className="truncate text-foreground">{tv(id.slice(0, 24))}</span>
        </nav>
        {tv(body)}
      </SheetContent>
    </Sheet>
  );
}
