import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Lock } from "lucide-react";
import { DataList, FilterChips, Panel, PageHeader, Pill, useDrill, type AdminSearch } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { db, MANAGER } from "@/lib/wam/admin-api";
import { fmtDate } from "@/lib/wam/admin-logic";

export const Route = createFileRoute("/admin/documents")({
  head: () => ({ meta: [{ title: "Documents · WAM Management" }, { name: "description", content: "Drawings, manuals, certificates and invoices." }, { property: "og:title", content: "Documents · WAM Management" }, { property: "og:description", content: "Drawings, manuals, certificates and invoices." }] }),
  component: Documents,
});

function Documents() {
  const s = Route.useSearch() as AdminSearch;
  const { open, go } = useDrill();
  const [q, setQ] = useState("");
  const rows = db.DOCUMENTS.filter((d) => (d.classification !== "restricted" || MANAGER.canSeeFinance) && (!s.f || d.kind === s.f) && (!q || d.title.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHeader title="Documents" subtitle="Restricted documents are visible only to accounts with finance permission." />
      <Panel title={`${rows.length} documents`}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <FilterChips value={s.f} onChange={(f) => go("/admin/documents", { f })} options={["drawing", "manual", "certificate", "invoice", "photo"].map((k) => ({ key: k, label: k[0]!.toUpperCase() + k.slice(1) }))} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" className="h-9 bg-surface md:ml-auto md:w-64" />
        </div>
        <DataList rows={rows} rowKey={(d) => d.id} onRow={(d) => open(`doc:${d.id}`)} cols={[
          { key: "t", label: "Title", render: (d) => <span className="inline-flex items-center gap-2"><FileText className="size-4 text-brass" />{d.title}</span> },
          { key: "k", label: "Type", render: (d) => <span className="text-muted-foreground capitalize">{d.kind}</span> },
          { key: "l", label: "Linked to", render: (d) => <span className="font-mono text-xs">{d.links.map((l) => l.id).join(", ")}</span> },
          { key: "c", label: "Class", render: (d) => d.classification === "restricted" ? <Pill tone="warning"><Lock className="mr-1 size-3" />Restricted</Pill> : <Pill>Internal</Pill> },
          { key: "u", label: "Uploaded", render: (d) => fmtDate(d.uploadedAt) },
        ]} />
      </Panel>
    </>
  );
}
