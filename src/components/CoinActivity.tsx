import { useEffect, useState } from "react";
import { Coins, Gift, ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type LedgerRow = {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
};

function describeReason(reason: string, delta: number): { label: string; note: string | null; gift: boolean } {
  const r = (reason || "").trim();
  // Boss gift: "boss:gift" or "boss:gift:<note>"
  if (r.startsWith("boss:gift")) {
    const note = r.slice("boss:gift".length).replace(/^:/, "").trim();
    return { label: "🎁 Gift from Boss", note: note || null, gift: true };
  }
  if (r.startsWith("boss:adjust")) {
    const note = r.slice("boss:adjust".length).replace(/^:/, "").trim();
    return { label: delta >= 0 ? "Boss adjustment" : "Boss removed coins", note: note || null, gift: false };
  }
  if (r.startsWith("topup:approved")) {
    return { label: "✅ Top-up approved", note: null, gift: true };
  }
  if (r.startsWith("redeem:")) {
    return { label: `Redeemed code · ${r.slice("redeem:".length)}`, note: null, gift: true };
  }
  if (r.startsWith("purchase:")) {
    return { label: `Spent on ${r.slice("purchase:".length).replace(/_/g, " ")}`, note: null, gift: false };
  }
  if (r.includes("vip")) {
    return { label: "VIP perk (no spend)", note: null, gift: false };
  }
  return { label: r || "Adjustment", note: null, gift: delta > 0 };
}

export function CoinActivity({ limit = 8 }: { limit?: number }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("credit_ledger")
      .select("id, delta, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    setRows((data ?? []) as LedgerRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  if (!user) return null;

  return (
    <section className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 via-card to-card p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-gold" />
          <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-gold">Coin Activity</h2>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">No activity yet.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => {
            const meta = describeReason(row.reason, row.delta);
            const positive = row.delta > 0;
            const zero = row.delta === 0;
            return (
              <li
                key={row.id}
                className={[
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                  meta.gift
                    ? "border-gold/40 bg-gold/10"
                    : positive
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : zero
                        ? "border-border bg-background/40"
                        : "border-border bg-background/40",
                ].join(" ")}
              >
                <div className="shrink-0 mt-0.5">
                  {meta.gift ? (
                    <Gift className="h-4 w-4 text-gold" />
                  ) : positive ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground truncate">{meta.label}</p>
                    <span
                      className={[
                        "text-sm font-[Montserrat] font-black tabular-nums",
                        positive ? "text-emerald-400" : zero ? "text-muted-foreground" : "text-destructive",
                      ].join(" ")}
                    >
                      {positive ? "+" : ""}
                      {row.delta} 🪙
                    </span>
                  </div>
                  {meta.note && (
                    <p className="mt-1 text-xs italic text-foreground/80">"{meta.note}"</p>
                  )}
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}