import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg";
import { OgWordmark } from "@/components/OgWordmark";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set New Password · 0G-PORTAL" },
      { name: "description", content: "Choose a new password for your 0G-PORTAL account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase recovery flow: the link contains tokens in the URL hash and
  // the client emits a PASSWORD_RECOVERY auth event once parsed.
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const isRecovery = hash.includes("type=recovery") || hash.includes("access_token");
    if (isRecovery) setReady(true);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Fallback: if a session already exists from the recovery link
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated. Redirecting...");
      setTimeout(() => navigate({ to: "/profile" }), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-5 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.72_0.22_245_/_0.35),transparent)] animate-pulse-gold" />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 mb-8">
          <img src={logo} alt="0G-PORTAL" className="h-10 w-10 rounded-md ring-1 ring-[oklch(0.72_0.22_245/0.5)]" />
          <OgWordmark suffix="-PORTAL" className="text-2xl text-metallic" />
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-[0_0_60px_-10px_oklch(0.72_0.22_245/0.4)]">
          <h1 className="text-2xl font-bold text-center text-metallic mb-1">Set New Password</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Choose something only you would tune to.
          </p>

          {!ready ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              This link looks invalid or expired.
              <div className="mt-4">
                <Link to="/forgot-password" className="text-[oklch(0.72_0.22_245)] underline-offset-2 hover:underline">
                  Request a new reset link
                </Link>
              </div>
            </div>
          ) : done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400 mb-2" />
              <p className="text-sm text-emerald-300">Password updated.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="rp-password" className="text-xs uppercase tracking-widest">New Password</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rp-password"
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
              <div>
                <Label htmlFor="rp-confirm" className="text-xs uppercase tracking-widest">Confirm</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rp-confirm"
                    type="password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="btn-glass-blue w-full h-11 text-white font-bold uppercase tracking-[0.25em]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}