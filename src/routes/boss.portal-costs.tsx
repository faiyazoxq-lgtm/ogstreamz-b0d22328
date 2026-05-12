import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Coins, Search, Save, Loader2, Lock, Sparkles, Minus, Plus, ExternalLink, Zap, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { chargePortalUse } from "@/lib/portal-use.functions";

export const Route = createFileRoute("/boss/portal-costs")({
  component: PortalCosts,
});

const BUILTIN_HUBS: Array<{ key: string; label: string; href: string }> = [
  { key: "music",   label: "MusicHUB",   href: "/music" },
  { key: "jokes",   label: "JokesHUB",   href: "/jokes" },
  { key: "trade",   label: "TradeHUB",   href: "/trade" },
  { key: "connect", label: "ConnectHUB", href: "/connect" },
  { key: "battle",  label: "BattleHUB",  href: "/battle" },
  { key: "tools",   label: "ToolHUB",    href: "/tools" },
];

type CustomHub = { id: string; title: string; href: string; create_portal_cost: number };
type Portal = { id: string; slug: string; name: string; kind: string; vip: boolean; use_credit_cost: number };

function PortalCosts() {
  // Built-in hub costs (app_settings.hub_create_costs)
  const [builtIn, setBuiltIn] = useState<Record<string, number>>({});
  const [savingBuiltIn, setSavingBuiltIn] = useState(false);

  // Custom hubs
  const [hubs, setHubs] = useState<CustomHub[]>([]);
  const [hubDrafts, setHubDrafts] = useState<Record<string, number>>({});

  // Portals
  const [portals, setPortals] = useState<Portal[]>([]);
  const [portalDrafts, setPortalDrafts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const chargeFn = useServerFn(chargePortalUse);
  const [savingPortal, setSavingPortal] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: setting }, { data: hubRows }, { data: portalRows }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "hub_create_costs").maybeSingle(),
      supabase.from("custom_hubs").select("id,title,href,create_portal_cost").order("sort_order").order("created_at"),
      supabase.from("portals").select("id,slug,name,kind,vip,use_credit_cost").order("created_at", { ascending: false }),
    ]);
    const seeded: Record<string, number> = {};
    for (const h of BUILTIN_HUBS) {
      const v = (setting?.value as Record<string, unknown> | undefined)?.[h.key];
      seeded[h.key] = typeof v === "number" ? v : 1;
    }
    setBuiltIn(seeded);
    setHubs((hubRows ?? []) as CustomHub[]);
    setPortals((portalRows ?? []) as Portal[]);
    setHubDrafts({});
    setPortalDrafts({});
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function saveBuiltIn() {
    setSavingBuiltIn(true);
    const clean: Record<string, number> = {};
    for (const h of BUILTIN_HUBS) clean[h.key] = Math.max(0, Math.floor(Number(builtIn[h.key]) || 0));
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "hub_create_costs", value: clean, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSavingBuiltIn(false);
    if (error) return toast.error(error.message);
    toast.success("Built-in hub costs saved");
    setBuiltIn(clean);
  }

  async function saveHub(id: string) {
    const value = Math.max(0, Math.floor(Number(hubDrafts[id]) || 0));
    const { error } = await supabase.from("custom_hubs").update({ create_portal_cost: value }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Hub cost saved");
    setHubs((prev) => prev.map((h) => (h.id === id ? { ...h, create_portal_cost: value } : h)));
    setHubDrafts((prev) => { const { [id]: _, ...rest } = prev; return rest; });
  }

  async function savePortal(id: string) {
    const value = Math.max(0, Math.floor(Number(portalDrafts[id] ?? portals.find((p) => p.id === id)?.use_credit_cost ?? 0)));
    setSavingPortal(id);
    const { error } = await supabase.from("portals").update({ use_credit_cost: value }).eq("id", id);
    setSavingPortal(null);
    if (error) return toast.error(error.message);
    toast.success(value === 0 ? "Portal set to free" : `Saved · ${value} 🪙 per use`);
    setPortals((prev) => prev.map((p) => (p.id === id ? { ...p, use_credit_cost: value } : p)));
    setPortalDrafts((prev) => { const { [id]: _, ...rest } = prev; return rest; });
  }

  async function quickSetPortal(id: string, value: number) {
    const v = Math.max(0, Math.floor(value));
    setPortalDrafts((prev) => ({ ...prev, [id]: v }));
    setSavingPortal(id);
    const { error } = await supabase.from("portals").update({ use_credit_cost: v }).eq("id", id);
    setSavingPortal(null);
    if (error) return toast.error(error.message);
    setPortals((prev) => prev.map((p) => (p.id === id ? { ...p, use_credit_cost: v } : p)));
    setPortalDrafts((prev) => { const { [id]: _, ...rest } = prev; return rest; });
    toast.success(v === 0 ? "Set to free" : `Set to ${v} 🪙`);
  }

  async function testPortal(slug: string) {
    setTesting(slug);
    try {
      const r = await chargeFn({ data: { slug } });
      if (r.ok) {
        if (r.free) toast.success(`Test passed — free for boss/admin (cost: ${r.cost} 🪙)`);
        else toast.success(`Test charged ${r.cost} 🪙 · balance now ${r.balance}`);
      } else if (r.error === "insufficient") {
        toast.error(`Insufficient balance — would block at ${r.cost} 🪙`);
      } else {
        toast.error(r.error || "Test failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Test failed");
    } finally {
      setTesting(null);
    }
  }

  const filteredPortals = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return portals;
    return portals.filter((p) =>
      p.name.toLowerCase().includes(n) ||
      p.slug.toLowerCase().includes(n) ||
      (p.kind ?? "").toLowerCase().includes(n),
    );
  }, [portals, q]);

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
          <Coins className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-[Montserrat] font-black text-2xl text-metallic">Portal & Hub Coin Costs</h1>
          <p className="text-sm text-muted-foreground">
            Set how many coins it takes to <strong>create</strong> a portal in each hub, and how many coins each portal charges per <strong>use</strong>.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Built-in hubs */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Built-in hubs · Create cost</h2>
                <p className="text-xs text-muted-foreground/80">Coins charged when a user spawns a portal inside one of the core hubs.</p>
              </div>
              <Button size="sm" onClick={saveBuiltIn} disabled={savingBuiltIn}>
                {savingBuiltIn ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save built-in
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {BUILTIN_HUBS.map((h) => (
                <div key={h.key} className="rounded-xl border bg-card p-4 flex items-center gap-3">
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{h.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{h.href}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      className="h-9 w-20 text-right"
                      value={builtIn[h.key] ?? 0}
                      onChange={(e) => setBuiltIn((prev) => ({ ...prev, [h.key]: Number(e.target.value) }))}
                    />
                    <span className="text-xs text-muted-foreground">coins</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Custom hubs */}
          <section className="space-y-3">
            <div>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Custom hubs · Create cost</h2>
              <p className="text-xs text-muted-foreground/80">Coins charged when a user spawns a portal inside a custom hub.</p>
            </div>
            {hubs.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No custom hubs yet.
              </div>
            ) : (
              <div className="space-y-2">
                {hubs.map((h) => {
                  const draft = hubDrafts[h.id];
                  const dirty = draft !== undefined && draft !== h.create_portal_cost;
                  return (
                    <div key={h.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
                      <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{h.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{h.href}</p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        className="h-9 w-20 text-right"
                        value={draft ?? h.create_portal_cost}
                        onChange={(e) => setHubDrafts((prev) => ({ ...prev, [h.id]: Number(e.target.value) }))}
                      />
                      <span className="text-xs text-muted-foreground w-10">coins</span>
                      <Button size="sm" disabled={!dirty} onClick={() => saveHub(h.id)}>Save</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Portals */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Portals · Use cost</h2>
                <p className="text-xs text-muted-foreground/80">Coins charged each time a user actively uses the portal. <code>0</code> = free.</p>
              </div>
              <div className="relative w-64 max-w-full">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search portals…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            {filteredPortals.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {portals.length === 0 ? "No portals yet." : "No portals match your search."}
              </div>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                  <div>Portal</div>
                  <div>Kind</div>
                  <div className="text-right w-44">Cost (instant save)</div>
                  <div className="w-44 text-right">Test / Preview</div>
                </div>
                <div className="divide-y">
                  {filteredPortals.map((p) => {
                    const draft = portalDrafts[p.id];
                    const current = draft ?? p.use_credit_cost;
                    const dirty = draft !== undefined && draft !== p.use_credit_cost;
                    const isSaving = savingPortal === p.id;
                    const isTesting = testing === p.slug;
                    return (
                      <div key={p.id} className="flex flex-wrap md:grid md:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 md:gap-3 px-3 py-3 items-center">
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">
                            {p.name} {p.vip && <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-400">VIP</span>}
                            {p.use_credit_cost === 0 && <span className="ml-1 text-[10px] uppercase tracking-wider text-emerald-400">FREE</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{p.kind}</span>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={isSaving || current <= 0}
                            onClick={() => quickSetPortal(p.id, current - 1)}
                            title="Decrease"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-16 text-right"
                            value={current}
                            onChange={(e) => setPortalDrafts((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                            onBlur={() => { if (dirty) void savePortal(p.id); }}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={isSaving}
                            onClick={() => quickSetPortal(p.id, current + 1)}
                            title="Increase"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant={current === 0 ? "secondary" : "outline"}
                            className="ml-1 h-8"
                            disabled={isSaving || current === 0}
                            onClick={() => quickSetPortal(p.id, 0)}
                            title="Set free"
                          >
                            <Gift className="h-3.5 w-3.5 mr-1" /> Free
                          </Button>
                          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={isTesting}
                            onClick={() => void testPortal(p.slug)}
                            title="Run a real charge against your account"
                          >
                            {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                            <span className="ml-1">Test</span>
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="h-8">
                            <a href={`/p/${p.slug}`} target="_blank" rel="noopener noreferrer" title="Open portal">
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="ml-1">Open</span>
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}