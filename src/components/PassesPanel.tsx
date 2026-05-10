import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Loader2, Ticket, ExternalLink, Coins } from "lucide-react";
import { getMyPurchases } from "@/lib/account-passes.functions";
import { coinChip } from "@/lib/coins";

type Pass = { id: string; source: string; expires_at: string; revoked_at: string | null; created_at: string };
type Order = { id: string; kind: string; pass_number: string | null; status: string; amount_cents: number; currency: string; duration_days: number; created_at: string };
type CreditPurchase = { id: string; credits_granted: number; amount_cents: number; currency: string; created_at: string };
type Summary = { passes: Pass[]; orders: Order[]; credit_purchases: CreditPurchase[] };

function passLabel(source: string) {
  if (source?.startsWith("store:real_og:")) return "Real OG Lifetime";
  if (source?.startsWith("store:streams_pass:")) return "Streams Pass";
  if (source?.startsWith("store:vip_pass:")) return "VIP Pass";
  if (source?.startsWith("pass:")) return "Welcome Pass";
  if (source?.startsWith("redeem:")) return "Redeemed Pass";
  return "VIP Pass";
}

function fmtMoney(cents: number, currency: string) {
  try {
    const base = new Intl.NumberFormat("en-GB", { style: "currency", currency: (currency || "gbp").toUpperCase() }).format(cents / 100);
    return (currency || "gbp").toLowerCase() === "gbp" ? `${base} ${coinChip(cents)}` : base;
  } catch { return `${(cents/100).toFixed(2)} ${currency} ${coinChip(cents)}`; }
}

function daysLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.round(ms / 86400_000);
}

export function PassesPanel({ compact = false }: { compact?: boolean }) {
  const fetchSummary = useServerFn(getMyPurchases);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary().then((d: any) => setData(d as Summary)).catch(() => setData({ passes: [], orders: [], credit_purchases: [] })).finally(() => setLoading(false));
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Loading your passes…
      </div>
    );
  }

  const now = Date.now();
  const active = (data?.passes ?? []).filter(p => !p.revoked_at && new Date(p.expires_at).getTime() > now);
  const expired = (data?.passes ?? []).filter(p => p.revoked_at || new Date(p.expires_at).getTime() <= now);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-metallic">
          <Crown className="inline h-4 w-4 mr-2 text-yellow-400" />Active passes
        </p>
        {compact && (
          <Link to="/account/passes" className="text-[11px] uppercase tracking-widest font-bold text-[color:var(--neon-blue-bright)] inline-flex items-center gap-1">
            See all <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active passes.{" "}
          <Link to="/store" className="underline text-[color:var(--neon-blue-bright)]">Get one →</Link>
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {active.slice(0, compact ? 3 : 50).map(p => {
            const dl = daysLeft(p.expires_at);
            const lifetime = dl > 365 * 5;
            return (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate"><Ticket className="inline h-3.5 w-3.5 mr-1.5 text-yellow-400" />{passLabel(p.source)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {lifetime ? "Lifetime · never expires" : `Expires ${new Date(p.expires_at).toLocaleDateString()} · ${dl} day${dl === 1 ? "" : "s"} left`}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${dl <= 7 && !lifetime ? "border-rose-400/60 text-rose-300" : "border-emerald-400/40 text-emerald-300"}`}>
                  {lifetime ? "Lifetime" : dl <= 7 ? "Renew soon" : "Active"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!compact && expired.length > 0 && (
        <>
          <p className="mt-5 text-xs uppercase tracking-widest text-muted-foreground mb-2">Expired</p>
          <ul className="divide-y divide-border">
            {expired.slice(0, 10).map(p => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3 opacity-70">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground truncate">{passLabel(p.source)}</p>
                  <p className="text-[11px] text-muted-foreground">Ended {new Date(p.expires_at).toLocaleDateString()}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{p.revoked_at ? "Revoked" : "Expired"}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {!compact && (data?.orders?.length ?? 0) > 0 && (
        <>
          <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground mb-2">Pass orders</p>
          <ul className="divide-y divide-border">
            {data!.orders.slice(0, 20).map(o => (
              <li key={o.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{o.pass_number ? `${o.pass_number} · ` : ""}{o.kind.replace(/_/g, " ")}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {fmtMoney(o.amount_cents, o.currency)}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                  o.status === "issued" ? "border-emerald-400/40 text-emerald-300"
                  : o.status === "pending_approval" ? "border-amber-400/40 text-amber-300"
                  : o.status === "denied" || o.status === "refunded" ? "border-rose-400/40 text-rose-300"
                  : "border-border text-muted-foreground"
                }`}>{o.status.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {!compact && (data?.credit_purchases?.length ?? 0) > 0 && (
        <>
          <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground mb-2"><Coins className="inline h-3 w-3 mr-1 text-yellow-400" />Credit purchases</p>
          <ul className="divide-y divide-border">
            {data!.credit_purchases.slice(0, 20).map(c => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white">+{c.credits_granted} credits</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">{fmtMoney(c.amount_cents, c.currency)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}