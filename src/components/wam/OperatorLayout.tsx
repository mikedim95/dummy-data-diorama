import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Briefcase, QrCode, User, WifiOff, ChevronLeft } from "lucide-react";
import { useWam } from "@/lib/wam/store";
import { cn } from "@/lib/utils";

export function WamLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="grid size-8 place-items-center rounded-lg bg-walnut ring-1 ring-brass/60">
        <span className="font-display text-xs font-black tracking-tighter text-gold">W</span>
      </div>
      <span className="font-display text-sm font-extrabold tracking-[0.25em] text-foreground">WAM</span>
    </div>
  );
}

export function OfflineBanner() {
  const { online } = useWam();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-xs font-medium text-warning">
      <WifiOff className="size-3.5" /> Offline — changes are saved on this device
    </div>
  );
}

/** Redirects to login if no operator; to scan if a machine is required and missing. */
function useGuard(needMachine: boolean) {
  const { hydrated, operator, machineCode } = useWam();
  const navigate = useNavigate();
  useEffect(() => {
    if (!hydrated) return;
    if (!operator) navigate({ to: "/" });
    else if (needMachine && !machineCode) navigate({ to: "/scan" });
  }, [hydrated, operator, machineCode, needMachine, navigate]);
  return hydrated && !!operator && (!needMachine || !!machineCode);
}

export function OperatorLayout({
  children,
  needMachine = false,
  nav = true,
  back,
  title,
}: {
  children: ReactNode;
  needMachine?: boolean;
  nav?: boolean;
  back?: { to: "/work" | "/scan" | "/profile" | "/machine"; label?: string };
  title?: string;
}) {
  const ok = useGuard(needMachine);
  const { operator, shiftStartedAt } = useWam();
  const date = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="min-h-dvh bg-page">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 pt-safe backdrop-blur-sm">
          <OfflineBanner />
          <div className="flex h-14 items-center justify-between px-4">
            {back ? (
              <Link to={back.to} className="press -ml-2 flex h-11 items-center gap-1 rounded-xl pr-3 pl-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronLeft className="size-5" /> {back.label ?? "Back"}
              </Link>
            ) : (
              <WamLogo />
            )}
            {title && <span className="font-display text-sm font-semibold">{title}</span>}
            {operator && (
              <Link to="/profile" className="press flex items-center gap-2 rounded-xl py-1 pl-2" aria-label="Profile">
                <div className="text-right leading-tight">
                  <div className="text-xs font-semibold">{operator.name.split(" ")[0]}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {date} · {shiftStartedAt ? <span className="text-success">On shift</span> : "Off shift"}
                  </div>
                </div>
                <div className="grid size-9 place-items-center rounded-full border border-brass/50 bg-elevated">
                  <User className="size-4 text-gold" />
                </div>
              </Link>
            )}
          </div>
        </header>
        <main className={cn("flex-1 px-4 pt-5", nav ? "pb-28" : "pb-8")}>{ok ? children : null}</main>
        {nav && ok && <BottomNavigation />}
      </div>
    </div>
  );
}

export function BottomNavigation() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/work" as const, label: "Work", icon: Briefcase, match: ["/work", "/task"] },
    { to: "/scan" as const, label: "Scan", icon: QrCode, match: ["/scan", "/machine"] },
    { to: "/profile" as const, label: "Profile", icon: User, match: ["/profile", "/shift"] },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-surface/95 pb-safe backdrop-blur-sm">
      <div className="mx-auto grid max-w-md grid-cols-3 px-2 pt-1.5">
        {items.map((it) => {
          const active = it.match.some((m) => path.startsWith(m));
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "press flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium",
                active ? "text-gold" : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <it.icon className="size-5" />
              {it.label}
              <span className={cn("h-0.5 w-5 rounded-full transition-all duration-200", active ? "bg-gold" : "bg-transparent")} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
