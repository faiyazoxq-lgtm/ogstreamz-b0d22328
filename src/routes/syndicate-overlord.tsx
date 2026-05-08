import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shield, Skull, Loader2, Search, Sparkles, Save, Plus, Minus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adjustCredits, setRank, setFeatureFlags, createRedeemCode } from "@/lib/overlord.functions";

const OVERLORD_EMAIL = "faiyazoxq@gmail.com";
const RANKS = ["prospect", "enforcer", "vip", "boss"] as const;
type Rank = typeof RANKS[number];
type Flags = { jokes: boolean; music: boolean; tools: boolean };
type Row = {
  id: string; email: string; status: "free" | "vip"; credits: number;
  rank: Rank; feature_flags: Flags; display_name: string | null; created_at: string;
};

export const Route = createFileRoute("/syndicate-overlord")({
  head: () => ({ meta: [{ title: "Overlord Terminal · 0G-PORTAL" }] }),
  component: OverlordPage,
});

function OverlordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  const allowed = !!user && user.email === OVERLORD_EMAIL;

  useEffect(() => {
    if (loading) return;
    if (!allowed) navigate({ to: "/" });
  }, [allowed, loading, navigate]);

  useEffect(() => {
    if (!allowed) return;
    supabase.from("profiles")
      .select("id,email,status,credits,rank,feature_flags,display_name,created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows((data ?? []) as any);
      });
  }, [allowed]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(n) || (r.display_name ?? "").toLowerCase().includes(n));
  }, [rows, q]);

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  if (loading || !allowed) {
    return <main className="px-5 py-20 text-center font-mono text-emerald-400">// Verifying overlord clearance…</main>;
  }

  return (
    <main className="relative min-h-screen bg-[#020a14] text-emerald-200 font-mono overflow-hidden">
      <TerminalGrid />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-cyan-400 flex items-center gap-2">
              <Skull className="h-4 w-4" /> OVERLORD TERMINAL
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-cyan-300 drop-shadow-[0_0_18px_rgba(58,214,255,0.5)]">
              0G-PORTAL // GOD MODE
            </h1>
            <p className="mt-2 text-emerald-400/80 text-xs">
              {rows.length} souls registered · {rows.filter((r) => r.rank === "vip" || r.rank === "boss").length} VIP+
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="grep email…"
              className="pl-9 bg-black/60 border-emerald-700/40 text-emerald-200 placeholder:text-emerald-700 font-mono"
            />
          </div>
        </header>

        <RedeemCodePanel />

        <section className="mt-8 rounded-xl border border-emerald-700/30 bg-black/50 backdrop-blur">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-cyan-400 border-b border-emerald-800/40">
            <div className="col-span-4">EMAIL</div>
            <div className="col-span-2">RANK</div>
            <div className="col-span-2">CREDITS</div>
            <div className="col-span-3">HUBS</div>
            <div className="col-span-1 text-right">SAVE</div>
          </div>
          {filtered.map((r) => <UserRow key={r.id} row={r} onChange={(p) => updateRow(r.id, p)} />)}
          {filtered.length === 0 && (
            <p className="px-5 py-12 text-center text-emerald-700">// no records found</p>
          )}
        </section>

        <p className="mt-6 text-[10px] tracking-[0.3em] uppercase text-emerald-700">
          0G-PORTAL · OVERLORD TERMINAL · session: {user?.id.slice(0, 8)}…
        </p>
      </div>
    </main>
  );
}

function TerminalGrid() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: "linear-gradient(rgba(58,214,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(58,214,255,0.06) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(900px circle at 50% -10%, rgba(58,214,255,0.18), transparent 60%)" }} />
    </>
  );
}

