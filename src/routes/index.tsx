import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WamLogo, OfflineBanner } from "@/components/wam/OperatorLayout";
import { Eyebrow } from "@/components/wam/bits";
import { useWam } from "@/lib/wam/store";
import { meta } from "@/lib/wam/meta";

export const Route = createFileRoute("/")({
  head: () => meta("Sign in", "Sign in to the WAM workshop operator dashboard."),
  component: Login,
});

function Login() {
  const { login, operator, hydrated, machineCode } = useWam();
  const navigate = useNavigate();
  const [id, setId] = useState("OP-104");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && operator) navigate({ to: machineCode ? "/work" : "/scan" });
  }, [hydrated, operator, machineCode, navigate]);

  return (
    <div className="min-h-dvh bg-page">
      <OfflineBanner />
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
        <div className="pt-6"><WamLogo /></div>
        <div className="flex flex-1 flex-col justify-center">
          <div className="bg-walnut mb-8 h-1.5 w-16 rounded-full" />
          <Eyebrow>Workshop terminal</Eyebrow>
          <h1 className="mt-2 text-4xl leading-[1.05] font-extrabold">Operator<br />sign in</h1>
          <p className="mt-3 text-sm text-muted-foreground">Use your operator ID and 4-digit PIN.</p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const r = login(id, pin);
              setErr(r);
              if (!r) navigate({ to: "/scan" });
            }}
          >
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Operator ID</span>
              <Input value={id} onChange={(e) => setId(e.target.value)} autoCapitalize="characters" className="mt-1 h-14 rounded-xl bg-surface font-mono text-base tracking-wider" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">PIN</span>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                type="password"
                autoComplete="current-password"
                placeholder="••••"
                className="mt-1 h-14 rounded-xl bg-surface text-center font-mono text-2xl tracking-[0.6em]"
              />
            </label>
            {err && <p role="alert" className="text-sm text-critical">{err}</p>}
            <Button type="submit" variant="gold" size="xl" className="w-full" disabled={pin.length !== 4}>
              Sign in <ArrowRight className="size-5" />
            </Button>
          </form>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" /> Demo: OP-104 or OP-117 · PIN 1234
          </p>
        </div>
      </div>
    </div>
  );
}
