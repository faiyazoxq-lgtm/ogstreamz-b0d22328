import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Crown, Coins, Ticket, History, Loader2, Sparkles, ExternalLink, Music, Mic2,
  Flame, UserPlus, Users, Activity, Clock, BellRing, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { redeemCode } from "@/lib/overlord.functions";
import { ZeroGStreamPanel } from "@/components/ZeroGStreamPanel";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · 0G-PORTAL" }] }),
  component: DashboardPage,
});

const RANK_META: Record<string, { label: string; color: string; perks: string }> = {
  prospect: { label: "Prospect", color: "text-emerald-300", perks: "5 free Hit-Button clicks · Gallery access" },
  enforcer: { label: "Enforcer", color: "text-cyan-300", perks: "Unlimited Gallery · Priority feed" },
  vip: { label: "VIP", color: "text-yellow-300", perks: "Unlimited Hits · Live Wire jokes · Deep tool mode" },
  boss: { label: "Boss", color: "text-pink-400", perks: "Ultimate Creator · All access" },
};

type SpawnRow = { id: string; name: string; slug: string; created_at: string; kind: string };
type UnlockRow = { id: string; created_at: string; portal: { name: string; slug: string } | null };
type TrackRow = { id: string; created_at: string; track: { title: string; portal_slug: string } | null };

function DashboardPage() {
  const { user, profile, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const redeem = useServerFn(redeemCode);
  const [spawns, setSpawns] = useState<SpawnRow[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [trackBuys, setTrackBuys] = useState<TrackRow[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("portals").select("id,name,slug,created_at,kind").eq("created_by", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("portal_unlocks").select("id,created_at,portal:portals(name,slug)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("track_purchases").select("id,created_at,track:tracks(title,portal_slug)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]).then(([s, u, t]) => {
      setSpawns((s.data ?? []) as any);
      setUnlocks((u.data ?? []) as any);
      setTrackBuys((t.data ?? []) as any);
    });
  }, [user]);

  const onRedeem = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await redeem({ data: { code } });
      toast.success(`+${r.credits} credits${r.rank ? ` · Promoted to ${String(r.rank).toUpperCase()}` : ""}`);
      setCode("");
      await refresh();
    } catch (e: any) { toast.error(e.message ?? "Redeem failed"); }
    finally { setBusy(false); }
  };

  if (loading || !profile) return <main className="px-5 py-20 text-center text-muted-foreground"><Loader2 className="h-5 w-5 inline animate-spin mr-2" />Loading frequency…</main>;

  const isBoss = profile.rank === "boss";
  const meta = RANK_META[profile.rank] ?? RANK_META.prospect;
  const freeLeft = Math.max(0, 5 - (profile.free_clicks_used ?? 0));

  return (
    <main className="relative max-w-5xl mx-auto px-5 sm:px-8 py-12">
      {/* Hero */}
      <header className="mb-8">
        <p className="text-xs tracking-[0.4em] uppercase font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          {isBoss ? "Boss Dashboard" : "Syndicate Dashboard"}
        </p>
        <h1 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-5xl text-metallic">
          {isBoss ? "0G · Control Centre" : (profile.display_name || profile.email.split("@")[0])}
        </h1>
        {isBoss && <p className="mt-2 text-sm text-muted-foreground">Ultimate Creator · unlimited everything · own the system.</p>}
      </header>

      {isBoss ? (
        <BossPanel />
      ) : (
        <>
          <section className="grid sm:grid-cols-3 gap-4 mb-10">
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rank</p>
              <p className={`mt-1 text-3xl font-black ${meta.color}`}><Crown className="inline h-6 w-6 mr-2" />{meta.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{meta.perks}</p>
            </Card>
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Credits</p>
              <p className="mt-1 text-3xl font-black text-metallic"><Coins className="inline h-6 w-6 mr-2 text-yellow-400" />{profile.credits}</p>
              <Link to="/store" className="mt-1 inline-block text-xs underline text-[color:var(--neon-blue-bright)]">Buy Credits →</Link>
            </Card>
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Hit-Button (free)</p>
              <p className="mt-1 text-3xl font-black text-metallic"><Flame className="inline h-6 w-6 mr-2 text-orange-400" />{profile.rank === "prospect" ? `${freeLeft}/5` : "∞"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{profile.rank === "prospect" ? "Upgrade for unlimited" : "Unlimited access unlocked"}</p>
            </Card>
          </section>

          <section className="rounded-2xl border p-6 mb-10" style={{ borderColor: "color-mix(in oklab, var(--neon-blue-bright) 40%, transparent)", background: "linear-gradient(135deg, color-mix(in oklab, var(--neon-blue-bright) 8%, transparent), transparent)" }}>
            <h2 className="text-xs uppercase tracking-[0.4em] mb-3" style={{ color: "var(--neon-blue-bright)" }}>
              <Ticket className="inline h-4 w-4 mr-2" />Redeem Code
            </h2>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="0G-FOUNDER" className="font-mono uppercase" onKeyDown={(e) => e.key === "Enter" && onRedeem()} />
              <Button onClick={onRedeem} disabled={busy || !code} className="font-bold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-2" />Redeem</>}
              </Button>
            </div>
          </section>
        </>
      )}

      {/* History */}
      <section className="space-y-6">
        <ZeroGStreamPanel />
        <h2 className="text-xs uppercase tracking-[0.4em] text-muted-foreground"><History className="inline h-3.5 w-3.5 mr-2" />Transmission History</h2>

        <HistoryGroup title="Portals you spawned" empty="You haven't spawned any portals yet." Icon={Sparkles}>
          {spawns.map((s) => (
            <HistoryRow key={s.id} title={s.name} sub={`${s.kind} · ${new Date(s.created_at).toLocaleDateString()}`} to={s.kind === "music" ? `/m/${s.slug}` : `/p/${s.slug}`} />
          ))}
        </HistoryGroup>

        {!isBoss && (
          <>
            <HistoryGroup title="VIP portals unlocked" empty="No VIP portal unlocks yet." Icon={Mic2}>
              {unlocks.filter((u) => u.portal).map((u) => (
                <HistoryRow key={u.id} title={u.portal!.name} sub={new Date(u.created_at).toLocaleDateString()} to={`/p/${u.portal!.slug}`} />
              ))}
            </HistoryGroup>

            <HistoryGroup title="Tracks you own" empty="No track purchases yet." Icon={Music}>
              {trackBuys.filter((t) => t.track).map((t) => (
                <HistoryRow key={t.id} title={t.track!.title} sub={`${t.track!.portal_slug} · ${new Date(t.created_at).toLocaleDateString()}`} to={`/m/${t.track!.portal_slug}`} />
              ))}
            </HistoryGroup>
          </>
        )}
      </section>

      <footer className="mt-16 pt-8 border-t border-border text-center text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
        {isBoss ? "0G-PORTAL · Boss · Ultimate Creator" : "0G-PORTAL · Syndicate Member · Frequency Unlocked"}
      </footer>
    </main>
  );
}

