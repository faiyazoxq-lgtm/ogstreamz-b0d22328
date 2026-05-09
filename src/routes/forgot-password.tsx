import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Password · 0G-PORTAL" },
      { name: "description", content: "Recover access to your 0G-PORTAL account." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset link sent. Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
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
          <span className="font-[Montserrat] font-black text-2xl tracking-tight text-metallic">0G-PORTAL</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-[0_0_60px_-10px_oklch(0.72_0.22_245/0.4)]">
          <h1 className="text-2xl font-bold text-center text-metallic mb-1">Reset Password</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            We'll email you a secure link to set a new one.
          </p>

          {sent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-5 text-sm text-emerald-300">
                Link sent to <span className="font-mono">{email}</span>.<br />
                Check spam if you don't see it within a minute.
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/auth" })}
                className="w-full h-11"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="fp-email" className="text-xs uppercase tracking-widest">Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@frequency.com"
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="btn-glass-blue w-full h-11 text-white font-bold uppercase tracking-[0.25em]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
              </Button>
              <Link
                to="/auth"
                className="block text-center text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="inline h-3 w-3 mr-1" />
                Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}