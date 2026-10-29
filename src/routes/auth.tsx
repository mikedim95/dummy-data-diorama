import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WamLogo } from "@/components/wam/OperatorLayout";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Manager sign in · WAM" },
      { name: "description", content: "Secure sign-in for WAM managers." },
      { property: "og:title", content: "Manager sign in · WAM" },
      { property: "og:description", content: "Secure sign-in for WAM managers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const safe = (p?: string) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/admin");

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "err" | "ok"; s: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: safe(redirect) as "/admin" }); });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_IN" && s) navigate({ to: safe(redirect) as "/admin" }); });
    return () => sub.subscription.unsubscribe();
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg({ t: "err", s: error.message });
    } else {
      const { error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: `${window.location.origin}/auth` } });
      setMsg(error ? { t: "err", s: error.message } : { t: "ok", s: "Check your email to confirm your account, then sign in." });
    }
    setBusy(false);
  }

  async function google() {
    setMsg(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setMsg({ t: "err", s: r.error.message ?? "Google sign-in failed." });
  }

  return (
    <div className="min-h-dvh bg-page">
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pt-safe pb-safe">
        <div className="pt-6"><WamLogo /></div>
        <div className="flex flex-1 flex-col justify-center">
          <div className="bg-walnut mb-6 h-1.5 w-16 rounded-full" />
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-brass uppercase"><ShieldCheck className="size-3.5" /> Management access</div>
          <h1 className="mt-2 text-3xl font-extrabold">{mode === "in" ? "Manager sign in" : "Create account"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Only accounts granted the manager role can open the dashboard.</p>

          <Button variant="metal" size="xl" className="mt-8 w-full" onClick={google}>Continue with Google</Button>
          <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground"><div className="hairline flex-1" />or<div className="hairline flex-1" /></div>

          <form onSubmit={submit} className="space-y-3">
            <Input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl bg-surface" />
            <Input type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder="Password (min. 8 characters)" value={pw} onChange={(e) => setPw(e.target.value)} className="h-12 rounded-xl bg-surface" />
            {msg && <p role="alert" className={msg.t === "err" ? "text-sm text-critical" : "text-sm text-success"}>{msg.s}</p>}
            <Button type="submit" variant="gold" size="xl" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : <>{mode === "in" ? "Sign in" : "Create account"} <ArrowRight className="size-5" /></>}
            </Button>
          </form>
          <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="mt-4 py-2 text-center text-xs text-muted-foreground hover:text-foreground">
            {mode === "in" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
