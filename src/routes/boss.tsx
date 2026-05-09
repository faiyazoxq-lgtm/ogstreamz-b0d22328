import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Crown, Users, Coins, Ticket, KeyRound, Handshake, Inbox, FileText, ArrowUpRight, Share2, ShieldCheck, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/boss")({
  head: () => ({
    meta: [
      { title: "Boss Portal · 0G-STREAMZ" },
      { name: "description", content: "People, credits, passes, codes, resellers, top-ups — the human side of the syndicate." },
    ],
  }),
  component: BossPortal,
});

type Tile = {
  to: string;
  hash?: string;
  label: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
};

const TILES: Tile[] = [
  { to: "/admin", hash: "roster",    label: "User Roster",      blurb: "View members · adjust credits · change rank/status", Icon: Users,    tint: "#3ad6ff" },
  { to: "/admin", hash: "topups",    label: "Top-Up Requests",  blurb: "Approve or deny credit top-ups",                     Icon: Inbox,    tint: "#ff5577" },
  { to: "/admin", hash: "roster",    label: "Adjust Credits",   blurb: "Boss-grant credits by email or user-id",             Icon: Coins,    tint: "#ffd166" },
  { to: "/admin", hash: "passes",    label: "VIP Passes",       blurb: "Mint, grant, revoke, share signup passes",           Icon: Ticket,   tint: "#a78bfa" },
  { to: "/admin", hash: "codes",     label: "Redeem Codes",     blurb: "Create, list, expire promo codes",                   Icon: KeyRound, tint: "#00e08a" },
  { to: "/admin", hash: "resellers", label: "Resellers",        blurb: "Reseller wallets, mark-up, downline",                Icon: Handshake,tint: "#ff7a1a" },
  { to: "/admin", hash: "share",     label: "Share Cards",      blurb: "Generate share-link cards for passes",               Icon: Share2,   tint: "#ff5acd" },
  { to: "/admin", hash: "notes",     label: "Boss Notes",       blurb: "Private operational notes",                          Icon: FileText, tint: "#94a3b8" },
  { to: "/boss/civility",            label: "Civility Controls",blurb: "Toggle Guttermouth swear-chat · keep things civil", Icon: ShieldCheck, tint: "#3ad6ff" },
  { to: "/boss/analytics",           label: "View Analytics",   blurb: "Anonymous public-view counts for every portal & battle", Icon: BarChart3, tint: "#00e08a" },
];

function BossPortal() {
  const { user, isAdmin, profile, loading } = useAuth();
  const navigate = useNavigate();
  const isBoss = profile?.rank === "boss" || isAdmin;

  useEffect(() => {
    if (loading) return;
    if (!user || !isBoss) navigate({ to: "/" });
  }, [user, isBoss, loading, navigate]);

  if (loading || !isBoss) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-6 pb-28 md:pb-12 space-y-6">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <div className="flex items-center gap-3">
          <Crown className="h-6 w-6" style={{ color: "#ffd166" }} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
              0G · Boss Portal
            </p>
            <h1 className="syndicate-header text-2xl md:text-3xl text-white/95">People, Credits & Access</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/65 max-w-2xl">
          Everything to do with managing humans in the syndicate — members, credits, passes, codes, resellers, top-ups.
          Need AI agents, hub controls, or model tuning? Open the <Link to="/console" className="underline" style={{ color: "var(--syndicate-glow)" }}>0G-Console</Link>.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => (
          <Link
            key={t.label + t.hash}
            to={t.to}
            hash={t.hash}
            className="group glass-obsidian-cmd rounded-2xl p-5 transition-all hover:-translate-y-0.5"
            style={{ borderColor: `${t.tint}66` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ background: `${t.tint}1f`, border: `1px solid ${t.tint}55` }}
              >
                <t.Icon className="h-5 w-5" style={{ color: t.tint }} />
              </div>
              <ArrowUpRight
                className="h-4 w-4 opacity-50 group-hover:opacity-100 transition"
                style={{ color: t.tint }}
              />
            </div>
            <h2 className="mt-4 syndicate-header text-base text-white/95">{t.label}</h2>
            <p className="mt-1 text-xs text-white/60 leading-relaxed">{t.blurb}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
