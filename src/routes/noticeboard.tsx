import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Crown, Sparkles, Lock, Check, X, Calendar, Flame, KeyRound, Send,
  Download, Zap, Radio, Star, ShieldCheck, Music, ArrowRight, Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/noticeboard")({
  head: () => ({
    meta: [
      { title: "VIP Noticeboard · 0G-Syndicate" },
      { name: "description", content: "Latest perks, active VIP benefits, and what free users are missing — the official 0G VIP noticeboard." },
      { property: "og:title", content: "VIP Noticeboard — Real OG Perks" },
      { property: "og:description", content: "See every active VIP perk, latest drops, and the free vs VIP gap at a glance." },
    ],
  }),
  component: NoticeboardPage,
});

type Perk = {
  id: string;
  title: string;
  body: string;
  Icon: any;
  added: string; // YYYY-MM-DD
  free: boolean | string;
  vip: boolean | string;
  category: "drop" | "tool" | "vault" | "status";
};

const PERKS: Perk[] = [
  { id: "vault-keys", title: "0G-Vault Rotating Keys", body: "Fresh credentials every 15 minutes — yours on tap.", Icon: KeyRound, added: "2026-05-08", free: false, vip: true, category: "vault" },
  { id: "tg-drops", title: "VIP Telegram Broadcast", body: "Private channel for leaks, drops and exclusives.", Icon: Send, added: "2026-05-05", free: false, vip: true, category: "drop" },
  { id: "hq-music", title: "Full HQ Music Downloads", body: "Every track from every portal — uncapped.", Icon: Download, added: "2026-04-30", free: "1 credit / track", vip: "Unlimited", category: "drop" },
  { id: "trade-scans", title: "Unlimited Trade Scans", body: "Power-Pack execution and AI tools without daily caps.", Icon: Zap, added: "2026-04-22", free: "3 / day", vip: "Unlimited", category: "tool" },
  { id: "early-portals", title: "Early-Access Portals", body: "New portals open for VIPs first — usually weeks ahead.", Icon: Sparkles, added: "2026-04-18", free: false, vip: true, category: "status" },
  { id: "real-og-badge", title: "Real 0G Profile Badge", body: "Permanent flair across the syndicate.", Icon: Crown, added: "2026-04-10", free: false, vip: true, category: "status" },
  { id: "live-wire", title: "Live-Wire Joke Drops", body: "Boss-only humour streams — VIPs get the unfiltered cut.", Icon: Flame, added: "2026-03-28", free: "Clean cut only", vip: "Full feed", category: "drop" },
  { id: "ogstreamz", title: "OGSTREAMZ Profile Linking", body: "Link your stream credentials and route them through the vault.", Icon: Radio, added: "2026-03-15", free: false, vip: true, category: "vault" },
  { id: "music-hub", title: "Music Hub Priority", body: "Skip the queue, hear unreleased tracks first.", Icon: Music, added: "2026-03-02", free: "Standard queue", vip: "Priority", category: "drop" },
];

