import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { COIN } from "@/lib/coins";

type Props = {
  accent?: string;
  className?: string;
};

/**
 * Compact coin balance chip. Links to /wallet for top-ups.
 * Hides when the user is signed out.
 */
export function CoinBalance({ accent = "#facc15", className = "" }: Props) {
  const { user, profile } = useAuth();
  if (!user) return null;
  const credits = profile?.credits ?? 0;
  return (
    <Link
      to="/wallet"
      title={`${credits.toLocaleString()} coins · top up`}
      className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-bold tabular-nums transition hover:scale-105 ${className}`}
      style={{
        borderColor: `${accent}80`,
        background: `${accent}15`,
        color: accent,
      }}
    >
      <Coins className="h-3.5 w-3.5" />
      <span>{credits.toLocaleString()}</span>
      <span className="opacity-70">{COIN}</span>
    </Link>
  );
}