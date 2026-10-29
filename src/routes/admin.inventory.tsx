import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownUp, Boxes, MapPin, TriangleAlert } from "lucide-react";
import { DataList, FilterChips, KpiCard, Panel, PageHeader, Pill, useDrill, type AdminSearch } from "@/components/admin/ui";
import { db, material } from "@/lib/wam/admin-api";
import { fmtDate, lowStock, stockOf, windows } from "@/lib/wam/admin-logic";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({ meta: [{ title: "Inventory · WAM Management" }, { name: "description", content: "Materials, stock levels and movements." }, { property: "og:title", content: "Inventory · WAM Management" }, { property: "og:description", content: "Materials, stock levels and movements." }] }),
  component: Inventory,
});

function Inventory() {
  const s = Route.useSearch() as AdminSearch;
  const { open, go } = useDrill();
  const w = windows(s.range ?? "7");
  const low = lowStock(db.MATERIALS, db.STOCK_BALANCES);
  const lowIds = new Set(low.map((x) => x.m.id));
  const rows = db.MATERIALS.filter((m) => s.f !== "low" || lowIds.has(m.id));
  const locations = [...new Set(db.STOCK_BALANCES.map((b) => b.location))];
  const moves = db.STOCK_MOVEMENTS.filter((m) => new Date(m.at).getTime() >= w.start);
  const consumed = moves.filter((m) => m.type === "out" && m.jobId);

  return (
    <>
      <PageHeader title="Inventory" subtitle="Consumption figures come from recorded stock movements, not planned job requirements." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Material types" value={db.MATERIALS.length} icon={Boxes} onClick={() => go("/admin/inventory")} />
        <KpiCard label="Low stock" value={low.length} tone={low.length ? "warning" : "default"} icon={TriangleAlert} onClick={() => go("/admin/inventory", { f: "low" })} />
        <KpiCard label="Stock locations" value={locations.length} icon={MapPin} onClick={() => go("/admin/inventory", { f: "locations" })} />
        <KpiCard label="Movements in period" value={moves.length} sub={`${consumed.length} issued to production`} icon={ArrowDownUp} onClick={() => go("/admin/inventory", { f: "moves" })} />
      </div>
      <div className="mt-5 mb-3"><FilterChips value={s.f} onChange={(f) => go("/admin/inventory", { f })} options={[{ key: "low", label: "Low stock" }, { key: "locations", label: "By location" }, { key: "moves", label: "Movements" }]} /></div>

      {s.f === "moves" ? (
        <Panel title="Recorded stock movements">
          <DataList rows={moves} rowKey={(m) => m.id} onRow={(m) => open(m.jobId ? `job:${m.jobId}` : `material:${m.materialId}`)} cols={[
            { key: "d", label: "Date", render: (m) => fmtDate(m.at) }, { key: "m", label: "Material", render: (m) => material(m.materialId)?.name },
            { key: "t", label: "Type", render: (m) => <Pill tone={m.type === "in" ? "success" : m.type === "adjust" ? "warning" : "default"}>{m.type}</Pill> },
            { key: "q", label: "Qty", render: (m) => <span className="font-mono text-xs">{m.qty > 0 ? "+" : ""}{m.qty} {material(m.materialId)?.unit}</span> },
            { key: "n", label: "Note", render: (m) => <span className="text-muted-foreground">{m.note}</span> },
          ]} />
        </Panel>
      ) : s.f === "locations" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {locations.map((loc) => (
            <Panel key={loc} title={loc}>
              {db.STOCK_BALANCES.filter((b) => b.location === loc).map((b) => { const m = material(b.materialId)!; return (
                <button key={m.id} onClick={() => open(`material:${m.id}`)} className="flex w-full justify-between py-1.5 text-sm hover:text-gold"><span>{m.name}</span><span className="font-mono text-xs">{b.qty} {m.unit}</span></button>
              ); })}
            </Panel>
          ))}
        </div>
      ) : (
        <Panel title={`${rows.length} materials`}>
          <DataList rows={rows} rowKey={(m) => m.id} onRow={(m) => open(`material:${m.id}`)} cols={[
            { key: "c", label: "Code", render: (m) => <span className="font-mono text-xs text-brass">{m.code}</span> }, { key: "n", label: "Material", render: (m) => m.name },
            { key: "q", label: "On hand", render: (m) => `${stockOf(m.id, db.STOCK_BALANCES)} ${m.unit}` }, { key: "min", label: "Minimum", render: (m) => `${m.minQty} ${m.unit}` },
            { key: "s", label: "Condition", render: (m) => lowIds.has(m.id) ? <Pill tone={stockOf(m.id, db.STOCK_BALANCES) < m.minQty / 2 ? "critical" : "warning"}>Below minimum</Pill> : <Pill tone="success">OK</Pill> },
            { key: "sup", label: "Supplier", render: (m) => <span className="text-muted-foreground">{m.supplier}</span> },
          ]} />
        </Panel>
      )}
    </>
  );
}