const CAT_LABEL: Record<Perk["category"], string> = {
  drop: "Drops", tool: "Tools", vault: "Vault", status: "Status",
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

function NoticeboardPage() {
  const { user, profile, isAdmin } = useAuth();
  const isVip = isVipProfile(profile, { isAdmin });

  const sorted = [...PERKS].sort((a, b) => b.added.localeCompare(a.added));
  const latest = sorted.slice(0, 3);

  return (
    <main className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] font-bold text-amber-200">
              <Crown className="h-3 w-3" /> VIP Noticeboard
            </div>
            <h1 className="mt-3 font-[Montserrat] font-black text-3xl sm:text-5xl tracking-tight text-white">
              Perks board for the <span className="bg-gradient-to-r from-amber-300 to-cyan-300 bg-clip-text text-transparent">Real OGs</span>
            </h1>
            <p className="mt-2 text-sm sm:text-base text-cyan-100/70 max-w-2xl">
              Every active perk, the freshest drops and exactly what free tier is missing — all in one place.
            </p>
          </div>
          {isVip ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.25em] font-bold text-emerald-200">
              <ShieldCheck className="h-4 w-4" /> VIP active — all perks unlocked
            </div>
          ) : (
            <Link
              to="/vip"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-cyan-400 hover:opacity-90 text-black font-black uppercase tracking-[0.25em] px-4 py-3 text-[11px] shadow-[0_0_40px_-8px_rgba(255,200,80,0.6)]"
            >
              <Crown className="h-4 w-4" /> Unlock VIP
            </Link>
          )}
        </div>

        {/* Latest perks */}
        <section aria-labelledby="latest-heading" className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <h2 id="latest-heading" className="text-[11px] uppercase tracking-[0.3em] font-bold text-amber-200">Latest drops</h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((p) => (
              <li key={p.id} className="relative overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-500/10 via-cyan-500/5 to-transparent p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-amber-400/15 border border-amber-300/40 text-amber-200">
                    <p.Icon className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-cyan-100/60">
                    <Calendar className="h-3 w-3" /> {fmtDate(p.added)}
                  </span>
                </div>
                <h3 className="mt-3 font-bold text-white">{p.title}</h3>
                <p className="mt-1 text-sm text-cyan-100/70">{p.body}</p>
                <div className="mt-3">
                  {isVip ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-400/40 px-2 py-1 text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-200">
                      <Check className="h-3 w-3" /> Active for you
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 border border-rose-400/30 px-2 py-1 text-[10px] uppercase tracking-[0.25em] font-bold text-rose-200">
                      <Lock className="h-3 w-3" /> VIP only
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Comparison board */}
        <section aria-labelledby="board-heading" className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-4 w-4 text-cyan-300" />
            <h2 id="board-heading" className="text-[11px] uppercase tracking-[0.3em] font-bold text-cyan-200">
              Active perks · Free vs VIP
            </h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.3em] text-white/60 font-bold">
              <div className="col-span-6">Perk</div>
              <div className="col-span-3 text-center">Free</div>
              <div className="col-span-3 text-center text-amber-200">VIP {isVip && "· you"}</div>
            </div>
            <ul>
              {sorted.map((p) => (
                <li
                  key={p.id}
                  className={`grid grid-cols-1 sm:grid-cols-12 gap-2 px-4 py-4 border-b border-white/5 last:border-b-0 ${
                    isVip ? "" : ""
                  }`}
                >
                  <div className="sm:col-span-6 flex items-start gap-3">
                    <div className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-lg bg-white/5 border border-white/10 text-cyan-200">
                      <p.Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-white text-sm">{p.title}</h3>
                        <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">{CAT_LABEL[p.category]}</span>
                      </div>
                      <p className="text-xs text-white/60 mt-0.5">{p.body}</p>
                      <p className="text-[10px] text-white/40 mt-1 inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Added {fmtDate(p.added)}
                      </p>
                    </div>
                  </div>
                  <div className="sm:col-span-3 flex sm:justify-center items-center text-sm">
                    <span className="sm:hidden text-[10px] uppercase tracking-[0.25em] text-white/40 mr-2">Free:</span>
                    <Cell value={p.free} tone="muted" />
                  </div>
                  <div className="sm:col-span-3 flex sm:justify-center items-center text-sm">
                    <span className="sm:hidden text-[10px] uppercase tracking-[0.25em] text-amber-200/70 mr-2">VIP:</span>
                    <Cell value={p.vip} tone={isVip ? "active" : "vip"} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Footer CTA */}
        {!isVip && (
          <section className="mt-12 rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-500/15 via-cyan-500/10 to-transparent p-6 sm:p-8 text-center">
            <Star className="h-8 w-8 text-amber-300 mx-auto" />
            <h2 className="mt-3 font-[Montserrat] font-black text-2xl sm:text-3xl text-white">
              You're missing {sorted.filter((p) => p.free === false).length} VIP-only perks
            </h2>
            <p className="mt-2 text-sm text-cyan-100/70 max-w-xl mx-auto">
              One pass. Every portal. Every drop. The Real OG status doesn't sit and wait — it ships.
            </p>
            <Link
              to="/vip"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-cyan-400 hover:opacity-90 text-black font-black uppercase tracking-[0.25em] px-5 py-3 text-xs"
            >
              <Crown className="h-4 w-4" /> Become a Real OG <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        {isVip && (
          <p className="mt-10 text-center text-xs text-white/40">
            New perks land here first. Bookmark this page — we ship often.
          </p>
        )}
      </div>
    </main>
  );
}

function Cell({ value, tone }: { value: boolean | string; tone: "muted" | "vip" | "active" }) {
  if (value === true) {
    const cls =
      tone === "active"
        ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
        : tone === "vip"
        ? "bg-amber-500/15 border-amber-400/40 text-amber-200"
        : "bg-white/5 border-white/15 text-white/70";
    return (
      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.25em] font-bold ${cls}`}>
        <Check className="h-3 w-3" /> {tone === "active" ? "Active" : "Yes"}
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] uppercase tracking-[0.25em] font-bold text-white/40">
        <X className="h-3 w-3" /> No
      </span>
    );
  }
  const cls =
    tone === "active" ? "text-emerald-200" : tone === "vip" ? "text-amber-200" : "text-white/60";
  return <span className={`text-xs font-semibold ${cls}`}>{value}</span>;
}