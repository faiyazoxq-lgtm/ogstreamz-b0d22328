import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CoinChip } from "@/components/CoinChip";
import { formatGbp } from "@/lib/coins";
import { BossOgPassCard } from "@/components/boss/BossOgPassCard";
import { PassStatusRow } from "@/components/PassStatusRow";
import { socialToUrl, socialDisplay } from "@/lib/social-handles";
import type { RosterRow } from "@/lib/boss-users.functions";
import { effectiveSwearing, effectiveIntensity } from "@/lib/swearing";
import {
  Mail, Calendar, Coins, Tv, ShieldOff, ShieldCheck, Flame, ExternalLink, Hash,
  IdCard, KeyRound, Gavel, Link2, Wrench,
} from "lucide-react";

type Props = {
  row: RosterRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Optional action buttons rendered inside a clearly separated "Boss actions"
   * zone at the bottom of the drawer. Treat each button as operating on THIS
   * member only — use destructive styling for irreversible actions.
   */
  actions?: React.ReactNode;
};

const SOCIAL_KEYS = ["telegram", "youtube", "tiktok", "instagram", "twitter", "website"] as const;
const SOCIAL_LABEL: Record<string, string> = {
  telegram: "Telegram",
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "X / Twitter",
  website: "Website",
};

/**
 * Slide-in drawer that surfaces a member's full profile when a boss
 * clicks a `BossOgPassCard`. Shows the identity card, every social
 * handle (with normalized URL), pass / chip status, and the boss-only
 * lifecycle fields (rank, status, credits, ban, stream, swearing).
 */
