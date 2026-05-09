import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Mail, Lock, Loader2, Send, Wand2, Coins, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { claimSignupPass } from "@/lib/passes.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { getRemember, setRemember, markTabSession, clearTabSession } from "@/lib/remember-session";
import logo from "@/assets/logo.jpg";
import { SIGNUP_BONUS_CREDITS } from "@/components/AuthGate";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Join the Syndicate · 0G-PORTAL" },
      { name: "description", content: "Sign in or create your 0G-PORTAL account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const claim = useServerFn(claimSignupPass);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [passToken, setPassToken] = useState<string | null>(null);
  const [remember, setRememberState] = useState<boolean>(true);
  const [signedInDest, setSignedInDest] = useState<string | null>(null);

  useEffect(() => { setRememberState(getRemember()); }, []);

  // Resolve the post-auth destination: AuthGate stashes the originally
  // requested path in sessionStorage; honor it once, then clear.
  const consumeRedirect = (): string => {
    try {
      const t = sessionStorage.getItem("post_auth_redirect");
      if (t && t.startsWith("/") && !t.startsWith("/auth")) {
        sessionStorage.removeItem("post_auth_redirect");
        return t;
      }
    } catch { /* ignore */ }
    return "/profile";
  };
  const peekRedirect = (): string => {
    try {
      const t = sessionStorage.getItem("post_auth_redirect");
      if (t && t.startsWith("/") && !t.startsWith("/auth")) return t;
    } catch { /* ignore */ }
    return "/profile";
  };

  // Capture ?p=TOKEN from QR / quick links and persist across signup confirm
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("p");
    if (t) {
      const upper = t.toUpperCase();
      sessionStorage.setItem("signup_pass_token", upper);
      setPassToken(upper);
      setMode("signup");
    } else {
      const stored = sessionStorage.getItem("signup_pass_token");
      if (stored) setPassToken(stored);
    }
  }, []);

  // Surface a friendly notice when a non-native provider was requested
  // from the welcome prompt (e.g. GitHub, Microsoft, Facebook).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("provider");
    if (!p) return;
    const native = new Set(["google", "apple"]);
    const label = p.charAt(0).toUpperCase() + p.slice(1);
    if (native.has(p)) return;
    toast.message(`${label} sign-in coming soon`, {
      description: "Use Google, Apple, or email — we'll add more providers soon.",
    });
  }, []);

  const tryClaim = async () => {
    const t = sessionStorage.getItem("signup_pass_token");
    if (!t) return;
    try {
      const r = await claim({ data: { token: t } });
      sessionStorage.removeItem("signup_pass_token");
      const bits: string[] = [];
      if (r?.credits) bits.push(`+${r.credits} credits`);
      if (r?.vip_until) bits.push(`VIP until ${new Date(r.vip_until).toLocaleDateString()}`);
      toast.success(`Pass redeemed${bits.length ? ` · ${bits.join(" · ")}` : ""}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pass redeem failed";
      if (!/Already claimed/i.test(msg)) toast.error(msg);
    }
  };

  useEffect(() => {
    if (user) {
      const dest = consumeRedirect();
      // Confirm starting credits when this is the first sign-in after signup.
      try {
        if (sessionStorage.getItem("just_signed_up") === "1") {
          sessionStorage.removeItem("just_signed_up");
          const credits = profile?.credits ?? SIGNUP_BONUS_CREDITS;
          toast.success(`Account created · +${credits} credits in your wallet`, {
            description: "Spend them on any portal — no card needed.",
          });
        }
      } catch { /* ignore */ }
      // Surface the live credit balance on this screen for ~2.2s before
      // redirecting, so members can see what they have to spend.
      setSignedInDest(dest);
      tryClaim().finally(() => {
        const t = setTimeout(() => navigate({ to: dest as never }), 2200);
        return () => clearTimeout(t);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const ref = new URLSearchParams(window.location.search).get("ref") || undefined;
        const dest = peekRedirect();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${dest}`,
            data: ref ? { referred_by_reseller: ref } : undefined,
          },
        });
        if (error) throw error;
        try { sessionStorage.setItem("just_signed_up", "1"); } catch { /* ignore */ }
        toast.success(passToken
          ? `Welcome. Confirm your email — your pass ${passToken} will activate on first sign-in.`
          : `Welcome to the Syndicate. Confirm your inbox — +${SIGNUP_BONUS_CREDITS} credits land on first sign-in.`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setRemember(remember);
        if (remember) markTabSession(); else clearTabSession();
        toast.success("Locked in. Frequency unlocked.");
        // Defer navigation to the signed-in confirmation screen below
        // (rendered via the user/profile effect) so the credit balance
        // is visible before redirect.
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => oauth("google");
  const apple = async () => oauth("apple");

  const oauth = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const dest = peekRedirect();
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}${dest}`,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: consumeRedirect() as never });
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${provider} sign-in failed`;
      toast.error(msg);
      setLoading(false);
    }
  };

  const magicLink = async () => {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    setLoading(true);
    try {
      const dest = peekRedirect();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${dest}` },
      });
      if (error) throw error;
      toast.success("Magic link sent — check your inbox", {
        description: "Tap the link from this device to sign in instantly.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send magic link";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 sm:px-5 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.72_0.22_245_/_0.35),transparent)] animate-pulse-gold" />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
          <img src={logo} alt="0G-PORTAL" className="h-10 w-10 rounded-md ring-1 ring-[oklch(0.72_0.22_245/0.5)]" />
          <span className="font-[Montserrat] font-black text-2xl tracking-tight text-metallic">0G-PORTAL</span>
        </Link>

        {user && signedInDest ? (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-[0_0_60px_-10px_oklch(0.72_0.22_245/0.4)] space-y-5 text-center">
            <header className="space-y-1">
              <h1 className="text-2xl font-bold text-metallic">Welcome back</h1>
              <p className="text-sm text-muted-foreground truncate">
                {user.email}
              </p>
            </header>

            <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-amber-600/5 px-4 py-5 space-y-1">
              <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.3em] text-amber-300/90 font-bold">
                <Coins className="h-3.5 w-3.5" />
                Wallet balance
              </div>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-4xl font-black text-amber-200 tabular-nums">
                  {profile?.credits ?? "—"}
                </span>
                <span className="text-sm font-bold uppercase tracking-widest text-amber-300/80">
                  credits
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Spend them on any portal — no card needed.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => navigate({ to: signedInDest as never })}
              className="btn-glass-blue w-full h-12 text-white font-bold uppercase tracking-[0.25em]"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Redirecting…
            </p>
          </div>
        ) : (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 shadow-[0_0_60px_-10px_oklch(0.72_0.22_245/0.4)] space-y-6">
          <header className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-metallic">Join the Syndicate</h1>
            <p className="text-sm text-muted-foreground">Tune in. The frequency is private.</p>
          </header>

          {passToken && (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-300 text-center">
              <span className="uppercase tracking-widest text-[10px] text-yellow-500">Pass attached</span>
              <p className="mt-1 font-mono">{passToken}</p>
              <p className="text-yellow-400/70 mt-1 text-[11px]">Activates automatically when you sign in.</p>
            </div>
          )}

          {/* PRIMARY: Social sign-in — visual priority */}
          <section
            aria-label="One-tap sign in"
            className="relative rounded-xl border border-[oklch(0.72_0.22_245/0.35)] bg-[oklch(0.72_0.22_245/0.06)] p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/80 font-bold">
                One-tap sign in
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                ⚡ Fastest
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={google}
              className="w-full h-14 text-base font-semibold bg-white text-gray-900 hover:bg-gray-50 border-white/80 shadow-lg shadow-[oklch(0.72_0.22_245/0.25)]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 mr-3" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={apple}
              className="w-full h-14 text-base font-semibold bg-black text-white hover:bg-black/85 border-white/25"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 mr-3" aria-hidden fill="currentColor">
                <path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3.03-.81.86-2.13 1.52-3.21 1.43-.13-1.1.42-2.25 1.16-3.04.83-.88 2.24-1.54 3.26-1.42zM20.5 17.31c-.55 1.27-.81 1.83-1.52 2.95-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.78-4.05-3.34C.01 16.18-.31 11.13 1.5 8.43c1.28-1.92 3.31-3.04 5.21-3.04 1.94 0 3.16 1.06 4.77 1.06 1.56 0 2.51-1.06 4.76-1.06 1.7 0 3.5.93 4.78 2.53-4.21 2.31-3.52 8.32.48 9.39z"/>
              </svg>
              Continue with Apple
            </Button>
          </section>

          <Divider label="or with email" />

          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")} className="w-full space-y-5">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-0">
              <AuthForm
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                loading={loading}
                submit={submit}
                cta="Sign In"
              />
              <Button
                type="button"
                variant="outline"
                disabled={loading || !email}
                onClick={magicLink}
                className="w-full h-12 border-[oklch(0.78_0.18_85/0.5)] hover:bg-[oklch(0.78_0.18_85/0.1)] text-amber-200"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Email me a magic link
              </Button>
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(v) => setRememberState(v === true)}
                  />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 mt-0">
              <AuthForm
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                loading={loading}
                submit={submit}
                cta="Create Account"
              />
              <Button
                type="button"
                variant="outline"
                disabled={loading || !email}
                onClick={magicLink}
                className="w-full h-12 border-[oklch(0.78_0.18_85/0.5)] hover:bg-[oklch(0.78_0.18_85/0.1)] text-amber-200"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Or email me a magic link
              </Button>
            </TabsContent>
          </Tabs>

          <Divider label="other ways" />

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              const start = passToken ? `?start=${encodeURIComponent(passToken)}` : "";
              window.open(`https://t.me/og_portal${start}`, "_blank");
            }}
            className="w-full h-12 border-sky-500/40 hover:bg-sky-500/10"
          >
            <Send className="h-4 w-4 mr-2 text-sky-400" />
            Continue in Telegram
          </Button>
        </div>
        )}
      </div>
    </main>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function AuthForm(props: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
  submit: (e: FormEvent) => void;
  cta: string;
}) {
  const { email, setEmail, password, setPassword, loading, submit, cta } = props;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="email" className="text-xs uppercase tracking-widest">Email</Label>
        <div className="relative mt-1.5">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@frequency.com"
            className="pl-10 h-11"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="password" className="text-xs uppercase tracking-widest">Password</Label>
        <div className="relative mt-1.5">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pl-10 h-11"
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="btn-glass-blue w-full h-11 text-white font-bold uppercase tracking-[0.25em]">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : cta}
      </Button>
    </form>
  );
}