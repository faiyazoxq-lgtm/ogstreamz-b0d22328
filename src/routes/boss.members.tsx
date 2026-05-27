import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Users, Inbox, Ticket, KeyRound, Handshake, Share2, FileText, MousePointerClick } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";
import { BossUsers } from "@/routes/boss.users";
import { BossOgPasses } from "@/routes/boss.og-passes";
import { BossResellerAuditPage } from "@/routes/boss.reseller-audit";
import { BossTodoPage } from "@/components/boss/ops/todo";
import { TopUpRequestsPanel } from "@/components/TopUpRequestsPanel";
import { VipPassPoolAdmin } from "@/components/boss/VipPassPoolAdmin";

export const Route = createFileRoute("/boss/members")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Members · Boss · 0G-STREAMZ" },
      { name: "description", content: "Unified Mega Dashboard: roster, top-ups, passes, codes, resellers, share & notes." },
    ],
  }),
  component: BossMembersPage,
});

const TABS = [
  { id: "roster",    label: "Roster",    Icon: Users,     tint: "#3ad6ff",
    purpose: "Browse every member, open a profile, run per-user actions." },
  { id: "topups",    label: "Top-Ups",   Icon: Inbox,     tint: "#ff5577",
    purpose: "Approve or reject pending credit top-up requests." },
  { id: "passes",    label: "Passes",    Icon: Ticket,    tint: "#ffd166",
    purpose: "Mint OG Passes and manage the shared VIP pass pool." },
  { id: "codes",     label: "Codes",     Icon: KeyRound,  tint: "#a78bfa",
    purpose: "Sign-up bonus codes, promo codes, and per-user invites." },
  { id: "resellers", label: "Resellers", Icon: Handshake, tint: "#00e08a",
    purpose: "Audit reseller activity and reconcile commission." },
  { id: "share",     label: "Share",     Icon: Share2,    tint: "#ff7a1a",
    purpose: "Public share links and referral controls." },
  { id: "notes",     label: "Notes",     Icon: FileText,  tint: "#7dd3fc",
    purpose: "Boss-only scratchpad and follow-up to-do list." },
] as const;

type TabId = typeof TABS[number]["id"];

function BossMembersPage() {
  const loc = useLocation();
  const navigate = useNavigate();
  const active = useMemo<TabId>(() => {
    const h = (loc.hash || "").replace(/^#/, "");
    return (TABS.find((t) => t.id === h)?.id ?? "roster") as TabId;
  }, [loc.hash]);

  useEffect(() => {
    if (!loc.hash) {
      // Normalize URL so deep-links and rail dots match.
      void navigate({ to: "/boss/members", hash: "roster", replace: true });
    }
  }, [loc.hash, navigate]);

  return (
    <div className="space-y-5">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <p
          className="text-[10px] uppercase tracking-[0.4em] terminal-mono"
          style={{ color: "#ffd166" }}
        >
          0G · Members
        </p>
        <h1 className="syndicate-header text-2xl md:text-3xl text-white/95 mt-1">
          Members
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          People, credits, passes, and codes — every per-member control in one place.
          Tip: open the <span className="text-white/80">Roster</span> tab and click a card to
          drill into a member’s profile, socials, and quick actions.
        </p>
      </header>

      <Tabs
        value={active}
        onValueChange={(v) =>
          navigate({ to: "/boss/members", hash: v, replace: false })
        }
      >
        <TabsList className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl h-auto">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              title={t.purpose}
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 gap-1.5"
              style={{
                ["--tab-tint" as any]: t.tint,
              }}
            >
              <t.Icon className="h-3.5 w-3.5" style={{ color: t.tint }} />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="roster" className="mt-5 space-y-4">
          <TabIntro tab="roster">
            <span className="inline-flex items-center gap-1 text-white/70">
              <MousePointerClick className="h-3 w-3" /> Click any card to open the member drawer for per-user actions.
            </span>
          </TabIntro>
          <BossUsers />
        </TabsContent>

        <TabsContent value="topups" className="mt-5 space-y-4">
          <TabIntro tab="topups" />
          <TopUpRequestsPanel />
        </TabsContent>

        <TabsContent value="passes" className="mt-5 space-y-6">
          <TabIntro tab="passes" />
          <BossOgPasses />
          <section className="space-y-2">
            <h2 className="syndicate-header text-sm text-white/80 flex items-center gap-2">
              <Ticket className="h-3.5 w-3.5" style={{ color: "#ffd166" }} />
              VIP Pass Pool
            </h2>
            <p className="text-xs text-white/55">
              Shared pool of pre-minted VIP passes that auto-assign on qualifying signups.
            </p>
            <VipPassPoolAdmin />
          </section>
        </TabsContent>

        <TabsContent value="codes" className="mt-5 space-y-4">
          <TabIntro tab="codes" />
          <CodesPanel />
        </TabsContent>

        <TabsContent value="resellers" className="mt-5 space-y-4">
          <TabIntro tab="resellers">
            For reseller signups &amp; top-ups use the public{" "}
            <Link to="/reseller" className="underline text-gold">/reseller</Link> portal.
          </TabIntro>
          <BossResellerAuditPage />
        </TabsContent>

        <TabsContent value="share" className="mt-5 space-y-4">
          <TabIntro tab="share" />
          <SharePanel />
        </TabsContent>

        <TabsContent value="notes" className="mt-5 space-y-4">
          <TabIntro tab="notes" />
          <BossTodoPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabIntro({ tab, children }: { tab: TabId; children?: React.ReactNode }) {
  const meta = TABS.find((t) => t.id === tab)!;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/55"
      style={{ borderLeft: `2px solid ${meta.tint}` }}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-white/80">
        <meta.Icon className="h-3.5 w-3.5" style={{ color: meta.tint }} />
        {meta.label}
      </span>
      <span>{meta.purpose}</span>
      {children}
    </div>
  );
}

function CodesPanel() {
  return (
    <div className="glass-obsidian-cmd rounded-2xl p-5 space-y-3">
      <h2 className="syndicate-header text-base text-white/90 flex items-center gap-2">
        <KeyRound className="h-4 w-4" style={{ color: "#a78bfa" }} />
        Promo &amp; Invite Codes
      </h2>
      <p className="text-sm text-white/60">
        Mint single-use VIP or credit codes per-user from the Roster tab’s row action
        menu. Bulk minting and code analytics will land here.
      </p>
      <div className="flex gap-2">
        <Link
          to="/boss/members"
          hash="roster"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/90 hover:bg-white/10"
        >
          Open Roster
        </Link>
        <Link
          to="/boss/promotions"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/90 hover:bg-white/10"
        >
          Sign-up Bonus &amp; Promos
        </Link>
      </div>
    </div>
  );
}

function SharePanel() {
  return (
    <div className="glass-obsidian-cmd rounded-2xl p-5 space-y-3">
      <h2 className="syndicate-header text-base text-white/90 flex items-center gap-2">
        <Share2 className="h-4 w-4" style={{ color: "#ff7a1a" }} />
        Public Share &amp; Referrals
      </h2>
      <p className="text-sm text-white/60">
        Referral and share-link controls live here. Hook the existing referral
        tracking surfaces into this panel as they land.
      </p>
      <div className="flex gap-2">
        <Link
          to="/boss/promotions"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/90 hover:bg-white/10"
        >
          Promotions
        </Link>
        <Link
          to="/boss/ops"
          hash="analytics"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/90 hover:bg-white/10"
        >
          Analytics
        </Link>
      </div>
    </div>
  );
}