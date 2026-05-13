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
import { OgPassBadge } from "@/components/OgPassBadge";

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
    toUrl: (v) => {
      const h = v.replace(/^@/, "").replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "");
      return h ? `https://t.me/${h}` : null;
    },
  },
  {
    key: "youtube",
    label: "YouTube",
    Icon: Youtube,
    tint: "rgb(248,113,113)",
    toUrl: (v) => (/^https?:\/\//i.test(v) ? v : v ? `https://youtube.com/@${v.replace(/^@/, "")}` : null),
  },
  {
    key: "tiktok",
    label: "TikTok",
    Icon: Music2,
    tint: "rgb(232,121,249)",
    toUrl: (v) => (/^https?:\/\//i.test(v) ? v : v ? `https://tiktok.com/@${v.replace(/^@/, "")}` : null),
  },
  {
    key: "instagram",
    label: "Instagram",
    Icon: Instagram,
    tint: "rgb(244,114,182)",
    toUrl: (v) => (/^https?:\/\//i.test(v) ? v : v ? `https://instagram.com/${v.replace(/^@/, "")}` : null),
  },
  {
    key: "twitter",
    label: "X",
    Icon: Twitter,
    tint: "rgb(226,232,240)",
    toUrl: (v) => (/^https?:\/\//i.test(v) ? v : v ? `https://x.com/${v.replace(/^@/, "")}` : null),
  },
  {
    key: "website",
    label: "Website",
    Icon: Globe,
    tint: "rgb(125,211,252)",
    toUrl: (v) => {
      if (!v) return null;
      return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    },
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

  return (
    <div className={["inline-flex flex-wrap items-center gap-1.5", className].join(" ")}>
      <OgPassBadge number={profile.og_pass_no} size={size} />
      {rankChipLabel && (
        <span
          title={`Rank · ${rankChipLabel}`}
          className={[
            "inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.22em] border",
            isBoss
              ? "border-amber-300/60 bg-amber-400/10 text-amber-100 shadow-[0_0_14px_-6px_rgba(255,200,80,0.7)]"
              : "border-border/60 bg-background/40 text-muted-foreground",
            chipCls,
          ].join(" ")}
        >
          <Shield className={iconSize} />
          {rankChipLabel}
        </span>
      )}
      {isVip && (
        <span
          title="VIP Lifetime Pass · Real OG for life"
          className={[
            "inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.22em]",
            "border border-amber-300/60 bg-amber-400/15 text-amber-100",
            chipCls,
          ].join(" ")}
        >
          <Crown className={iconSize} /> VIP
          <span className="opacity-80 inline-flex items-center gap-0.5">
            <InfinityIcon className={iconSize} />Lifetime
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
        {streamActive ? <Tv className={iconSize} /> : <TvMinimal className={`${iconSize} opacity-60`} />}
        OG-Streamz
        <span className="opacity-80">{streamActive ? streamExpiryLabel(profile) : "Off"}</span>
      </span>
      {showCoins && credits != null && (
        <span
          title={`Coin balance · ${credits.toLocaleString()} 🪙`}
          className={[
            "inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.22em] border",
            "border-amber-300/50 bg-gradient-to-r from-amber-400/15 to-amber-500/10 text-amber-100",
            "shadow-[0_0_14px_-6px_rgba(255,200,80,0.6)] tabular-nums",
            chipCls,
          ].join(" ")}
        >
          <span aria-hidden className="text-[0.85em] leading-none">🪙</span>
          <span className="tabular-nums">{credits.toLocaleString()}</span>
        </span>
      )}
      {linkedSocials.length > 0 && (
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40",
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