function BossPanel() {
  const [stats, setStats] = useState({ total: 0, active30: 0, vip: 0, expiring: 0 });
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("boss:auto-reminders") !== "off";
  });
  const [reminderDays, setReminderDays] = useState<string>(() => {
    if (typeof window === "undefined") return "7";
    return localStorage.getItem("boss:reminder-days") ?? "7";
  });

  useEffect(() => {
    localStorage.setItem("boss:auto-reminders", reminders ? "on" : "off");
  }, [reminders]);
  useEffect(() => {
    localStorage.setItem("boss:reminder-days", reminderDays);
  }, [reminderDays]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const days = Math.max(1, parseInt(reminderDays, 10) || 7);
      const sinceActive = new Date(Date.now() - 30 * 86400_000).toISOString();
      const expiringSoon = new Date(Date.now() + days * 86400_000).toISOString();
      const nowIso = new Date().toISOString();

      const [tot, act, vip, exp] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).neq("rank", "boss"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).neq("rank", "boss").gte("updated_at", sinceActive),
        supabase.from("profiles").select("*", { count: "exact", head: true }).neq("rank", "boss").in("rank", ["vip", "enforcer"]),
        supabase.from("vip_passes").select("*", { count: "exact", head: true }).is("revoked_at", null).gte("expires_at", nowIso).lte("expires_at", expiringSoon),
      ]);
      setStats({
        total: tot.count ?? 0,
        active30: act.count ?? 0,
        vip: vip.count ?? 0,
        expiring: exp.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, [reminderDays]);

  return (
    <>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatTile icon={<Users className="h-4 w-4" />} label="Total Users" value={stats.total} tint="cyan" loading={loading} />
        <StatTile icon={<Activity className="h-4 w-4" />} label="Active (30d)" value={stats.active30} tint="emerald" loading={loading} />
        <StatTile icon={<Crown className="h-4 w-4" />} label="VIP+" value={stats.vip} tint="yellow" loading={loading} />
        <StatTile icon={<Clock className="h-4 w-4" />} label={`Expiring ≤${reminderDays}d`} value={stats.expiring} tint="pink" loading={loading} />
      </section>

      <section className="grid sm:grid-cols-2 gap-3 mb-6">
        <ActionTile
          to="/syndicate-overlord"
          icon={<UserPlus className="h-5 w-5" />}
          title="Create Users"
          desc="Mint redeem codes, signup passes & VIP grants."
          accent="#3ad6ff"
        />
        <ActionTile
          to="/syndicate-overlord"
          icon={<Settings2 className="h-5 w-5" />}
          title="Manage Users"
          desc="Roster, ranks, credits, hubs, feature flags."
          accent="#00e08a"
        />
        <ActionTile
          to="/syndicate-overlord"
          icon={<Activity className="h-5 w-5" />}
          title="Active Users"
          desc={`${stats.active30} touched the system in the last 30 days.`}
          accent="#7dffce"
        />
        <ActionTile
          to="/syndicate-overlord"
          icon={<Clock className="h-5 w-5" />}
          title="Expiring Soon"
          desc={`${stats.expiring} VIP pass${stats.expiring === 1 ? "" : "es"} burn out in ${reminderDays}d.`}
          accent="#ff5fa2"
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] font-bold flex items-center gap-2" style={{ color: "var(--neon-blue-bright)" }}>
              <BellRing className="h-3.5 w-3.5" /> Auto Reminders
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Auto-ping users whose VIP pass expires within{" "}
              <input
                type="number"
                min={1}
                max={90}
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                className="w-14 mx-1 bg-black/40 border border-border rounded px-2 py-0.5 text-center text-white font-mono"
              />{" "}
              days.
            </p>
          </div>
          <Switch
            checked={reminders}
            onCheckedChange={setReminders}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {reminders
            ? "ON · Members within the window receive a renewal nudge."
            : "OFF · No reminders will be sent."}
        </p>
      </section>
    </>
  );
}

