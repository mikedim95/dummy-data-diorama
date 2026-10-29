import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { wamRequest } from "@/lib/wam/client-api";
import { getAdminSnapshot } from "@/lib/wam/admin.functions";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Bell, Boxes, Briefcase, Calendar, ChevronsLeft, ChevronsRight, Cog, Euro, Factory, FileText, LayoutDashboard, Menu, Search, Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { WamLogo } from "@/components/wam/OperatorLayout";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { useDrill, type AdminSearch } from "@/components/admin/ui";
import { RANGES } from "@/lib/wam/admin-logic";
import { db, loadSnapshot, MANAGER, useOverview } from "@/lib/wam/admin-api";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  range: z.enum(["1", "7", "30", "90"]).optional(),
  d: z.string().optional(),
  f: z.string().optional(),
});

export const Route = createFileRoute("/admin")({
  validateSearch: (s): AdminSearch => searchSchema.parse(s) as AdminSearch,
  ssr: false,
  beforeLoad: async ({ location }) => {
    try { await wamRequest("session"); }
    catch (error) {
      if ([401, 403].includes((error as { status?: number }).status ?? 0)) throw redirect({ to: "/auth", search: { redirect: location.href } });
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Management · WAM" }, { name: "description", content: "WAM executive management dashboard." }] }),
  component: AdminGate,
});

function AdminGate() {
  const fetchSnapshot = useServerFn(getAdminSnapshot);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["admin-snapshot"], queryFn: () => fetchSnapshot(), staleTime: 60_000, retry: 1 });
  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    const config = await wamRequest<{ localDemo: boolean }>("config");
    await wamRequest("logout", {});
    if (!config.localDemo) await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  if (q.isPending) return <div className="grid min-h-dvh place-items-center bg-page"><Loader2 className="size-6 animate-spin text-gold" /></div>;
  if (q.isError) return <Centered title="Couldn't load the dashboard" body="Please try again." action={<Button variant="gold" onClick={() => q.refetch()}>Retry</Button>} />;
  if (!q.data.allowed) return <Centered title="No management access" body={`${q.data.email} is signed in but hasn't been given the manager role. Ask the owner to grant access.`} action={<Button variant="metal" onClick={signOut}><LogOut className="size-4" /> Sign out</Button>} />;
  loadSnapshot(q.data.data, q.data.email, q.data.canSeeFinance);
  return <AdminLayout onSignOut={signOut} sampleData={q.data.sampleData} />;
}

function Centered({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-page px-6 text-center">
      <div className="max-w-sm">
        <ShieldX className="mx-auto size-10 text-brass" strokeWidth={1.5} />
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6">{action}</div>
      </div>
    </div>
  );
}

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/production", label: "Production", icon: Factory },
  { to: "/admin/orders", label: "Orders", icon: Briefcase },
  { to: "/admin/employees", label: "Employees", icon: Users },
  { to: "/admin/machines", label: "Machines & Maintenance", icon: Cog },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/finance", label: "Finance", icon: Euro, finance: true },
  { to: "/admin/documents", label: "Documents", icon: FileText },
] as const;

