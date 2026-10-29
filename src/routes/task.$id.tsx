import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, MessageSquare, Camera, Send, Hand, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { OperatorLayout } from "@/components/wam/OperatorLayout";
import { PhotoUploader } from "@/components/wam/PhotoUploader";
import { Elapsed, Eyebrow, PriorityLabel, StatusBadge, fmtTime } from "@/components/wam/bits";
import { useWam } from "@/lib/wam/store";
import { meta } from "@/lib/wam/meta";
import type { Activity } from "@/lib/wam/types";
import { wamPhoto } from "@/lib/wam/client-api";

export const Route = createFileRoute("/task/$id")({
  head: () => meta("Task details", "Job details, instructions and progress."),
  component: TaskPage,
});

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function TaskPhoto({ path }: { path: string }) {
  const [source, setSource] = useState<string>();
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    if (!path.startsWith("/api/wam/files/")) { setSource(path); return; }
    void wamPhoto(path).then((blob) => {
      if (active) { url = URL.createObjectURL(blob); setSource(url); }
    }).catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [path]);
  return source ? <img src={source} alt="Task photo" className="size-16 rounded-lg border border-border object-cover" /> : <span className="grid size-16 place-items-center rounded-lg border border-border text-xs text-muted-foreground">Photo</span>;
}