export function MemberDetailDrawer({ row, open, onOpenChange, actions }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto bg-[oklch(0.13_0.03_240)] border-l border-[oklch(0.5_0.1_240/0.4)] text-white"
      >
        {row && (
          <>
            <SheetHeader className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-4 bg-[oklch(0.13_0.03_240)]/95 backdrop-blur border-b border-white/5 space-y-1 text-left">
              <SheetTitle className="text-white flex items-center gap-2 flex-wrap">
                <span>{row.display_name?.trim() || row.email}</span>
                <CoinChip credits={row.credits} />
                {row.banned ? (
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] font-bold bg-destructive/20 text-destructive border border-destructive/50">
                    <ShieldOff className="h-3 w-3" /> Banned
                  </span>
                ) : null}
              </SheetTitle>
              <SheetDescription className="text-white/55 text-xs">
                Read-only member profile. Per-user actions appear at the bottom when available.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              <BossOgPassCard row={row} />

              <Section label="Identity" Icon={IdCard} tint="#3ad6ff">
                <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                  <a href={`mailto:${row.email}`} className="text-sky-300 hover:underline break-all">
                    {row.email}
                  </a>
                </Field>
                {row.created_at && (
                  <Field icon={<Calendar className="h-3.5 w-3.5" />} label="Joined">
                    <span>{new Date(row.created_at).toLocaleString()}</span>
                  </Field>
                )}
                {row.og_pass_no != null && (
                  <Field icon={<Hash className="h-3.5 w-3.5" />} label="OG Pass #">
                    <span className="tabular-nums">{String(row.og_pass_no).padStart(5, "0")}</span>
                  </Field>
                )}
              </Section>

              <Section
                label="Access & Credits"
                Icon={KeyRound}
                tint="#ffd166"
                hint="Rank, tier, coin balance, and stream entitlement."
              >
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <Stat label="Rank" value={row.rank} />
                  <Stat label="Tier" value={row.member_tier ?? "—"} />
                  <Stat
                    label="Coins"
                    value={`${(row.credits ?? 0).toLocaleString("en-GB")} 🪙 (${formatGbp((row.credits ?? 0) * 100)})`}
                    icon={<Coins className="h-3 w-3 text-gold" />}
                  />
                  <Stat label="Account status" value={row.status} />
                  <Stat
                    label="Stream"
                    value={row.stream_status ?? "none"}
                    icon={<Tv className="h-3 w-3 text-cyan-300" />}
                  />
                  <Stat
                    label="Stream expiry"
                    value={row.stream_expires_at ? new Date(row.stream_expires_at).toLocaleDateString() : "—"}
                  />
                </div>
              </Section>

              <Section
                label="Moderation"
                Icon={Gavel}
                tint={row.banned ? "#ff5577" : "#94a3b8"}
                hint="Ban state and per-member swearing override."
              >
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <Stat
                    label="Swearing"
                    value={`${effectiveSwearing(row) ? "On" : "Safe"} · ${effectiveIntensity(row)}`}
                    icon={<Flame className="h-3 w-3 text-rose-300" />}
                  />
                  <Stat
                    label="Banned"
                    value={row.banned ? "Yes" : "No"}
                    icon={
                      row.banned ? (
                        <ShieldOff className="h-3 w-3 text-destructive" />
                      ) : (
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      )
                    }
                  />
                </div>
                {row.banned && row.banned_reason && (
                  <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
                    <span className="font-bold uppercase tracking-[0.18em] text-[10px] mr-1.5">Ban reason</span>
                    {row.banned_reason}
                  </div>
                )}
              </Section>

              <Section
                label="Pass status"
                Icon={ShieldCheck}
                tint="#a78bfa"
                hint="Live OG Pass / chip state."
              >
                {row.og_pass_no != null ? (
                  <PassStatusRow profile={row as any} size="md" />
                ) : (
                  <p className="text-[12px] italic text-white/50">No OG Pass # assigned yet.</p>
                )}
              </Section>

              <Section label="Socials & handles" Icon={Link2} tint="#7dd3fc">
                <SocialsList contact={row.contact_card} />
              </Section>

              {actions && (
                <section aria-label="Boss actions" className="pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-3.5 w-3.5" style={{ color: "#ff7a1a" }} />
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/70 font-bold">
                      Boss actions
                    </p>
                    <span className="text-[10px] text-white/40">
                      · affect this member only
                    </span>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3 space-y-2">
                    <p className="text-[11px] text-white/55">
                      Review the action label before clicking. Destructive actions are styled in red and cannot be undone.
                    </p>
                    <div className="space-y-2">{actions}</div>
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  label,
  children,
  Icon,
  tint = "#94a3b8",
  hint,
}: {
  label: string;
  children: React.ReactNode;
  Icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint?: string;
  hint?: string;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2">
        {Icon && (
          <Icon className="h-3 w-3 translate-y-0.5 shrink-0" style={{ color: tint }} />
        )}
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/55 font-bold">{label}</p>
        {hint && <p className="text-[10px] text-white/35 normal-case tracking-normal">{hint}</p>}
      </div>
      <div
        className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2"
        style={{ borderLeft: `2px solid ${tint}55` }}
      >
        {children}
      </div>
    </section>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-[12px] text-white/80">
      {icon && <span className="mt-0.5 text-white/55">{icon}</span>}
      <span className="text-white/45 w-20 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/5 bg-black/30 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-white/90 font-medium">
        {icon}
        {value}
      </p>
    </div>
  );
}

function SocialsList({ contact }: { contact: Record<string, any> | null }) {
  if (!contact || typeof contact !== "object") {
    return <p className="text-[12px] italic text-white/45">No socials provided.</p>;
  }
  const items = SOCIAL_KEYS
    .map((k) => {
      const raw = contact[k];
      if (!raw || typeof raw !== "string") return null;
      const url = socialToUrl(k, raw);
      const display = socialDisplay(k as any, raw) ?? raw;
      return { key: k, raw, url, display };
    })
    .filter(Boolean) as Array<{ key: string; raw: string; url: string | null; display: string }>;

  if (items.length === 0) {
    return <p className="text-[12px] italic text-white/45">No socials provided.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.key} className="flex items-center justify-between gap-2 text-[12px]">
          <span className="text-white/55 w-20 shrink-0">{SOCIAL_LABEL[it.key] ?? it.key}</span>
          {it.url ? (
            <a
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sky-300 hover:underline truncate"
              title={it.url}
            >
              <span className="truncate">{it.display}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <span className="text-white/70 truncate" title={it.raw}>
              {it.display}{" "}
              <span className="text-destructive/80 text-[10px] uppercase tracking-wider">invalid</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default MemberDetailDrawer;