function NavList({ collapsed, onNav }: { collapsed?: boolean; onNav?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const range = Route.useSearch().range;
  return (
    <nav className="space-y-1">
      {NAV.filter((n) => !("finance" in n) || MANAGER.canSeeFinance).map((n) => {
        const active = "exact" in n ? path === n.to || path === "/admin/" : path.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            search={{ range }}
            onClick={onNav}
            title={collapsed ? n.label : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200",
              active ? "border border-gold/50 bg-elevated text-gold" : "border border-transparent text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <n.icon className="size-[18px] shrink-0" />
            {!collapsed && <span className="truncate">{n.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function GlobalSearch({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const { go } = useDrill();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q.toLowerCase()), 150); return () => clearTimeout(t); }, [q]);
  const groups = useMemo(() => {
    if (dq.length < 2) return [];
    const m = (s: string) => s.toLowerCase().includes(dq);
    const cust = (id: string) => db.CUSTOMERS.find((c) => c.id === id)?.name ?? "";
    return [
      { label: "Orders", to: "/admin/orders", items: db.ORDERS.filter((o) => m(o.id) || m(o.title) || m(cust(o.customerId))).slice(0, 6).map((o) => ({ d: `order:${o.id}`, t: `${o.id} · ${o.title}`, s: cust(o.customerId) })) },
      { label: "Customers", to: "/admin/orders", items: db.CUSTOMERS.filter((c) => m(c.name)).slice(0, 4).map((c) => ({ d: `customer:${c.id}`, t: c.name, s: c.city })) },
      { label: "Jobs", to: "/admin/production", items: db.JOBS.filter((j) => j.status !== "completed" && (m(j.id) || m(j.name))).slice(0, 6).map((j) => ({ d: `job:${j.id}`, t: j.name, s: j.id })) },
      { label: "Employees", to: "/admin/employees", items: db.EMPLOYEES.filter((e) => m(e.name) || m(e.id)).map((e) => ({ d: `employee:${e.id}`, t: e.name, s: e.title })) },
      { label: "Machines", to: "/admin/machines", items: db.ADMIN_MACHINES.filter((x) => m(x.name) || m(x.code)).map((x) => ({ d: `machine:${x.code}`, t: x.name, s: x.code })) },
      { label: "Materials", to: "/admin/inventory", items: db.MATERIALS.filter((x) => m(x.name) || m(x.code)).map((x) => ({ d: `material:${x.id}`, t: x.name, s: x.code })) },
      { label: "Documents", to: "/admin/documents", items: db.DOCUMENTS.filter((x) => m(x.title) && (x.classification !== "restricted" || MANAGER.canSeeFinance)).map((x) => ({ d: `doc:${x.id}`, t: x.title, s: x.kind })) },
    ].filter((g) => g.items.length);
  }, [dq]);
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search orders, customers, jobs, machines, materials…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>{dq.length < 2 ? "Type at least 2 characters." : "No matching records."}</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g.label} heading={g.label}>
            {g.items.map((it) => (
              <CommandItem key={it.d} value={`${g.label} ${it.t} ${it.s}`} onSelect={() => { setOpen(false); go(g.to, { d: it.d }); }}>
                <span className="truncate">{it.t}</span><span className="ml-auto text-xs text-muted-foreground">{it.s}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

function AdminLayout({ onSignOut, sampleData }: { onSignOut: () => void; sampleData: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const range = search.range ?? "7";
  const ov = useOverview(range);
  const current = [...NAV].reverse().find((n) => path.startsWith(n.to))?.label ?? "Overview";

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen((o) => !o); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="flex min-h-dvh w-full bg-page">
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border/70 bg-surface/80 p-3 transition-[width] duration-200 lg:flex", collapsed ? "w-[72px]" : "w-64")}>
        <div className={cn("flex h-12 items-center px-2", collapsed && "justify-center px-0")}>{collapsed ? <WamLogo className="[&>span]:hidden" /> : <WamLogo />}</div>
        <div className="bg-walnut my-3 h-1 rounded-full" />
        <NavList collapsed={collapsed} />
        <button onClick={() => setCollapsed((c) => !c)} className="press mt-auto flex h-10 items-center justify-center gap-2 rounded-xl text-xs text-muted-foreground hover:text-foreground" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
        </button>
      </aside>

      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-72 border-border bg-surface p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <WamLogo className="mb-4" />
          <NavList onNav={() => setMobileNav(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-sm">
          <div className="bg-walnut px-4 py-1 text-center text-[11px] font-medium tracking-wide text-gold">{sampleData ? "LOCAL SAMPLE DATA · Connected to the WAM PostgreSQL database" : "Connected to the WAM database"}</div>
          <div className="flex h-16 items-center gap-3 px-4 md:px-6">
            <button className="press grid size-10 place-items-center rounded-xl border border-border lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu className="size-5" /></button>
            <div className="hidden min-w-0 sm:block">
              <div className="text-[10px] tracking-[0.2em] text-brass uppercase">WAM Management</div>
              <div className="truncate text-sm font-semibold">{current}</div>
            </div>
            <button onClick={() => setSearchOpen(true)} className="press ml-auto flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm text-muted-foreground hover:border-brass md:w-72">
              <Search className="size-4 shrink-0" /><span className="hidden truncate md:inline">Search records…</span><kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] md:inline">⌘K</kbd>
            </button>
            <label className="relative flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface pr-1 pl-3 text-sm">
              <Calendar className="size-4 text-brass" />
              <select
                aria-label="Date range"
                value={range}
                onChange={(e) => navigate({ to: ".", search: ((p: AdminSearch) => ({ ...p, range: e.target.value })) as never })}
                className="h-full cursor-pointer appearance-none bg-transparent pr-2 outline-none"
              >
                {RANGES.map((r) => <option key={r.key} value={r.key} className="bg-popover">{r.label}</option>)}
              </select>
            </label>
            <button onClick={() => navigate({ to: "/admin", search: { range } })} className="press relative grid size-10 place-items-center rounded-xl border border-border" aria-label={`${ov.alerts.length} alerts`}>
              <Bell className="size-4" />
              {ov.alerts.length > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-critical text-[10px] font-bold text-destructive-foreground">{ov.alerts.length}</span>}
            </button>
            <div className="hidden items-center gap-2 md:flex">
              <div className="grid size-10 place-items-center rounded-full border border-gold/60 bg-elevated font-display text-xs font-bold text-gold">{MANAGER.name.slice(0, 2).toUpperCase()}</div>
              <div className="max-w-40 text-xs leading-tight"><div className="truncate font-semibold">{MANAGER.name}</div><div className="text-muted-foreground">{MANAGER.role}</div></div>
            </div>
            <button onClick={onSignOut} className="press grid size-10 place-items-center rounded-xl border border-border" aria-label="Sign out" title="Sign out"><LogOut className="size-4" /></button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto max-w-[1440px]"><Outlet /></div>
        </main>
      </div>
      <GlobalSearch open={searchOpen} setOpen={setSearchOpen} />
      <DetailDrawer />
    </div>
  );
}
