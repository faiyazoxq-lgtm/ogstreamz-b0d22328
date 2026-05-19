import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, Copy, Check, Timer, Loader2, Flame, Lock, Download } from "lucide-react";
import { toPng } from "html-to-image";
import vaultLogo from "@/assets/og-vault-safe.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { isVipProfile } from "@/lib/roles";
import { revealVipPass, type VipPassRevealResult } from "@/lib/vip-pass-pool.functions";

/** VIP / Real OG widget: press Reveal to be assigned a random VIP pass code
 *  from the boss-curated pool. The code stays valid for 15 minutes — once it
 *  expires, the next Reveal click pulls a fresh random one. */
export function VipPassRevealCard() {
  const { user, profile } = useAuth();
  const reveal = useServerFn(revealVipPass);

  const isVip = isVipProfile(profile);

  const [data, setData] = useState<VipPassRevealResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<"user" | "pass" | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const passCardRef = useRef<HTMLDivElement | null>(null);
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

  const doCopy = async (value: string, which: "user" | "pass") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(which);
      window.setTimeout(() => setCopiedField(null), 1200);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const doDownload = async () => {
    if (!passCardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(passCardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#000308",
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `og-vip-pass-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Pass image downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    } finally {
      setDownloading(false);
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
        {/* Heading */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="font-[Montserrat] font-black uppercase tracking-tight text-white [text-shadow:_0_0_24px_rgba(0,200,255,0.6)] leading-[1.05] text-2xl sm:text-4xl">
            VIP Access Code <span className="block text-cyan-300">for the Vault</span>
          </h2>
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
          <div className="mt-6 space-y-4">
            <div
              ref={passCardRef}
              className="relative overflow-hidden rounded-2xl p-6 sm:p-8 border border-cyan-300/40"
              style={{
                background:
                  "radial-gradient(120% 80% at 0% 0%, rgba(0,200,255,0.35) 0%, transparent 55%), radial-gradient(120% 80% at 100% 100%, rgba(255,30,90,0.30) 0%, transparent 55%), linear-gradient(135deg, #050a1a 0%, #0a0014 100%)",
                boxShadow:
                  "inset 0 0 0 1px rgba(0,212,255,0.25), 0 30px 60px -20px rgba(0,180,255,0.4)",
              }}
            >
              <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full blur-2xl bg-cyan-400/30" />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full blur-2xl bg-fuchsia-500/20" />

              {/* Dominant vault logo */}
              <div className="relative flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-3xl bg-cyan-400/40" />
                  <img
                    src={vaultLogo}
                    alt="OG Vault"
                    className="relative h-36 w-36 sm:h-48 sm:w-48 object-contain drop-shadow-[0_0_24px_rgba(0,212,255,0.6)]"
                  />
                </div>
              </div>

              {/* Username then password */}
              <div className="relative mt-6 mx-auto w-full max-w-md space-y-3">
                {data.username && (
                  <button
                    type="button"
                    onClick={() => doCopy(data.username || "", "user")}
                    className="group w-full text-left rounded-xl border border-cyan-300/30 bg-black/60 px-5 py-4 backdrop-blur-sm hover:border-cyan-300/60 hover:bg-black/70 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-200/70">Username</p>
                      {copiedField === "user"
                        ? <Check className="h-3.5 w-3.5 text-cyan-300" />
                        : <Copy className="h-3.5 w-3.5 text-cyan-200/70 group-hover:text-cyan-200" />}
                    </div>
                    <code className="mt-1 block font-mono text-2xl sm:text-3xl font-black text-white break-all tracking-wider">
                      {data.username}
                    </code>
                  </button>
                )}
                {data.password && (
                  <button
                    type="button"
                    onClick={() => doCopy(data.password || "", "pass")}
                    className="group w-full text-left rounded-xl border border-cyan-300/30 bg-black/60 px-5 py-4 backdrop-blur-sm hover:border-cyan-300/60 hover:bg-black/70 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-200/70">Password</p>
                      {copiedField === "pass"
                        ? <Check className="h-3.5 w-3.5 text-cyan-300" />
                        : <Copy className="h-3.5 w-3.5 text-cyan-200/70 group-hover:text-cyan-200" />}
                    </div>
                    <code
                      className="mt-1 block font-mono text-2xl sm:text-3xl font-black text-white break-all tracking-wider"
                      style={{ textShadow: "0 0 10px rgba(0,212,255,0.6)" }}
                    >
                      {data.password}
                    </code>
                  </button>
                )}
              </div>

              <div className="relative mt-6 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-cyan-200/70 font-mono">
                <span>Holder · {profile?.email ?? "Real OG"}</span>
                <span>15-min window</span>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] text-cyan-200/70">
                Pool size: <strong className="text-white">{data.pool_size}</strong>
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  size="sm"
                  onClick={doDownload}
                  disabled={downloading}
                  className="bg-cyan-400/15 hover:bg-cyan-400/30 text-cyan-100 border border-cyan-300/50"
                >
                  {downloading
                    ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5 mr-1.5" />}
                  Save image
                </Button>
                {expired && (
                  <Button
                    onClick={pull}
                    disabled={loading}
                    size="sm"
                    className="bg-gradient-to-r from-[#ff2a2a] via-[#ff5e00] to-[#ffd000] text-black font-black uppercase tracking-[0.25em]"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Flame className="h-3.5 w-3.5 mr-2" />}
                    Pull fresh pass
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default VipPassRevealCard;