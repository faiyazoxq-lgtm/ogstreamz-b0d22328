import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";
import { useEffect, useState } from "react";
import { Coins, Save, Loader2, Globe, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
      toast.error("Enter a whole number between 0 and 1,000");
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
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Review and adjust platform-wide values. Changes take effect immediately for all new activity.
        </p>
      </div>

      {/* Signup bonus card */}
      <section className="rounded-xl border border-border bg-card p-5 max-w-xl">
        {/* Card header */}
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/25">
            <Coins className="h-4 w-4 text-amber-400" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-foreground">Signup bonus credits</h2>
              <Badge variant="outline" className="text-[10px] gap-1 font-medium text-amber-400 border-amber-400/25">
                <Globe className="h-3 w-3" />
                Platform-wide
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Coins granted automatically to every new account at registration.
              Increasing this raises acquisition cost; lowering it tightens the funnel.
            </p>
          </div>
        </div>

        {/* Control row */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
              Coins on signup
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={1000}
                step={1}
                disabled={loading || saving}
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                className="w-32 text-sm font-semibold tabular-nums"
              />
              <span className="text-sm text-muted-foreground">🪙</span>
            </div>
          </div>

          <Button
            size="sm"
            onClick={save}
            disabled={!dirty || saving || loading}
            className="shrink-0"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save
          </Button>
        </div>

        {/* Current value & impact hint */}
        {initial !== null && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Live value:</span>
              <span className="font-bold text-foreground tabular-nums">{initial}</span>
              <span className="text-muted-foreground">🪙</span>
            </div>
            {dirty && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Unsaved change — review before saving.</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Hint footer */}
      <p className="text-xs text-muted-foreground max-w-xl">
        Only whole numbers between 0 and 1,000 are accepted. This value is read at runtime and does not require a restart.
      </p>
    </div>
  );
}
