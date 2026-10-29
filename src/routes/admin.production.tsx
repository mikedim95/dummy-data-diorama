import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { RecordShortcut } from "@/components/admin/RecordShortcut";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DataList,
  FilterChips,
  JobPill,
  KpiCard,
  Panel,
  PageHeader,
  useDrill,
  type AdminSearch,
  type Col,
} from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { customer, db, employee, machine, order } from "@/lib/wam/admin-api";
import { completedJobsIn, fmtDate, isOverdue, windows, IN_PRODUCTION } from "@/lib/wam/admin-logic";
import type { Job } from "@/lib/wam/admin-types";
import { Activity, CheckCircle2, Clock, Factory, Hourglass } from "lucide-react";

export const Route = createFileRoute("/admin/production")({
  head: () => ({
    meta: [
      { title: "Production · WAM Management" },
      { name: "description", content: "Production steps across all machines." },
      { property: "og:title", content: "Production · WAM Management" },
      { property: "og:description", content: "Production steps across all machines." },
    ],
  }),
  component: Production,
});

function Production() {
  useLanguage();
  const s = Route.useSearch() as AdminSearch;
  const { go, open } = useDrill();
  const [q, setQ] = useState("");
  const [m, setM] = useState<string | undefined>();
  const w = windows(s.range ?? "7");
  const completed = completedJobsIn(db.JOBS, w.start, w.end);
  const openJobs = db.JOBS.filter((j) => j.status !== "completed");
  const base =
    s.f === "completed" ? completed : s.f ? openJobs.filter((j) => j.status === s.f) : openJobs;
  const rows = useMemo(
    () =>
      base
        .filter(
          (j) =>
            (!m || j.machineCode === m) &&
            (!q ||
              `${j.id} ${j.name} ${customer(order(j.orderId)?.customerId ?? "")?.name}`
                .toLowerCase()
                .includes(q.toLowerCase())),
        )
        .sort((a, b) =>
          (order(a.orderId)?.deadline ?? "").localeCompare(order(b.orderId)?.deadline ?? ""),
        ),
    [base, m, q],
  );

  const cols: Col<Job>[] = [
    {
      key: "id",
      label: "Job",
      render: (j) => <span className="font-mono text-xs text-brass">{tv(j.id)}</span>,
    },
    {
      key: "o",
      label: "Order",
      render: (j) => <span className="font-mono text-xs">{tv(j.orderId)}</span>,
    },
    {
      key: "c",
      label: "Customer",
      render: (j) => customer(order(j.orderId)?.customerId ?? "")?.name,
    },
    { key: "n", label: "Job name", render: (j) => j.name },
    {
      key: "e",
      label: "Employee",
      render: (j) =>
        employee(j.employeeId)?.name ?? (
          <span className="text-muted-foreground">{t("Unassigned")}</span>
        ),
    },
    { key: "m", label: "Machine", render: (j) => machine(j.machineCode)?.name },
    { key: "s", label: "Status", render: (j) => <JobPill s={j.status} /> },
    {
      key: "d",
      label: "Due",
      render: (j) => {
        const o = order(j.orderId);
        return o ? (
          <span className={isOverdue(o) ? "text-critical" : ""}>{tv(fmtDate(o.deadline))}</span>
        ) : null;
      },
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <RecordShortcut entity="JOB" />
      </div>
      <PageHeader
        title={t("Production")}
        subtitle={t("Every row is one production step of a customer order.")}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard
          label={t("Active orders")}
          value={db.ORDERS.filter((o) => IN_PRODUCTION.includes(o.status)).length}
          icon={Factory}
          onClick={() => go("/admin/orders", { f: "active" })}
        />
        <KpiCard
          label={t("Active steps")}
          value={openJobs.filter((j) => j.status === "active").length}
          icon={Activity}
          onClick={() => go("/admin/production", { f: "active" })}
        />
        <KpiCard
          label={t("Pending steps")}
          value={openJobs.filter((j) => j.status === "pending").length}
          icon={Hourglass}
          onClick={() => go("/admin/production", { f: "pending" })}
        />
        <KpiCard
          label={t("Completed steps")}
          value={completed.length}
          sub={t("Selected period")}
          icon={CheckCircle2}
          onClick={() => go("/admin/production", { f: "completed" })}
        />
        <KpiCard
          label={t("Delayed orders")}
          value={db.ORDERS.filter((o) => isOverdue(o)).length}
          tone="critical"
          icon={Clock}
          onClick={() => go("/admin/orders", { f: "overdue" })}
        />
      </div>
      <Panel className="mt-5" title={t("Work list · {0}", rows.length)}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <FilterChips
            value={s.f}
            onChange={(f) => go("/admin/production", { f })}
            options={[
              { key: "active", label: "Active" },
              { key: "pending", label: "Pending" },
              { key: "blocked", label: "Blocked" },
              { key: "completed", label: "Completed (period)" },
            ]}
          />
          <select
            value={m ?? ""}
            onChange={(e) => setM(e.target.value || undefined)}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-xs md:ml-auto"
            aria-label={t("Machine")}
          >
            <option value="">{t("All machines")}</option>
            {tv(
              db.ADMIN_MACHINES.map((x) => (
                <option key={x.code} value={x.code}>
                  {tv(x.name)}
                </option>
              )),
            )}
          </select>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search jobs…")}
            className="h-9 bg-surface md:w-56"
          />
        </div>
        <DataList
          rows={rows}
          cols={cols}
          rowKey={(j) => j.id}
          onRow={(j) => open(`job:${j.id}`)}
          empty={t("No steps match these filters.")}
        />
      </Panel>
    </>
  );
}