function StatTile({ icon, label, value, tint, loading }: { icon: React.ReactNode; label: string; value: number; tint: "cyan" | "emerald" | "yellow" | "pink"; loading: boolean }) {
  const tints = {
    cyan: "border-cyan-700/40 text-cyan-300",
    emerald: "border-emerald-700/40 text-emerald-300",
    yellow: "border-yellow-700/40 text-yellow-300",
    pink: "border-pink-700/40 text-pink-300",
  };
  return (
    <div className={`rounded-xl border bg-card/70 px-4 py-3 ${tints[tint]}`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] opacity-70">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-black tabular-nums">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value.toLocaleString()}
      </div>
    </div>
  );
}

function ActionTile({ to, icon, title, desc, accent }: { to: string; icon: React.ReactNode; title: string; desc: string; accent: string }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border bg-card p-4 hover:bg-card/60 transition relative overflow-hidden"
      style={{ borderColor: `${accent}55` }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${accent}22, transparent 70%)` }}
      />
      <div className="relative flex items-start gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-white transition" />
      </div>
    </Link>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5">{children}</div>;
}

function HistoryGroup({ title, empty, Icon, children }: { title: string; empty: string; Icon: any; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasContent = items.filter(Boolean).length > 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-bold text-metallic mb-3"><Icon className="inline h-4 w-4 mr-2 text-[color:var(--neon-blue-bright)]" />{title}</p>
      {hasContent ? <ul className="divide-y divide-border">{children}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

function HistoryRow({ title, sub, to }: { title: string; sub: string; to: string }) {
  return (
    <li className="py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <Link to={to} className="text-xs uppercase tracking-widest font-bold text-[color:var(--neon-blue-bright)] inline-flex items-center gap-1">
        Open <ExternalLink className="h-3 w-3" />
      </Link>
    </li>
  );
}
