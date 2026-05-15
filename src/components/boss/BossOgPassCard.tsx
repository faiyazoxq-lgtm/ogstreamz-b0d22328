import { Mail, Calendar, ShieldAlert } from "lucide-react";
import { CoinChip } from "@/components/CoinChip";
import { PassStatusRow } from "@/components/PassStatusRow";
import { OG_TIER_LABEL, OG_TIER_TONE, rankToOgTier, type OgTier } from "@/lib/og-tier";

type Props = {
  /** Roster row from listRoster — must include og_pass_no, contact_card, etc. */
  row: any;
  /** Optional right-rail node (e.g. action buttons) shown alongside the card. */
  actions?: React.ReactNode;
  /** When provided, the card becomes a button that opens a detail drawer. */
  onSelect?: (row: any) => void;
};


/**
 * Boss-facing OG Pass profile card.
 *
 * Renders the same identity chips members see on their own pass
 * (PassStatusRow → OG#, rank, VIP, OG-Streamz, coins, socials) plus the
 * boss-only fields (email, joined date, ban marker). Used in the user
 * roster, ban inspector, and any other boss view that surfaces a member.
 */
export function BossOgPassCard({ row, actions, onSelect }: Props) {
  const initials = (row.display_name || row.email || "?").trim().slice(0, 2).toUpperCase();
  const tier: OgTier = (row.og_tier as OgTier) ?? rankToOgTier(row.rank);
  const tierLabel = OG_TIER_LABEL[tier];
  const tierTone = OG_TIER_TONE[tier];
  const joined = row.created_at ? new Date(row.created_at).toLocaleDateString() : null;

  // Build the profile shape PassStatusRow expects.
  const passProfile = {
    og_pass_no: row.og_pass_no ?? null,
    rank: row.rank,
    status: row.status,
    credits: row.credits,
    stream_status: row.stream_status,
    stream_expires_at: row.stream_expires_at,
    member_tier: row.member_tier,
    contact_card: row.contact_card ?? null,
  };

  return (
    <div
      className={[
        "relative rounded-2xl p-4 sm:p-5",
        "border border-[oklch(0.5_0.1_240/0.45)]",
        "bg-[linear-gradient(180deg,oklch(0.22_0.04_240)_0%,oklch(0.13_0.03_240)_55%,oklch(0.18_0.04_240)_100%)]",
        "shadow-[inset_0_1px_0_oklch(0.85_0.08_235/0.18),inset_0_-1px_0_oklch(0.05_0.02_240/0.7),0_8px_24px_-18px_oklch(0.72_0.22_245/0.6)]",
        onSelect ? "cursor-pointer transition hover:border-[oklch(0.65_0.14_240/0.7)] hover:shadow-[0_10px_30px_-14px_oklch(0.72_0.22_245/0.8)] focus-within:ring-2 focus-within:ring-[oklch(0.7_0.18_245/0.6)]" : "",
      ].join(" ")}
      onClick={onSelect ? () => onSelect(row) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(row);
              }
            }
          : undefined
      }
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `Open profile for ${row.display_name || row.email}` : undefined}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden text-sm font-black tracking-wider"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.32 0.06 240) 0%, oklch(0.16 0.04 240) 100%)",
            border: "1px solid oklch(0.6 0.12 240 / 0.6)",
            color: "oklch(0.92 0.05 235)",
            boxShadow:
              "inset 0 1px 0 oklch(0.85 0.1 235 / 0.35), 0 0 12px -4px oklch(0.72 0.22 245 / 0.55)",
          }}
          aria-hidden="true"
        >
          {row.avatar_url ? (
            <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-white truncate" title={row.display_name || row.email}>
              {row.display_name?.trim() || row.email}
            </h3>
            <CoinChip credits={row.credits} />
            <span
              className={`inline-flex items-center text-[10px] uppercase tracking-[0.22em] px-1.5 py-0.5 rounded border font-bold ${tierTone}`}
              title={`OG Pass tier · ${tierLabel}`}
            >
              {tierLabel}
            </span>
            {row.banned && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded font-bold bg-destructive/15 text-destructive border border-destructive/40">
                <ShieldAlert className="h-3 w-3" /> Banned
              </span>
            )}
          </div>

          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/60 truncate">
            <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
            <a
              href={`mailto:${row.email}`}
              className="hover:text-white truncate"
              title={row.email}
            >
              {row.email}
            </a>
          </p>

          {joined && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/45">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              Joined {joined}
            </p>
          )}

          {/* The OG Pass identity row — same chips members see on their own pass. */}
          {passProfile.og_pass_no != null ? (
            <div className="mt-2.5">
              <PassStatusRow profile={passProfile as any} size="md" />
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] italic text-white/45">
              No OG Pass # assigned yet.
            </p>
          )}
        </div>

        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export default BossOgPassCard;