import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, Coins, Crown, Loader2, Lock, Minus, Plus, TrendingDown, Tv, Wallet, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAccess, TIER_LABEL } from "@/lib/access";
import { ACTION_RULES, upgradeCta, upgradeHref, type GatedActionKey } from "@/lib/action-gates";

/**
 * Live, multi-action cost estimator. Pick any combination of actions and
 * see the projected coin charge, your VIP / Real-OG perks applied, and
 * the resulting balance. All currency is shown in coins 🪙.
 */

type ActionDef = {
  key: GatedActionKey;
  label: string;
  hint?: string;
  cost: number;
  /** True if a Real-OG VIP free pass can zero this action out (1/day total). */
  vipFreeEligible?: boolean;
};

const FALLBACK_HUB_COSTS: Record<string, number> = {
  music: 1, jokes: 1, trade: 1, connect: 1, battle: 1, tools: 1,
};

const HUB_LABELS: Record<string, string> = {
  music: "Spawn music portal",
  jokes: "Spawn jokes portal",
  trade: "Spawn trade portal",
  connect: "Spawn connect portal",
  battle: "Spawn battle portal",
  tools: "Spawn tools portal",
};

type Props = { className?: string };

export function LiveCostEstimator({ className = "" }: Props) {
  const { profile } = useAuth();
  const access = useAccess();
  const [hubCosts, setHubCosts] = useState<Record<string, number>>(FALLBACK_HUB_COSTS);
  const [vipUsedToday, setVipUsedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({});

  const balance = profile?.credits ?? 0;
  const isRealOg = !!profile?.feature_flags?.real_og;
  const tier = profile?.status === "vip" ? "VIP" : isRealOg ? "Real OG" : "Free";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [{ data: setting }, vipRes] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "hub_create_costs").maybeSingle(),
        profile?.id
          ? supabase
              .from("portal_downloads")
              .select("id", { count: "exact", head: true })
              .eq("user_id", profile.id)
              .eq("mode", "vip_free")
              .gte("created_at", todayStart.toISOString())
          : Promise.resolve({ count: 0 } as any),
      ]);
      if (cancelled) return;
      const merged: Record<string, number> = { ...FALLBACK_HUB_COSTS };
      const v = (setting?.value as Record<string, unknown> | undefined) ?? {};
      for (const k of Object.keys(merged)) {
        const n = Number(v[k]);
        if (Number.isFinite(n)) merged[k] = Math.max(0, Math.floor(n));
      }
      setHubCosts(merged);
      setVipUsedToday(Number((vipRes as any)?.count ?? 0));
      setLoading(false);
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile?.id]);

  const actions: ActionDef[] = useMemo(() => [
    ...Object.keys(HUB_LABELS).map((k) => ({
      key: `hub:${k}` as GatedActionKey,
      label: HUB_LABELS[k],
      cost: hubCosts[k] ?? 1,
    })),
    { key: "download" as GatedActionKey, label: "Unlock / download track", hint: "1 free per day for Real OG", cost: 2, vipFreeEligible: true },
    { key: "vault" as GatedActionKey, label: "Reveal vault item", cost: 5 },
  ], [hubCosts]);

  const bump = (key: string, delta: number) =>
    setQty((q) => {
      const next = Math.max(0, Math.min(99, (q[key] ?? 0) + delta));
      return { ...q, [key]: next };
    });

  // Compute totals — apply Real-OG free pass to the FIRST selected download today.
  // Locked actions (subscription gate failed) never contribute to the total.
  const breakdown = useMemo(() => {
    let total = 0;
    let vipApplied = 0;
    let freePassesLeft = isRealOg && vipUsedToday < 1 ? 1 : 0;
    const lines: Array<{ key: string; label: string; qty: number; charged: number; saved: number }> = [];
    for (const a of actions) {
      const rule = ACTION_RULES[a.key];
      if (rule && !access.atLeast(rule.min)) continue;
      const q = qty[a.key] ?? 0;
      if (!q) continue;
      let saved = 0;
      if (a.vipFreeEligible && freePassesLeft > 0) {
        const apply = Math.min(freePassesLeft, q);
        saved = apply * a.cost;
        freePassesLeft -= apply;
        vipApplied += apply;
      }
      const charged = q * a.cost - saved;
      total += charged;
      lines.push({ key: a.key, label: a.label, qty: q, charged, saved });
    }
    return { total, vipApplied, lines };
  }, [actions, qty, isRealOg, vipUsedToday, access]);

  const after = Math.max(0, balance - breakdown.total);
  const overdraft = breakdown.total > balance;
  const anySelected = breakdown.lines.length > 0;

  return (
    <section
      aria-label="Live cost estimator"
      className={`rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 ${className}`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <Calculator className="h-3.5 w-3.5" /> Live cost estimator
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5 text-amber-300" />}
          {tier}
        </span>
      </header>

      <p className="mt-2 text-xs text-muted-foreground">
        Pick the actions you're considering — totals update live in coins.
      </p>

      {/* Action picker */}
      <ul className="mt-3 space-y-1.5">
        {actions.map((a) => {
          const q = qty[a.key] ?? 0;
          const sel = q > 0;
          const rule = ACTION_RULES[a.key];
          const locked = rule ? !access.atLeast(rule.min) : false;
          if (locked && rule) {
            const Icon = rule.min === "vip" || rule.min === "boss" ? Crown : rule.min === "stream" ? Tv : Lock;
            return (
              <li
                key={a.key}
                className="flex items-center justify-between gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 px-2.5 py-1.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate font-medium">
                    <Icon className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">{a.label}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.cost} 🪙 · {TIER_LABEL[rule.min]} required
                  </div>
                </div>
                <Link
                  to={upgradeHref(rule.min)}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-black hover:bg-amber-300 whitespace-nowrap"
                >
                  {upgradeCta(rule.min)}
                </Link>
              </li>
            );
          }
          return (
            <li
              key={a.key}
              className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                sel ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {a.cost} 🪙{a.hint ? ` · ${a.hint}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => bump(a.key, -1)}
                  disabled={q === 0}
                  aria-label={`Remove one ${a.label}`}
                  className="h-7 w-7 grid place-items-center rounded-md border border-border bg-background hover:bg-secondary disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center font-mono text-sm">{q}</span>
                <button
                  type="button"
                  onClick={() => bump(a.key, 1)}
                  aria-label={`Add one ${a.label}`}
                  className="h-7 w-7 grid place-items-center rounded-md border border-border bg-background hover:bg-secondary"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Breakdown */}
      {anySelected && (
        <div className="mt-3 space-y-1 rounded-md border border-border bg-secondary/30 p-2.5 text-xs">
          {breakdown.lines.map((l) => (
            <div key={l.key} className="flex items-center justify-between font-mono">
              <span className="truncate pr-2 text-foreground/80">
                {l.qty}× {l.label}
              </span>
              <span className="inline-flex items-center gap-1">
                {l.saved > 0 && <span className="text-emerald-400">−{l.saved}</span>}
                <span className="font-bold">{l.charged} 🪙</span>
              </span>
            </div>
          ))}
          {breakdown.vipApplied > 0 && (
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1 text-emerald-300">
              <span className="inline-flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5" /> VIP free pass applied
              </span>
              <span className="font-mono">×{breakdown.vipApplied}</span>
            </div>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Total now</span>
        <span className="inline-flex items-center gap-1 text-lg font-bold">
          {breakdown.total} <span aria-hidden>🪙</span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-2">
          <div className="inline-flex items-center gap-1 text-muted-foreground">
            <Wallet className="h-3 w-3" /> Balance
          </div>
          <div className="mt-1 font-mono font-bold">{balance} 🪙</div>
        </div>
        <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-2">
          <div className="inline-flex items-center gap-1 text-muted-foreground">
            <Coins className="h-3 w-3" /> After
          </div>
          <div className={`mt-1 font-mono font-bold ${overdraft ? "text-destructive" : ""}`}>
            {after} 🪙
          </div>
        </div>
      </div>

      {/* Subscription perks line */}
      {(isRealOg || profile?.status === "vip") && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <TrendingDown className="h-3.5 w-3.5" /> Subscription perk
          </span>
          <span className="font-mono text-emerald-300">
            {isRealOg
              ? vipUsedToday >= 1
                ? "VIP free pass used today"
                : "1 free unlock available today"
              : "VIP active"}
          </span>
        </div>
      )}

      {overdraft && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          Selected actions exceed your balance by {breakdown.total - balance} 🪙 — top up before continuing.
        </p>
      )}
    </section>
  );
}

export default LiveCostEstimator;