function UserRow({ row, onChange }: { row: Row; onChange: (p: Partial<Row>) => void }) {
  const adj = useServerFn(adjustCredits);
  const setR = useServerFn(setRank);
  const setF = useServerFn(setFeatureFlags);
  const [delta, setDelta] = useState("0");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    try {
      const n = parseInt(delta, 10);
      if (!Number.isFinite(n) || n === 0) throw new Error("Enter a non-zero amount");
      const r = await adj({ data: { userId: row.id, delta: n, reason: "overlord:adjust" } });
      onChange({ credits: r.credits });
      setDelta("0");
      toast.success(`Balance: ${r.credits}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const changeRank = async (rank: Rank) => {
    setBusy(true);
    try { await setR({ data: { userId: row.id, rank } }); onChange({ rank, status: rank === "vip" || rank === "boss" ? "vip" : "free" }); toast.success(`${row.email} → ${rank.toUpperCase()}`); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const toggleFlag = async (key: keyof Flags) => {
    const flags = { ...row.feature_flags, [key]: !row.feature_flags[key] };
    setBusy(true);
    try { await setF({ data: { userId: row.id, flags } }); onChange({ feature_flags: flags }); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const rankColor: Record<Rank, string> = {
    prospect: "text-emerald-400 border-emerald-700/40",
    enforcer: "text-cyan-300 border-cyan-700/40",
    vip: "text-yellow-300 border-yellow-700/40",
    boss: "text-pink-400 border-pink-700/40",
  };

  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-emerald-900/30 items-center text-sm hover:bg-emerald-900/5">
      <div className="col-span-4 truncate">
        <p className="text-emerald-200">{row.email}</p>
        <p className="text-[10px] text-emerald-700">id: {row.id.slice(0, 8)}…</p>
      </div>
      <div className="col-span-2">
        <select
          value={row.rank}
          onChange={(e) => changeRank(e.target.value as Rank)}
          disabled={busy}
          className={`w-full bg-black/60 border rounded px-2 py-1 text-xs uppercase tracking-widest ${rankColor[row.rank]}`}
        >
          {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="col-span-2 flex items-center gap-1">
        <span className="text-cyan-300 w-12 tabular-nums">{row.credits}</span>
        <Input value={delta} onChange={(e) => setDelta(e.target.value)} className="h-7 w-16 bg-black/60 border-emerald-800/40 text-emerald-200 font-mono text-xs" />
        <Button size="icon" onClick={apply} disabled={busy} className="h-7 w-7 bg-emerald-700 hover:bg-emerald-600 text-black">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (parseInt(delta,10) < 0 ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />)}
        </Button>
      </div>
      <div className="col-span-3 flex items-center gap-3 text-xs">
        {(["jokes","music","tools"] as const).map((k) => (
          <label key={k} className="inline-flex items-center gap-1 cursor-pointer text-emerald-300">
            <input type="checkbox" checked={row.feature_flags[k]} onChange={() => toggleFlag(k)} disabled={busy} />
            {k}
          </label>
        ))}
      </div>
      <div className="col-span-1 text-right">
        <Save className="inline h-4 w-4 text-emerald-700" />
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
      toast.success(`Minted ${r.code.code} · ${r.code.credits} credits × ${r.code.max_uses}`);
      setCode("");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-xl border border-emerald-700/30 bg-black/50 p-5 backdrop-blur">
      <h2 className="text-xs uppercase tracking-[0.4em] text-cyan-400 mb-3 flex items-center gap-2">
        <Ticket className="h-3.5 w-3.5" /> MINT REDEEM CODE
      </h2>
      <div className="grid sm:grid-cols-5 gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="0G-FOUNDER" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono uppercase" />
        <Input value={credits} onChange={(e) => setCredits(e.target.value)} type="number" min="1" placeholder="credits" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" min="1" placeholder="max uses" className="bg-black/60 border-emerald-800/40 text-emerald-200 font-mono" />
        <select value={grantRank} onChange={(e) => setGrantRank(e.target.value as any)} className="bg-black/60 border border-emerald-800/40 rounded px-2 text-emerald-200 text-sm">
          <option value="">no rank</option>
          {RANKS.map((r) => <option key={r} value={r}>grant: {r}</option>)}
        </select>
        <Button onClick={submit} disabled={busy || !code} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" />MINT</>}
        </Button>
      </div>
    </section>
  );
}