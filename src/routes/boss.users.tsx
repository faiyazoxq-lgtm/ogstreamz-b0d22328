import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users, Search, Coins, ShieldOff, ShieldCheck, LogOut, RefreshCw, Tv, Flame } from "lucide-react";
import { listRoster, setRank as setRankFn, setStatus as setStatusFn, adjustCredits, setBanned, forceSignOut, setUserSwearing, type RosterRow } from "@/lib/boss-users.functions";
import { reverifyStream } from "@/lib/stream-link.functions";
import { effectiveSwearing, effectiveIntensity, rankDefaultsToSafe } from "@/lib/swearing";
import { BossOgPassCard } from "@/components/boss/BossOgPassCard";
import { MemberDetailDrawer } from "@/components/boss/MemberDetailDrawer";

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<RosterRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const PAGE_SIZE = 25;

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await list({ data: { search, rank: rankFilter, limit: PAGE_SIZE, cursor: null } });
      setRows(res.rows);
      setCursor(res.nextCursor ?? null);
      setHasMore(!!res.hasMore);
    } catch (e: any) { setErr(e?.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }, [list, search, rankFilter]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore || !cursor) return;
    setLoadingMore(true); setErr(null);
    try {
      const res = await list({ data: { search, rank: rankFilter, limit: PAGE_SIZE, cursor } });
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...res.rows.filter((r) => !seen.has(r.id))];
      });
      setCursor(res.nextCursor ?? null);
      setHasMore(!!res.hasMore);
    } catch (e: any) { setErr(e?.message ?? "Failed to load more"); }
    finally { setLoadingMore(false); }
  }, [list, search, rankFilter, cursor, hasMore, loading, loadingMore]);

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rankFilter]);

  // Infinite scroll: auto-load next page when sentinel is in view.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "240px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

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
          return (
            <article key={r.id} className="glass-obsidian-cmd rounded-2xl p-4 font-sans">
              {/* OG Pass identity card — same chips members see, plus boss-only fields */}
              <BossOgPassCard
                row={r}
                onSelect={(row) => {
                  setSelected(row);
                  setDrawerOpen(true);
                }}
              />

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

      {/* Pagination sentinel + manual load-more (mobile-friendly) */}
      {rows.length > 0 && (
        <div ref={sentinelRef} className="pt-2 pb-6 flex flex-col items-center gap-2">
          {hasMore ? (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-bold hover:bg-secondary/80 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : (
            <p className="text-[11px] text-white/40 uppercase tracking-[0.25em]">End of roster · {rows.length} shown</p>
          )}
        </div>
      )}

      <MemberDetailDrawer
        row={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
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