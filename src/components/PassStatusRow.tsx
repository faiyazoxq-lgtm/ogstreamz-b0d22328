import { Crown, Tv, TvMinimal, Infinity as InfinityIcon } from "lucide-react";
import { OgPassBadge } from "@/components/OgPassBadge";

type ProfileLike = {
  status?: "free" | "vip" | string | null;
  rank?: string | null;
  member_tier?: string | null;
  stream_status?: string | null;
  stream_expires_at?: string | null;
  og_pass_no?: number | null;
} | null | undefined;

function isStreamActive(p: ProfileLike): boolean {
  if (!p) return false;
  if (p.member_tier === "og_streamz_member") return true;
  if (p.stream_status && p.stream_status !== "expired" && p.stream_status !== "revoked") {
    if (!p.stream_expires_at) return true;
    return new Date(p.stream_expires_at).getTime() > Date.now();
  }
  return false;
}

function streamExpiryLabel(p: ProfileLike): string {
  if (!p?.stream_expires_at) return "Active";
  const ms = new Date(p.stream_expires_at).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.ceil(ms / 86400_000);
  if (days > 360) return `${Math.round(days / 30)}mo left`;
  return `${days}d left`;
}

/**
 * Compact identity row for member profile cards:
 *   [ OG PASS #00001 ] [ VIP ] [ OG-STREAMZ ]
 * Always renders when profile has an OG Pass number — VIP / Stream chips
 * appear only when active so the row doubles as a quick status read-out.
 */
export function PassStatusRow({
  profile,
  size = "sm",
  className = "",
}: {
  profile: ProfileLike;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (!profile?.og_pass_no) return null;
  const isVip = profile.status === "vip" || profile.rank === "boss";
  const streamActive = isStreamActive(profile);
  const chipCls =
    size === "lg"
      ? "px-3 py-1 text-[11px]"
      : size === "md"
      ? "px-2.5 py-0.5 text-[10px]"
      : "px-2 py-0.5 text-[9px]";

  return (
    <div className={["inline-flex flex-wrap items-center gap-1.5", className].join(" ")}>
      <OgPassBadge number={profile.og_pass_no} size={size} />
      {isVip && (
        <span
          title="VIP Lifetime Pass · Real OG for life"
          className={[
            "inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.22em]",
            "border border-amber-300/60 bg-amber-400/15 text-amber-100",
            chipCls,
          ].join(" ")}
        >
          <Crown className="h-3 w-3" /> VIP
          <span className="opacity-80 inline-flex items-center gap-0.5">
            <InfinityIcon className="h-3 w-3" />Lifetime
          </span>
        </span>
      )}
      <span
        title={
          streamActive
            ? `OG-Streamz · Stream Profile active${
                profile.stream_expires_at
                  ? ` until ${new Date(profile.stream_expires_at).toLocaleDateString()}`
                  : ""
              }`
            : "Stream Profile inactive — yearly pass required"
        }
        className={[
          "inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.22em] border",
          streamActive
            ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-100 shadow-[0_0_14px_-6px_rgba(56,189,248,0.7)]"
            : "border-border/60 bg-background/40 text-muted-foreground",
          chipCls,
        ].join(" ")}
      >
        {streamActive ? <Tv className="h-3 w-3" /> : <TvMinimal className="h-3 w-3 opacity-60" />}
        OG-Streamz
        <span className="opacity-80">{streamActive ? streamExpiryLabel(profile) : "Off"}</span>
      </span>
    </div>
  );
}
