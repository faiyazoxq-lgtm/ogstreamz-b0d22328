import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Eye, Copy, Check, Timer, Loader2, Flame, Lock, Download, Sparkles, Share2, Gift } from "lucide-react";
import { toPng } from "html-to-image";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
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
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const passCardRef = useRef<HTMLDivElement | null>(null);
  const referralCardRef = useRef<HTMLDivElement | null>(null);
  const tick = useRef<number | null>(null);
  const renderCache = useRef<{ key: string; file: File; dataUrl: string; name: string } | null>(null);
  const referralCache = useRef<{ key: string; file: File; dataUrl: string; name: string } | null>(null);

  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Pull this user's referral code so the share card embeds a reward link.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setReferralCode(prof?.referral_code ?? null);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const referralUrl = useMemo(() => {
    if (!referralCode || typeof window === "undefined") return "";
    return `${window.location.origin}/auth?mode=signup&vipref=${referralCode}`;
  }, [referralCode]);

  // Stable identity for the currently-rendered pass. When this changes,
  // the cached PNG is invalidated so Share/Save re-render once.
  const passKey = useMemo(() => {
    if (!data?.available) return "";
    return [data.code ?? "", data.username ?? "", data.password ?? "", data.expires_at ?? ""].join("|");
  }, [data]);

  useEffect(() => {
    renderCache.current = null;
  }, [passKey]);

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

  // Payload encoded into the scannable QR. Prefer the pass code; fall back
  // to a username:password pair so scanners always get something useful.
  const qrPayload = useMemo(() => {
    if (!data?.available) return "";
    if (data.code) return data.code;
    if (data.username && data.password) return `${data.username}:${data.password}`;
    return data.username || data.password || "";
  }, [data]);

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

  const renderPassFile = async (): Promise<{ file: File; dataUrl: string; name: string } | null> => {
    if (!passCardRef.current) return null;
    if (renderCache.current && renderCache.current.key === passKey && passKey) {
      const c = renderCache.current;
      return { file: c.file, dataUrl: c.dataUrl, name: c.name };
    }
    const dataUrl = await toPng(passCardRef.current, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: "#000308",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `og-vip-pass-${stamp}.png`;
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], name, { type: "image/png" });
    if (passKey) renderCache.current = { key: passKey, file, dataUrl, name };
    return { file, dataUrl, name };
  };

  const triggerDownload = (dataUrl: string, name: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const doDownload = async () => {
    setDownloading(true);
    try {
      const out = await renderPassFile();
      if (!out) return;
      triggerDownload(out.dataUrl, out.name);
      toast.success("Pass image downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  // Renders the referral card (no creds) — cached per referral code.
  const renderReferralFile = async (): Promise<{ file: File; dataUrl: string; name: string } | null> => {
    if (!referralCardRef.current) return null;
    const key = referralCode ?? "";
    if (referralCache.current && referralCache.current.key === key && key) {
      const c = referralCache.current;
      return { file: c.file, dataUrl: c.dataUrl, name: c.name };
    }
    const dataUrl = await toPng(referralCardRef.current, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: "#000308",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `og-vip-invite-${stamp}.png`;
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], name, { type: "image/png" });
    if (key) referralCache.current = { key, file, dataUrl, name };
    return { file, dataUrl, name };
  };

  const doShare = async () => {
    if (!referralCode || !referralUrl) {
      toast.error("Referral code not ready yet — try again in a moment");
      return;
    }
    setSharing(true);
    try {
      const out = await renderReferralFile();
      if (!out) return;
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      const text = `Join me on OG-STREAMZ — use my VIP code ${referralCode} at signup and we both get +2 coins 🪙`;
      const shareData: ShareData = {
        files: [out.file],
        title: "Join me on OG-STREAMZ",
        text,
        url: referralUrl,
      };
      if (nav.share && nav.canShare && nav.canShare(shareData)) {
        await nav.share(shareData);
        toast.success("Invite shared");
      } else {
        triggerDownload(out.dataUrl, out.name);
        let copied = false;
        try {
          await navigator.clipboard.writeText(`${text}\n${referralUrl}`);
          copied = true;
        } catch {
          /* clipboard blocked — silent */
        }
        toast.message(
          copied
            ? "Sharing not supported — invite saved & link copied"
            : "Sharing not supported — invite image downloaded instead",
        );
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return; // user cancelled
      toast.error(e?.message ?? "Share failed");
    } finally {
      setSharing(false);
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
          <div className="mt-6 space-y-4">
            {/* Premium printable pass card */}
            <div className="relative">
              <div
                ref={passCardRef}
                className="relative overflow-hidden rounded-2xl p-5 sm:p-6 border border-cyan-300/40"
                style={{
                  background:
                    "radial-gradient(120% 80% at 0% 0%, rgba(0,200,255,0.35) 0%, transparent 55%), radial-gradient(120% 80% at 100% 100%, rgba(255,30,90,0.30) 0%, transparent 55%), linear-gradient(135deg, #050a1a 0%, #0a0014 100%)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(0,212,255,0.25), 0 30px 60px -20px rgba(0,180,255,0.4)",
                }}
              >
                {/* Holographic shimmer overlay */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-30 mix-blend-screen"
                  style={{
                    background:
                      "repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 6px)",
                  }}
                />
                <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full blur-2xl bg-cyan-400/30" />
                <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full blur-2xl bg-fuchsia-500/20" />

                <div className="relative flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="grid place-items-center w-9 h-9 rounded-lg bg-cyan-400/15 border border-cyan-300/50">
                      <Crown className="h-4 w-4 text-cyan-200" />
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.4em] font-black text-cyan-200/90">
                        OG-STREAMZ · VIP PASS
                      </p>
                      <p className="text-[10px] text-cyan-300/70 font-mono">
                        {data.label || "Syndicate Drop"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-cyan-200/60">Holder</p>
                    <p className="text-xs font-mono text-cyan-100 truncate max-w-[140px]">
                      {profile?.email ?? "Real OG"}
                    </p>
                  </div>
                </div>

                <div className="relative space-y-2.5">
                  <div className="flex items-stretch gap-3">
                    <div className="flex-1 min-w-0 space-y-2.5">
                  {data.username && (
                    <div className="rounded-xl border border-cyan-300/30 bg-black/40 px-4 py-2.5 backdrop-blur-sm">
                      <p className="text-[9px] uppercase tracking-[0.35em] text-cyan-200/70 mb-0.5">Username</p>
                      <code className="font-mono text-base sm:text-lg font-black text-white break-all">
                        {data.username}
                      </code>
                    </div>
                  )}
                  {data.password && (
                    <div className="rounded-xl border border-cyan-300/30 bg-black/40 px-4 py-2.5 backdrop-blur-sm">
                      <p className="text-[9px] uppercase tracking-[0.35em] text-cyan-200/70 mb-0.5">Password</p>
                      <code
                        className="font-mono text-base sm:text-lg font-black text-white break-all"
                        style={{ textShadow: "0 0 10px rgba(0,212,255,0.6)" }}
                      >
                        {data.password}
                      </code>
                    </div>
                  )}
                  {data.code && (
                    <div className="rounded-xl border border-cyan-300/30 bg-black/40 px-4 py-2.5 backdrop-blur-sm">
                      <p className="text-[9px] uppercase tracking-[0.35em] text-cyan-200/70 mb-0.5">Code</p>
                      <code
                        className="font-mono text-base sm:text-lg font-black text-white break-all"
                        style={{ textShadow: "0 0 10px rgba(0,212,255,0.6)" }}
                      >
                        {data.code}
                      </code>
                    </div>
                  )}
                    </div>
                    {qrPayload && (
                      <div className="shrink-0 self-center rounded-xl border border-cyan-300/40 bg-white p-2 shadow-[0_0_18px_rgba(0,200,255,0.45)]">
                        <QRCodeSVG
                          value={qrPayload}
                          size={104}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#020617"
                          marginSize={1}
                        />
                        <p className="mt-1 text-center text-[8px] uppercase tracking-[0.3em] font-black text-slate-700">
                          Scan
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative mt-5 flex items-center justify-between text-[9px] uppercase tracking-[0.3em] text-cyan-200/70 font-mono">
                  <span>Issued {new Date().toLocaleDateString()}</span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> 15-min window
                  </span>
                </div>
              </div>
            </div>

            {/* Quick copy + download actions */}
            <div className="flex flex-wrap items-center gap-2">
              {data.username && (
                <Button size="sm" onClick={() => doCopy(data.username || "")} className="bg-cyan-400/15 hover:bg-cyan-400/30 text-cyan-100 border border-cyan-300/50">
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> User
                </Button>
              )}
              {data.password && (
                <Button size="sm" onClick={() => doCopy(data.password || "")} className="bg-cyan-400/15 hover:bg-cyan-400/30 text-cyan-100 border border-cyan-300/50">
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Pass
                </Button>
              )}
              {data.code && (
                <Button size="sm" onClick={() => doCopy(data.code)} className="bg-cyan-400/15 hover:bg-cyan-400/30 text-cyan-100 border border-cyan-300/50">
                  {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />} Code
                </Button>
              )}
              <Button
                size="sm"
                onClick={doDownload}
                disabled={downloading}
                className="ml-auto bg-gradient-to-r from-[#00d4ff] to-[#ff2a8a] text-black font-black uppercase tracking-[0.2em] shadow-[0_0_18px_rgba(0,200,255,0.5)] hover:brightness-110"
              >
                {downloading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                Save image
              </Button>
              <Button
                size="sm"
                onClick={doShare}
                disabled={sharing}
                className="bg-gradient-to-r from-[#ff2a8a] to-[#00d4ff] text-black font-black uppercase tracking-[0.2em] shadow-[0_0_18px_rgba(255,42,138,0.5)] hover:brightness-110"
              >
                {sharing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5 mr-1.5" />}
                Share
              </Button>
            </div>

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