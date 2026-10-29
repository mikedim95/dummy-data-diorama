import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Clock, Cpu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OperatorLayout } from "@/components/wam/OperatorLayout";
import { Eyebrow, fmtTime, Elapsed } from "@/components/wam/bits";
import { useWam } from "@/lib/wam/store";
import { meta } from "@/lib/wam/meta";

export const Route = createFileRoute("/profile")({
  head: () => meta("Profile", "Operator details and shift actions."),
  component: ProfilePage,
});

function ProfilePage() {
  useLanguage();
  const { operator, machine, shiftStartedAt } = useWam();
  return (
    <OperatorLayout>
      <div className="bg-metal overflow-hidden rounded-2xl border border-border">
        <div className="bg-walnut h-16" />
        <div className="-mt-8 px-4 pb-4">
          <div className="grid size-16 place-items-center rounded-2xl border-2 border-gold bg-elevated font-display text-xl font-bold text-gold">
            {tv(
              operator?.name
                .split(" ")
                .map((n) => n[0])
                .join(""),
            )}
          </div>
          <h1 className="mt-3 text-xl font-bold">{tv(operator?.name)}</h1>
          <p className="text-sm text-muted-foreground">
            {tv(operator?.role)} · <span className="font-mono">{tv(operator?.id)}</span>
          </p>
        </div>
      </div>

      <Eyebrow className="mt-6">{t("Current shift")}</Eyebrow>
      <div className="bg-metal mt-2 space-y-3 rounded-2xl border border-border p-4 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-brass" /> {t("Started")}
          {tv(" ")}
          {tv(shiftStartedAt ? fmtTime(shiftStartedAt) : "—")}
          {tv(
            shiftStartedAt && (
              <span className="ml-auto text-muted-foreground">
                <Elapsed since={shiftStartedAt} />
              </span>
            ),
          )}
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-brass" /> {tv(machine?.name ?? t("No machine scanned"))}
        </div>
        <div className="flex items-center gap-2">
          <BadgeCheck className="size-4 text-success" /> {t("On shift")}
        </div>
      </div>

      <Button asChild variant="gold" size="xl" className="mt-8 w-full">
        <Link to="/shift">
          <LogOut className="size-5" /> {t("Finish Shift")}
        </Link>
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {t("Runs the end-of-shift summary and machine checks.")}
      </p>
    </OperatorLayout>
  );
}
