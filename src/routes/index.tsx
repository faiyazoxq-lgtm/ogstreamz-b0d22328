import { createFileRoute, Link } from "@tanstack/react-router";
import { SyndicateGallery } from "@/components/SyndicateGallery";
import {
  Music2, Smile, Wrench, ArrowUpRight, TrendingUp, Rocket, Swords,
  Sparkles, Radio, Bot, Brain, Zap, Star, Megaphone, Disc3, Satellite, Radar,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg";
import { TiltCard } from "@/components/TiltCard";

const ICONS: Record<string, any> = {
  Music2, Smile, Wrench, TrendingUp, Rocket, Sparkles, Radio, Bot, Brain,
  Zap, Star, Megaphone, Disc3, Satellite, Radar,
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "0G-PORTAL — The Hub" },
      { name: "description", content: "Enter the 0G-PORTAL universe: MusicHUB, JokesHUB, and ToolHUB." },
    ],
  }),
  component: Index,
});

const portals = [
  { to: "/music" as const,   title: "MusicHUB",   desc: "Stream. Own. Repeat.",          Icon: Music2 },
  { to: "/jokes" as const,   title: "JokesHUB",   desc: "Fast wit. Zero filler.",        Icon: Smile },
  { to: "/trade" as const,   title: "TradeHUB",   desc: "Live signals. Bias meters.",    Icon: TrendingUp },
  { to: "/connect" as const, title: "ConnectHUB", desc: "Scout. Enrich. Outreach.",      Icon: Rocket },
  { to: "/battle" as const,  title: "BattleHUB",  desc: "Every choice is a loss.",       Icon: Swords },
  { to: "/tools" as const,   title: "ToolHUB",    desc: "Sharp utilities, fast.",        Icon: Wrench },
];

function Index() {
  const [customHubs, setCustomHubs] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("custom_hubs")
      .select("id,title,tagline,href,icon,accent,sort_order,published")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setCustomHubs(data ?? []));
  }, []);

  return (
    <main className="relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-[radial-gradient(closest-side,oklch(0.72_0.22_245_/_0.28),transparent)]" />
        <div className="absolute top-1/2 left-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(closest-side,oklch(0.55_0.24_255_/_0.15),transparent)]" />
      </div>

      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-16 text-center">
        <div className="relative mx-auto mb-8 w-full max-w-2xl">
          <div className="absolute inset-0 blur-3xl bg-[radial-gradient(closest-side,oklch(0.72_0.22_245_/_0.45),transparent)]" />
          <img
            src={logo}
            alt="0G-PORTAL mascot"
            className="relative w-full h-auto rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] shadow-[0_0_80px_-10px_oklch(0.72_0.22_245/0.6)]"
          />
        </div>
        <p className="text-xs sm:text-sm tracking-[0.4em] uppercase font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          Street · Static · Stream
        </p>
        <h1 className="mt-6 font-[Montserrat] font-black text-5xl sm:text-7xl md:text-8xl tracking-tight leading-[0.95]">
          <span className="text-metallic animate-glitch">0G-PORTAL</span>
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-muted-foreground text-base sm:text-lg">
          One frequency. Five portals. Pick your channel.
        </p>
      </section>

      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-28 grid gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {portals.map(({ to, title, desc, Icon }) => (
          <TiltCard
            key={to}
            className="group relative overflow-hidden rounded-2xl"
          >
          <Link
            to={to}
            className="block relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-10 transition-all duration-500 hover:-translate-y-1 animate-pulse-gold hover:shadow-[0_0_80px_-10px_oklch(0.72_0.22_245_/_0.8)] hover:border-[oklch(0.72_0.22_245/0.7)]"
            style={{ transform: "translateZ(40px)" }}
          >
            <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: "radial-gradient(500px circle at 50% 0%, oklch(0.72 0.22 245 / 0.28), transparent 60%)" }}
            />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center transition-colors group-hover:shadow-[0_0_25px_oklch(0.72_0.22_245/0.7)]">
                <Icon className="h-6 w-6 neon-icon" />
              </div>
              <ArrowUpRight className="h-5 w-5 neon-icon" />
            </div>
            <h2 className="mt-10 font-[Montserrat] font-black text-3xl sm:text-4xl tracking-tight text-metallic">
              {title}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">{desc}</p>
            <div className="mt-8 btn-glass-blue btn-magnetic inline-flex items-center gap-2 px-5 py-3 rounded-lg text-xs uppercase tracking-[0.25em] font-bold text-white">
              Open Portal
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>
          </TiltCard>
        ))}
        {customHubs.map((h) => {
          const Icon = ICONS[h.icon] ?? Sparkles;
          const accent = h.accent || "#3ad6ff";
          const isExternal = /^https?:\/\//i.test(h.href);
          const cardCls = "group relative overflow-hidden rounded-2xl border bg-card p-8 sm:p-10 transition-all duration-500 hover:-translate-y-1";
          const inner = (
            <>
              <div
                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(500px circle at 50% 0%, ${accent}44, transparent 60%)` }}
              />
              <div className="flex items-center justify-between">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${accent}1f`, color: accent }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="mt-10 font-[Montserrat] font-black text-3xl sm:text-4xl tracking-tight text-metallic">
                {h.title}
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground">{h.tagline}</p>
              <div className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-lg text-xs uppercase tracking-[0.25em] font-bold text-white"
                style={{ background: `${accent}26`, border: `1px solid ${accent}66` }}>
                Open Hub
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </>
          );
          return isExternal ? (
            <a key={h.id} href={h.href} target="_blank" rel="noreferrer"
              className={cardCls} style={{ borderColor: `${accent}55` }}>
              {inner}
            </a>
          ) : (
            <Link key={h.id} to={h.href as any} className={cardCls} style={{ borderColor: `${accent}55` }}>
              {inner}
            </Link>
          );
        })}
      </section>

      <SyndicateGallery />
    </main>
  );
}
