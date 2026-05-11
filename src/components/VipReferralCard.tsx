import { useEffect, useState } from "react";
import { Copy, Check, Gift, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function VipReferralCard() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Copy failed — long-press to select");
    }
  }

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
            onClick={() => copy(code, "Code")}
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-amber-300/40 bg-black/40 px-4 py-3 hover:bg-black/60 transition"
            aria-label={`Copy referral code ${code}`}
          >
            <span
              className="font-mono text-3xl sm:text-4xl font-black tracking-[0.4em] text-amber-100 tabular-nums"
              style={{ textShadow: "0 0 20px rgba(252,211,77,0.5)" }}
            >
              {code}
            </span>
            {copied ? (
              <Check className="h-5 w-5 text-emerald-300" />
            ) : (
              <Copy className="h-5 w-5 text-amber-200/80 group-hover:text-amber-100" />
            )}
          </button>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-100/70">
            <span>Share with friends — they enter at signup, you both get +2 🪙</span>
            <button
              type="button"
              onClick={() => copy(shareUrl, "Share link")}
              className="underline underline-offset-2 hover:text-amber-100"
            >
              Copy share link
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-amber-100/70 py-2">
          Your referral code is being prepared. Refresh in a moment.
        </p>
      )}
    </section>
  );
}
