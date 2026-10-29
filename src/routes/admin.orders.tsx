import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { RecordShortcut } from "@/components/admin/RecordShortcut";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DataList,
  FilterChips,
  OrderPill,
  Panel,
  PageHeader,
  useDrill,
  ORDER_STATUS,
  type AdminSearch,
  type Col,
} from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { customer, db, jobsOfOrder, snapshotState } from "@/lib/wam/admin-api";
import { fmtDate, isOverdue, IN_PRODUCTION } from "@/lib/wam/admin-logic";
import type { CustomerOrder, OrderStatus } from "@/lib/wam/admin-types";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders · WAM Management" },
      { name: "description", content: "Customer order pipeline." },
      { property: "og:title", content: "Orders · WAM Management" },
      { property: "og:description", content: "Customer order pipeline." },
    ],
  }),
  component: Orders,
});

const PIPE: OrderStatus[] = [
  "submitted",
  "planned",
  "awaiting_approval",
  "in_production",
  "qc",
  "ready",
  "delivered",
];

function Orders() {
  useLanguage();
  const s = Route.useSearch() as AdminSearch;
  const { go, open } = useDrill();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"deadline" | "created">("deadline");
  const revision = snapshotState.version;
  const rows = useMemo(() => {
    let r = db.ORDERS;
    if (s.f === "overdue") r = r.filter((o) => isOverdue(o));
    else if (s.f === "active") r = r.filter((o) => IN_PRODUCTION.includes(o.status));
    else if (s.f) r = r.filter((o) => o.status === s.f);
    else r = r.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    if (q)
      r = r.filter((o) =>
        `${o.number ?? o.id} ${o.title} ${customer(o.customerId)?.name}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      );
    return [...r].sort((a, b) =>
      sort === "deadline"
        ? a.deadline.localeCompare(b.deadline)
        : b.createdAt.localeCompare(a.createdAt),
    );
  }, [s.f, q, sort, revision]);

  const cols: Col<CustomerOrder>[] = [
    {
      key: "id",
      label: "Order",
      render: (o) => <span className="font-mono text-xs text-brass">{tv(o.number ?? o.id)}</span>,
    },
    { key: "c", label: "Customer", render: (o) => customer(o.customerId)?.name },
    { key: "t", label: "Product", render: (o) => o.title },
    { key: "q", label: "Qty", render: (o) => o.quantity },
    {
      key: "p",
      label: "Progress",
      render: (o) => {
        const js = jobsOfOrder(o.id);
        return js.length
          ? `${js.filter((j) => j.status === "completed").length}/${js.length} steps`
          : "—";
      },
    },
    { key: "s", label: "Status", render: (o) => <OrderPill s={o.status} /> },
    {
      key: "d",
      label: "Deadline",
      render: (o) => (
        <span className={isOverdue(o) ? "font-medium text-critical" : ""}>
          {tv(fmtDate(o.deadline))}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <RecordShortcut entity="CUSTOMER_ORDER" />
      </div>
      <PageHeader
        title={t("Orders")}
        subtitle={t("Open orders by default. Use the pipeline to filter.")}
      />
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {tv(
          PIPE.map((st) => (
            <button
              key={st}
              onClick={() => go("/admin/orders", { f: s.f === st ? undefined : st })}
              className={`bg-metal press rounded-xl border p-3 text-left transition-colors ${s.f === st ? "border-gold/70" : "border-border hover:border-brass"}`}
            >
              <div className="font-display text-2xl font-bold">
                {tv(db.ORDERS.filter((o) => o.status === st).length)}
              </div>
              <div className="text-[11px] text-muted-foreground">{tv(ORDER_STATUS[st])}</div>
            </button>
          )),
        )}
      </div>
      <Panel title={t("{0} orders", rows.length)}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <FilterChips
            value={s.f}
            onChange={(f) => go("/admin/orders", { f })}
            options={[
              {
                key: "overdue",
                label: "Overdue",
                count: db.ORDERS.filter((o) => isOverdue(o)).length,
              },
              { key: "active", label: "In production + QC" },
              { key: "cancelled", label: "Cancelled" },
            ]}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "deadline")}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-xs md:ml-auto"
            aria-label={t("Sort")}
          >
            <option value="deadline">{t("Sort: deadline")}</option>
            <option value="created">{t("Sort: newest")}</option>
          </select>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search orders or customers…")}
            className="h-9 bg-surface md:w-64"
          />
        </div>
        <DataList
          rows={rows}
          cols={cols}
          rowKey={(o) => o.id}
          onRow={(o) => open(`order:${o.id}`)}
          empty={t("No orders match.")}
        />
      </Panel>
    </>
  );
}
