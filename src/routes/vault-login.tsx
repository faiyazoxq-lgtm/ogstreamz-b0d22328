import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, Flame, Crown, Mail, KeyRound, Loader2, Wand2, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { isVipProfile } from "@/lib/roles";
import { OgWordmark } from "@/components/OgWordmark";

export const Route = createFileRoute("/vault-login")({
  head: () => ({
    meta: [
      { title: "0G-VAULT Login · VIP Pass" },
      { name: "description", content: "Vault-style sign-in for VIP Pass holders. Continue with Google, Apple, or email." },
    ],
  }),
  component: VaultLoginPage,
});

function VaultLoginPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const isVip = isVipProfile(profile, { isAdmin });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    // Brief vault-unlock animation flair on load
    const t = setTimeout(() => setUnlocking(true), 250);
    return () => clearTimeout(t);
  }, []);

  // VIPs (and admins) should land directly in the VIP Vault when they tap
  // "Enter Vault" — sending them to /dashboard hides the vault behind an
  // extra hop and feels like the button does nothing (esp. inside the
  // Telegram in-app browser). Non-VIPs still go to /dashboard.
  const dest = isVip ? "/vip" : "/dashboard";

  const oauth = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const r = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}${dest}`,
      });
      if (r.error) throw r.error;
      if (r.redirected) return;
      navigate({ to: dest as never });
    } catch (e: any) {
      toast.error(e?.message ?? `${provider} sign-in failed`);
      setLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password required"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Vault unlocked");
      navigate({ to: dest as never });
    } catch (e: any) {
      toast.error(e?.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const magicLink = async () => {
    if (!email) { toast.error("Enter your email first"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${dest}` },
      });
      if (error) throw error;
      toast.success("Magic key sent — check your inbox");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send magic link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden flex items-center justify-center px-4 py-12">
      {/* Vault background: blue flames + sparks */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.20),transparent_60%),linear-gradient(180deg,#02060f_0%,#000_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-3/4 opacity-70 bg-[radial-gradient(ellipse_at_bottom,rgba(56,189,248,0.45),transparent_60%)] animate-pulse" />
        <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(0deg,rgba(56,189,248,0.12)_0_1px,transparent_1px_4px)]" />
        {/* Embers */}
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute block h-1 w-1 rounded-full bg-cyan-300/80 shadow-[0_0_8px_rgba(56,189,248,0.9)]"
            style={{
              left: `${(i * 53) % 100}%`,
              bottom: `-${(i * 7) % 30}px`,
              animation: `ember 4.${i % 9}s linear ${(i % 5) * 0.4}s infinite`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes ember {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          15% { opacity: 0.9; }
          100% { transform: translateY(-110vh) scale(0.4); opacity: 0; }
        }
        @keyframes vault-open {
          0% { transform: rotate(0deg); }
          60% { transform: rotate(220deg); }
          100% { transform: rotate(200deg); }
        }
      `}</style>

      <div className="relative w-full max-w-md">
        {/* Vault frame */}
        <div className="relative rounded-3xl border-2 border-cyan-300/40 bg-gradient-to-b from-[#0b1424] via-[#06101e] to-[#020611] p-1 shadow-[0_0_120px_-10px_rgba(56,189,248,0.6)]">
          {/* Rivets */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl">
            {[
              "top-2 left-2","top-2 right-2","bottom-2 left-2","bottom-2 right-2",
              "top-2 left-1/2 -translate-x-1/2","bottom-2 left-1/2 -translate-x-1/2",
              "top-1/2 left-2 -translate-y-1/2","top-1/2 right-2 -translate-y-1/2",
            ].map((cls, i) => (
              <span key={i} className={`absolute ${cls} h-2 w-2 rounded-full bg-slate-300/80 shadow-[inset_0_-1px_0_rgba(0,0,0,0.5),0_0_6px_rgba(125,211,252,0.6)]`} />
            ))}
          </div>

          <div className="rounded-[20px] border border-cyan-200/15 bg-black/60 p-6 sm:p-8 backdrop-blur-sm">
            {/* Vault wheel */}
            <div className="flex flex-col items-center text-center">
              <div className="relative h-20 w-20 rounded-full border-4 border-cyan-300/60 bg-gradient-to-br from-slate-700 to-slate-900 shadow-[0_0_40px_rgba(56,189,248,0.6)] flex items-center justify-center">
                <div
                  className="absolute inset-2 rounded-full border-2 border-cyan-200/40"
                  style={unlocking ? { animation: "vault-open 1.2s cubic-bezier(.7,.1,.3,1) forwards" } : undefined}
                />
                <Lock className="h-7 w-7 text-cyan-200" />
                <Flame className="absolute -top-3 -right-3 h-5 w-5 text-cyan-300 animate-pulse" />
              </div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.35em] font-bold text-cyan-200">
                <Crown className="h-3 w-3" /> VIP Pass · Vault Login
              </div>
              <h1 className="mt-3 text-3xl sm:text-4xl tracking-tight">
                <OgWordmark suffix="-VAULT" />
              </h1>
              <p className="mt-1 text-xs uppercase tracking-[0.3em] text-cyan-200/70">
                All your apps. One vault.
              </p>
            </div>

            {/* Already signed in */}
            {user && (
              <div className="mt-5 rounded-lg border border-cyan-300/30 bg-cyan-400/5 p-3 text-center">
                <p className="text-xs text-cyan-100/80">Signed in as <span className="font-bold">{user.email}</span></p>
                <Button
                  type="button"
                  onClick={() => navigate({ to: dest as never })}
                  className="mt-2 w-full h-10 bg-cyan-400/20 hover:bg-cyan-400/30 border border-cyan-300/50 text-cyan-50 font-bold uppercase tracking-[0.2em]"
                >
                  Enter Vault <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* OAuth — hidden when already authenticated */}
            {!user && (
            <>
            <div className="mt-6 space-y-3">
              <Button
                type="button"
                disabled={loading}
                onClick={() => oauth("google")}
                className="w-full h-12 bg-white text-gray-900 hover:bg-gray-50 font-semibold shadow-[0_0_30px_-5px_rgba(56,189,248,0.6)]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={() => oauth("apple")}
                className="w-full h-12 bg-black text-white hover:bg-black/85 border border-cyan-200/20 font-semibold"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2" aria-hidden fill="currentColor">
                  <path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3.03-.81.86-2.13 1.52-3.21 1.43-.13-1.1.42-2.25 1.16-3.04.83-.88 2.24-1.54 3.26-1.42zM20.5 17.31c-.55 1.27-.81 1.83-1.52 2.95-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.78-4.05-3.34C.01 16.18-.31 11.13 1.5 8.43c1.28-1.92 3.31-3.04 5.21-3.04 1.94 0 3.16 1.06 4.77 1.06 1.56 0 2.51-1.06 4.76-1.06 1.7 0 3.5.93 4.78 2.53-4.21 2.31-3.52 8.32.48 9.39z"/>
                </svg>
                Continue with Apple
              </Button>
            </div>

            <div className="my-5 flex items-center gap-3" role="separator">
              <div className="h-px flex-1 bg-cyan-300/20" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/60 font-bold">or vault key</span>
              <div className="h-px flex-1 bg-cyan-300/20" />
            </div>

            {/* Email + password (vault key) */}
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="vault-email" className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">Vault email</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-300/70" />
                  <Input
                    id="vault-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="og@vault.com"
                    required
                    className="pl-10 h-11 bg-black/50 border-cyan-300/30 focus-visible:ring-cyan-400/50"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="vault-pass" className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">Vault key</Label>
                <div className="relative mt-1.5">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-300/70" />
                  <Input
                    id="vault-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-10 h-11 bg-black/50 border-cyan-300/30 focus-visible:ring-cyan-400/50 font-mono tracking-widest"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black uppercase tracking-[0.25em] shadow-[0_0_40px_-5px_rgba(56,189,248,0.7)]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4 mr-2" /> Open Vault</>}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || !email}
                onClick={magicLink}
                className="w-full h-10 border-cyan-300/40 text-cyan-100 hover:bg-cyan-400/10"
              >
                <Wand2 className="h-3.5 w-3.5 mr-2" />
                Email me a magic key
              </Button>
            </form>
            </>
            )}

            <div className="mt-6 flex items-center justify-between text-[11px] text-cyan-200/60">
              <Link to="/auth" className="hover:text-cyan-100">Standard login</Link>
              {!isVip && (
                <Link to="/vip" className="inline-flex items-center gap-1 hover:text-cyan-100">
                  <Crown className="h-3 w-3" /> Get VIP Pass
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
