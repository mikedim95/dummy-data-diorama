import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Wrench } from "lucide-react";
import { OperatorLayout } from "@/components/wam/OperatorLayout";
import { ActiveTaskCard, TaskCard } from "@/components/wam/TaskCard";
import { Eyebrow } from "@/components/wam/bits";
import { useWam } from "@/lib/wam/store";
import { sortTasks } from "@/lib/wam/logic";
import { meta } from "@/lib/wam/meta";

export const Route = createFileRoute("/work")({
  head: () => meta("Today's work", "Your assigned, active and completed jobs for today."),
  component: WorkPage,
});

function WorkPage() {
  const { tasks, machine, operator } = useWam();
  const mine = sortTasks(tasks.filter((t) => t.machine === machine?.code));
  const active = mine.find((t) => t.status === "active" && t.assignee === operator?.id);
  const rest = mine.filter((t) => t !== active);
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const stats = [
    { label: "Assigned", value: mine.length },
    { label: "Active", value: mine.filter((t) => t.status === "active").length },
    { label: "Completed", value: mine.filter((t) => t.status === "completed").length },
  ];

  return (
    <OperatorLayout needMachine>
      <h1 className="text-3xl font-extrabold">Today's Work</h1>
      <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
        <span>{date}</span>
        <Link to="/machine" className="press inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs">
          <Wrench className="size-3.5 text-brass" /> {machine?.name}
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-metal rounded-xl border border-border px-3 py-2.5">
            <div className="font-display text-2xl font-bold tabular-nums">{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {active && machine && (
        <section className="mt-6">
          <ActiveTaskCard task={active} machineName={machine.name} />
        </section>
      )}

      <section className="mt-6">
        <Eyebrow>Work orders</Eyebrow>
        <div className="hairline mt-2 mb-3" />
        {rest.length === 0 && !active ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 size-8" /> No work assigned to this machine today.
          </div>
        ) : (
          <div className="space-y-2.5">{rest.map((t, i) => <TaskCard key={t.id} task={t} index={i} />)}</div>
        )}
      </section>
    </OperatorLayout>
  );
}
