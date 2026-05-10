import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Swords, Crown, Shield, TrendingUp, Timer, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/battlehub")({
  head: () => ({
    meta: [
      { title: "BattleHUB — Pick A Side" },
      { name: "description", content: "BattleHUB: pick a side, cast your vote, watch the results roll in. Dark, gold-accented arena for daily showdowns." },
      { property: "og:title", content: "BattleHUB — Pick A Side" },
      { property: "og:description", content: "Pick a side, cast your vote, watch the results roll in." },
    ],
  }),
  component: BattleHubPage,
});

type Side = "gold" | "shadow";

// Round window: rolls over at the next 10-minute boundary so the same end
// time is shared across tabs / reloads and used as the round bucket key.
const ROUND_WINDOW_MS = 10 * 60 * 1000;

function nextBoundary(from: number, windowMs: number) {
  return Math.ceil((from + 1) / windowMs) * windowMs;
}

function getVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "battlehub_visitor_id";
  let v = window.localStorage.getItem(KEY);
  if (!v) {
    v = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.localStorage.setItem(KEY, v);
  }
  return v;
}

function formatRemaining(ms: number) {
  const safe = Math.max(0, ms);
  const total = Math.floor(safe / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function BattleHubPage() {
  const [pick, setPick] = useState<Side | null>(null);
  const [votes, setVotes] = useState({ gold: 0, shadow: 0 });
  const [voteError, setVoteError] = useState<string | null>(null);

  // Anchor the round end to a deterministic boundary so reloading doesn't
  // restart the timer from scratch.
  const endsAt = useMemo(() => nextBoundary(Date.now(), ROUND_WINDOW_MS), []);
  const roundKey = endsAt; // bucket key shared by all clients in this window
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Fetch initial counts + subscribe to realtime inserts for this round.
  useEffect(() => {
    let cancelled = false;
    const visitorId = getVisitorId();

    async function loadCounts() {
      const { data, error } = await supabase
        .from("battlehub_votes")
        .select("side")
        .eq("round_key", roundKey);
      if (cancelled || error || !data) return;
      const next = { gold: 0, shadow: 0 };
      for (const row of data as { side: Side }[]) {
        if (row.side === "gold" || row.side === "shadow") next[row.side]++;
      }
      setVotes(next);
      // Restore "already voted" state across reloads
      const { data: mine } = await supabase
        .from("battlehub_votes")
        .select("side")
        .eq("round_key", roundKey)
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!cancelled && mine?.side) setPick(mine.side as Side);
    }
    loadCounts();

    const channel = supabase
      .channel(`battlehub-${roundKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "battlehub_votes",
          filter: `round_key=eq.${roundKey}`,
        },
        (payload) => {
          const side = (payload.new as { side?: Side })?.side;
          if (side === "gold" || side === "shadow") {
            setVotes((v) => ({ ...v, [side]: v[side] + 1 }));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roundKey]);

  const remainingMs = endsAt - now;
  const roundEnded = remainingMs <= 0;
  const totalMs = ROUND_WINDOW_MS;
  const elapsedPct = Math.min(100, Math.max(0, ((totalMs - remainingMs) / totalMs) * 100));
  const lowTime = !roundEnded && remainingMs <= 30_000;

  const total = votes.gold + votes.shadow;
  const goldPct = total === 0 ? 0 : Math.round((votes.gold / total) * 100);
  const shadowPct = total === 0 ? 0 : 100 - goldPct;
  const winner: Side | "tie" | null = !roundEnded
    ? null
    : votes.gold === votes.shadow
      ? "tie"
      : votes.gold > votes.shadow
        ? "gold"
        : "shadow";

  const cast = async (side: Side) => {
    if (pick || roundEnded) return;
    // Optimistic UI
    setPick(side);
    setVoteError(null);
    const visitorId = getVisitorId();
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id ?? null;
    const { error } = await supabase.from("battlehub_votes").insert({
      round_key: roundKey,
      side,
      user_id: userId,
      visitor_id: visitorId,
    });
    if (error) {
      // Unique violation → already voted (e.g., from another tab); keep pick.
      if ((error as { code?: string }).code !== "23505") {
        setPick(null);
        setVoteError("Couldn't record your vote. Try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5e8c7]">
      {/* Ambient gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(201,168,76,0.25), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#c9a84c]">
          <Swords className="h-4 w-4" />
          BattleHUB · Preview
        </div>
        <h1 className="bg-gradient-to-b from-[#f0d78c] to-[#c9a84c] bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl">
          Pick a side.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[#f5e8c7]/70 sm:text-base">
          Today's showdown. One vote per soul. The crowd decides who walks away
          gilded and who fades into the shadow.
        </p>

        {/* Countdown */}
        <div
          role="timer"
          aria-live={lowTime ? "assertive" : "polite"}
          aria-atomic="true"
          className={[
            "mt-8 rounded-2xl border p-4 sm:p-5 backdrop-blur transition-colors",
            roundEnded
              ? "border-[#5a5a5a]/50 bg-[#0f0f0f]/80"
              : lowTime
                ? "border-[#ff6b6b]/50 bg-[#1a0a0a]/80"
                : "border-[#c9a84c]/30 bg-[#141414]/80",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#c9a84c]">
              {roundEnded ? <Lock className="h-3.5 w-3.5" /> : <Timer className="h-3.5 w-3.5" />}
              {roundEnded ? "Round closed" : "Round ends in"}
            </div>
            <div
              className={[
                "tabular-nums font-mono text-2xl sm:text-3xl font-black",
                roundEnded
                  ? "text-[#f5e8c7]/50 line-through decoration-[#5a5a5a]"
                  : lowTime
                    ? "text-[#ff6b6b] animate-pulse"
                    : "text-[#f0d78c]",
              ].join(" ")}
            >
              {formatRemaining(remainingMs)}
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
            <div
              className={[
                "h-full transition-[width] duration-1000 ease-linear",
                roundEnded
                  ? "bg-[#5a5a5a]"
                  : lowTime
                    ? "bg-[#ff6b6b]"
                    : "bg-gradient-to-r from-[#c9a84c] to-[#f0d78c]",
              ].join(" ")}
              style={{ width: `${elapsedPct}%` }}
            />
          </div>
          {roundEnded && (
            <div className="mt-3 text-sm text-[#f5e8c7]/80">
              {winner === "tie"
                ? "Stalemate — the crowd split clean down the middle."
                : winner === "gold"
                  ? "House of Gold takes the round."
                  : "House of Shadow takes the round."}
              <span className="ml-2 text-[11px] uppercase tracking-[0.2em] text-[#f5e8c7]/40">
                Voting locked
              </span>
            </div>
          )}
        </div>

        {/* Sides */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <SideCard
            side="gold"
            label="House of Gold"
            tagline="Bright, brash, unbothered."
            icon={<Crown className="h-6 w-6" />}
            picked={pick === "gold"}
            disabled={roundEnded || (!!pick && pick !== "gold")}
            locked={roundEnded}
            onPick={() => cast("gold")}
          />
          <SideCard
            side="shadow"
            label="House of Shadow"
            tagline="Quiet, patient, lethal."
            icon={<Shield className="h-6 w-6" />}
            picked={pick === "shadow"}
            disabled={roundEnded || (!!pick && pick !== "shadow")}
            locked={roundEnded}
            onPick={() => cast("shadow")}
          />
        </div>

        {/* Current vote */}
        <div className="mt-8 rounded-2xl border border-[#c9a84c]/20 bg-[#141414]/80 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.2em] text-[#c9a84c]">
              Your vote
            </div>
            <div className="text-xs text-[#f5e8c7]/50">
              {total.toLocaleString()} total
            </div>
          </div>
          <div className="mt-2 text-lg font-semibold">
            {pick === "gold" && "House of Gold — locked in."}
            {pick === "shadow" && "House of Shadow — locked in."}
            {!pick && !roundEnded && (
              <span className="text-[#f5e8c7]/60">No vote cast yet.</span>
            )}
            {!pick && roundEnded && (
              <span className="text-[#f5e8c7]/60">Round closed before you voted.</span>
            )}
          </div>
          {voteError && (
            <div className="mt-2 text-sm text-[#ff6b6b]">{voteError}</div>
          )}
        </div>

        {/* Results preview */}
        <div className="mt-6 rounded-2xl border border-[#c9a84c]/20 bg-[#141414]/80 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#c9a84c]">
            <TrendingUp className="h-4 w-4" />
            Results preview
          </div>

          <ResultRow
            label="House of Gold"
            count={votes.gold}
            pct={goldPct}
            color="#c9a84c"
          />
          <div className="h-3" />
          <ResultRow
            label="House of Shadow"
            count={votes.shadow}
            pct={shadowPct}
            color="#5a5a5a"
          />

          <p className="mt-5 text-xs text-[#f5e8c7]/50">
            Live results lock in when the round ends. Full BattleHUB experience
            coming soon.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            asChild
            className="bg-[#c9a84c] text-[#0a0a0a] hover:bg-[#f0d78c]"
          >
            <Link to="/battle">Open Battle Arena</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-[#c9a84c]/40 bg-transparent text-[#f5e8c7] hover:bg-[#c9a84c]/10 hover:text-[#f0d78c]"
          >
            <Link to="/">Back home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function SideCard({
  label,
  tagline,
  icon,
  picked,
  disabled,
  locked,
  onPick,
}: {
  side: Side;
  label: string;
  tagline: string;
  icon: React.ReactNode;
  picked: boolean;
  disabled: boolean;
  locked?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={picked}
      className={[
        "group relative overflow-hidden rounded-2xl border p-6 text-left transition-all",
        "min-h-[160px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a84c]",
        picked
          ? "border-[#c9a84c] bg-[#1a1408] shadow-[0_0_40px_-10px_rgba(201,168,76,0.6)]"
          : "border-[#c9a84c]/20 bg-[#141414] hover:border-[#c9a84c]/60 hover:bg-[#1a1408]",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span
          className={[
            "inline-flex h-10 w-10 items-center justify-center rounded-full border",
            picked
              ? "border-[#c9a84c] bg-[#c9a84c]/15 text-[#f0d78c]"
              : "border-[#c9a84c]/30 text-[#c9a84c] group-hover:border-[#c9a84c]/70",
          ].join(" ")}
        >
          {icon}
        </span>
        <div>
          <div className="text-lg font-bold text-[#f0d78c]">{label}</div>
          <div className="text-sm text-[#f5e8c7]/60">{tagline}</div>
        </div>
      </div>
      <div className="mt-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#c9a84c]">
        {locked && !picked ? "Voting locked" : picked ? "Vote cast" : "Tap to pick"}
      </div>
    </button>
  );
}

function ResultRow({
  label,
  count,
  pct,
  color,
}: {
  label: string;
  count: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium text-[#f5e8c7]">{label}</span>
        <span className="tabular-nums text-[#f5e8c7]/70">
          {count.toLocaleString()} · {pct}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#0a0a0a] ring-1 ring-inset ring-[#c9a84c]/15">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: `0 0 12px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}