function TaskActivity({ items }: { items: Activity[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {[...items].reverse().map((a) => (
        <li key={a.id} className="animate-rise relative">
          <span className={`absolute top-1.5 -left-[21px] size-2.5 rounded-full ${a.type === "status" ? "bg-gold" : "bg-muted-foreground"}`} />
          <div className="text-[11px] text-muted-foreground">{fmtTime(a.at)} · {a.by}</div>
          {a.text && <div className="text-sm">{a.text}</div>}
          {a.photos && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {a.photos.map((p, i) => <TaskPhoto key={i} path={p} />)}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function TaskPage() {
  const { id } = Route.useParams();
  const { tasks, machine, operator, acceptTask, addActivity, completeTask } = useWam();
  const navigate = useNavigate();
  const task = tasks.find((t) => t.id === id);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "comment" | "photo" | "finish">(null);
  const draftKey = `wam-draft-${id}`;
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  // Preserve comment drafts across refresh / connectivity loss.
  useEffect(() => setText(localStorage.getItem(draftKey) ?? ""), [draftKey]);
  useEffect(() => {
    if (text) localStorage.setItem(draftKey, text);
    else localStorage.removeItem(draftKey);
  }, [text, draftKey]);

  if (!task) {
    return <OperatorLayout back={{ to: "/work" }}><p className="text-muted-foreground">This task no longer exists.</p></OperatorLayout>;
  }
  const mineActive = task.status === "active" && task.assignee === operator?.id;
  const reset = () => { setText(""); setPhotos([]); setSheet(null); };

  return (
    <OperatorLayout needMachine back={{ to: "/work", label: "Today's work" }} nav={false}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm tracking-wider text-brass">JOB #{task.job}</span>
        <StatusBadge status={task.status} />
      </div>
      <h1 className="mt-1 text-2xl font-extrabold">{task.title}</h1>
      <p className="text-sm text-muted-foreground">{task.customer}</p>

      {mineActive && task.startedAt && (
        <div className="animate-rise mt-4 flex items-center justify-between rounded-xl border border-gold/50 bg-elevated px-4 py-3">
          <span className="text-xs text-muted-foreground">In progress since {fmtTime(task.startedAt)}</span>
          <span className="text-lg text-gold"><Elapsed since={task.startedAt} /></span>
        </div>
      )}
      {task.status === "blocked" && <div className="mt-4 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm text-warning">{task.blockedReason}</div>}

      <section className="bg-metal mt-5 divide-y divide-border/60 rounded-2xl border border-border px-4">
        <Row k="Machine" v={machine?.name} />
        <Row k="Material" v={task.material} />
        <Row k="Quantity" v={task.quantity} />
        <Row k="Priority" v={<PriorityLabel p={task.priority} />} />
        <Row k="Est. duration" v={`${task.estMin} min`} />
        <Row k="Template" v={<span className="font-mono text-xs">{task.template}</span>} />
        <Row k="Order stage" v={<span className="inline-flex items-center gap-1"><Layers className="size-3.5 text-brass" />{task.orderStage}</span>} />
      </section>

      <section className="mt-5">
        <Eyebrow>Instructions</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed">{task.instructions}</p>
      </section>

      <section className="mt-5">
        <Eyebrow>Reference files</Eyebrow>
        <div className="mt-2 space-y-2">
          {task.files.map((f) => (
            <div key={f} className="flex h-12 items-center gap-3 rounded-xl border border-border bg-surface px-3 text-sm">
              <FileText className="size-4 text-brass" /> <span className="truncate font-mono text-xs">{f}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <Eyebrow>Activity</Eyebrow>
        <div className="mt-3"><TaskActivity items={task.activity} /></div>
      </section>

      <div className="h-40" />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-safe backdrop-blur-sm">
        <div className="mx-auto max-w-md px-4 pt-3">
          {task.status === "pending" && (
            <Button
              variant="gold"
              size="xl"
              className="w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const err = await acceptTask(task.id);
                setBusy(false);
                if (err) toast.error(err);
                else { toast.success(`Job #${task.job} is now active`); navigate({ to: "/work" }); }
              }}
            >
              <Hand className="size-5" /> Accept Task
            </Button>
          )}
          {mineActive && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="metal" size="xl" onClick={() => setSheet("comment")}><MessageSquare className="size-5" /> Comment</Button>
                <Button variant="metal" size="xl" onClick={() => setSheet("photo")}><Camera className="size-5" /> Photo</Button>
              </div>
              <Button variant="success" size="xl" className="w-full" onClick={() => setSheet("finish")}><CheckCircle2 className="size-5" /> Mark as Finished</Button>
            </div>
          )}
          {task.status === "active" && !mineActive && <p className="py-3 text-center text-sm text-muted-foreground">Claimed by another operator.</p>}
          {task.status === "completed" && <p className="py-3 text-center text-sm text-success">Finished at {task.completedAt && fmtTime(task.completedAt)}</p>}
          {task.status === "blocked" && <p className="py-3 text-center text-sm text-warning">Can't be started yet.</p>}
        </div>
      </div>

      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl border-border bg-surface pb-safe">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">
              {sheet === "comment" ? "Add comment" : sheet === "photo" ? "Add photos" : "Finish this stage?"}
            </SheetTitle>
            <SheetDescription>
              {sheet === "finish" ? `Marks your ${task.orderStage.split("·")[1]?.trim().toLowerCase() ?? ""} stage as done. The customer order continues to its next stage.` : `Job #${task.job} · ${task.title}`}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            {(sheet === "comment" || sheet === "finish") && (
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={sheet === "finish" ? "Final note (optional)" : "What should the team know?"} className="min-h-24 rounded-xl bg-background text-base" />
            )}
            {(sheet === "photo" || sheet === "finish") && <PhotoUploader photos={photos} onChange={setPhotos} />}
            <Button
              variant={sheet === "finish" ? "success" : "gold"}
              size="xl"
              className="w-full"
              disabled={busy || (sheet === "comment" && !text.trim()) || (sheet === "photo" && !photos.length)}
              onClick={async () => {
                setBusy(true);
                try {
                if (sheet === "finish") {
                  await completeTask(task.id, text, photos);
                  toast.success(`Job #${task.job} stage completed`);
                  reset();
                  setBusy(false);
                  navigate({ to: "/work" });
                  return;
                }
                await addActivity(task.id, sheet === "photo" ? { type: "photo", photos } : { type: "comment", text: text.trim() });
                toast.success(sheet === "photo" ? "Photos attached" : "Comment saved");
                reset();
                } catch (error) { toast.error((error as Error).message); }
                setBusy(false);
              }}
            >
              {sheet === "finish" ? <><CheckCircle2 className="size-5" /> Confirm finished</> : <><Send className="size-5" /> Save</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </OperatorLayout>
  );
}
