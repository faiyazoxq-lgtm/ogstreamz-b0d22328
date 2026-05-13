import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { BossOgPassCard } from "@/components/boss/BossOgPassCard";
import { PassStatusRow } from "@/components/PassStatusRow";
import { socialToUrl, socialDisplay } from "@/lib/social-handles";
import type { RosterRow } from "@/lib/boss-users.functions";
import { effectiveSwearing, effectiveIntensity } from "@/lib/swearing";
import { Mail, Calendar, Coins, Tv, ShieldOff, ShieldCheck, Flame, ExternalLink, Hash } from "lucide-react";

type Props = {
  row: RosterRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional action buttons rendered at the bottom of the drawer. */
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
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="text-white">
                {row.display_name?.trim() || row.email}
              </SheetTitle>
              <SheetDescription className="text-white/60">
                Full member profile, contact, and pass status.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <BossOgPassCard row={row} />

              <Section label="Contact">
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

              <Section label="Pass / Chip Status">
                {row.og_pass_no != null ? (
                  <PassStatusRow profile={row as any} size="md" />
                ) : (
                  <p className="text-[12px] italic text-white/50">No OG Pass # assigned yet.</p>
                )}
                <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                  <Stat label="Rank" value={row.rank} />
                  <Stat label="Status" value={row.status} />
                  <Stat label="Coins" value={`${row.credits ?? 0} 🪙`} icon={<Coins className="h-3 w-3 text-gold" />} />
                  <Stat label="Tier" value={row.member_tier ?? "—"} />
                  <Stat
                    label="Stream"
                    value={row.stream_status ?? "none"}
                    icon={<Tv className="h-3 w-3 text-cyan-300" />}
                  />
                  <Stat
                    label="Stream expiry"
                    value={row.stream_expires_at ? new Date(row.stream_expires_at).toLocaleDateString() : "—"}
                  />
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
                  <p className="mt-2 text-[11px] text-destructive/80">
                    Ban reason: {row.banned_reason}
                  </p>
                )}
              </Section>

              <Section label="Socials & Handles">
                <SocialsList contact={row.contact_card} />
              </Section>

              {actions && (
                <Section label="Actions">
                  <div className="space-y-2">{actions}</div>
                </Section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.25em] text-white/45 font-bold mb-2">{label}</p>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">{children}</div>
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