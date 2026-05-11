import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Coins, Gift, Sparkles, Megaphone, Percent, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/boss/promotions")({
  head: () => ({ meta: [{ title: "Promotions — Boss" }] }),
  component: PromotionsPage,
});

type Settings = {
  signup_bonus_credits: number;
  referral_bonus_credits: number;
  daily_login_bonus_credits: number;
  first_purchase_bonus_pct: number;
  vip_promo_banner_enabled: boolean;
  promo_banner_enabled: boolean;
  promo_banner_text: string;
};

const DEFAULTS: Settings = {
  signup_bonus_credits: 2,
  referral_bonus_credits: 0,
  daily_login_bonus_credits: 0,
  first_purchase_bonus_pct: 0,
  vip_promo_banner_enabled: true,
  promo_banner_enabled: false,
  promo_banner_text: "",
};

const KEYS = Object.keys(DEFAULTS) as (keyof Settings)[];

function PromotionsPage() {
  const [data, setData] = useState<Settings>(DEFAULTS);
  const [initial, setInitial] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", KEYS as string[]);
      if (error) {
        toast.error("Couldn't load settings");
        setLoading(false);
        return;
      }
      const next = { ...DEFAULTS };
      for (const r of rows ?? []) {
        const k = r.key as keyof Settings;
        if (!(k in DEFAULTS)) continue;
        const raw = r.value as unknown;
        if (typeof DEFAULTS[k] === "number") {
          const n = Number(raw);
          if (Number.isFinite(n)) (next as any)[k] = Math.max(0, n);
        } else if (typeof DEFAULTS[k] === "boolean") {
          (next as any)[k] = raw === true || raw === "true";
        } else {
          (next as any)[k] = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
        }
      }
      setData(next);
      setInitial(next);
      setLoading(false);
    })();
  }, []);

  const dirty = JSON.stringify(data) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const updated_by = u.user?.id ?? null;
      const rows = KEYS.map((k) => ({
        key: k,
        value: data[k] as any,
        updated_by,
      }));
      const { error } = await supabase
        .from("app_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
      setInitial(data);
      toast.success("Promotions saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const num = (k: keyof Settings) => (
    <Input
      type="number"
      min={0}
      step={1}
      value={String(data[k] as number)}
      onChange={(e) => setData((d) => ({ ...d, [k]: Math.max(0, Number(e.target.value || 0)) }))}
      className="max-w-[140px]"
    />
  );

  if (loading) {
    return (
      <div className="px-2 sm:px-0 py-10 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading promotions…
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0 py-6 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] font-bold text-gold inline-flex items-center gap-1.5">
          <Megaphone className="h-3.5 w-3.5" /> Boss · Promotions
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Sign-up bonus & promos</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Tune the credits new users get, the bonuses for referrals & daily logins, and which marketing
          banners are visible. Changes take effect immediately for every visitor.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5 space-y-5">
        <h2 className="text-sm uppercase tracking-[0.25em] font-bold text-foreground inline-flex items-center gap-2">
          <Coins className="h-4 w-4 text-gold" /> Credits & rewards
        </h2>

        <Row
          icon={<Gift className="h-4 w-4 text-emerald-300" />}
          title="Sign-up bonus"
          desc="Free credits granted to brand-new accounts on first sign-in. Shown on the locked-out promo screen as the big +N number."
          control={num("signup_bonus_credits")}
          unit="credits"
        />
        <Row
          icon={<Sparkles className="h-4 w-4 text-cyan-300" />}
          title="Referral bonus"
          desc="Credits awarded to a member when someone they referred signs up. 0 disables the reward."
          control={num("referral_bonus_credits")}
          unit="credits"
        />
        <Row
          icon={<Coins className="h-4 w-4 text-amber-300" />}
          title="Daily-login bonus"
          desc="Credits given the first time a member opens the app each calendar day. 0 disables the reward."
          control={num("daily_login_bonus_credits")}
          unit="credits"
        />
        <Row
          icon={<Percent className="h-4 w-4 text-fuchsia-300" />}
          title="First-purchase bonus"
          desc="Extra credits added on top of any first paid coin pack, as a percentage of the pack size."
          control={num("first_purchase_bonus_pct")}
          unit="%"
        />
      </section>

      <section className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5 space-y-5">
        <h2 className="text-sm uppercase tracking-[0.25em] font-bold text-foreground inline-flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-cyan-300" /> Promotional banners
        </h2>

        <ToggleRow
          icon={<Crown className="h-4 w-4 text-cyan-200" />}
          title="VIP Pass banner"
          desc="Shows the cyan VIP/0G-VAULT promo strip at the top of every page for non-VIP visitors."
          checked={data.vip_promo_banner_enabled}
          onChange={(v) => setData((d) => ({ ...d, vip_promo_banner_enabled: v }))}
        />
        <ToggleRow
          icon={<Megaphone className="h-4 w-4 text-amber-300" />}
          title="Custom promo banner"
          desc="Show a custom message at the top of the app — e.g. limited-time offers, holidays, drops."
          checked={data.promo_banner_enabled}
          onChange={(v) => setData((d) => ({ ...d, promo_banner_enabled: v }))}
        />
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Banner message</Label>
          <Input
            value={data.promo_banner_text}
            onChange={(e) => setData((d) => ({ ...d, promo_banner_text: e.target.value }))}
            placeholder="🔥 Weekend drop — 30% off all coin packs"
            disabled={!data.promo_banner_enabled}
          />
          <p className="text-[11px] text-muted-foreground">
            Shown only when the custom banner toggle above is on.
          </p>
        </div>
      </section>

      <div className="sticky bottom-3 z-20 flex items-center justify-end gap-2 rounded-xl border border-border bg-background/85 backdrop-blur px-3 py-2">
        {dirty ? (
          <span className="text-[11px] uppercase tracking-widest text-amber-300">Unsaved changes</span>
        ) : (
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">All changes saved</span>
        )}
        <Button onClick={save} disabled={!dirty || saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </Button>
      </div>
    </div>
  );
}

function Row({
  icon, title, desc, control, unit,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  control: React.ReactNode;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-t border-border/60 pt-4 first:border-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground max-w-xl">{desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {control}
        {unit && <span className="text-xs uppercase tracking-widest text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function ToggleRow({
  icon, title, desc, checked, onChange,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/60 pt-4 first:border-0 first:pt-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground max-w-xl">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
