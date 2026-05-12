import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Eye, Copy, Check, Timer, Loader2, Flame, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { revealVipPass, type VipPassRevealResult } from "@/lib/vip-pass-pool.functions";

/** VIP / Real OG widget: press Reveal to be assigned a random VIP pass code
 *  from the boss-curated pool. The code stays valid for 15 minutes — once it
 *  expires, the next Reveal click pulls a fresh random one. */
export function VipPassRevealCard() {
  const { user, profile } = useAuth();
  const reveal = useServerFn(revealVipPass);

  const isVip =
    !!profile && (
      profile.status === "vip" ||
      profile.rank === "vip" ||
      profile.rank === "boss" ||
      !!(profile.feature_flags as any)?.real_og
    );

  const [data, setData] = useState<VipPassRevealResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tick = useRef<number | null>(null);

  const pull = async () => {
    setLoading(true);
    try {
      const r = (await reveal()) as VipPassRevealResult;
      setData(r);
      if (r.available) setSecondsLeft(r.expires_in ?? 0);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not reveal pass");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!data || !data.available) return;
    if (tick.current) window.clearInterval(tick.current);
    tick.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (tick.current) window.clearInterval(tick.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (tick.current) window.clearInterval(tick.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.available && (data as any).expires_at]);

  const mmss = useMemo(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [secondsLeft]);

  const expired = data?.available && secondsLeft <= 0;

  const doCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  if (!user) return null;

  if (!isVip) {
    return (
      <section className="rounded-2xl border border-cyan-400/30 bg-card p-6 sm:p-7">
        <header className="flex items-center gap-3 mb-2">
          <Lock className="h-5 w-5 text-cyan-300" />
          <h2 className="font-[Montserrat] font-black text-xl text-foreground">VIP Pass Drop</h2>
        </header>
        <p className="text-sm text-muted-foreground">
          Real OG / VIP only. Grab a Real OG Pass to unlock the rotating pass pool.
        </p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-cyan-300/60 bg-gradient-to-br from-[#001233] via-[#000814] to-[#02000a] p-6 sm:p-8 shadow-[0_0_50px_-10px_rgba(0,180,255,0.5),0_20px_60px_-20px_rgba(255,30,30,0.3)]">
      <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(0,200,255,0.5),transparent)]" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(255,30,30,0.3),transparent)]" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-cyan-300" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-cyan-200">VIP Pass · Drop</p>
              <h2 className="mt-0.5 font-[Montserrat] font-black text-2xl text-white [text-shadow:_0_0_18px_rgba(0,200,255,0.6)]">
                Random Pass — 15-min window
              </h2>
            </div>
          </div>
          {data?.available && !expired && (
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/60 bg-cyan-400/10 px-3 py-1.5 text-cyan-100">
              <Timer className="h-3.5 w-3.5" />
              <span className="font-mono font-black tabular-nums">{mmss}</span>
            </div>
          )}
        </div>

        {!data && (
          <div className="mt-6">
            <p className="text-sm text-cyan-100/80 mb-4">
              Press Reveal to be assigned a random VIP pass code from the syndicate pool.
              It's yours for 15 minutes — after that, a new code rotates in.
            </p>
            <Button
              onClick={pull}
              disabled={loading}
              className="bg-gradient-to-r from-[#00d4ff] via-[#0080ff] to-[#ff2a2a] text-white font-black uppercase tracking-[0.25em] shadow-[0_0_24px_rgba(0,180,255,0.7)] hover:brightness-110"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Reveal my pass
            </Button>
          </div>
        )}

        {data && !data.available && (
          <div className="mt-6 rounded-lg border border-cyan-400/30 bg-[#001a3d]/70 p-4 text-cyan-100/80 text-sm">
            {data.reason}
          </div>
        )}

        {data?.available && (
          <div className="mt-6 space-y-3">
            {data.label && (
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-cyan-200/80">{data.label}</p>
            )}
            {data.username && (
              <div className="rounded-lg border border-cyan-300/40 bg-[#001a3d]/80 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/70 mb-1">Username</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-base sm:text-lg font-black text-white break-all select-all">{data.username}</code>
                  <Button size="sm" onClick={() => doCopy(data.username || "")} className="bg-cyan-400/20 hover:bg-cyan-400/40 text-cyan-100 border border-cyan-300/60">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {data.password && (
              <div className="rounded-lg border border-cyan-300/40 bg-[#001a3d]/80 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/70 mb-1">Password</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-base sm:text-lg font-black text-white break-all select-all [text-shadow:_0_0_10px_rgba(0,200,255,0.5)]">{data.password}</code>
                  <Button size="sm" onClick={() => doCopy(data.password || "")} className="bg-cyan-400/20 hover:bg-cyan-400/40 text-cyan-100 border border-cyan-300/60">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {data.code && (
              <div className="flex items-center gap-2 rounded-lg border border-cyan-300/40 bg-[#001a3d]/80 px-3 py-3">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/70 mb-1">Code</p>
                  <code className="font-mono text-base sm:text-lg font-black text-white break-all select-all [text-shadow:_0_0_10px_rgba(0,200,255,0.5)]">{data.code}</code>
                </div>
                <Button size="sm" onClick={() => doCopy(data.code)} className="bg-cyan-400/20 hover:bg-cyan-400/40 text-cyan-100 border border-cyan-300/60">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 text-[11px] text-cyan-200/70 flex-wrap">
              <span>Pool size: <strong className="text-white">{data.pool_size}</strong></span>
              {expired ? (
                <Button
                  onClick={pull}
                  disabled={loading}
                  size="sm"
                  className="bg-gradient-to-r from-[#ff2a2a] via-[#ff5e00] to-[#ffd000] text-black font-black uppercase tracking-[0.25em]"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Flame className="h-3.5 w-3.5 mr-2" />}
                  Pull a fresh pass
                </Button>
              ) : (
                <span className="uppercase tracking-[0.25em] text-cyan-300/80">Expires in {mmss}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default VipPassRevealCard;