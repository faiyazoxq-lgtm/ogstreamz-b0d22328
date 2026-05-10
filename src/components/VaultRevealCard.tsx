import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  KeyRound, Lock, Eye, EyeOff, Copy, Check, RefreshCw, Loader2,
  ShieldCheck, Crown, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  revealVaultCredential,
  type VaultRevealResult,
} from "@/lib/vault.functions";

/** Real OG-only widget. Reveals the current 0G-VAULT username/password,
 *  rotates every 15 minutes, with a live countdown until next rotation. */
export function VaultRevealCard() {
  const { user, profile } = useAuth();
  const reveal = useServerFn(revealVaultCredential);

  const isRealOg =
    !!profile && (
      profile.status === "vip" ||
      profile.rank === "vip" ||
      profile.rank === "boss" ||
      !!(profile.feature_flags as any)?.real_og
    );

  const [data, setData] = useState<VaultRevealResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState<"u" | "p" | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const tick = useRef<number | null>(null);

  const pull = async () => {
    setLoading(true);
    try {
      const r = (await reveal()) as VaultRevealResult;
      setData(r);
      setShowPwd(false);
      setSecondsLeft(r.rotates_in ?? 0);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not reveal credentials");
    } finally {
      setLoading(false);
    }
  };

  // Countdown ticker — auto-refreshes when window expires.
  useEffect(() => {
    if (!data) return;
    if (tick.current) window.clearInterval(tick.current);
    tick.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // window flipped — refresh quietly
          void pull();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (tick.current) window.clearInterval(tick.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.available && (data as any).window_start]);

  const mmss = useMemo(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [secondsLeft]);

  const doCopy = async (which: "u" | "p", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1200);
      toast.success(`${which === "u" ? "Username" : "Password"} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  // ---------- Locked states ----------
  if (!user) {
    return (
      <section className="mt-8 rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center gap-3 mb-2">
          <KeyRound className="h-5 w-5 text-amber-300" />
          <h2 className="font-[Montserrat] font-black text-xl text-foreground">0G-VAULT Access</h2>
        </header>
        <p className="text-sm text-muted-foreground">
          Sign in with your Real OG pass to reveal rotating VAULT credentials.
        </p>
      </section>
    );
  }

  if (!isRealOg) {
    return (
      <section className="mt-8 rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center gap-3 mb-2 flex-wrap">
          <KeyRound className="h-5 w-5 text-amber-300" />
          <h2 className="font-[Montserrat] font-black text-xl text-foreground">0G-VAULT Access</h2>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-amber-200/90 border border-amber-300/40 rounded-full px-2 py-1">
            <Crown className="h-3 w-3" /> Real OG only
          </span>
        </header>
        <p className="text-sm text-muted-foreground">
          The 0G-VAULT is a separate product. Members holding the{" "}
          <span className="text-amber-200 font-semibold">Real OG Pass</span> get rotating
          username + password drops, refreshed every 15 minutes.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            to="/store"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-300 hover:bg-amber-200 text-black px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] font-bold"
          >
            <Lock className="h-3.5 w-3.5" />
            Get the Real OG Pass · £20 (20 🪙)
          </Link>
        </div>
      </section>
    );
  }

  // ---------- Real OG state ----------
  return (
    <section className="mt-8 rounded-2xl border border-amber-300/50 bg-gradient-to-br from-amber-300/10 via-card to-[oklch(0.18_0.04_85)] p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-1 flex-wrap">
        <KeyRound className="h-5 w-5 text-amber-300" />
        <h2 className="font-[Montserrat] font-black text-xl text-foreground">0G-VAULT Access</h2>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-amber-200/90 border border-amber-300/40 rounded-full px-2 py-1">
          <ShieldCheck className="h-3 w-3" /> Real OG verified
        </span>
        {data?.available && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-200">
            <Timer className="h-3.5 w-3.5" />
            Rotates in <span className="tabular-nums font-bold">{mmss}</span>
          </span>
        )}
      </header>
      <p className="text-xs text-muted-foreground mb-4">
        Credentials rotate every 15 minutes across the VAULT pool. Same drop for every Real OG inside the window.
      </p>

      {!data && (
        <Button
          onClick={pull}
          disabled={loading}
          className="h-12 px-6 text-xs uppercase tracking-[0.25em] font-bold bg-amber-300 hover:bg-amber-200 text-black"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Decrypting…</>
                   : <><Eye className="h-4 w-4 mr-2" />Reveal current drop</>}
        </Button>
      )}

      {data && !data.available && (
        <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
          {data.reason}
        </div>
      )}

      {data?.available && (
        <div className="space-y-3">
          {data.label && (
            <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/80 font-bold">
              {data.label}
            </div>
          )}

          <CredentialRow
            field="Username"
            value={data.username}
            mono
            copied={copied === "u"}
            onCopy={() => doCopy("u", data.username)}
          />
          <CredentialRow
            field="Password"
            value={showPwd ? data.password : "•".repeat(Math.min(14, data.password.length))}
            mono
            copied={copied === "p"}
            onCopy={() => doCopy("p", data.password)}
            extra={
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-amber-200 hover:text-amber-100 px-2 py-1 rounded border border-amber-300/40"
              >
                {showPwd ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPwd ? "Hide" : "Show"}
              </button>
            }
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Pool size: <span className="text-foreground font-bold">{data.pool_size}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={pull}
              disabled={loading}
              className="border-amber-300/40 text-amber-200 hover:bg-amber-300/10"
            >
              {loading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Refreshing</>
                : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</>}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function CredentialRow({
  field, value, mono, copied, onCopy, extra,
}: {
  field: string;
  value: string;
  mono?: boolean;
  copied?: boolean;
  onCopy: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-300/30 bg-background/60 px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{field}</div>
        <div className={`mt-1 text-base text-foreground truncate ${mono ? "font-mono" : ""}`}>
          {value}
        </div>
      </div>
      {extra}
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-amber-300/40 text-amber-200 hover:bg-amber-300/10 text-[11px] uppercase tracking-[0.2em] font-bold"
        aria-label={`Copy ${field.toLowerCase()}`}
      >
        {copied ? <><Check className="h-3.5 w-3.5" />Copied</>
                : <><Copy className="h-3.5 w-3.5" />Copy</>}
      </button>
    </div>
  );
}

export default VaultRevealCard;
