import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Swords, Crown, Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const INITIAL = { gold: 1284, shadow: 1176 };

function BattleHubPage() {
  const [pick, setPick] = useState<Side | null>(null);
  const [votes, setVotes] = useState(INITIAL);

  const total = votes.gold + votes.shadow;
  const goldPct = Math.round((votes.gold / total) * 100);
  const shadowPct = 100 - goldPct;

  const cast = (side: Side) => {
    if (pick) return;
    setPick(side);
    setVotes((v) => ({ ...v, [side]: v[side] + 1 }));
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

        {/* Sides */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <SideCard
            side="gold"
            label="House of Gold"
            tagline="Bright, brash, unbothered."
            icon={<Crown className="h-6 w-6" />}
            picked={pick === "gold"}
            disabled={!!pick && pick !== "gold"}
            onPick={() => cast("gold")}
          />
          <SideCard
            side="shadow"
            label="House of Shadow"
            tagline="Quiet, patient, lethal."
            icon={<Shield className="h-6 w-6" />}
            picked={pick === "shadow"}
            disabled={!!pick && pick !== "shadow"}
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
            {!pick && (
              <span className="text-[#f5e8c7]/60">No vote cast yet.</span>
            )}
          </div>
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
  onPick,
}: {
  side: Side;
  label: string;
  tagline: string;
  icon: React.ReactNode;
  picked: boolean;
  disabled: boolean;
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
        {picked ? "Vote cast" : "Tap to pick"}
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