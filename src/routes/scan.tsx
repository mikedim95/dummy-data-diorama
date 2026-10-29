import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { QrCode, Keyboard, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperatorLayout } from "@/components/wam/OperatorLayout";
import { QRScanner } from "@/components/wam/QRScanner";
import { Eyebrow } from "@/components/wam/bits";
import { useWam } from "@/lib/wam/store";
import { meta } from "@/lib/wam/meta";

export const Route = createFileRoute("/scan")({
  head: () => meta("Scan machine", "Scan your workstation QR code to see today's assignments."),
  component: ScanPage,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function ScanPage() {
  useLanguage();
  const { operator, lookupMachine, selectMachine, machine, machines } = useWam();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const resolve = useCallback(
    async (text: string) => {
      const m = lookupMachine(text);
      if (!m) {
        setErr(`"${text.slice(0, 40)}" is not a registered WAM machine.`);
        setScanning(false);
        return;
      }
      try {
        await selectMachine(m.code);
      } catch (error) {
        setErr((error as Error).message);
        return;
      }
      toast.success(t("{0} identified", m.name));
      navigate({ to: "/machine" });
    },
    [lookupMachine, selectMachine, navigate],
  );
  const onCamErr = useCallback(() => setManual(true), []);

  return (
    <OperatorLayout>
      <Eyebrow>
        {t(greeting())}, {tv(operator?.name.split(" ")[0])}
      </Eyebrow>
      <h1 className="mt-2 text-3xl font-extrabold">{t("Ready to start?")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("Scan your workstation to view today's assignments.")}
      </p>

      <div className="mt-8">
        {tv(
          scanning ? (
            <div className="animate-rise space-y-4">
              <QRScanner onResult={resolve} onError={onCamErr} />
              <p className="text-center text-xs text-muted-foreground">
                {t("Align the QR code on the machine plate within the frame")}
              </p>
              <Button
                variant="metal"
                size="xl"
                className="w-full"
                onClick={() => setScanning(false)}
              >
                <X className="size-5" /> {t("Cancel")}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => {
                setErr(null);
                setScanning(true);
              }}
              className="bg-metal press group relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-gold/50"
            >
              <span className="bg-walnut absolute inset-x-0 top-0 h-2" />
              <span className="bg-gold-gradient grid size-24 place-items-center rounded-3xl shadow-gold transition-transform duration-200 group-hover:scale-105">
                <QrCode className="size-12 text-gold-foreground" strokeWidth={1.5} />
              </span>
              <span className="font-display text-xl font-bold">{t("Scan Machine QR")}</span>
              <span className="text-xs text-muted-foreground">{t("Opens your camera")}</span>
            </button>
          ),
        )}
      </div>

      {tv(
        err && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-critical/40 bg-critical/10 p-3 text-sm text-critical"
          >
            {tv(err)}
          </p>
        ),
      )}

      <div className="mt-6">
        {tv(
          !manual ? (
            <button
              onClick={() => setManual(true)}
              className="press mx-auto flex h-11 items-center gap-2 rounded-xl px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              <Keyboard className="size-4" /> {t("Enter machine code manually")}
            </button>
          ) : (
            <form
              className="animate-rise space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) resolve(code);
              }}
            >
              <label className="text-xs font-medium text-muted-foreground" htmlFor="code">
                {t("Machine code (on the plate below the QR)")}
              </label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("WAM-CNC-01")}
                  autoCapitalize="characters"
                  className="h-12 rounded-xl bg-surface font-mono tracking-wider uppercase"
                />
                <Button
                  type="submit"
                  variant="gold"
                  className="h-12 w-12 rounded-xl"
                  aria-label={t("Continue")}
                >
                  <ArrowRight className="size-5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tv(
                  machines.map((m) => (
                    <button
                      type="button"
                      key={m.code}
                      onClick={() => setCode(m.code)}
                      className="press h-9 rounded-lg border border-border px-3 font-mono text-xs text-muted-foreground"
                    >
                      {tv(m.code)}
                    </button>
                  )),
                )}
              </div>
            </form>
          ),
        )}
      </div>

      {tv(
        machine && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            {t("Currently on")} <span className="text-foreground">{tv(machine.name)}</span>
          </p>
        ),
      )}
    </OperatorLayout>
  );
}
