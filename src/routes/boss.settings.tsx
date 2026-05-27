import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";
import { useEffect, useState } from "react";
import { Coins, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/boss/settings")({
  beforeLoad: exactPathRedirect("/boss/settings", () => ({
    to: "/boss/infrastructure",
    hash: "settings",
  })),
  component: () => null,
});

export function SettingsPage() {
  const { user } = useAuth();
  const [bonus, setBonus] = useState<string>("");
  const [initial, setInitial] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "signup_bonus_credits")
        .maybeSingle();
      if (cancelled) return;
      if (error) toast.error(error.message);
      const v = Number(data?.value ?? 2);
      setBonus(String(v));
      setInitial(v);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const dirty = initial !== null && Number(bonus) !== initial;

  const save = async () => {
    const n = Math.trunc(Number(bonus));
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      toast.error("Enter a whole number between 0 and 1000");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "signup_bonus_credits", value: n, updated_by: user?.id ?? null }, { onConflict: "key" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setInitial(n);
    toast.success(`Signup bonus set to ${n} 🪙`);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="syndicate-header text-2xl text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Tunable platform values. Changes apply instantly.</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 max-w-xl">
        <div className="flex items-start gap-3 mb-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 ring-1 ring-gold/30">
            <Coins className="h-4 w-4 text-gold" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Signup bonus credits</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Coins granted automatically when a new account is created.
            </p>
          </div>
        </div>

        <label className="block text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-1.5">
          Coins on signup
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            disabled={loading || saving}
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm font-bold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <span className="text-sm text-muted-foreground">🪙</span>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving || loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-black disabled:opacity-50 hover:bg-gold/90"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
        {initial !== null && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Current live value: <span className="font-bold text-foreground tabular-nums">{initial}</span> 🪙
          </p>
        )}
      </section>
    </div>
  );
}
