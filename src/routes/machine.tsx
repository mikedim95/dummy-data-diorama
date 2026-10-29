import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MapPin, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OperatorLayout } from "@/components/wam/OperatorLayout";
import { MaintenanceReminder } from "@/components/wam/MaintenanceReminder";
import { Eyebrow } from "@/components/wam/bits";
import { maintenanceFor, useWam } from "@/lib/wam/store";
import { meta } from "@/lib/wam/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/machine")({
  head: () => meta("Machine checks", "Pre-start maintenance reminders for your machine."),
  component: MachinePage,
});

function MachineOverview() {
  const { machine } = useWam();
  if (!machine) return null;
  const st: [string, string] = ({ operational: ["Operational", "text-success bg-success"], attention: ["Needs attention", "text-warning bg-warning"], down: ["Out of service", "text-critical bg-critical"] } as Record<string, [string, string]>)[machine.status]!;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="bg-walnut px-4 py-3">
        <Eyebrow className="text-gold">Workstation</Eyebrow>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-wide uppercase">{machine.name}</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 text-xs">
        <div className="col-span-2 flex items-center gap-2">
          <span className={cn("size-2 rounded-full", st[1].split(" ")[1] ?? "")} />
          <span className={cn("font-semibold", st[1].split(" ")[0] ?? "")}>{st[0]}</span>
          <span className="ml-auto font-mono text-muted-foreground">{machine.code}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground"><Cpu className="size-3.5" /> {machine.model}</div>
        <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3.5" /> {machine.location}</div>
      </div>
    </div>
  );
}

function MachinePage() {
  const { machineCode, startChecks, setStartCheck } = useWam();
  const navigate = useNavigate();
  const items = maintenanceFor(machineCode, "start");
  const required = items.filter((i) => i.kind === "required");
  const done = required.filter((i) => startChecks[i.id] === "done").length;
  const sorted = [...items].sort((a, b) => (a.kind === "info" ? 1 : 0) - (b.kind === "info" ? 1 : 0));

  return (
    <OperatorLayout needMachine back={{ to: "/scan", label: "Scan" }}>
      <MachineOverview />
      <div className="mt-6 flex items-end justify-between">
        <div>
          <Eyebrow>Before starting</Eyebrow>
          <h2 className="mt-1 text-lg font-bold">Maintenance reminders</h2>
        </div>
        <span className="font-mono text-sm text-muted-foreground">{done}/{required.length}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="bg-gold-gradient h-full transition-all duration-300" style={{ width: `${required.length ? (done / required.length) * 100 : 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Tap the box once you've physically done each check. Viewing alone doesn't record it.</p>

      <div className="mt-4 space-y-2.5">
        {sorted.map((it, i) => (
          <MaintenanceReminder key={it.id} item={it} index={i} state={startChecks[it.id]} onChange={(v) => setStartCheck(it.id, v)} />
        ))}
      </div>

      <div className="sticky bottom-24 mt-6">
        <Button variant="gold" size="xl" className="w-full" onClick={() => navigate({ to: "/work" })}>
          Continue to Today's Work <ArrowRight className="size-5" />
        </Button>
        {done < required.length && <p className="mt-2 text-center text-[11px] text-muted-foreground">{required.length - done} check{required.length - done > 1 ? "s" : ""} not yet confirmed</p>}
      </div>
    </OperatorLayout>
  );
}
