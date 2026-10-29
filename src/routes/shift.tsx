import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, CheckCircle2, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OperatorLayout, WamLogo } from "@/components/wam/OperatorLayout";
import { MaintenanceReminder } from "@/components/wam/MaintenanceReminder";
import { Eyebrow, StatusBadge } from "@/components/wam/bits";
import { useMaintenanceFor, useWam } from "@/lib/wam/store";
import { canFinishShift } from "@/lib/wam/logic";
import { meta } from "@/lib/wam/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shift")({
  head: () => meta("Finish shift", "Shift summary, end-of-shift machine checks and sign out."),
  component: ShiftPage,
});

function ShiftPage() {
  useLanguage();
  const { tasks, machine, machineCode, operator, endChecks, setEndCheck, finishShift } = useWam();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState(false);

  const mine = tasks.filter((t) => t.machine === machineCode);
  const completed = mine.filter((t) => t.status === "completed");
  const active = mine.filter((t) => t.status === "active" && t.assignee === operator?.id);
  const items = useMaintenanceFor(machineCode, "end");
  const ready = canFinishShift(items, endChecks, active.length > 0, note);
  const skipped = items.some((i) => endChecks[i.id] === "skipped");

  if (doneMsg) {
    return (
      <div className="grid min-h-dvh place-items-center bg-page px-6 text-center">
        <div className="animate-rise">
          <WamLogo className="justify-center" />
          <CheckCircle2 className="mx-auto mt-10 size-12 text-success" strokeWidth={1.5} />
          <h1 className="mt-4 text-2xl font-bold">{t("Shift completed.")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("Your work has been recorded.")}</p>
          <Button variant="metal" size="xl" className="mt-8" onClick={() => navigate({ to: "/" })}>
            {t("Back to sign in")}
          </Button>
        </div>
      </div>
    );
  }

  const steps = ["Summary", "Machine checks", "Finish"];
  return (
    <OperatorLayout needMachine nav={false} back={{ to: "/profile", label: "Cancel" }}>
      <ol className="mb-6 flex gap-2">
        {tv(
          steps.map((s, i) => (
            <li key={s} className="flex-1">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors duration-200",
                  i <= step ? "bg-gold" : "bg-muted",
                )}
              />
              <div
                className={cn(
                  "mt-1.5 text-[11px]",
                  i === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {tv(s)}
              </div>
            </li>
          )),
        )}
      </ol>

      {tv(
        step === 0 && (
          <div className="animate-rise">
            <h1 className="text-2xl font-extrabold">{t("Shift summary")}</h1>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="bg-metal rounded-xl border border-border p-3">
                <div className="font-display text-3xl font-bold text-success">
                  {tv(completed.length)}
                </div>
                <div className="text-xs text-muted-foreground">{t("Completed")}</div>
              </div>
              <div className="bg-metal rounded-xl border border-border p-3">
                <div
                  className={cn("font-display text-3xl font-bold", active.length && "text-warning")}
                >
                  {tv(active.length)}
                </div>
                <div className="text-xs text-muted-foreground">{t("Still active")}</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("Machine:")} <span className="text-foreground">{tv(machine?.name)}</span>
            </p>
            <div className="mt-4 space-y-2">
              {tv(
                [...active, ...completed].map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                  >
                    <span className="truncate">
                      <span className="font-mono text-xs text-brass">#{tv(t.job)}</span>{" "}
                      {tv(t.title)}
                    </span>
                    <StatusBadge status={t.status} />
                  </div>
                )),
              )}
            </div>
            {tv(
              active.length > 0 && (
                <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  {t("You have unfinished work. You'll add a handover note in the last step.")}
                </p>
              ),
            )}
            <Button variant="gold" size="xl" className="mt-8 w-full" onClick={() => setStep(1)}>
              {t("Continue")} <ArrowRight className="size-5" />
            </Button>
          </div>
        ),
      )}

      {tv(
        step === 1 && (
          <div className="animate-rise">
            <Eyebrow>{tv(machine?.name)}</Eyebrow>
            <h1 className="mt-1 text-2xl font-extrabold">{t("Before you leave")}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Tick each required check. Open a check to skip it if it can't be done.")}
            </p>
            <div className="mt-4 space-y-2.5">
              {tv(
                items.map((it, i) => (
                  <MaintenanceReminder
                    key={it.id}
                    item={it}
                    index={i}
                    allowSkip
                    state={endChecks[it.id]}
                    onChange={(v) => setEndCheck(it.id, v)}
                  />
                )),
              )}
            </div>
            <Button
              variant="gold"
              size="xl"
              className="mt-8 w-full"
              disabled={!items.filter((i) => i.kind === "required").every((i) => endChecks[i.id])}
              onClick={() => setStep(2)}
            >
              {t("Continue")} <ArrowRight className="size-5" />
            </Button>
          </div>
        ),
      )}

      {tv(
        step === 2 && (
          <div className="animate-rise">
            <h1 className="text-2xl font-extrabold">{t("Finish shift")}</h1>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex gap-2">
                <Check className="size-4 text-success" /> {tv(completed.length)}
                {tv(" ")}
                {t("task stage(s) completed")}
              </li>
              <li className="flex gap-2">
                <Check className="size-4 text-success" /> {t("End-of-shift checks answered")}
                {tv(skipped && t(" (some skipped)"))}
              </li>
            </ul>
            {tv(
              (active.length > 0 || skipped) && (
                <label className="mt-5 block">
                  <span className="text-sm font-medium">
                    {t("Handover note")} <span className="text-critical">*</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {tv(
                      active.length
                        ? t("Describe where you left the active job")
                        : t("Explain the skipped checks"),
                    )}
                    .
                  </span>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-2 min-h-24 rounded-xl bg-surface text-base"
                  />
                </label>
              ),
            )}
            {tv(
              err && (
                <p role="alert" className="mt-4 text-sm text-critical">
                  {tv(err)}
                </p>
              ),
            )}
            <Button
              variant="gold"
              size="xl"
              className="mt-8 w-full"
              disabled={!ready || busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await finishShift(note);
                  setDoneMsg(true);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Couldn't record shift. Try again.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {tv(
                busy ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />,
              )}
              {tv(" ")}
              {t("Finish Shift & Logout")}
            </Button>
          </div>
        ),
      )}
    </OperatorLayout>
  );
}
