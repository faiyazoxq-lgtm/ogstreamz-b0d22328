import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, User as UserIcon, Loader2, Send, X, Sparkles, Github, Facebook } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Checkbox } from "@/components/ui/checkbox";
import { getRemember, setRemember, markTabSession, clearTabSession } from "@/lib/remember-session";

const DISMISS_KEY = "welcome_auth_dismissed_at";
const DISMISS_TTL_REMEMBER_MS = 1000 * 60 * 60 * 24 * 30; // 30d
const DISMISS_TTL_TAB_MS = 1000 * 60 * 60 * 12; // 12h

export function WelcomeAuthPrompt() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRememberState] = useState<boolean>(true);

  useEffect(() => { setRememberState(getRemember()); }, []);

  useEffect(() => {
    if (authLoading || user) return;
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const ttl = getRemember() ? DISMISS_TTL_REMEMBER_MS : DISMISS_TTL_TAB_MS;
    if (Date.now() - at > ttl) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [user, authLoading]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/profile`,
            data: name ? { display_name: name, full_name: name } : undefined,
          },
        });
        if (error) throw error;
        toast.success("Check your inbox to verify your email.");
        setOpen(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setRemember(remember);
        if (remember) markTabSession(); else clearTabSession();
        toast.success("Welcome back.");
        setOpen(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/profile`,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${provider} sign-in failed`);
      setBusy(false);
    }
  };

  if (user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-[oklch(0.72_0.22_245/0.4)] bg-card">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="relative px-6 pt-7 pb-6">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-64 w-72 rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.72_0.22_245/0.35),transparent)]" />
          </div>

          <div className="text-center mb-5">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Tune in</p>
            <h2 className="mt-1 font-[Montserrat] font-black text-2xl text-metallic">Join the Syndicate</h2>
            <p className="text-xs text-muted-foreground mt-1">Sign in to unlock all portals.</p>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => oauth("google")}
              className="w-full h-10 border-[oklch(0.72_0.22_245/0.4)] hover:bg-[oklch(0.72_0.22_245/0.1)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" aria-hidden>
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
              disabled={busy}
              onClick={() => oauth("apple")}
              className="w-full h-10 bg-black text-white hover:bg-black/85 border-white/20"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" aria-hidden fill="currentColor">
                <path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3.03-.81.86-2.13 1.52-3.21 1.43-.13-1.1.42-2.25 1.16-3.04.83-.88 2.24-1.54 3.26-1.42zM20.5 17.31c-.55 1.27-.81 1.83-1.52 2.95-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.78-4.05-3.34C.01 16.18-.31 11.13 1.5 8.43c1.28-1.92 3.31-3.04 5.21-3.04 1.94 0 3.16 1.06 4.77 1.06 1.56 0 2.51-1.06 4.76-1.06 1.7 0 3.5.93 4.78 2.53-4.21 2.31-3.52 8.32.48 9.39z"/>
              </svg>
              Continue with Apple
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => window.open("https://t.me/og_portal", "_blank")}
              className="w-full h-10 border-sky-500/40 hover:bg-sky-500/10"
            >
              <Send className="h-4 w-4 mr-2 text-sky-400" />
              Continue in Telegram
            </Button>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">or email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="login">Login</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="wp-name" className="text-[10px] uppercase tracking-widest">Name</Label>
                  <div className="relative mt-1">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="wp-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      placeholder="Your name"
                      className="pl-10 h-10"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="wp-email" className="text-[10px] uppercase tracking-widest">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="wp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@frequency.com"
                    className="pl-10 h-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="wp-password" className="text-[10px] uppercase tracking-widest">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="wp-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 h-10"
                  />
                </div>
                {mode === "signup" && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> We'll send a verification email.
                  </p>
                )}
              </div>
              <Button type="submit" disabled={busy} className="btn-glass-blue w-full h-10 text-white font-bold uppercase tracking-[0.25em]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create Account" : "Sign In"}
              </Button>
              {mode === "login" && (
                <div className="flex items-center justify-between text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(v) => setRememberState(v === true)}
                    />
                    Remember me
                  </label>
                  <Link
                    to="/forgot-password"
                    onClick={() => setOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
            </form>
          </Tabs>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Prefer the full page?{" "}
            <Link to="/auth" className="text-[oklch(0.72_0.22_245)] underline-offset-2 hover:underline" onClick={() => setOpen(false)}>
              Open sign-in
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}