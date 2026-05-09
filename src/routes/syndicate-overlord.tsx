import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Skull, Loader2, Search, Sparkles, Plus, Minus, Ticket, Users, Wallet, Crown, X,
  Activity, Shield, Filter, Zap, Mail, Send, Trash2, NotebookPen, Pin, PinOff, Save,
  Clock, BellRing, CheckSquare, Square,
  Copy, Smile, Music, Wrench, Lock, Unlock, User as UserIcon, Coins,
  RefreshCw, Download, FileDown, Power, Eraser, Rocket, Star,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  adjustCredits, setRank, setFeatureFlags, createRedeemCode,
  grantVipPass, revokeVipPass, listVipPasses,
  grantByEmail, listPendingGrants, deletePendingGrant,
} from "@/lib/overlord.functions";
import { bossListResellers, bossCreateReseller, bossTopupReseller } from "@/lib/reseller.functions";
import { PassShareCardPanel } from "@/components/overlord/PassShareCardPanel";

const RANKS = ["prospect", "enforcer", "vip", "boss"] as const;
type Rank = typeof RANKS[number];
type Flags = { jokes: boolean; music: boolean; tools: boolean };
type Row = {
  id: string; email: string; status: "free" | "vip"; credits: number;
  rank: Rank; feature_flags: Flags; display_name: string | null; created_at: string;
};

/** Labeled form field used across generator panels for a clearer interface. */
function Field({
  label, hint, icon: Icon, className, children,
}: {
  label: string;
  hint?: string;
  icon?: any;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </label>
      {children}
      {hint ? <span className="text-[11px] text-emerald-600/80 normal-case tracking-normal leading-snug">{hint}</span> : null}
    </div>
  );
}

/** Header strip used at the top of each generator panel. */
function GeneratorHeader({
  icon: Icon, title, subtitle, accent,
}: {
  icon: any;
  title: string;
  subtitle: string;
  accent: "cyan" | "yellow" | "pink";
}) {
  const map = {
    cyan:   { bar: "from-cyan-500 to-cyan-300",   ring: "ring-cyan-500/30",  text: "text-cyan-200",   chip: "bg-cyan-500/15 text-cyan-300 border-cyan-700/40" },
    yellow: { bar: "from-yellow-400 to-amber-300", ring: "ring-yellow-500/30", text: "text-yellow-200", chip: "bg-yellow-500/15 text-yellow-300 border-yellow-700/40" },
    pink:   { bar: "from-pink-500 to-fuchsia-400", ring: "ring-pink-500/30",  text: "text-pink-200",   chip: "bg-pink-500/15 text-pink-300 border-pink-700/40" },
  } as const;
  const c = map[accent];
  return (
    <div className="mb-5 flex items-start gap-4">
      <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${c.bar} grid place-items-center text-black shadow-lg ring-4 ${c.ring}`}>
        <Icon className="h-6 w-6 stroke-[2.5]" />
      </div>
      <div className="min-w-0">
        <span className={`inline-block text-[10px] uppercase tracking-[0.4em] font-black px-2 py-0.5 rounded border ${c.chip} mb-1.5`}>
          Generator
        </span>
        <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${c.text} leading-tight`}>{title}</h2>
        <p className="mt-1 text-sm text-emerald-400/80 normal-case tracking-normal leading-snug">{subtitle}</p>
      </div>
    </div>
  );
}

const FIELD_INPUT = "h-11 bg-black/70 border-2 border-emerald-800/50 focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-500/30 text-emerald-100 placeholder:text-emerald-700 text-base font-bold tracking-tight";
const FIELD_SELECT = "h-11 bg-black/70 border-2 border-emerald-800/50 text-emerald-100 text-base font-bold tracking-tight";
const PRIMARY_BTN = "h-11 text-base font-black tracking-wider uppercase shadow-lg";

export const Route = createFileRoute("/syndicate-overlord")({
  head: () => ({ meta: [{ title: "Boss Control Center · 0G-PORTAL" }] }),
  component: OverlordPage,
});

function OverlordPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [rankFilter, setRankFilter] = useState<"all" | Rank>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active30, setActive30] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [reminders, setReminders] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("boss:auto-reminders") !== "off";
  });
  const [reminderDays, setReminderDays] = useState<string>(() => {
    if (typeof window === "undefined") return "7";
    return localStorage.getItem("boss:reminder-days") ?? "7";
  });

  useEffect(() => { localStorage.setItem("boss:auto-reminders", reminders ? "on" : "off"); }, [reminders]);
  useEffect(() => { localStorage.setItem("boss:reminder-days", reminderDays); }, [reminderDays]);

  const allowed = !!user && profile?.rank === "boss";

  useEffect(() => {
    if (loading) return;
    if (!allowed) navigate({ to: "/" });
  }, [allowed, loading, navigate]);

  const refreshUsers = () => {
    supabase.from("profiles")
      .select("id,email,status,credits,rank,feature_flags,display_name,created_at")
      .neq("rank", "boss")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows((data ?? []) as any);
      });
  };

  useEffect(() => {
    if (!allowed) return;
    refreshUsers();
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    const days = Math.max(1, parseInt(reminderDays, 10) || 7);
    const sinceActive = new Date(Date.now() - 30 * 86400_000).toISOString();
    const expiringSoon = new Date(Date.now() + days * 86400_000).toISOString();
    const nowIso = new Date().toISOString();
    Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).neq("rank", "boss").gte("updated_at", sinceActive),
      supabase.from("vip_passes").select("*", { count: "exact", head: true }).is("revoked_at", null).gte("expires_at", nowIso).lte("expires_at", expiringSoon),
    ]).then(([a, e]) => {
      setActive30(a.count ?? 0);
      setExpiringCount(e.count ?? 0);
    });
  }, [allowed, reminderDays, rows.length]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (rankFilter !== "all" && r.rank !== rankFilter) return false;
      if (!n) return true;
      return r.email.toLowerCase().includes(n) || (r.display_name ?? "").toLowerCase().includes(n);
    });
  }, [rows, q, rankFilter]);

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const stats = useMemo(() => ({
    total: rows.length,
    vip: rows.filter((r) => r.rank === "vip").length,
    enforcers: rows.filter((r) => r.rank === "enforcer").length,
    credits: rows.reduce((s, r) => s + (r.credits || 0), 0),
  }), [rows]);

  if (loading || !allowed) {
    return <main className="px-5 py-20 text-center font-mono text-emerald-400">Checking access…</main>;
  }

  return (
    <main className="relative min-h-screen bg-[#020a14] text-emerald-200 font-mono">
      <TerminalGrid />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.5em] text-cyan-400 flex items-center gap-2">
              <Skull className="h-3.5 w-3.5" /> BOSS CONTROL CENTER
            </p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-cyan-300 drop-shadow-[0_0_18px_rgba(58,214,255,0.4)]">
              Ultimate Control
            </h1>
            <p className="mt-1 text-xs text-emerald-600/80 normal-case tracking-normal">
              One command deck — users, credits, ranks, VIP passes, codes, resellers, and private notes.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
            <span className="px-2 py-1 rounded border border-emerald-700/50 text-emerald-300 flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-emerald-400 animate-pulse" /> live data
            </span>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard icon={<Users className="h-4 w-4" />} label="total users" value={stats.total} tint="cyan" />
          <StatCard icon={<Crown className="h-4 w-4" />} label="vip members" value={stats.vip} tint="yellow" />
          <StatCard icon={<Shield className="h-4 w-4" />} label="enforcers" value={stats.enforcers} tint="emerald" />
          <StatCard icon={<Zap className="h-4 w-4" />} label="credits in circulation" value={stats.credits} tint="pink" />
          <StatCard icon={<Activity className="h-4 w-4" />} label="active (30d)" value={active30} tint="emerald" />
          <StatCard icon={<Clock className="h-4 w-4" />} label={`expiring ≤${reminderDays}d`} value={expiringCount} tint="pink" />
        </div>

        {/* Auto reminders */}
        <div className="rounded-xl border border-emerald-700/30 bg-black/50 backdrop-blur p-4 mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold flex items-center gap-2 text-cyan-300">
              <BellRing className="h-3 w-3" /> Auto Reminders
            </p>
            <p className="mt-2 text-xs text-emerald-300/90 normal-case">
              Auto-ping users whose VIP pass expires within{" "}
              <input
                type="number"
                min={1}
                max={90}
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                className="w-14 mx-1 bg-black/60 border border-emerald-800/50 rounded px-2 py-0.5 text-center text-cyan-200 font-mono"
              />{" "}
              days. <span className="text-emerald-700">{reminders ? "ON" : "OFF"}</span>
            </p>
          </div>
          <Switch
            checked={reminders}
            onCheckedChange={setReminders}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>

        {/* Tabbed control surface */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="bg-transparent border-0 p-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 h-auto w-full">
            {([
              {
                v: "users", icon: Users, label: "Users",
                actions: [
                  { icon: RefreshCw, label: "Refresh", onClick: refreshUsers },
                  { icon: Star, label: "Select VIPs", onClick: () => setSelected(new Set(rows.filter(r => r.rank === "vip").map(r => r.id))) },
                  { icon: Eraser, label: "Clear filters", onClick: () => { setQ(""); setRankFilter("all"); setSelected(new Set()); } },
                ],
              },
              {
                v: "notes", icon: NotebookPen, label: "Private Notes",
                actions: [{ icon: Plus, label: "New note", onClick: () => window.dispatchEvent(new CustomEvent("boss:new-note")) }],
              },
              {
                v: "preload", icon: Mail, label: "Pre-load Credits",
                actions: [{ icon: Rocket, label: "Quick grant", onClick: () => window.dispatchEvent(new CustomEvent("boss:focus-preload")) }],
              },
              {
                v: "codes", icon: Ticket, label: "Redeem Codes",
                actions: [{ icon: Sparkles, label: "Quick code", onClick: () => window.dispatchEvent(new CustomEvent("boss:focus-codes")) }],
              },
              {
                v: "passes", icon: Crown, label: "VIP Passes",
                actions: [{ icon: Plus, label: "Grant pass", onClick: () => window.dispatchEvent(new CustomEvent("boss:focus-passes")) }],
              },
              {
                v: "resellers", icon: Wallet, label: "Resellers",
                actions: [{ icon: Plus, label: "New reseller", onClick: () => window.dispatchEvent(new CustomEvent("boss:focus-resellers")) }],
              },
              {
                v: "share", icon: Sparkles, label: "Share Card",
                actions: [],
              },
            ] as Array<{ v: string; icon: any; label: string; actions: Array<{ icon: any; label: string; onClick: () => void }> }>).map(({ v, icon: Icon, label, actions }) => (
              <div key={v} className="relative group">
                <TabsTrigger
                  value={v}
                  className="w-full flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-emerald-800/40 bg-black/60 backdrop-blur text-emerald-300 font-black uppercase tracking-wider text-base sm:text-lg shadow-lg transition-all hover:border-cyan-500/60 hover:bg-emerald-900/20 data-[state=active]:border-cyan-400 data-[state=active]:bg-emerald-700/30 data-[state=active]:text-cyan-200 data-[state=active]:shadow-[0_0_30px_-5px] data-[state=active]:shadow-cyan-500/50 data-[state=active]:scale-[1.02]"
                >
                  <Icon className="h-8 w-8 sm:h-10 sm:w-10 stroke-[2.5]" />
                  <span className="text-center leading-tight px-1">{label}</span>
                </TabsTrigger>
                {actions.length > 0 && (
                  <div className="pointer-events-none absolute inset-x-1 bottom-1 flex flex-wrap items-center justify-center gap-1 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-150 z-10">
                    {actions.map((a, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); a.onClick(); }}
                        title={a.label}
                        className="px-2 py-1 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-cyan-500/40"
                      >
                        <a.icon className="h-3 w-3" />
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </TabsList>

          {/* Power Action tiles — quick launches that don't change tab */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: RefreshCw, label: "Refresh All", tint: "emerald",
                onClick: () => { refreshUsers(); toast.success("Refreshed all data"); },
              },
              {
                icon: FileDown, label: "Export CSV", tint: "cyan",
                onClick: () => {
                  const csv = [
                    ["email","display_name","rank","status","credits","jokes","music","tools","created_at"].join(","),
                    ...rows.map(r => [
                      r.email, r.display_name ?? "", r.rank, r.status, r.credits,
                      r.feature_flags.jokes, r.feature_flags.music, r.feature_flags.tools, r.created_at,
                    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")),
                  ].join("\n");
                  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  const a = document.createElement("a");
                  a.href = url; a.download = `users-${Date.now()}.csv`; a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`Exported ${rows.length} users`);
                },
              },
              {
                icon: Copy, label: "Copy Emails", tint: "violet",
                onClick: async () => {
                  const list = (filtered.length ? filtered : rows).map(r => r.email).join("\n");
                  await navigator.clipboard.writeText(list);
                  toast.success(`Copied ${(filtered.length ? filtered : rows).length} emails`);
                },
              },
              {
                icon: Power, label: "Clear Selection", tint: "rose",
                onClick: () => { setSelected(new Set()); toast.success("Selection cleared"); },
              },
            ].map(({ icon: Icon, label, tint, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className={`flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 bg-black/60 backdrop-blur font-black uppercase tracking-wider text-sm sm:text-base shadow-lg transition-all hover:scale-[1.03] active:scale-95 ${
                  tint === "emerald" ? "border-emerald-700/50 text-emerald-300 hover:border-emerald-400 hover:shadow-emerald-500/40 hover:shadow-[0_0_25px_-5px]" :
                  tint === "cyan" ? "border-cyan-700/50 text-cyan-300 hover:border-cyan-400 hover:shadow-cyan-500/40 hover:shadow-[0_0_25px_-5px]" :
                  tint === "violet" ? "border-violet-700/50 text-violet-300 hover:border-violet-400 hover:shadow-violet-500/40 hover:shadow-[0_0_25px_-5px]" :
                  "border-rose-700/50 text-rose-300 hover:border-rose-400 hover:shadow-rose-500/40 hover:shadow-[0_0_25px_-5px]"
                }`}
              >
                <Icon className="h-7 w-7 sm:h-8 sm:w-8 stroke-[2.5]" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* USERS */}
          <TabsContent value="users" className="mt-4">
            <div className="rounded-xl border border-emerald-700/30 bg-black/50 backdrop-blur">
              <div className="p-4 flex flex-wrap items-center gap-3 border-b border-emerald-800/40 bg-gradient-to-r from-emerald-950/40 to-cyan-950/30">
                <div className="relative flex-1 min-w-[260px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Quick search — email or name…"
                    className="pl-12 pr-10 h-12 bg-black/70 border-2 border-cyan-700/50 focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-500/30 text-cyan-100 placeholder:text-emerald-700 font-bold text-base shadow-lg"
                  />
                  {q && (
                    <button
                      onClick={() => setQ("")}
                      title="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-emerald-500 hover:text-rose-300 hover:bg-rose-900/20 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <span className="px-3 py-2 rounded-lg bg-black/60 border border-cyan-700/40 text-cyan-300 font-black text-sm tabular-nums">
                  {filtered.length}<span className="text-emerald-700 font-bold"> / {rows.length}</span>
                </span>
              </div>
              <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 border-b border-emerald-800/40 bg-black/40">
                <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-emerald-600 font-bold">
                  <Filter className="h-3.5 w-3.5" /> Rank
                </span>
                {(["all", "prospect", "enforcer", "vip"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRankFilter(r as any)}
                    className={`px-3 py-1.5 rounded-lg border-2 text-xs uppercase tracking-widest font-black transition ${
                      rankFilter === r
                        ? "border-cyan-400 text-cyan-200 bg-cyan-500/15 shadow-[0_0_15px_-3px] shadow-cyan-500/40"
                        : "border-emerald-800/40 text-emerald-500 hover:text-emerald-200 hover:border-emerald-600"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <BulkActionBar
                selected={selected}
                rows={rows}
                onClear={() => setSelected(new Set())}
                onApplied={(updates) => {
                  setRows((rs) => rs.map((r) => updates[r.id] ? { ...r, ...updates[r.id] } : r));
                }}
              />

              <div className="flex items-center gap-3 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-cyan-400 border-b border-emerald-800/40 bg-black/40">
                <button
                  onClick={() => {
                    const allIds = filtered.map((r) => r.id);
                    const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
                    setSelected(allSelected ? new Set() : new Set(allIds));
                  }}
                  title="Select all visible"
                  className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-100 font-bold"
                >
                  {filtered.length > 0 && filtered.every((r) => selected.has(r.id))
                    ? <CheckSquare className="h-4 w-4" />
                    : <Square className="h-4 w-4" />}
                  Select all visible
                </button>
                <span className="ml-auto text-emerald-700">Tap a card to toggle controls</span>
              </div>

              <div className="max-h-[70vh] overflow-y-auto divide-y divide-emerald-900/30">
                {filtered.map((r) => (
                  <UserRow
                    key={r.id}
                    row={r}
                    selected={selected.has(r.id)}
                    onToggleSelect={() => toggleSelect(r.id)}
                    onChange={(p) => updateRow(r.id, p)}
                  />
                ))}
                {filtered.length === 0 && (
                  <p className="px-5 py-12 text-center text-emerald-700">No users match your search.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="codes" className="mt-4"><RedeemCodePanel /></TabsContent>
          <TabsContent value="notes" className="mt-4"><NotesPanel /></TabsContent>
          <TabsContent value="preload" className="mt-4"><PreLoadPanel onApplied={refreshUsers} /></TabsContent>
          <TabsContent value="passes" className="mt-4"><VipPassPanel rows={rows} /></TabsContent>
          <TabsContent value="resellers" className="mt-4"><ResellerAdminPanel rows={rows} /></TabsContent>
          <TabsContent value="share" className="mt-4"><PassShareCardPanel /></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: number; tint: "cyan" | "yellow" | "emerald" | "pink" }) {
  const tints = {
    cyan: "border-cyan-700/50 text-cyan-300 shadow-[0_0_24px_-12px_rgb(34_211_238/0.6)]",
    yellow: "border-yellow-700/50 text-yellow-300 shadow-[0_0_24px_-12px_rgb(250_204_21/0.6)]",
    emerald: "border-emerald-700/50 text-emerald-300 shadow-[0_0_24px_-12px_rgb(16_185_129/0.6)]",
    pink: "border-pink-700/50 text-pink-300 shadow-[0_0_24px_-12px_rgb(236_72_153/0.6)]",
  };
  return (
    <div className={`rounded-xl border bg-black/60 backdrop-blur px-4 py-4 ${tints[tint]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-80 leading-tight">{label}</span>
        <span className="opacity-90">{icon}</span>
      </div>
      <div className="mt-2 text-3xl sm:text-4xl font-black tabular-nums leading-none">{value.toLocaleString()}</div>
    </div>
  );
}

function TerminalGrid() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 opacity-25"
        style={{ backgroundImage: "linear-gradient(rgba(58,214,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(58,214,255,0.06) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(900px circle at 50% -10%, rgba(58,214,255,0.18), transparent 60%)" }} />
    </>
  );
}

const RANK_STYLES: Record<Rank, string> = {
  prospect: "bg-emerald-500/10 text-emerald-300 border-emerald-700/40",
  enforcer: "bg-cyan-500/10 text-cyan-300 border-cyan-700/40",
  vip: "bg-yellow-500/10 text-yellow-300 border-yellow-700/40",
  boss: "bg-pink-500/10 text-pink-300 border-pink-700/40",
};

function UserRow({ row, onChange, selected, onToggleSelect }: { row: Row; onChange: (p: Partial<Row>) => void; selected: boolean; onToggleSelect: () => void }) {
  const adj = useServerFn(adjustCredits);
  const setR = useServerFn(setRank);
  const setF = useServerFn(setFeatureFlags);
  const [delta, setDelta] = useState("0");
  const [busy, setBusy] = useState(false);

  const give = async (amount: number) => {
    setBusy(true);
    try {
      if (!amount) throw new Error("Enter an amount");
      const r = await adj({ data: { userId: row.id, delta: amount, reason: "boss:adjust" } });
      onChange({ credits: r.credits });
      setDelta("0");
      toast.success(`${row.email}: ${amount > 0 ? "+" : ""}${amount} → ${r.credits} credits`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const apply = () => {
    const n = parseInt(delta, 10);
    if (!Number.isFinite(n) || n === 0) { toast.error("Enter a non-zero amount"); return; }
    give(n);
  };
  const changeRank = async (rank: Rank) => {
    setBusy(true);
    try {
      await setR({ data: { userId: row.id, rank } });
      onChange({ rank, status: rank === "vip" || rank === "boss" ? "vip" : "free" });
      toast.success(`${row.email} is now ${rank.toUpperCase()}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const toggleFlag = async (key: keyof Flags) => {
    const flags = { ...row.feature_flags, [key]: !row.feature_flags[key] };
    setBusy(true);
    try { await setF({ data: { userId: row.id, flags } }); onChange({ feature_flags: flags }); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const setAllFlags = async (value: boolean) => {
    const flags: Flags = { jokes: value, music: value, tools: value };
    setBusy(true);
    try {
      await setF({ data: { userId: row.id, flags } });
      onChange({ feature_flags: flags });
      toast.success(`${value ? "Unlocked" : "Locked"} all features for ${row.email}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const copyEmail = () => {
    navigator.clipboard?.writeText(row.email);
    toast.success("Email copied");
  };

  const n = parseInt(delta, 10);
  const FLAGS: Array<{ k: keyof Flags; Icon: any; label: string }> = [
    { k: "jokes", Icon: Smile, label: "Jokes" },
    { k: "music", Icon: Music, label: "Music" },
    { k: "tools", Icon: Wrench, label: "Tools" },
  ];
  const RANK_BTNS: Array<{ r: Rank; Icon: any }> = [
    { r: "prospect", Icon: UserIcon },
    { r: "enforcer", Icon: Shield },
    { r: "vip", Icon: Crown },
  ];

  return (
    <div className={`p-4 sm:p-5 transition ${selected ? "bg-cyan-900/15" : "hover:bg-emerald-900/5"}`}>
      {/* Identity row */}
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleSelect}
          title={selected ? "Deselect" : "Select for bulk action"}
          className="mt-0.5 text-cyan-400 hover:text-cyan-200 flex-shrink-0"
        >
          {selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
        </button>
        <span
          className={`mt-2 inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${row.status === "vip" ? "bg-yellow-400 shadow-[0_0_10px_rgb(250_204_21/0.9)]" : "bg-emerald-700"}`}
          title={row.status === "vip" ? "Active VIP" : "Free account"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-emerald-100 truncate">{row.email}</h3>
            <button onClick={copyEmail} className="text-emerald-700 hover:text-cyan-300 flex-shrink-0" title="Copy email">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5 truncate">
            {row.display_name ?? "no name"} · joined {new Date(row.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="outline" className={`text-[11px] uppercase tracking-widest font-bold flex-shrink-0 ${RANK_STYLES[row.rank]}`}>
          {row.rank}
        </Badge>
      </div>

      {/* Rank pills */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-emerald-600 mr-1">Rank</span>
        {RANK_BTNS.map(({ r, Icon }) => {
          const active = row.rank === r;
          return (
            <button
              key={r}
              onClick={() => !active && changeRank(r)}
              disabled={busy || active}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-bold uppercase tracking-widest transition ${
                active
                  ? `${RANK_STYLES[r]} ring-1 ring-cyan-400/50`
                  : "border-emerald-900/50 text-emerald-700 hover:text-emerald-200 hover:border-emerald-700"
              }`}
            >
              <Icon className="h-4 w-4" /> {r}
            </button>
          );
        })}
      </div>

      {/* Credits */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-emerald-600 mr-1 flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-cyan-400" /> Credits
        </span>
        <span className="text-2xl font-black tabular-nums text-cyan-200 tracking-tight">{row.credits.toLocaleString()}</span>
        <div className="ml-auto flex items-center gap-1 flex-wrap">
          {[10, 50, 100, 500].map((v) => (
            <Button key={`+${v}`} size="sm" disabled={busy} onClick={() => give(v)}
              className="h-8 px-2.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-black" title={`Add ${v}`}>+{v}</Button>
          ))}
          {[50, 100].map((v) => (
            <Button key={`-${v}`} size="sm" disabled={busy} onClick={() => give(-v)}
              className="h-8 px-2.5 text-xs font-bold bg-rose-700 hover:bg-rose-600 text-white" title={`Remove ${v}`}>−{v}</Button>
          ))}
          <Input
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="±"
            className="h-8 w-16 bg-black/60 border-emerald-800/40 text-emerald-200 font-mono text-xs text-center"
          />
          <Button size="icon" onClick={apply} disabled={busy || !n}
            className="h-8 w-8 bg-cyan-600 hover:bg-cyan-500 text-black" title={n < 0 ? "Remove" : "Add"}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (n < 0 ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />)}
          </Button>
        </div>
      </div>

      {/* Feature toggles */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {FLAGS.map(({ k, Icon, label }) => {
          const on = row.feature_flags[k];
          return (
            <button
              key={k}
              onClick={() => toggleFlag(k)}
              disabled={busy}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition ${
                on
                  ? "border-cyan-600/60 bg-cyan-500/10 text-cyan-200"
                  : "border-emerald-900/50 bg-black/40 text-emerald-700 hover:text-emerald-300"
              }`}
              title={`${on ? "Disable" : "Enable"} ${label}`}
            >
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <Icon className="h-4 w-4" /> {label}
              </span>
              <Switch checked={on} className="data-[state=checked]:bg-cyan-500 pointer-events-none scale-90" />
            </button>
          );
        })}
      </div>

      {/* Extra controls */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Button size="sm" disabled={busy} onClick={() => setAllFlags(true)}
          className="h-8 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-emerald-100">
          <Unlock className="h-3.5 w-3.5 mr-1.5" /> Unlock all
        </Button>
        <Button size="sm" disabled={busy} onClick={() => setAllFlags(false)}
          className="h-8 text-xs font-bold bg-rose-900 hover:bg-rose-800 text-rose-100">
          <Lock className="h-3.5 w-3.5 mr-1.5" /> Lock all
        </Button>
        {row.rank !== "vip" ? (
          <Button size="sm" disabled={busy} onClick={() => changeRank("vip")}
            className="h-8 text-xs font-bold bg-yellow-500 hover:bg-yellow-400 text-black">
            <Crown className="h-3.5 w-3.5 mr-1.5" /> Make VIP
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => changeRank("prospect")}
            className="h-8 text-xs font-bold bg-emerald-900 hover:bg-emerald-800 text-emerald-100">
            Reset rank
          </Button>
        )}
        {row.credits > 0 && (
          <Button size="sm" disabled={busy} onClick={() => give(-row.credits)}
            className="h-8 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200" title="Zero out balance">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Zero credits
          </Button>
        )}
        <span className="ml-auto text-[10px] text-emerald-700 uppercase tracking-widest" title={row.id}>
          id {row.id.slice(0, 8)}
        </span>
      </div>
    </div>
  );
}

function RedeemCodePanel() {
  const create = useServerFn(createRedeemCode);
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("25");
  const [maxUses, setMaxUses] = useState("1");
  const [grantRank, setGrantRank] = useState<Rank | "">("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await create({ data: { code, credits: Number(credits), maxUses: Number(maxUses), grantRank: grantRank || null } });
      if (!r?.code) { toast.error("Mint failed"); return; }
      toast.success(`Minted ${r.code.code} · ${r.code.credits} credits × ${r.code.max_uses}`);
      setCode("");
    } catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg || "Mint failed");
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border-2 border-cyan-700/30 bg-gradient-to-br from-black/70 to-cyan-950/20 p-6 backdrop-blur shadow-xl">
      <GeneratorHeader
        icon={Ticket}
        accent="cyan"
        title="Create a Redeem Code"
        subtitle="Share the code — anyone who enters it gets credits (and a rank, if set)."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Code" hint="Word people will type" icon={Ticket}>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME50" className={`${FIELD_INPUT} uppercase`} />
        </Field>
        <Field label="Credits" hint="Per redemption" icon={Coins}>
          <Input value={credits} onChange={(e) => setCredits(e.target.value)} type="number" min="1" placeholder="25" className={FIELD_INPUT} />
        </Field>
        <Field label="Max uses" hint="How many people can redeem" icon={Users}>
          <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" min="1" placeholder="1" className={FIELD_INPUT} />
        </Field>
        <Field label="Bonus rank" hint="Optional rank upgrade on redeem" icon={Crown}>
          <Select value={grantRank || "none"} onValueChange={(v) => setGrantRank(v === "none" ? "" : v as Rank)}>
            <SelectTrigger className={FIELD_SELECT}><SelectValue /></SelectTrigger>
            <SelectContent className="bg-black border-emerald-800 text-emerald-200">
              <SelectItem value="none">No rank change</SelectItem>
              {RANKS.filter((r) => r !== "boss").map((r) => <SelectItem key={r} value={r}>Set rank: {r}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={submit} disabled={busy || !code} className={`${PRIMARY_BTN} px-6 bg-cyan-500 hover:bg-cyan-400 text-black`}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Sparkles className="h-5 w-5 mr-2" />Mint Code</>}
        </Button>
      </div>
    </section>
  );
}

function BulkActionBar({
  selected, rows, onClear, onApplied,
}: {
  selected: Set<string>;
  rows: Row[];
  onClear: () => void;
  onApplied: (updates: Record<string, Partial<Row>>) => void;
}) {
  const adj = useServerFn(adjustCredits);
  const setR = useServerFn(setRank);
  const setF = useServerFn(setFeatureFlags);
  const [busy, setBusy] = useState(false);
  const [customDelta, setCustomDelta] = useState("");

  if (selected.size === 0) return null;

  const ids = Array.from(selected);
  const targets = rows.filter((r) => selected.has(r.id));

  const runCredits = async (delta: number) => {
    setBusy(true);
    const updates: Record<string, Partial<Row>> = {};
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        const r = await adj({ data: { userId: id, delta, reason: "boss:bulk" } });
        updates[id] = { credits: r.credits };
        ok++;
      } catch { fail++; }
    }
    onApplied(updates);
    setBusy(false);
    toast.success(`${delta > 0 ? "+" : ""}${delta} credits → ${ok} users${fail ? ` · ${fail} failed` : ""}`);
  };

  const runRank = async (rank: Rank) => {
    setBusy(true);
    const updates: Record<string, Partial<Row>> = {};
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        await setR({ data: { userId: id, rank } });
        updates[id] = { rank, status: rank === "vip" || rank === "boss" ? "vip" : "free" };
        ok++;
      } catch { fail++; }
    }
    onApplied(updates);
    setBusy(false);
    toast.success(`Rank → ${rank.toUpperCase()} on ${ok} users${fail ? ` · ${fail} failed` : ""}`);
  };

  const runFlag = async (key: keyof Flags, value: boolean) => {
    setBusy(true);
    const updates: Record<string, Partial<Row>> = {};
    let ok = 0, fail = 0;
    for (const t of targets) {
      const flags = { ...t.feature_flags, [key]: value };
      try {
        await setF({ data: { userId: t.id, flags } });
        updates[t.id] = { feature_flags: flags };
        ok++;
      } catch { fail++; }
    }
    onApplied(updates);
    setBusy(false);
    toast.success(`${key} ${value ? "ON" : "OFF"} on ${ok} users${fail ? ` · ${fail} failed` : ""}`);
  };

  const runAllFlags = async (value: boolean) => {
    setBusy(true);
    const updates: Record<string, Partial<Row>> = {};
    let ok = 0, fail = 0;
    const flags: Flags = { jokes: value, music: value, tools: value };
    for (const t of targets) {
      try {
        await setF({ data: { userId: t.id, flags } });
        updates[t.id] = { feature_flags: flags };
        ok++;
      } catch { fail++; }
    }
    onApplied(updates);
    setBusy(false);
    toast.success(`${value ? "Unlocked" : "Locked"} all features on ${ok} users${fail ? ` · ${fail} failed` : ""}`);
  };

  const runZeroCredits = async () => {
    setBusy(true);
    const updates: Record<string, Partial<Row>> = {};
    let ok = 0, fail = 0;
    for (const t of targets) {
      const delta = -t.credits;
      if (delta === 0) { ok++; continue; }
      try {
        const r = await adj({ data: { userId: t.id, delta, reason: "boss:bulk:zero" } });
        updates[t.id] = { credits: r.credits };
        ok++;
      } catch { fail++; }
    }
    onApplied(updates);
    setBusy(false);
    toast.success(`Zeroed credits on ${ok} users${fail ? ` · ${fail} failed` : ""}`);
  };

  const runCustomDelta = async () => {
    const n = Number(customDelta);
    if (!Number.isFinite(n) || n === 0) { toast.error("Enter a non-zero number"); return; }
    await runCredits(n);
    setCustomDelta("");
  };

  return (
    <div className="px-3 py-2 border-b border-cyan-700/40 bg-cyan-950/30 backdrop-blur flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-300 font-bold">
        {busy ? <Loader2 className="h-3 w-3 inline animate-spin mr-1" /> : null}
        {selected.size} selected
      </span>
      <span className="text-[10px] text-emerald-700 uppercase tracking-widest">credits:</span>
      {[50, 100, 500].map((v) => (
        <Button key={`+${v}`} size="sm" disabled={busy} onClick={() => runCredits(v)} className="h-6 px-2 text-[10px] bg-emerald-700 hover:bg-emerald-600 text-black">+{v}</Button>
      ))}
      {[50, 100].map((v) => (
        <Button key={`-${v}`} size="sm" disabled={busy} onClick={() => runCredits(-v)} className="h-6 px-2 text-[10px] bg-rose-700 hover:bg-rose-600 text-white">−{v}</Button>
      ))}
      <Input
        value={customDelta}
        onChange={(e) => setCustomDelta(e.target.value)}
        placeholder="±N"
        type="number"
        className="h-6 w-16 px-1 text-[10px] bg-black/60 border-emerald-800/40 text-emerald-200 font-mono"
      />
      <Button size="sm" disabled={busy || !customDelta} onClick={runCustomDelta} className="h-6 px-2 text-[10px] bg-cyan-600 hover:bg-cyan-500 text-black font-bold">
        <Coins className="h-3 w-3 mr-1" />Apply
      </Button>
      <Button size="sm" disabled={busy} onClick={runZeroCredits} className="h-6 px-2 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200">
        Zero
      </Button>
      <span className="text-[10px] text-emerald-700 uppercase tracking-widest ml-2">rank:</span>
      <Button size="sm" disabled={busy} onClick={() => runRank("prospect")} className="h-6 px-2 text-[10px] bg-emerald-900 hover:bg-emerald-800 text-emerald-100">
        <UserIcon className="h-3 w-3 mr-1" />Prospect
      </Button>
      <Button size="sm" disabled={busy} onClick={() => runRank("enforcer")} className="h-6 px-2 text-[10px] bg-cyan-700 hover:bg-cyan-600 text-white">
        <Shield className="h-3 w-3 mr-1" />Enforcer
      </Button>
      <Button size="sm" disabled={busy} onClick={() => runRank("vip")} className="h-6 px-2 text-[10px] bg-yellow-500 hover:bg-yellow-400 text-black">
        <Crown className="h-3 w-3 mr-1" />VIP
      </Button>
      <span className="text-[10px] text-emerald-700 uppercase tracking-widest ml-2">features:</span>
      <Button size="sm" disabled={busy} onClick={() => runAllFlags(true)} className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-black font-bold">
        <Unlock className="h-3 w-3 mr-1" />Unlock all
      </Button>
      <Button size="sm" disabled={busy} onClick={() => runAllFlags(false)} className="h-6 px-2 text-[10px] bg-rose-700 hover:bg-rose-600 text-white font-bold">
        <Lock className="h-3 w-3 mr-1" />Lock all
      </Button>
      {(["jokes","music","tools"] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <Button size="sm" disabled={busy} onClick={() => runFlag(k, true)} className="h-6 px-2 text-[10px] bg-cyan-700 hover:bg-cyan-600 text-white">{k}+</Button>
          <Button size="sm" disabled={busy} onClick={() => runFlag(k, false)} className="h-6 px-2 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200">{k}−</Button>
        </span>
      ))}
      <button onClick={onClear} disabled={busy} className="ml-auto text-[10px] uppercase tracking-widest text-emerald-600 hover:text-emerald-300">
        <X className="h-3 w-3 inline mr-1" />Clear
      </button>
    </div>
  );
}

function ResellerAdminPanel({ rows }: { rows: Row[] }) {
  const list = useServerFn(bossListResellers);
  const create = useServerFn(bossCreateReseller);
  const topup = useServerFn(bossTopupReseller);
  const [resellers, setResellers] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [initialCredits, setInitialCredits] = useState("100");
  const [markup, setMarkup] = useState("500");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { const r = await list(); setResellers(r.resellers ?? []); }
    catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Failed to load resellers");
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const submit = async () => {
    setBusy(true);
    try {
      await create({ data: { userId, displayName, initialCredits: Number(initialCredits), markupCents: Number(markup) } });
      toast.success("Reseller activated");
      setUserId(""); setDisplayName("");
      refresh();
    } catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Failed");
    } finally { setBusy(false); }
  };

  const adjust = async (uid: string, delta: number) => {
    try { const r = await topup({ data: { userId: uid, delta, reason: "boss:adjust" } }); toast.success(`Wallet: ${r.credits}c`); refresh(); }
    catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Failed");
    }
  };

  const emailOf = (uid: string) => rows.find((r) => r.id === uid)?.email ?? uid.slice(0, 8) + "…";

  return (
    <section className="rounded-2xl border-2 border-pink-700/30 bg-gradient-to-br from-black/70 to-pink-950/20 p-6 backdrop-blur shadow-xl">
      <GeneratorHeader
        icon={Users}
        accent="pink"
        title="Reseller Program"
        subtitle="Give a user a wallet so they can sell credits on your behalf."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Choose user" hint="Pick from existing accounts" icon={UserIcon}>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className={FIELD_SELECT}>
              <SelectValue placeholder="Choose a user…" />
            </SelectTrigger>
            <SelectContent className="bg-black border-emerald-800 text-emerald-200 max-h-72">
              {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reseller name" hint="Display label for their store" icon={NotebookPen}>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Acme Drops" className={FIELD_INPUT} />
        </Field>
        <Field label="Starting credits" hint="Wallet balance to seed" icon={Wallet}>
          <Input value={initialCredits} onChange={(e) => setInitialCredits(e.target.value)} type="number" min="0" placeholder="100" className={FIELD_INPUT} />
        </Field>
        <Field label="Markup (cents)" hint="Their profit per credit sold" icon={Coins}>
          <Input value={markup} onChange={(e) => setMarkup(e.target.value)} type="number" min="0" placeholder="500" className={FIELD_INPUT} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={submit} disabled={busy || !userId} className={`${PRIMARY_BTN} px-6 bg-pink-500 hover:bg-pink-400 text-black`}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Sparkles className="h-5 w-5 mr-2" />Activate Reseller</>}
        </Button>
      </div>

      <div className="mt-5 divide-y divide-pink-900/20">
        {resellers.length === 0 && <p className="text-xs text-emerald-700 py-2">No resellers yet.</p>}
        {resellers.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="text-pink-200 flex items-center gap-2">
                {emailOf(r.user_id)}
                <Badge variant="outline" className={r.active ? "border-emerald-700 text-emerald-300" : "border-rose-700 text-rose-300"}>
                  {r.active ? "active" : "disabled"}
                </Badge>
              </p>
              <p className="text-[10px] text-emerald-700">
                {r.display_name ?? "—"} · markup ${(r.markup_cents/100).toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-cyan-300 tabular-nums w-16 text-right font-mono">{r.credits}c</span>
              <Button size="sm" onClick={() => adjust(r.user_id, 100)} className="h-7 bg-emerald-700 hover:bg-emerald-600 text-black">+100</Button>
              <Button size="sm" onClick={() => adjust(r.user_id, -100)} className="h-7 bg-rose-700 hover:bg-rose-600 text-white">-100</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PreLoadPanel({ onApplied }: { onApplied: () => void }) {
  const grant = useServerFn(grantByEmail);
  const list = useServerFn(listPendingGrants);
  const remove = useServerFn(deletePendingGrant);
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState("50");
  const [grantRank, setGrantRank] = useState<Rank | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [showClaimed, setShowClaimed] = useState(false);

  const refresh = async () => {
    try { const r = await list(); setPending(r.grants ?? []); }
    catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Failed to load grants");
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await grant({
        data: {
          email,
          credits: Number(credits) || 0,
          grantRank: grantRank || null,
          notes: notes || undefined,
        },
      });
      if (r.status === "applied") {
        toast.success(`Applied · ${r.credits ?? 0} credits added to ${email}`);
        onApplied();
      } else {
        toast.success(`Queued · ${email} will receive on signup`);
      }
      setEmail(""); setNotes("");
      refresh();
    } catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Grant failed");
    } finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    try { await remove({ data: { id } }); toast.success("Removed"); refresh(); }
    catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Failed");
    }
  };

  const visible = pending.filter((g) => showClaimed || !g.claimed_at);

  return (
    <section className="rounded-2xl border-2 border-cyan-700/30 bg-gradient-to-br from-black/70 to-cyan-950/20 p-6 backdrop-blur shadow-xl">
      <GeneratorHeader
        icon={Mail}
        accent="cyan"
        title="Pre-load Credits by Email"
        subtitle="If they're a user → credits land instantly. If not → queued, applied on signup."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Recipient email" hint="Who to credit" icon={Mail} className="lg:col-span-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" type="email" className={FIELD_INPUT} />
        </Field>
        <Field label="Credits" hint="Amount to grant" icon={Coins}>
          <Input value={credits} onChange={(e) => setCredits(e.target.value)} type="number" min="0" placeholder="50" className={FIELD_INPUT} />
        </Field>
        <Field label="Bonus rank" hint="Optional rank upgrade" icon={Crown}>
          <Select value={grantRank || "none"} onValueChange={(v) => setGrantRank(v === "none" ? "" : v as Rank)}>
            <SelectTrigger className={FIELD_SELECT}><SelectValue /></SelectTrigger>
            <SelectContent className="bg-black border-emerald-800 text-emerald-200">
              <SelectItem value="none">No rank change</SelectItem>
              {RANKS.filter((r) => r !== "boss").map((r) => <SelectItem key={r} value={r}>Set rank: {r}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Note" hint="Private — only you see this" icon={NotebookPen} className="lg:col-span-3">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. early supporter, conf giveaway…" className={FIELD_INPUT} />
        </Field>
        <div className="flex items-end">
          <Button onClick={submit} disabled={busy || !email} className={`${PRIMARY_BTN} w-full bg-cyan-500 hover:bg-cyan-400 text-black`}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-5 w-5 mr-2" />Send Grant</>}
          </Button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-widest text-emerald-700">
        <span>{visible.length} {visible.length === 1 ? "entry" : "entries"}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={showClaimed} onCheckedChange={setShowClaimed} className="scale-75 data-[state=checked]:bg-cyan-500" />
          Include claimed
        </label>
      </div>

      <div className="mt-2 divide-y divide-cyan-900/20">
        {visible.length === 0 && <p className="text-xs text-emerald-700 py-3">Nothing pre-loaded yet.</p>}
        {visible.map((g) => (
          <div key={g.id} className="flex items-center justify-between py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-cyan-200 flex items-center gap-2 truncate">
                {g.email}
                <Badge variant="outline" className={g.claimed_at ? "border-emerald-700 text-emerald-300" : "border-yellow-700 text-yellow-300"}>
                  {g.claimed_at ? "claimed" : "waiting"}
                </Badge>
                {g.grant_rank && (
                  <Badge variant="outline" className="border-pink-700 text-pink-300">{g.grant_rank}</Badge>
                )}
              </p>
              <p className="text-[10px] text-emerald-700">
                {g.credits} credits · created {new Date(g.created_at).toLocaleDateString()}
                {g.claimed_at ? ` · claimed ${new Date(g.claimed_at).toLocaleDateString()}` : ""}
                {g.notes ? ` · ${g.notes}` : ""}
              </p>
            </div>
            {!g.claimed_at && (
              <Button size="sm" onClick={() => cancel(g.id)} className="h-7 bg-rose-700 hover:bg-rose-600 text-white" title="Cancel this grant">
                <Trash2 className="h-3 w-3 mr-1" /> Cancel
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function VipPassPanel({ rows }: { rows: Row[] }) {
  const grant = useServerFn(grantVipPass);
  const revoke = useServerFn(revokeVipPass);
  const list = useServerFn(listVipPasses);
  const [passes, setPasses] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [preset, setPreset] = useState<"30" | "90" | "180" | "365" | "custom">("30");
  const [customDate, setCustomDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const refresh = async () => {
    try { const r = await list(); setPasses(r.passes ?? []); }
    catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Failed to load passes");
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const computeExpiry = (): string | null => {
    if (preset === "custom") {
      if (!customDate) return null;
      const d = new Date(customDate);
      if (isNaN(d.getTime()) || d <= new Date()) return null;
      return d.toISOString();
    }
    const days = parseInt(preset, 10);
    return new Date(Date.now() + days * 86400_000).toISOString();
  };

  const submit = async () => {
    if (!userId) { toast.error("Pick a user"); return; }
    const exp = computeExpiry();
    if (!exp) { toast.error("Invalid expiry date"); return; }
    setBusy(true);
    try {
      await grant({ data: { userId, expiresAt: exp, source: preset === "custom" ? "custom" : `${preset}d`, notes } });
      toast.success("VIP pass granted");
      setUserId(""); setNotes(""); setCustomDate("");
      refresh();
    } catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Grant failed");
    } finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    try { await revoke({ data: { passId: id } }); toast.success("Revoked"); refresh(); }
    catch (e: any) {
      let msg = e?.message;
      if (e instanceof Response) { try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; } }
      toast.error(msg ?? "Failed");
    }
  };

  const emailOf = (uid: string) => rows.find((r) => r.id === uid)?.email ?? uid.slice(0, 8) + "…";
  const fmt = (s: string) => new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const isActive = (p: any) => !p.revoked_at && new Date(p.expires_at) > new Date();
  const visible = passes.filter((p) => showInactive || isActive(p));

  return (
    <section className="rounded-2xl border-2 border-yellow-700/30 bg-gradient-to-br from-black/70 to-yellow-950/10 p-6 backdrop-blur shadow-xl">
      <GeneratorHeader
        icon={Crown}
        accent="yellow"
        title="Grant VIP Pass"
        subtitle="Choose a user, pick how long, and unlock VIP access immediately."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="User" hint="Search and pick a member" icon={UserIcon} className="lg:col-span-2">
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className={FIELD_SELECT}>
              <SelectValue placeholder="Choose a user…" />
            </SelectTrigger>
            <SelectContent className="bg-black border-emerald-800 text-emerald-200 max-h-72">
              {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Duration" hint="How long VIP lasts" icon={Clock}>
          <Select value={preset} onValueChange={(v) => setPreset(v as any)}>
            <SelectTrigger className={FIELD_SELECT}><SelectValue /></SelectTrigger>
            <SelectContent className="bg-black border-emerald-800 text-emerald-200">
              <SelectItem value="30">1 month</SelectItem>
              <SelectItem value="90">3 months</SelectItem>
              <SelectItem value="180">6 months</SelectItem>
              <SelectItem value="365">12 months</SelectItem>
              <SelectItem value="custom">Custom date…</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Custom expiry" hint="Only used when Duration = Custom" icon={Clock}>
          <Input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            disabled={preset !== "custom"}
            className={`${FIELD_INPUT} disabled:opacity-40`}
          />
        </Field>
        <Field label="Note" hint="Private reminder for you" icon={NotebookPen} className="lg:col-span-2">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. comp pass for podcast guest…" className={FIELD_INPUT} />
        </Field>
        <div className="flex items-end lg:col-span-1">
          <Button onClick={submit} disabled={busy} className={`${PRIMARY_BTN} w-full bg-yellow-500 hover:bg-yellow-400 text-black`}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Crown className="h-5 w-5 mr-2" />Grant VIP</>}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-widest text-emerald-700">
        <span>{visible.length} {visible.length === 1 ? "pass" : "passes"}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} className="scale-75 data-[state=checked]:bg-yellow-500" />
          Include expired
        </label>
      </div>

      <div className="mt-2 divide-y divide-yellow-900/20">
        {visible.length === 0 && <p className="text-xs text-emerald-700 py-3">No VIP passes yet.</p>}
        {visible.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="text-yellow-200 flex items-center gap-2">
                {emailOf(p.user_id)}
                <Badge variant="outline" className={isActive(p) ? "border-emerald-700 text-emerald-300" : "border-rose-700 text-rose-300"}>
                  {isActive(p) ? "active" : p.revoked_at ? "revoked" : "expired"}
                </Badge>
              </p>
              <p className="text-[10px] text-emerald-700">
                Expires {fmt(p.expires_at)} · {p.source}{p.notes ? ` · ${p.notes}` : ""}
              </p>
            </div>
            {isActive(p) && (
              <Button size="sm" onClick={() => cancel(p.id)} className="h-7 bg-rose-700 hover:bg-rose-600 text-white">
                <X className="h-3 w-3 mr-1" />Revoke
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

type Note = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

function NotesPanel() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("boss_notes")
      .select("id,title,body,pinned,created_at,updated_at")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setNotes((data ?? []) as Note[]);
  };
  useEffect(() => { refresh(); }, []);

  const reset = () => { setEditingId(null); setDraftTitle(""); setDraftBody(""); };

  const save = async () => {
    if (!user) return;
    const title = draftTitle.trim();
    const body = draftBody.trim();
    if (!title && !body) { toast.error("Add a title or some text first"); return; }
    setBusy(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("boss_notes")
          .update({ title, body })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Note updated");
      } else {
        const { error } = await supabase
          .from("boss_notes")
          .insert({ user_id: user.id, title, body });
        if (error) throw error;
        toast.success("Note saved");
      }
      reset();
      refresh();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setBusy(false); }
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setDraftTitle(n.title);
    setDraftBody(n.body);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("boss_notes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (editingId === id) reset();
    toast.success("Deleted");
    refresh();
  };

  const togglePin = async (n: Note) => {
    const { error } = await supabase
      .from("boss_notes")
      .update({ pinned: !n.pinned })
      .eq("id", n.id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return notes;
    return notes.filter((n) =>
      n.title.toLowerCase().includes(s) || n.body.toLowerCase().includes(s)
    );
  }, [notes, q]);

  return (
    <section className="grid lg:grid-cols-2 gap-4">
      {/* Editor */}
      <div className="rounded-xl border border-emerald-700/30 bg-black/50 p-5 backdrop-blur">
        <h2 className="text-xs uppercase tracking-[0.4em] text-cyan-400 mb-1 flex items-center gap-2">
          <NotebookPen className="h-3.5 w-3.5" /> {editingId ? "Edit Note" : "New Note"}
        </h2>
        <p className="text-[10px] text-emerald-700 uppercase tracking-widest mb-4">
          Private to you. No one else can ever see these — not admins, not other users.
        </p>
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Title (e.g. Sarah's phone number)"
          className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono mb-2"
        />
        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          placeholder="Write anything here — phone numbers, addresses, reminders, ideas. Only you can see it."
          rows={8}
          className="w-full rounded-md bg-black/60 border border-emerald-800/40 text-emerald-200 placeholder:text-emerald-700 font-mono text-sm p-3 focus:outline-none focus:border-cyan-500"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={save} disabled={busy} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />{editingId ? "Update" : "Save Note"}</>}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={reset} className="border-emerald-700/50 text-emerald-300">
              Cancel
            </Button>
          )}
          <span className="ml-auto text-[10px] text-emerald-700 uppercase tracking-widest">
            {draftBody.length} chars
          </span>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-emerald-700/30 bg-black/50 backdrop-blur">
        <div className="p-3 border-b border-emerald-800/40 flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-cyan-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your notes…"
            className="h-8 bg-black/60 border-emerald-800/40 text-emerald-200 placeholder:text-emerald-700 font-mono text-xs"
          />
          <span className="text-[10px] text-emerald-700 ml-auto whitespace-nowrap">{filtered.length} / {notes.length}</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-emerald-900/30">
          {filtered.length === 0 && (
            <p className="px-5 py-12 text-center text-emerald-700">No notes yet. Write your first one on the left.</p>
          )}
          {filtered.map((n) => (
            <article key={n.id} className={`p-4 hover:bg-emerald-900/5 transition ${editingId === n.id ? "bg-cyan-500/5" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-emerald-100 font-bold flex items-center gap-2 truncate">
                    {n.pinned && <Pin className="h-3 w-3 text-yellow-400 shrink-0" />}
                    {n.title || <span className="text-emerald-700 italic">Untitled</span>}
                  </h3>
                  {n.body && (
                    <p className="mt-1 text-sm text-emerald-300 whitespace-pre-wrap break-words">
                      {n.body.length > 240 ? n.body.slice(0, 240) + "…" : n.body}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-emerald-700 uppercase tracking-widest">
                    Updated {new Date(n.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => togglePin(n)} title={n.pinned ? "Unpin" : "Pin to top"} className="h-7 w-7 text-yellow-400 hover:bg-yellow-500/10">
                    {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(n)} title="Edit" className="h-7 w-7 text-cyan-300 hover:bg-cyan-500/10">
                    <NotebookPen className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(n.id)} title="Delete" className="h-7 w-7 text-rose-300 hover:bg-rose-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
