import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock, Cpu, AlertTriangle } from "lucide-react";
import type { Task } from "@/lib/wam/types";
import { Elapsed, Eyebrow, PriorityLabel, StatusBadge } from "./bits";
import { cn } from "@/lib/utils";

export function TaskCard({ task, index = 0 }: { task: Task; index?: number }) {
  return (
    <Link
      to="/task/$id"
      params={{ id: task.id }}
      className={cn(
        "bg-metal press animate-rise flex items-center gap-3 rounded-2xl border p-4",
        task.status === "active" ? "border-gold/70 shadow-gold" : "border-border hover:border-brass/60",
        task.status === "completed" && "opacity-70",
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs tracking-wider text-brass">JOB #{task.job}</span>
          <StatusBadge status={task.status} />
        </div>
        <div className="mt-1 truncate font-display text-base font-semibold">{task.title}</div>
        <div className="truncate text-xs text-muted-foreground">{task.customer}</div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <PriorityLabel p={task.priority} />
          <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {task.estMin} min</span>
          <span>× {task.quantity}</span>
        </div>
        {task.status === "blocked" && task.blockedReason && (
          <div className="mt-2 flex gap-1.5 text-xs text-warning"><AlertTriangle className="size-3.5 shrink-0" /> {task.blockedReason}</div>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function ActiveTaskCard({ task, machineName }: { task: Task; machineName: string }) {
  return (
    <Link
      to="/task/$id"
      params={{ id: task.id }}
      className="press animate-rise relative block overflow-hidden rounded-2xl border border-gold/60 bg-elevated p-4 pl-5 shadow-gold"
    >
      <span className="bg-gold-gradient absolute inset-y-0 left-0 w-1" />
      <div className="flex items-center justify-between">
        <Eyebrow className="flex items-center gap-2 text-gold">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-gold/60" /><span className="relative inline-flex size-2 rounded-full bg-gold" /></span>
          Now working
        </Eyebrow>
        {task.startedAt && <span className="text-sm text-gold"><Elapsed since={task.startedAt} /></span>}
      </div>
      <div className="mt-2 font-display text-lg font-bold leading-tight">
        <span className="font-mono text-sm font-medium text-brass">#{task.job}</span> {task.title}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Cpu className="size-3" /> {machineName}</span>
        <span className="inline-flex items-center gap-1 text-foreground">Open <ChevronRight className="size-4" /></span>
      </div>
    </Link>
  );
}
