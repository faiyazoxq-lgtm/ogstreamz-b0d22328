import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users, Search, Coins, ShieldOff, ShieldCheck, LogOut, RefreshCw, Crown, Tv, Flame } from "lucide-react";
import { listRoster, setRank as setRankFn, setStatus as setStatusFn, adjustCredits, setBanned, forceSignOut, setUserSwearing, type RosterRow } from "@/lib/boss-users.functions";
import { reverifyStream } from "@/lib/stream-link.functions";
import { effectiveSwearing, effectiveIntensity, rankDefaultsToSafe } from "@/lib/swearing";

export const Route = createFileRoute("/boss/users")({
  head: () => ({ meta: [{ title: "Users · Boss" }, { name: "description", content: "Full roster control: rank, status, credits, ban, force sign-out, stream-account verification." }] }),
  component: BossUsers,
});

const RANK_OPTS = ["prospect", "enforcer", "stream_user", "vip", "boss"] as const;
const RANK_LABEL: Record<string, string> = {
  prospect: "Visitor", enforcer: "Member", stream_user: "Stream User", vip: "VIP / Real OG", boss: "Boss",
};
const RANK_TINT: Record<string, string> = {
  prospect: "#94a3b8", enforcer: "#3ad6ff", stream_user: "#a78bfa", vip: "#ffd166", boss: "#ff2e55",
};

