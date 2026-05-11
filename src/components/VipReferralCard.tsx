import { useEffect, useMemo, useState } from "react";
import {
  Copy, Check, Gift, Loader2, Users, Share2, QrCode,
  Send, MessageCircle, Mail, Link2, Twitter,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function VipReferralCard() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: prof }, { count }] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
        supabase.from("referral_redemptions").select("*", { count: "exact", head: true }).eq("referrer_id", user.id),
      ]);
      if (cancelled) return;
      setCode(prof?.referral_code ?? null);
      setRedemptions(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  const shareUrl = typeof window !== "undefined" && code
    ? `${window.location.origin}/auth?mode=signup&vipref=${code}`
    : "";

  const shareMessage = code
    ? `Join me on 0G-PORTAL — use my VIP code ${code} at signup and we both get +2 coins 🪙\n${shareUrl}`
    : "";

  async function copy(text: string, label: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`${label} copied`);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
    } catch {
      toast.error("Copy failed — long-press to select");
    }
  }

  async function nativeShare() {
    if (!shareUrl) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Join me on 0G-PORTAL",
          text: shareMessage,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    void copy(shareUrl, "Share link", "share");
  }

  const enc = encodeURIComponent;
  const shareTargets = useMemo(() => {
    if (!code) return [];
    const msg = shareMessage;
    return [
      { key: "tg", label: "Telegram", Icon: Send,
        href: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(`Use my VIP code ${code} — we both get +2 coins 🪙`)}` },
      { key: "wa", label: "WhatsApp", Icon: MessageCircle,
        href: `https://wa.me/?text=${enc(msg)}` },
      { key: "x",  label: "X",        Icon: Twitter,
        href: `https://twitter.com/intent/tweet?text=${enc(msg)}` },
      { key: "ml", label: "Email",    Icon: Mail,
        href: `mailto:?subject=${enc("Join me on 0G-PORTAL")}&body=${enc(msg)}` },
    ] as const;
  }, [code, shareUrl, shareMessage]);

  return (
    <section
      aria-label="Your VIP referral code"
      className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-400/15 via-amber-300/5 to-transparent p-4 sm:p-5 shadow-[0_0_60px_-20px_rgba(252,211,77,0.6)]"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-300/50 bg-amber-300/15">
            <Gift className="h-4 w-4 text-amber-200" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-amber-200/80">VIP Referral</p>
            <h3 className="text-sm font-black text-amber-100">Both earn 2 coins</h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 border border-amber-300/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200 tabular-nums">
          <Users className="h-3 w-3" /> {redemptions} used
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-amber-200/70 text-sm py-3">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading code…
        </div>
      ) : code ? (
        <>
          <button
            type="button"
            onClick={() => copy(code, "Code", "code")}
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-amber-300/40 bg-black/40 px-4 py-3 hover:bg-black/60 transition"
            aria-label={`Copy referral code ${code}`}
          >
            <span
              className="font-mono text-3xl sm:text-4xl font-black tracking-[0.4em] text-amber-100 tabular-nums"
              style={{ textShadow: "0 0 20px rgba(252,211,77,0.5)" }}
            >
              {code}
            </span>
            {copiedKey === "code" ? (
              <Check className="h-5 w-5 text-emerald-300" />
            ) : (
              <Copy className="h-5 w-5 text-amber-200/80 group-hover:text-amber-100" />
            )}
          </button>

          {/* Share link */}
          <div className="mt-3 flex items-stretch gap-2">
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-amber-300/30 bg-black/40 px-3 py-2"
              aria-label="Your referral link"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0 text-amber-200/70" />
              <span className="truncate text-xs sm:text-sm text-amber-100/90 font-mono" title={shareUrl}>
                {shareUrl.replace(/^https?:\/\//, "")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copy(shareUrl, "Share link", "url")}
              className="inline-flex items-center justify-center rounded-lg border border-amber-300/40 bg-amber-300/15 px-3 hover:bg-amber-300/25 transition"
              aria-label="Copy share link"
            >
              {copiedKey === "url"
                ? <Check className="h-4 w-4 text-emerald-300" />
                : <Copy className="h-4 w-4 text-amber-100" />}
            </button>
          </div>

          {/* Quick-share + QR */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2">
            <button
              type="button"
              onClick={nativeShare}
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-300 text-black font-bold py-2 hover:bg-amber-200 transition text-xs sm:text-sm"
            >
              <Share2 className="h-4 w-4" /> Share link
            </button>
            {shareTargets.map(({ key, label, Icon, href }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Share via ${label}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300/30 bg-black/40 py-2 px-2 text-amber-100 hover:bg-black/60 transition text-xs"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </a>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-amber-100/70">
            <span>Friends enter at signup → you both get +2 🪙</span>
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-amber-100"
              aria-expanded={showQr}
              aria-controls="vipref-qr"
            >
              <QrCode className="h-3.5 w-3.5" /> {showQr ? "Hide QR" : "Show QR"}
            </button>
          </div>

          {showQr && shareUrl && (
            <div
              id="vipref-qr"
              className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-amber-300/30 bg-white p-4"
            >
              <QRCodeSVG
                value={shareUrl}
                size={168}
                bgColor="#ffffff"
                fgColor="#1a1300"
                level="M"
                marginSize={1}
              />
              <p className="text-[11px] text-stone-700 font-bold tabular-nums">{code}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-amber-100/70 py-2">
          Your referral code is being prepared. Refresh in a moment.
        </p>
      )}
    </section>
  );
}
