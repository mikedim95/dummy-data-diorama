import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { RecordShortcut } from "@/components/admin/RecordShortcut";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Lock, Receipt, Wallet } from "lucide-react";
import {
  chartTheme,
  DataList,
  FilterChips,
  KpiCard,
  Panel,
  PageHeader,
  Pill,
  useDrill,
  type AdminSearch,
} from "@/components/admin/ui";
import { db, MANAGER, useOverview } from "@/lib/wam/admin-api";
import {
  costs,
  eur,
  fmtDate,
  netSales,
  outstanding,
  startOfDay,
  windows,
} from "@/lib/wam/admin-logic";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [
      { title: "Finance · WAM Management" },
      { name: "description", content: "Recorded sales, expenses and balances." },
      { property: "og:title", content: "Finance · WAM Management" },
      { property: "og:description", content: "Recorded sales, expenses and balances." },
    ],
  }),
  component: Finance,
});

const PALETTE = [
  "var(--gold)",
  "var(--brass)",
  "var(--walnut)",
  "var(--success)",
  "var(--warning)",
  "var(--muted-foreground)",
];

function Finance() {
  useLanguage();
  const s = Route.useSearch() as AdminSearch;
  const { open, go } = useDrill();
  const ov = useOverview(s.range ?? "7");
  const w = windows(s.range ?? "7");
  const period = db.FINANCIAL_RECORDS.filter((f) => new Date(f.date).getTime() >= w.start);
  const rows = useMemo(() => {
    let r = [...db.FINANCIAL_RECORDS];
    if (s.f === "receivable") r = r.filter((f) => f.type === "sale" && outstanding(f) > 0);
    else if (s.f === "payable")
      r = r.filter((f) => (f.type === "purchase" || f.type === "expense") && outstanding(f) > 0);
    else if (s.f === "overdue")
      r = r.filter(
        (f) => outstanding(f) > 0 && new Date(f.dueDate).getTime() < startOfDay(Date.now()),
      );
    else if (s.f?.startsWith("month:")) r = r.filter((f) => f.date.slice(0, 7) === s.f!.slice(6));
    else if (s.f) r = r.filter((f) => f.type === s.f);
    else r = period;
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [s.f, period]);

  if (!MANAGER.canSeeFinance)
    return (
      <div className="py-20 text-center text-muted-foreground">
        <Lock className="mx-auto mb-2 size-8" />
        {t("You don't have permission to view finance.")}
      </div>
    );

  const cats = Object.entries(
    db.FINANCIAL_RECORDS.filter(
      (f) =>
        (f.type === "purchase" || f.type === "expense") &&
        new Date(f.date).getTime() >= Date.now() - 180 * 864e5,
    ).reduce<Record<string, number>>(
      (a, f) => ({ ...a, [f.category]: (a[f.category] ?? 0) + f.amount }),
      {},
    ),
  ).map(([name, value]) => ({ name: t(name), value }));
  const sales = db.FINANCIAL_RECORDS.filter((f) => f.type === "sale");
  const paidVsOut = [
    { name: t("Paid"), value: sales.reduce((a, f) => a + f.paid, 0) },
    { name: t("Outstanding"), value: sales.reduce((a, f) => a + outstanding(f), 0) },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <RecordShortcut entity="FINANCIAL_RECORD" />
      </div>
      <PageHeader
        title={t("Finance")}
        subtitle={t(
          "From financial records. Sales are shown net of refunds; this is not a profit figure.",
        )}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard
          label={t("Gross recorded sales")}
          value={eur(netSales(period))}
          sub={t("Selected period")}
          icon={ArrowUpRight}
          onClick={() => go("/admin/finance", { f: "sale" })}
        />
        <KpiCard
          label={t("Purchases & expenses")}
          value={eur(costs(period))}
          sub={t("Selected period")}
          icon={ArrowDownLeft}
          onClick={() => go("/admin/finance", { f: "expense" })}
        />
        <KpiCard
          label={t("Receivables")}
          value={eur(ov.kpi.receivables)}
          icon={Wallet}
          onClick={() => go("/admin/finance", { f: "receivable" })}
        />
        <KpiCard
          label={t("Payables")}
          value={eur(ov.kpi.payables)}
          icon={Receipt}
          onClick={() => go("/admin/finance", { f: "payable" })}
        />
        <KpiCard
          label={t("Overdue unpaid")}
          value={eur(ov.kpi.overdueUnpaid)}
          tone={ov.kpi.overdueUnpaid ? "critical" : "default"}
          icon={AlertCircle}
          onClick={() => go("/admin/finance", { f: "overdue" })}
        />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Panel title={t("Monthly sales trend")}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ov.months}
                onClick={(e) => {
                  const m = ov.months[Number(e?.activeTooltipIndex ?? -1)];
                  if (m) go("/admin/finance", { f: `month:${m.key}` });
                }}
                className="cursor-pointer"
              >
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={chartTheme.axis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={chartTheme.axis}
                  fontSize={11}
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `€${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={chartTheme.tooltip}
                  cursor={{ fill: "var(--elevated)" }}
                  formatter={(v) => eur(Number(v))}
                />
                <Bar dataKey="sales" name={t("Sales")} fill="var(--gold)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={t("Expenses by category · 6 months")}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cats}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="var(--surface)"
                  className="cursor-pointer"
                  onClick={() => go("/admin/finance", { f: "expense" })}
                >
                  {tv(
                    cats.map((c, i) => <Cell key={c.name} fill={PALETTE[i % PALETTE.length]!} />),
                  )}
                </Pie>
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => eur(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {tv(
              cats.map((c, i) => (
                <span key={c.name} className="inline-flex items-center gap-1">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                  />
                  {tv(c.name)}
                </span>
              )),
            )}
          </div>
        </Panel>
        <Panel title={t("Sales: paid vs outstanding")}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paidVsOut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="var(--surface)"
                  className="cursor-pointer"
                  onClick={(d) =>
                    go("/admin/finance", {
                      f: (d as { name: string }).name === "Outstanding" ? "receivable" : "sale",
                    })
                  }
                >
                  <Cell fill="var(--success)" />
                  <Cell fill="var(--warning)" />
                </Pie>
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => eur(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <div className="mt-5 mb-3">
        <FilterChips
          value={s.f}
          onChange={(f) => go("/admin/finance", { f })}
          options={[
            { key: "sale", label: "Sales" },
            { key: "refund", label: "Refunds" },
            { key: "purchase", label: "Purchases" },
            { key: "expense", label: "Expenses" },
            { key: "receivable", label: "Receivable" },
            { key: "overdue", label: "Overdue" },
          ]}
        />
      </div>
      <Panel title={t("{0} records{1}", rows.length, !s.f ? t(" in period") : "")}>
        <DataList
          rows={rows}
          rowKey={(f) => f.id}
          onRow={(f) => open(`finance:${f.id}`)}
          cols={[
            {
              key: "r",
              label: "Reference",
              render: (f) => <span className="font-mono text-xs text-brass">{tv(f.ref)}</span>,
            },
            { key: "c", label: "Counterparty", render: (f) => f.counterparty },
            {
              key: "t",
              label: "Category",
              render: (f) => (
                <span className="text-muted-foreground">
                  {tv(f.type)} · {tv(f.category)}
                </span>
              ),
            },
            {
              key: "a",
              label: "Amount",
              render: (f) => (
                <span className="tabular-nums">
                  {tv(f.type === "refund" ? "−" : "")}
                  {tv(eur(f.amount))}
                </span>
              ),
            },
            { key: "p", label: "Paid", render: (f) => eur(f.paid) },
            {
              key: "b",
              label: "Remaining",
              render: (f) =>
                outstanding(f) ? (
                  <span className="text-warning">{tv(eur(outstanding(f)))}</span>
                ) : (
                  <Pill tone="success">{t("Settled")}</Pill>
                ),
            },
            { key: "d", label: "Due", render: (f) => fmtDate(f.dueDate) },
          ]}
        />
      </Panel>
    </>
  );
}
