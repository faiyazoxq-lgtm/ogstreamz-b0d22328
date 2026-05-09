import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Skull, Loader2, Search, Sparkles, Plus, Minus, Ticket, Users, Wallet, Crown, X,
  Activity, Shield, Filter, Zap, ChevronDown, Mail, Send, Trash2, NotebookPen, Pin, PinOff, Save,
  Clock, BellRing, CheckSquare, Square,
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
          <TabsList className="bg-black/60 border border-emerald-800/40 p-1 flex flex-wrap h-auto">
            <TabsTrigger value="users" className="data-[state=active]:bg-emerald-700/30 data-[state=active]:text-cyan-300 text-xs uppercase tracking-widest">
              <Users className="h-3 w-3 mr-1.5" /> Users
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-emerald-700/30 data-[state=active]:text-cyan-300 text-xs uppercase tracking-widest">
              <NotebookPen className="h-3 w-3 mr-1.5" /> Private Notes
            </TabsTrigger>
            <TabsTrigger value="preload" className="data-[state=active]:bg-emerald-700/30 data-[state=active]:text-cyan-300 text-xs uppercase tracking-widest">
              <Mail className="h-3 w-3 mr-1.5" /> Pre-load Credits
            </TabsTrigger>
            <TabsTrigger value="codes" className="data-[state=active]:bg-emerald-700/30 data-[state=active]:text-cyan-300 text-xs uppercase tracking-widest">
              <Ticket className="h-3 w-3 mr-1.5" /> Redeem Codes
            </TabsTrigger>
            <TabsTrigger value="passes" className="data-[state=active]:bg-emerald-700/30 data-[state=active]:text-cyan-300 text-xs uppercase tracking-widest">
              <Crown className="h-3 w-3 mr-1.5" /> VIP Passes
            </TabsTrigger>
            <TabsTrigger value="resellers" className="data-[state=active]:bg-emerald-700/30 data-[state=active]:text-cyan-300 text-xs uppercase tracking-widest">
              <Wallet className="h-3 w-3 mr-1.5" /> Resellers
            </TabsTrigger>
            <TabsTrigger value="share" className="data-[state=active]:bg-emerald-700/30 data-[state=active]:text-cyan-300 text-xs uppercase tracking-widest">
              <Sparkles className="h-3 w-3 mr-1.5" /> Share Card
            </TabsTrigger>
          </TabsList>

          {/* USERS */}
          <TabsContent value="users" className="mt-4">
            <div className="rounded-xl border border-emerald-700/30 bg-black/50 backdrop-blur">
              <div className="p-3 flex flex-wrap items-center gap-2 border-b border-emerald-800/40">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by email or name…"
                    className="pl-9 h-8 bg-black/60 border-emerald-800/40 text-emerald-200 placeholder:text-emerald-700 font-mono text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-700">
                  <Filter className="h-3 w-3" />
                  {(["all", "prospect", "enforcer", "vip"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRankFilter(r as any)}
                      className={`px-2 py-1 rounded border transition ${
                        rankFilter === r
                          ? "border-cyan-500 text-cyan-300 bg-cyan-500/10"
                          : "border-emerald-800/40 text-emerald-600 hover:text-emerald-300"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-emerald-700 ml-auto">Showing {filtered.length} of {rows.length}</span>
              </div>

              <BulkActionBar
                selected={selected}
                rows={rows}
                onClear={() => setSelected(new Set())}
                onApplied={(updates) => {
                  setRows((rs) => rs.map((r) => updates[r.id] ? { ...r, ...updates[r.id] } : r));
                }}
              />

              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-cyan-400 border-b border-emerald-800/40 bg-black/40">
                <div className="col-span-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      const allIds = filtered.map((r) => r.id);
                      const allSelected = allIds.every((id) => selected.has(id));
                      setSelected(allSelected ? new Set() : new Set(allIds));
                    }}
                    title="Select all visible"
                    className="text-cyan-400 hover:text-cyan-200"
                  >
                    {filtered.length > 0 && filtered.every((r) => selected.has(r.id))
                      ? <CheckSquare className="h-3.5 w-3.5" />
                      : <Square className="h-3.5 w-3.5" />}
                  </button>
                  User
                </div>
                <div className="col-span-2">Rank</div>
                <div className="col-span-2">Credits</div>
                <div className="col-span-2">Features</div>
                <div className="col-span-3 text-right pr-2">Quick actions</div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
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
    cyan: "border-cyan-700/40 text-cyan-300",
    yellow: "border-yellow-700/40 text-yellow-300",
    emerald: "border-emerald-700/40 text-emerald-300",
    pink: "border-pink-700/40 text-pink-300",
  };
  return (
    <div className={`rounded-lg border bg-black/50 backdrop-blur px-4 py-3 ${tints[tint]}`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] opacity-70">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-black tabular-nums">{value.toLocaleString()}</div>
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
  const [open, setOpen] = useState(false);

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

  const n = parseInt(delta, 10);

  return (
    <div className="border-b border-emerald-900/30 hover:bg-emerald-900/5 transition">
      <div className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm ${selected ? "bg-cyan-900/15" : ""}`}>
        <div className="col-span-12 md:col-span-3 truncate flex items-center gap-2">
          <button
            onClick={onToggleSelect}
            title={selected ? "Deselect" : "Select for bulk action"}
            className="text-cyan-400 hover:text-cyan-200 flex-shrink-0"
          >
            {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          </button>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${row.status === "vip" ? "bg-yellow-400" : "bg-emerald-700"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-emerald-200 truncate">{row.email}</p>
            <p className="text-[10px] text-emerald-700 truncate">
              {row.display_name ?? "no name"} · joined {new Date(row.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="col-span-6 md:col-span-2">
          <Select value={row.rank} onValueChange={(v) => changeRank(v as Rank)} disabled={busy}>
            <SelectTrigger className={`h-8 bg-black/60 border text-[11px] uppercase tracking-widest ${RANK_STYLES[row.rank]}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-emerald-800 text-emerald-200">
              {RANKS.filter((r) => r !== "boss").map((r) => <SelectItem key={r} value={r} className="text-xs uppercase">{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-6 md:col-span-2 flex items-center gap-1">
          <Badge variant="outline" className="border-cyan-800/40 text-cyan-300 tabular-nums font-mono" title="Current credit balance">
            {row.credits.toLocaleString()}
          </Badge>
          <Input
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="±"
            title="Type any number, then press the button. Negative numbers remove credits."
            className="h-7 w-14 bg-black/60 border-emerald-800/40 text-emerald-200 font-mono text-xs"
          />
          <Button
            size="icon"
            onClick={apply}
            disabled={busy || !n}
            title={n < 0 ? "Remove credits" : "Add credits"}
            className="h-7 w-7 bg-emerald-700 hover:bg-emerald-600 text-black"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (n < 0 ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />)}
          </Button>
        </div>
        <div className="col-span-6 md:col-span-2 flex items-center gap-2 text-[10px] uppercase tracking-widest">
          {(["jokes","music","tools"] as const).map((k) => (
            <label key={k} className="inline-flex items-center gap-1 cursor-pointer text-emerald-400" title={`Toggle ${k} access`}>
              <Switch
                checked={row.feature_flags[k]}
                onCheckedChange={() => toggleFlag(k)}
                disabled={busy}
                className="data-[state=checked]:bg-cyan-500 scale-75"
              />
              {k}
            </label>
          ))}
        </div>
        <div className="col-span-6 md:col-span-3 flex items-center justify-end gap-1 flex-wrap">
          <Button size="sm" disabled={busy} onClick={() => give(50)} className="h-7 px-2 text-[10px] bg-emerald-700 hover:bg-emerald-600 text-black" title="Add 50 credits">+50</Button>
          <Button size="sm" disabled={busy} onClick={() => give(-50)} className="h-7 px-2 text-[10px] bg-rose-700 hover:bg-rose-600 text-white" title="Remove 50 credits">−50</Button>
          {row.rank !== "vip" ? (
            <Button size="sm" disabled={busy} onClick={() => changeRank("vip")} className="h-7 px-2 text-[10px] bg-yellow-500 hover:bg-yellow-400 text-black" title="Upgrade to VIP">
              <Crown className="h-3 w-3 mr-1" />Make VIP
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => changeRank("prospect")} className="h-7 px-2 text-[10px] bg-emerald-800 hover:bg-emerald-700 text-emerald-100" title="Downgrade to standard member">
              Reset
            </Button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-emerald-700 hover:text-cyan-300 transition px-1"
            title={open ? "Hide details" : "Show details"}
          >
            <ChevronDown className={`h-4 w-4 inline transition ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-3 text-[10px] text-emerald-700 uppercase tracking-widest">
          <div><span className="text-emerald-500">user id:</span> {row.id.slice(0, 12)}…</div>
          <div><span className="text-emerald-500">account:</span> {row.status === "vip" ? "VIP" : "Free"}</div>
          <div><span className="text-emerald-500">joined:</span> {new Date(row.created_at).toLocaleString()}</div>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-emerald-500">add:</span>
            {[10, 100, 500, 1000].map((v) => (
              <Button key={v} disabled={busy} size="sm" onClick={() => give(v)} className="h-6 px-2 text-[10px] bg-emerald-800/70 hover:bg-emerald-700 text-emerald-100">+{v}</Button>
            ))}
            <span className="text-emerald-500 ml-2">remove:</span>
            {[10, 100, 500].map((v) => (
              <Button key={v} disabled={busy} size="sm" onClick={() => give(-v)} className="h-6 px-2 text-[10px] bg-rose-800/70 hover:bg-rose-700 text-rose-100">−{v}</Button>
            ))}
          </div>
        </div>
      )}
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
    <section className="rounded-xl border border-emerald-700/30 bg-black/50 p-5 backdrop-blur">
      <h2 className="text-xs uppercase tracking-[0.4em] text-cyan-400 mb-4 flex items-center gap-2">
        <Ticket className="h-3.5 w-3.5" /> Create a Redeem Code
      </h2>
      <p className="text-[10px] text-emerald-700 uppercase tracking-widest mb-3">
        Share the code — anyone who enters it gets the credits (and rank, if set).
      </p>
      <div className="grid sm:grid-cols-5 gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code (e.g. WELCOME50)" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono uppercase" />
        <Input value={credits} onChange={(e) => setCredits(e.target.value)} type="number" min="1" placeholder="Credits to give" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" min="1" placeholder="How many people" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Select value={grantRank || "none"} onValueChange={(v) => setGrantRank(v === "none" ? "" : v as Rank)}>
          <SelectTrigger className="bg-black/60 border-emerald-800/40 text-emerald-200"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-black border-emerald-800 text-emerald-200">
            <SelectItem value="none">No rank change</SelectItem>
            {RANKS.filter((r) => r !== "boss").map((r) => <SelectItem key={r} value={r}>Also set rank: {r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={submit} disabled={busy || !code} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" />Create</>}
        </Button>
      </div>
    </section>
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
    <section className="rounded-xl border border-pink-700/30 bg-black/50 p-5 backdrop-blur">
      <h2 className="text-xs uppercase tracking-[0.4em] text-pink-400 mb-4 flex items-center gap-2">
        <Users className="h-3.5 w-3.5" /> Reseller Program
      </h2>
      <p className="text-[10px] text-emerald-700 uppercase tracking-widest mb-3">
        Give a user a wallet so they can sell credits on your behalf.
      </p>
      <div className="grid sm:grid-cols-5 gap-2">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="bg-black/60 border-emerald-800/40 text-emerald-200">
            <SelectValue placeholder="Choose a user…" />
          </SelectTrigger>
          <SelectContent className="bg-black border-emerald-800 text-emerald-200 max-h-72">
            {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Reseller name" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Input value={initialCredits} onChange={(e) => setInitialCredits(e.target.value)} type="number" min="0" placeholder="Starting credits" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Input value={markup} onChange={(e) => setMarkup(e.target.value)} type="number" min="0" placeholder="Their markup (¢)" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Button onClick={submit} disabled={busy || !userId} className="bg-pink-500 hover:bg-pink-400 text-black font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" />Activate</>}
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
    <section className="rounded-xl border border-cyan-700/30 bg-black/50 p-5 backdrop-blur">
      <h2 className="text-xs uppercase tracking-[0.4em] text-cyan-400 mb-1 flex items-center gap-2">
        <Mail className="h-3.5 w-3.5" /> Pre-load Credits by Email
      </h2>
      <p className="text-[10px] text-emerald-700 uppercase tracking-widest mb-4">
        Already a user → credits added now · new email → waiting, added when they sign up
      </p>

      <div className="grid sm:grid-cols-6 gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          type="email"
          className="sm:col-span-2 bg-black/60 border-emerald-800/40 text-emerald-200 font-mono"
        />
        <Input
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          type="number"
          min="0"
          placeholder="Credits"
          className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono"
        />
        <Select value={grantRank || "none"} onValueChange={(v) => setGrantRank(v === "none" ? "" : v as Rank)}>
          <SelectTrigger className="bg-black/60 border-emerald-800/40 text-emerald-200"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-black border-emerald-800 text-emerald-200">
            <SelectItem value="none">No rank change</SelectItem>
            {RANKS.filter((r) => r !== "boss").map((r) => <SelectItem key={r} value={r}>Also set rank: {r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note (optional)"
          className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono"
        />
        <Button onClick={submit} disabled={busy || !email} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" />Send</>}
        </Button>
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
    <section className="rounded-xl border border-yellow-700/30 bg-black/50 p-5 backdrop-blur">
      <h2 className="text-xs uppercase tracking-[0.4em] text-yellow-400 mb-4 flex items-center gap-2">
        <Crown className="h-3.5 w-3.5" /> VIP Passes
      </h2>
      <p className="text-[10px] text-emerald-700 uppercase tracking-widest mb-3">
        Choose a user, pick how long, and grant VIP access.
      </p>
      <div className="grid sm:grid-cols-6 gap-2">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="bg-black/60 border-emerald-800/40 text-emerald-200 sm:col-span-2">
            <SelectValue placeholder="Choose a user…" />
          </SelectTrigger>
          <SelectContent className="bg-black border-emerald-800 text-emerald-200 max-h-72">
            {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={preset} onValueChange={(v) => setPreset(v as any)}>
          <SelectTrigger className="bg-black/60 border-emerald-800/40 text-emerald-200"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-black border-emerald-800 text-emerald-200">
            <SelectItem value="30">1 month</SelectItem>
            <SelectItem value="90">3 months</SelectItem>
            <SelectItem value="180">6 months</SelectItem>
            <SelectItem value="365">12 months</SelectItem>
            <SelectItem value="custom">Pick a date</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          disabled={preset !== "custom"}
          className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono"
        />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Button onClick={submit} disabled={busy} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Crown className="h-4 w-4 mr-1" />Grant VIP</>}
        </Button>
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
