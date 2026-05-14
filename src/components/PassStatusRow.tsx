import {
  Crown,
  Tv,
  TvMinimal,
  Infinity as InfinityIcon,
  Send,
  Youtube,
  Instagram,
  Twitter,
  Music2,
  Globe,
  Shield,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { OgPassBadge } from "@/components/OgPassBadge";
import { socialToUrl } from "@/lib/social-handles";

type ContactCard = Record<string, string | null | undefined> | null | undefined;

type ProfileLike = {
  status?: "free" | "vip" | string | null;
  rank?: string | null;
  member_tier?: string | null;
  stream_status?: string | null;
  stream_expires_at?: string | null;
  og_pass_no?: number | null;
  credits?: number | null;
  contact_card?: unknown;
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

const SOCIAL_FIELDS: Array<{
  key: string;
  label: string;
  Icon: any;
  tint: string;
  toUrl: (v: string) => string | null;
}> = [
  {
    key: "telegram",
    label: "Telegram",
    Icon: Send,
    tint: "rgb(56,189,248)",
    toUrl: (v) => socialToUrl("telegram", v),
  },
  {
    key: "youtube",
    label: "YouTube",
    Icon: Youtube,
    tint: "rgb(248,113,113)",
    toUrl: (v) => socialToUrl("youtube", v),
  },
  {
    key: "tiktok",
    label: "TikTok",
    Icon: Music2,
    tint: "rgb(232,121,249)",
    toUrl: (v) => socialToUrl("tiktok", v),
  },
  {
    key: "instagram",
    label: "Instagram",
    Icon: Instagram,
    tint: "rgb(244,114,182)",
    toUrl: (v) => socialToUrl("instagram", v),
  },
  {
    key: "twitter",
    label: "X",
    Icon: Twitter,
    tint: "rgb(226,232,240)",
    toUrl: (v) => socialToUrl("twitter", v),
  },
  {
    key: "website",
    label: "Website",
    Icon: Globe,
    tint: "rgb(125,211,252)",
    toUrl: (v) => socialToUrl("website", v),
  },
];

function readContactCard(p: ProfileLike): ContactCard {
  const raw = (p as any)?.contact_card;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as ContactCard;
  return null;
}

function rankLabel(rank?: string | null): string | null {
  if (!rank) return null;
  const r = rank.toLowerCase();
  if (r === "boss") return "Boss";
  if (r === "vip") return null; // VIP chip already shown
  if (r === "member") return "Member";
  return rank.charAt(0).toUpperCase() + rank.slice(1);
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
  showCoins = true,
  showSocials = true,
  showRank = true,
}: {
  profile: ProfileLike;
  size?: "sm" | "md" | "lg";
  className?: string;
  showCoins?: boolean;
  showSocials?: boolean;
  showRank?: boolean;
}) {
  if (!profile?.og_pass_no) return null;
  const isVip = profile.status === "vip" || profile.rank === "boss";
  const isBoss = profile.rank === "boss";
  const streamActive = isStreamActive(profile);
  const credits = typeof profile.credits === "number" ? profile.credits : null;
  const contact = readContactCard(profile);
  const linkedSocials = showSocials && contact
    ? SOCIAL_FIELDS.flatMap((f) => {
        const v = (contact[f.key] ?? "").toString().trim();
        if (!v) return [];
        const url = f.toUrl(v);
        return url ? [{ ...f, url }] : [];
      })
    : [];
  const rankChipLabel = showRank && !isVip ? rankLabel(profile.rank) : null;
  const chipCls =
    size === "lg"
      ? "px-3 py-1 text-[11px]"
      : size === "md"
      ? "px-2.5 py-0.5 text-[10px]"
      : "px-2 py-0.5 text-[9px]";
  const iconSize = size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3";

  // Shared metallic silver-blue chrome — dark, 3D, electric edge.
  const chipMetal =
    "border border-[oklch(0.5_0.1_240/0.55)] " +
    "bg-[linear-gradient(180deg,oklch(0.26_0.05_240)_0%,oklch(0.14_0.04_240)_50%,oklch(0.2_0.05_240)_100%)] " +
    "text-[oklch(0.92_0.05_235)] " +
    "shadow-[inset_0_1px_0_oklch(0.82_0.08_235/0.3),inset_0_-1px_0_oklch(0.08_0.02_240/0.75),0_1px_0_oklch(0.05_0.02_240/0.8),0_0_12px_-4px_oklch(0.72_0.22_245/0.5)]";
  const chipMetalGold =
    "border border-[oklch(0.65_0.16_85/0.5)] " +
    "bg-[linear-gradient(180deg,oklch(0.3_0.06_85)_0%,oklch(0.16_0.04_70)_50%,oklch(0.22_0.05_80)_100%)] " +
    "text-[oklch(0.93_0.1_85)] " +
    "shadow-[inset_0_1px_0_oklch(0.85_0.14_85/0.35),inset_0_-1px_0_oklch(0.08_0.02_70/0.8),0_1px_0_oklch(0.05_0.02_70/0.85),0_0_14px_-4px_oklch(0.7_0.18_85/0.55)]";
  const chipMetalCyan =
    "border border-[oklch(0.6_0.14_215/0.55)] " +
    "bg-[linear-gradient(180deg,oklch(0.28_0.06_215)_0%,oklch(0.14_0.04_220)_50%,oklch(0.2_0.05_215)_100%)] " +
    "text-[oklch(0.94_0.08_215)] " +
    "shadow-[inset_0_1px_0_oklch(0.85_0.12_215/0.35),inset_0_-1px_0_oklch(0.08_0.02_220/0.8),0_1px_0_oklch(0.05_0.02_220/0.85),0_0_14px_-4px_oklch(0.7_0.18_215/0.6)]";
  const chipMetalDim =
    "border border-[oklch(0.4_0.04_240/0.5)] " +
    "bg-[linear-gradient(180deg,oklch(0.22_0.02_240)_0%,oklch(0.12_0.01_240)_50%,oklch(0.18_0.02_240)_100%)] " +
    "text-muted-foreground " +
    "shadow-[inset_0_1px_0_oklch(0.5_0.04_240/0.25),inset_0_-1px_0_oklch(0.05_0.01_240/0.8)]";

  return (
    <div className={["inline-flex flex-wrap items-center gap-1.5", className].join(" ")}>
      <Link
        to={isBoss ? "/boss/users" : "/account/passes"}
        title={isBoss ? "View all OG Passes" : "View my passes"}
        className="rounded-full transition hover:scale-[1.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
        onClick={(e) => e.stopPropagation()}
      >
        <OgPassBadge number={profile.og_pass_no} size={size} />
      </Link>
      {rankChipLabel && (
        <span
          title={`Rank · ${rankChipLabel}`}
          className={[
            "inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.22em]",
            isBoss ? chipMetalGold : chipMetal,
            chipCls,
          ].join(" ")}
        >
          <Shield className={iconSize} />
          {rankChipLabel}
        </span>
      )}
      {isVip && (
        <Link
          to="/vip"
          onClick={(e) => e.stopPropagation()}
          title="VIP Lifetime Pass · Real OG for life"
          className={[
            "inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.22em] transition hover:scale-[1.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
            chipMetalGold,
            chipCls,
          ].join(" ")}
        >
          <Crown className={iconSize} /> VIP
          <span className="opacity-80 inline-flex items-center gap-0.5">
            <InfinityIcon className={iconSize} />Lifetime
          </span>
        </Link>
      )}
      {(() => {
        const streamTitle = isBoss
          ? "OG-Streamz · Domain & DNS settings"
          : streamActive
          ? `OG-Streamz · Stream Profile active${
              profile.stream_expires_at
                ? ` until ${new Date(profile.stream_expires_at).toLocaleDateString()}`
                : ""
            }`
          : "Stream Profile inactive — yearly pass required";
        const streamCls = [
          "inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.22em] transition hover:scale-[1.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
          streamActive ? chipMetalCyan : chipMetalDim,
          chipCls,
        ].join(" ");
        const inner = (
          <>
            {streamActive ? <Tv className={iconSize} /> : <TvMinimal className={`${iconSize} opacity-60`} />}
            OG-Streamz
            <span className="opacity-80">{streamActive ? streamExpiryLabel(profile) : "Off"}</span>
          </>
        );
        if (isBoss) {
          return (
            <Link to="/boss/domain" title={streamTitle} className={streamCls} onClick={(e) => e.stopPropagation()}>
              {inner}
            </Link>
          );
        }
        return (
          <span title={streamTitle} className={streamCls}>
            {inner}
          </span>
        );
      })()}
      {/* Coin balance chip removed */}
      {linkedSocials.length > 0 && (
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full",
            chipMetal,
            size === "lg" ? "px-2.5 py-1" : "px-2 py-0.5",
          ].join(" ")}
          aria-label={`Linked socials: ${linkedSocials.map((s) => s.label).join(", ")}`}
        >
          {linkedSocials.map((s) => {
            const Icon = s.Icon;
            return (
              <a
                key={s.key}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center rounded-full p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
                style={{ color: s.tint }}
              >
                <Icon className={iconSize} />
                <span className="sr-only">{s.label}</span>
              </a>
            );
          })}
        </span>
      )}
    </div>
  );
}
