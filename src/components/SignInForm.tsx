import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WamLogo } from "@/components/wam/OperatorLayout";
import { wamRequest } from "@/lib/wam/client-api";
import { translate as t, useLanguage } from "@/lib/i18n";

type Session = {
  destination: "/admin" | "/scan" | "/work";
  session?: { access_token: string; refresh_token: string };
};
function enter(session: Session) {
  if (!["/admin", "/scan", "/work"].includes(session.destination))
    throw new Error("Your account does not have access to a workspace.");
  window.location.replace(session.destination);
}
export function SignInForm() {
  useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void wamRequest<Session>("session")
      .then((session) => {
        if (active) enter(session);
      })
      .catch((failure: Error & { status?: number }) => {
        if (active && failure.status !== 401) setError(failure.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center bg-page px-6 py-8">
      <form
        className="w-full max-w-sm space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || checking) return;
          setBusy(true);
          setError(null);
          try {
            const result = await wamRequest<Session>("login", { email: email.trim(), password });
            if (result.session) {
              const { supabase } = await import("@/integrations/supabase/client");
              const saved = await supabase.auth.setSession(result.session);
              if (saved.error) throw saved.error;
            }
            enter(result);
          } catch (failure) {
            setError((failure as Error).message);
            setBusy(false);
          }
        }}
      >
        <WamLogo />
        <h1 className="text-3xl font-extrabold">{t("Sign in")}</h1>
        <label className="block text-sm">
          {t("Email")}
          <Input
            type="email"
            name="email"
            aria-label={t("Email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            maxLength={255}
            disabled={busy || checking}
            className="mt-2 h-12"
          />
        </label>
        <label className="block text-sm">
          {t("Password")}
          <Input
            type="password"
            name="password"
            aria-label={t("Password")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            maxLength={200}
            disabled={busy || checking}
            className="mt-2 h-12"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-critical">
            {t(error)}
          </p>
        )}
        <Button
          type="submit"
          variant="gold"
          size="xl"
          className="w-full"
          disabled={busy || checking}
        >
          {busy || checking ? (
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          ) : (
            <ArrowRight aria-hidden="true" className="size-5" />
          )}
          {busy ? t("Signing in…") : t("Sign in")}
        </Button>
      </form>
    </div>
  );
}
