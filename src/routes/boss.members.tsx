import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Users, Inbox, Ticket, KeyRound, Handshake, Share2, FileText } from "lucide-react";
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
  { id: "roster",    label: "Roster",    Icon: Users,    tint: "#3ad6ff" },
  { id: "topups",    label: "Top-Ups",   Icon: Inbox,    tint: "#ff5577" },
  { id: "passes",    label: "Passes",    Icon: Ticket,   tint: "#ffd166" },
  { id: "codes",     label: "Codes",     Icon: KeyRound, tint: "#a78bfa" },
  { id: "resellers", label: "Resellers", Icon: Handshake, tint: "#00e08a" },
  { id: "share",     label: "Share",     Icon: Share2,   tint: "#ff7a1a" },
  { id: "notes",     label: "Notes",     Icon: FileText, tint: "#7dd3fc" },
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
          Mega Dashboard
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Every member-facing control in one place — roster, top-ups, passes, codes,
          resellers, share & notes. Replaces the legacy <code>/admin</code> hash tabs.
        </p>
      </header>

      <Tabs
        value={active}
        onValueChange={(v) =>
          navigate({ to: "/boss/members", hash: v, replace: false })
        }
      >
        <TabsList className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
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

        <TabsContent value="roster" className="mt-5">
          <BossUsers />
        </TabsContent>

        <TabsContent value="topups" className="mt-5">
          <TopUpRequestsPanel />
        </TabsContent>

        <TabsContent value="passes" className="mt-5 space-y-6">
          <BossOgPasses />
          <section className="space-y-2">
            <h2 className="syndicate-header text-sm text-white/80">VIP Pass Pool</h2>
            <VipPassPoolAdmin />
          </section>
        </TabsContent>

        <TabsContent value="codes" className="mt-5">
          <CodesPanel />
        </TabsContent>

        <TabsContent value="resellers" className="mt-5 space-y-4">
          <BossResellerAuditPage />
          <p className="text-xs text-white/55">
            For reseller signups & top-ups go to{" "}
            <Link to="/reseller" className="underline text-gold">/reseller</Link>.
          </p>
        </TabsContent>

        <TabsContent value="share" className="mt-5">
          <SharePanel />
        </TabsContent>

        <TabsContent value="notes" className="mt-5">
          <BossTodoPage />
        </TabsContent>
      </Tabs>
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
        Mint single-use VIP / credit codes per-user from the Roster tab (row action
        menu). Bulk minting and code analytics will land here.
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
        Referral / share-link controls live here. Hook the existing referral
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
          to="/boss/analytics"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/90 hover:bg-white/10"
        >
          Analytics
        </Link>
      </div>
    </div>
  );
}