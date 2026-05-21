import { useState, type FormEvent } from "react";
import { Loader2, LogIn, Mail, Lock, Tv, User } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { signInWithStreamCredentials } from "@/lib/stream-signin.functions";
import { Link } from "@tanstack/react-router";

export function SignInModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const [streamUser, setStreamUser] = useState("");
  const [streamPass, setStreamPass] = useState("");
  const [streamLoading, setStreamLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter your email and password");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Locked in. Frequency unlocked.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  async function handleStreamSignIn(e: FormEvent) {
    e.preventDefault();
    if (!streamUser.trim() || !streamPass) {
      toast.error("Enter your OG Streamz username and password");
      return;
    }
    setStreamLoading(true);
    try {
      const res = await signInWithStreamCredentials({
        data: {
          username: streamUser.trim(),
          password: streamPass,
          redirectTo: window.location.origin,
        },
      });
      if (!res.ok) {
        toast.error(res.error || "Sign-in failed");
        return;
      }
      window.location.href = res.actionLink;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setStreamLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-white/10 bg-gradient-to-br from-[#001a33] via-[#000914] to-black text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-[0.15em]">
            <LogIn className="h-5 w-5 text-[#7fd5ff]" />
            Members sign in
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Welcome back to the Syndicate.
          </DialogDescription>
        </DialogHeader>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
        >
          Continue with Google
        </Button>

        <button
          type="button"
          onClick={() => setStreamOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7fd5ff] underline-offset-4 hover:underline"
        >
          <Tv className="h-3.5 w-3.5" />
          Continue with OG Streamz profile
        </button>

        {streamOpen && (
          <form
            onSubmit={handleStreamSignIn}
            className="space-y-2 rounded-md border border-[#7fd5ff]/20 bg-[#001a33]/50 p-3"
          >
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                type="text"
                autoComplete="username"
                value={streamUser}
                onChange={(e) => setStreamUser(e.target.value)}
                disabled={streamLoading}
                required
                className="pl-9 bg-black/40 border-white/15 text-white placeholder:text-white/30"
                placeholder="Stream username"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                type="password"
                autoComplete="current-password"
                value={streamPass}
                onChange={(e) => setStreamPass(e.target.value)}
                disabled={streamLoading}
                required
                className="pl-9 bg-black/40 border-white/15 text-white placeholder:text-white/30"
                placeholder="Stream password"
              />
            </div>
            <Button
              type="submit"
              disabled={streamLoading}
              className="w-full bg-gradient-to-r from-[#7fd5ff] to-[#0077cc] font-bold uppercase tracking-[0.2em] text-black hover:opacity-90"
            >
              {streamLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in with stream"}
            </Button>
          </form>
        )}

        <div className="relative my-1 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/40">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="signin-email" className="text-xs uppercase tracking-[0.2em] text-white/70">
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                id="signin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="pl-9 bg-black/40 border-white/15 text-white placeholder:text-white/30"
                placeholder="you@domain.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signin-password" className="text-xs uppercase tracking-[0.2em] text-white/70">
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                id="signin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="pl-9 bg-black/40 border-white/15 text-white placeholder:text-white/30"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#00aaff] to-[#0077cc] font-bold uppercase tracking-[0.2em] text-white hover:opacity-90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-xs text-white/60">
          <Link
            to="/forgot-password"
            onClick={() => onOpenChange(false)}
            className="hover:text-white"
          >
            Forgot password?
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" } as never}
            onClick={() => onOpenChange(false)}
            className="hover:text-white"
          >
            Create account
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}