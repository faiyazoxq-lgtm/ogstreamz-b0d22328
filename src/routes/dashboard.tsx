import type { SubscriptionRow } from "@/hooks/use-subscription";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { requireMember } from "@/lib/route-guards";
import { useEffect, useState } from "react";
import {
  Crown, Coins, Ticket, History, Loader2, Sparkles, ExternalLink, Music, Mic2,
  Flame, Twitch, Youtube, Radio, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { redeemCode } from "@/lib/overlord.functions";
import { ZeroGStreamPanel } from "@/components/ZeroGStreamPanel";
import { VaultRevealCard } from "@/components/VaultRevealCard";
import { VipNotificationsInbox } from "@/components/VipNotificationsInbox";
import { PassesPanel } from "@/components/PassesPanel";
import { useSubscription } from "@/hooks/use-subscription";
import { PlanChip, StatusBadge, formatSubscriptionTerm } from "@/components/SubscriptionBadges";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: "Dashboard · 0G-PORTAL" }] }),
  component: DashboardPage,
});

const RANK_META: Record<string, { label: string; color: string; perks: string }> = {
  prospect: { label: "Prospect", color: "text-emerald-300", perks: "5 free Hit-Button clicks · Gallery access" },
  enforcer: { label: "Enforcer", color: "text-cyan-300", perks: "Unlimited Gallery · Priority feed" },
  vip: { label: "VIP", color: "text-yellow-300", perks: "Unlimited Hits · Live Wire jokes · Deep tool mode" },
  boss: { label: "Boss", color: "text-pink-400", perks: "Ultimate Creator · All access" },
};

type SpawnRow = { id: string; name: string; slug: string; created_at: string; kind: string };
type UnlockRow = { id: string; created_at: string; portal: { name: string; slug: string } | null };
type TrackRow = { id: string; created_at: string; track: { title: string; portal_slug: string } | null };