function BossUsers() {
  const list = useServerFn(listRoster);
  const setRankRpc = useServerFn(setRankFn);
  const setStatusRpc = useServerFn(setStatusFn);
  const creditsRpc = useServerFn(adjustCredits);
  const banRpc = useServerFn(setBanned);
  const signOutRpc = useServerFn(forceSignOut);
  const verifyRpc = useServerFn(reverifyStream);
  const swearRpc = useServerFn(setUserSwearing);

  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true); setErr(null);
    try {
      const { rows } = await list({ data: { search, rank: rankFilter, limit: 200 } });
      setRows(rows);
    } catch (e: any) { setErr(e?.message ?? "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rankFilter]);

  const counts = useMemo(() => rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.rank] = (acc[r.rank] ?? 0) + 1; return acc;
  }, {}), [rows]);

  const onAction = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id); setErr(null);
    try { await fn(); await refresh(); }
    catch (e: any) { setErr(e?.message ?? "Action failed"); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <header className="glass-obsidian-cmd rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-gold" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono text-gold">0G · Boss</p>
            <h1 className="syndicate-header text-2xl text-white/95">User Roster</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-white/65 max-w-2xl">
          Full control: rank, status, credits, ban, force sign-out. Stream-verified members auto-graduate to <strong className="text-white/90">Stream User</strong>; from there you can promote to VIP / Real OG.
        </p>
      </header>

      {/* Filters */}
      <div className="glass-obsidian-cmd rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); refresh(); }} className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-white/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or display name…"
            className="flex-1 bg-transparent border border-border rounded-md px-3 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <button type="submit" className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-secondary/80">Search</button>
        </form>
        <select
          value={rankFilter}
          onChange={(e) => setRankFilter(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-1.5 text-xs"
        >
          <option value="">All ranks</option>
          {RANK_OPTS.map((r) => <option key={r} value={r}>{RANK_LABEL[r]}{counts[r] ? ` (${counts[r]})` : ""}</option>)}
        </select>
        <button onClick={refresh} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-secondary/80">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {err && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
      {loading && <p className="text-center text-sm text-white/55 py-6">Loading roster…</p>}

      <div className="grid grid-cols-1 gap-3">
        {rows.map((r) => {
          const busy = busyId === r.id;
          const initials = (r.display_name || r.email || "?").trim().slice(0, 2).toUpperCase();
          return (
            <article key={r.id} className="glass-obsidian-cmd rounded-2xl p-4 font-sans">
              {/* Identity row */}
              <div className="flex items-start gap-3">
                <div
                  className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-black"
                  style={{ background: `${RANK_TINT[r.rank]}22`, color: RANK_TINT[r.rank], border: `1px solid ${RANK_TINT[r.rank]}66` }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-white truncate">{r.display_name || r.email}</span>
                    <span
                      className="text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: `${RANK_TINT[r.rank]}1f`, color: RANK_TINT[r.rank], border: `1px solid ${RANK_TINT[r.rank]}55` }}
                    >
                      {r.rank === "boss" && <Crown className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                      {RANK_LABEL[r.rank] ?? r.rank}
                    </span>
                    {r.banned && <span className="text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded font-bold bg-destructive/15 text-destructive border border-destructive/40">Banned</span>}
                    {r.stream_status === "Active" && <span className="text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">Stream ✓</span>}
                  </div>
                  <p className="text-xs text-white/60 mt-0.5 truncate">{r.email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
                    <span className="inline-flex items-center gap-1 text-gold/90"><Coins className="h-3 w-3" /> {r.credits} 🪙</span>
                    <span>· Status <span className="text-white/80 font-semibold">{r.status.toUpperCase()}</span></span>
                    {r.stream_expires_at && <span>· stream until {new Date(r.stream_expires_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>

              {/* Action grid: clearly labelled sections */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-white/5 pt-3">
                <Section label="Access">
                  <select
                    aria-label="Set rank"
                    disabled={busy}
                    value={r.rank}
                    onChange={(e) => onAction(r.id, () => setRankRpc({ data: { userId: r.id, rank: e.target.value as any } }))}
                    className="w-full bg-card border border-border rounded-md px-2 py-1.5 text-xs"
                  >
                    {RANK_OPTS.map((rk) => <option key={rk} value={rk}>{RANK_LABEL[rk]}</option>)}
                  </select>
                  <select
                    aria-label="Set status"
                    disabled={busy}
                    value={r.status}
                    onChange={(e) => onAction(r.id, () => setStatusRpc({ data: { userId: r.id, status: e.target.value as "free" | "vip" } }))}
                    className="w-full bg-card border border-border rounded-md px-2 py-1.5 text-xs"
                  >
                    <option value="free">Free</option>
                    <option value="vip">VIP</option>
                  </select>
                </Section>

                <Section label="Coins">
                  <button
                    disabled={busy}
                    onClick={() => {
                      const v = window.prompt(`Gift / adjust 🪙 for ${r.email} (e.g. 50 or -10):`, "0");
                      const n = Number(v);
                      if (!Number.isFinite(n) || n === 0) return;
                      const note = window.prompt(
                        n > 0
                          ? `Optional note — what are these ${n} 🪙 for? (member will see this)`
                          : `Optional note — reason for removing ${Math.abs(n)} 🪙?`,
                        ""
                      ) ?? "";
                      const reason = n > 0
                        ? `boss:gift${note.trim() ? ":" + note.trim().slice(0, 100) : ""}`
                        : `boss:adjust${note.trim() ? ":" + note.trim().slice(0, 100) : ""}`;
                      onAction(r.id, () => creditsRpc({ data: { userId: r.id, delta: n, reason } }));
                    }}
                    className="w-full inline-flex items-center justify-center gap-1 rounded-md border border-gold/40 bg-gold/10 text-gold px-2 py-1.5 text-xs font-bold hover:bg-gold/15"
                  >
                    <Coins className="h-3.5 w-3.5" /> Gift / Adjust 🪙
                  </button>
                </Section>

                <Section label="Stream / Session">
                  <button
                    disabled={busy}
                    onClick={() => onAction(r.id, () => verifyRpc({ data: { userId: r.id } }))}
                    title="Re-verify stream account"
                    className="w-full inline-flex items-center justify-center gap-1 rounded-md border border-border bg-secondary px-2 py-1.5 text-xs font-bold hover:bg-secondary/80"
                  >
                    <Tv className="h-3.5 w-3.5" /> Re-verify stream
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onAction(r.id, () => signOutRpc({ data: { userId: r.id } }))}
                    className="w-full inline-flex items-center justify-center gap-1 rounded-md border border-border bg-secondary px-2 py-1.5 text-xs font-bold hover:bg-secondary/80"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Force sign-out
                  </button>
                </Section>

                <Section label="Moderation">
                  {r.banned ? (
                    <button
                      disabled={busy}
                      onClick={() => onAction(r.id, () => banRpc({ data: { userId: r.id, banned: false } }))}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 px-2 py-1.5 text-xs font-bold hover:bg-emerald-500/15"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Unban
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt(`Reason for banning ${r.email}? (optional)`, "") ?? "";
                        onAction(r.id, () => banRpc({ data: { userId: r.id, banned: true, reason } }));
                      }}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-2 py-1.5 text-xs font-bold hover:bg-destructive/15"
                    >
                      <ShieldOff className="h-3.5 w-3.5" /> Ban user
                    </button>
                  )}
                </Section>
              </div>

              <SwearingRow row={r} busy={busy} onSet={(enabled, intensity) =>
                onAction(r.id, () => swearRpc({ data: { userId: r.id, enabled, intensity } }))
              } />
              {r.banned && r.banned_reason && (
                <p className="mt-2 text-[11px] text-destructive/80">Ban reason: {r.banned_reason}</p>
              )}
            </article>
          );
        })}
        {!loading && rows.length === 0 && <p className="text-center text-sm text-white/55 py-6">No users match.</p>}
      </div>
    </div>
  );
}

function SwearingRow({
  row, busy, onSet,
}: {
  row: RosterRow;
  busy: boolean;
  onSet: (enabled: boolean | null, intensity?: "mild" | "medium" | "chaotic") => void;
}) {
  const explicit = row.feature_flags?.swearing;
  const isExplicit = explicit === true || explicit === false;
  const swearing = effectiveSwearing(row);
  const intensity = effectiveIntensity(row);
  const defaultsSafe = rankDefaultsToSafe(row.rank);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3 text-[11px] text-white/70">
      <Flame className="h-3.5 w-3.5 text-rose-300" />
      <span className="uppercase tracking-[0.2em] text-white/55">Swearing</span>
      <span
        className={`px-1.5 py-0.5 rounded font-bold border text-[10px] uppercase tracking-[0.18em] ${
          swearing
            ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
        }`}
      >
        {swearing ? "On" : "Safe"}
      </span>
      <span className="text-white/40">
        {isExplicit ? "(boss override)" : defaultsSafe ? "(default: Safe — streamer/VIP)" : "(default: On)"}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSet(true, intensity)}
          className={`rounded-md px-2 py-1 text-[11px] font-bold border ${swearing ? "border-rose-500/60 bg-rose-500/15 text-rose-200" : "border-border bg-secondary hover:bg-secondary/80"}`}
        >
          On
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSet(false)}
          className={`rounded-md px-2 py-1 text-[11px] font-bold border ${!swearing ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-border bg-secondary hover:bg-secondary/80"}`}
        >
          Safe
        </button>
        <button
          type="button"
          disabled={busy || !isExplicit}
          onClick={() => onSet(null)}
          title="Clear override — fall back to rank default"
          className="rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-bold hover:bg-secondary/80 disabled:opacity-40"
        >
          Auto
        </button>
        <select
          aria-label="Swearing intensity"
          disabled={busy}
          value={intensity}
          onChange={(e) => onSet(explicit ?? swearing, e.target.value as any)}
          className="bg-card border border-border rounded-md px-2 py-1 text-[11px]"
        >
          <option value="mild">Mild</option>
          <option value="medium">Medium</option>
          <option value="chaotic">Chaotic</option>
        </select>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-white/45 font-bold">{label}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}