function DashboardPage() {
  const { user, profile, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const redeem = useServerFn(redeemCode);
  const [spawns, setSpawns] = useState<SpawnRow[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [trackBuys, setTrackBuys] = useState<TrackRow[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { sub: activeSub, planLabel, renewalLabel } = useSubscription({ userId: user?.id ?? null });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
    else if (profile?.rank === "boss") navigate({ to: "/syndicate-overlord" });
  }, [user, loading, navigate, profile?.rank]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("portals").select("id,name,slug,created_at,kind").eq("created_by", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("portal_unlocks").select("id,created_at,portal:portals(name,slug)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("track_purchases").select("id,created_at,track:tracks(title,portal_slug)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]).then(([s, u, t]) => {
      setSpawns((s.data ?? []) as any);
      setUnlocks((u.data ?? []) as any);
      setTrackBuys((t.data ?? []) as any);
    });
  }, [user]);


  const onRedeem = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await redeem({ data: { code } });
      toast.success(`+${r.credits} credits${r.rank ? ` · Promoted to ${String(r.rank).toUpperCase()}` : ""}`);
      setCode("");
      await refresh();
    } catch (e: any) { toast.error(e.message ?? "Redeem failed"); }
    finally { setBusy(false); }
  };

  if (loading || !profile) return <main className="px-5 py-20 text-center text-muted-foreground"><Loader2 className="h-5 w-5 inline animate-spin mr-2" />Loading frequency…</main>;
  if (profile.rank === "boss") return <main className="px-5 py-20 text-center text-muted-foreground"><Loader2 className="h-5 w-5 inline animate-spin mr-2" />Routing to Boss Control Center…</main>;

  const meta = RANK_META[profile.rank] ?? RANK_META.prospect;
  const freeLeft = Math.max(0, 5 - (profile.free_clicks_used ?? 0));

  return (
    <main className="relative max-w-5xl mx-auto px-5 sm:px-8 py-12">
      {/* Hero */}
      <header className="mb-8">
        <p className="text-xs tracking-[0.4em] uppercase font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          Syndicate Dashboard
        </p>
        <h1 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-5xl text-metallic">
          {profile.display_name || profile.email.split("@")[0]}
        </h1>
      </header>

          <section className="grid sm:grid-cols-3 gap-4 mb-10">
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rank</p>
              <p className={`mt-1 text-3xl font-black ${meta.color}`}><Crown className="inline h-6 w-6 mr-2" />{meta.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{meta.perks}</p>
              <SubSummary planLabel={planLabel} activeSub={activeSub} renewalLabel={renewalLabel} />
            </Card>
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Credits</p>
              <p className="mt-1 text-3xl font-black text-metallic"><Coins className="inline h-6 w-6 mr-2 text-yellow-400" />{profile.credits}</p>
              <Link to="/store" className="mt-1 inline-block text-xs underline text-[color:var(--neon-blue-bright)]">Buy Credits →</Link>
              <SubSummary planLabel={planLabel} activeSub={activeSub} renewalLabel={renewalLabel} />
            </Card>
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Hit-Button (free)</p>
              <p className="mt-1 text-3xl font-black text-metallic"><Flame className="inline h-6 w-6 mr-2 text-orange-400" />{profile.rank === "prospect" ? `${freeLeft}/5` : "∞"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{profile.rank === "prospect" ? "Upgrade for unlimited" : "Unlimited access unlocked"}</p>
              <SubSummary planLabel={planLabel} activeSub={activeSub} renewalLabel={renewalLabel} />
            </Card>
          </section>

          <section className="rounded-2xl border p-6 mb-10" style={{ borderColor: "color-mix(in oklab, var(--neon-blue-bright) 40%, transparent)", background: "linear-gradient(135deg, color-mix(in oklab, var(--neon-blue-bright) 8%, transparent), transparent)" }}>
            <h2 className="text-xs uppercase tracking-[0.4em] mb-3" style={{ color: "var(--neon-blue-bright)" }}>
              <Ticket className="inline h-4 w-4 mr-2" />Redeem Code
            </h2>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="0G-FOUNDER" className="font-mono uppercase" onKeyDown={(e) => e.key === "Enter" && onRedeem()} />
              <Button onClick={onRedeem} disabled={busy || !code} className="font-bold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-2" />Redeem</>}
              </Button>
            </div>
          </section>

      {/* History */}
      <section className="space-y-6">
        <ZeroGStreamPanel />
        <PassesPanel compact />
        <StreamLinksCard streams={(profile as any).stream_links ?? {}} />
        <VipNotificationsInbox />
        <VaultRevealCard />
        <h2 className="text-xs uppercase tracking-[0.4em] text-muted-foreground"><History className="inline h-3.5 w-3.5 mr-2" />Transmission History</h2>

        <HistoryGroup title="Portals you spawned" empty="You haven't spawned any portals yet." Icon={Sparkles}>
          {spawns.map((s) => (
            <HistoryRow
              key={s.id}
              title={s.name}
              sub={`${s.kind} · ${new Date(s.created_at).toLocaleDateString()}`}
              to={s.kind === "music" ? "/m/$slug" : "/p/$slug"}
              slug={s.slug}
            />
          ))}
        </HistoryGroup>

            <HistoryGroup title="VIP portals unlocked" empty="No VIP portal unlocks yet." Icon={Mic2}>
              {unlocks.filter((u) => u.portal).map((u) => (
                <HistoryRow key={u.id} title={u.portal!.name} sub={new Date(u.created_at).toLocaleDateString()} to="/p/$slug" slug={u.portal!.slug} />
              ))}
            </HistoryGroup>

            <HistoryGroup title="Tracks you own" empty="No track purchases yet." Icon={Music}>
              {trackBuys.filter((t) => t.track).map((t) => (
                <HistoryRow key={t.id} title={t.track!.title} sub={`${t.track!.portal_slug} · ${new Date(t.created_at).toLocaleDateString()}`} to="/m/$slug" slug={t.track!.portal_slug} />
              ))}
            </HistoryGroup>
      </section>

      <footer className="mt-16 pt-8 border-t border-border text-center text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
        0G-PORTAL · Syndicate Member · Frequency Unlocked
      </footer>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5">{children}</div>;
}

function StreamLinksCard({ streams }: { streams: { twitch?: string; youtube?: string; url?: string } }) {
  const items: Array<{ key: string; label: string; href: string; Icon: any }> = [];
  const twitch = (streams.twitch ?? "").trim();
  if (twitch) {
    const handle = twitch.replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "").replace(/^@/, "");
    items.push({ key: "twitch", label: `twitch.tv/${handle}`, href: `https://twitch.tv/${handle}`, Icon: Twitch });
  }
  const yt = (streams.youtube ?? "").trim();
  if (yt) {
    const href = /^https?:\/\//i.test(yt) ? yt : `https://youtube.com/${yt.replace(/^@/, "@")}`;
    items.push({ key: "youtube", label: yt, href, Icon: Youtube });
  }
  const url = (streams.url ?? "").trim();
  if (url && /^https?:\/\//i.test(url)) {
    items.push({ key: "url", label: url.replace(/^https?:\/\//i, ""), href: url, Icon: Radio });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-bold text-metallic flex items-center gap-2">
          <Radio className="h-4 w-4 text-[color:var(--neon-blue-bright)]" />
          Stream Profiles
        </p>
        <Link to="/settings" className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-white">
          Manage →
        </Link>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1.5">
        <Lock className="h-3 w-3" /> Private — visible only to you and the boss.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No stream profiles linked yet.{" "}
          <Link to="/settings" className="underline text-[color:var(--neon-blue-bright)]">
            Add Twitch, YouTube, or any stream URL
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map(({ key, label, href, Icon }) => (
            <li key={key} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 text-[color:var(--neon-blue-bright)] shrink-0" />
                <span className="text-sm text-white truncate">{label}</span>
              </div>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs uppercase tracking-widest font-bold text-[color:var(--neon-blue-bright)] inline-flex items-center gap-1"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubSummary({
  planLabel,
  activeSub,
  renewalLabel,
}: {
  planLabel: string | null;
  activeSub: SubscriptionRow | null;
  renewalLabel: string | null;
}) {
  const subWithStatus: SubscriptionRow | null =
    activeSub && activeSub.status ? activeSub : null;
  if (!planLabel && !subWithStatus && !renewalLabel) return null;
  const summaryParts = [
    planLabel ? `${formatSubscriptionTerm(planLabel)} plan` : null,
    subWithStatus?.status ? `status ${formatSubscriptionTerm(subWithStatus.status)}` : null,
    renewalLabel,
  ].filter(Boolean);
  return (
    <div
      className="mt-2.5 flex flex-col gap-1.5 leading-none"
      role="group"
      aria-label={`Subscription summary: ${summaryParts.join(", ")}`}
    >
      {(planLabel || subWithStatus) && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-h-[20px]">
          {planLabel && <PlanChip planLabel={planLabel} tone="amber" size="sm" />}
          {subWithStatus && <StatusBadge sub={subWithStatus} size="sm" />}
        </div>
      )}
      {renewalLabel && (
        <p
          className="text-[11px] leading-snug text-muted-foreground break-words hyphens-auto max-w-full text-start [unicode-bidi:plaintext]"
          dir="auto"
          title={renewalLabel}
        >
          {renewalLabel}
        </p>
      )}
    </div>
  );
}

function HistoryGroup({ title, empty, Icon, children }: { title: string; empty: string; Icon: any; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasContent = items.filter(Boolean).length > 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-bold text-metallic mb-3"><Icon className="inline h-4 w-4 mr-2 text-[color:var(--neon-blue-bright)]" />{title}</p>
      {hasContent ? <ul className="divide-y divide-border">{children}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

type PortalLinkRoute = "/p/$slug" | "/m/$slug" | "/td/$slug" | "/t/$slug" | "/b/$slug";
function HistoryRow({ title, sub, to, slug }: { title: string; sub: string; to: PortalLinkRoute; slug: string }) {
  return (
    <li className="py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <Link to={to} params={{ slug }} className="text-xs uppercase tracking-widest font-bold text-[color:var(--neon-blue-bright)] inline-flex items-center gap-1">
        Open <ExternalLink className="h-3 w-3" />
      </Link>
    </li>
  );
}
