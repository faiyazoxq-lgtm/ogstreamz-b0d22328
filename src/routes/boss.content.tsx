import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Grid3x3, Tv, Megaphone } from "lucide-react";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/content")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Content · Boss · 0G-STREAMZ" },
      { name: "description", content: "Hubs, portals, stream queue and promotions — content surface of the syndicate." },
    ],
  }),
  component: BossContentPage,
});

const SECTIONS = [
  { id: "hubs",        label: "Hubs",         blurb: "Built-in & custom hubs.",       Icon: Boxes,    tint: "#a78bfa" },
  { id: "portals",     label: "Portals",      blurb: "Manage portals & visibility.",  Icon: Grid3x3,  tint: "#3ad6ff" },
  { id: "stream",      label: "Stream Queue", blurb: "Pending stream verifications.", Icon: Tv,       tint: "#ff5577" },
  { id: "promotions",  label: "Promotions",   blurb: "Sign-up bonuses & promos.",     Icon: Megaphone, tint: "#ffd166" },
] as const;

function BossContentPage() {
  return (
    <div className="space-y-5">
      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
          0G · Content
        </p>
        <h1 className="syndicate-header text-2xl md:text-3xl text-white/95 mt-1">
          Content Dashboard
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Future home for hubs, portals, stream queue and promotional surfaces.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((s) => (
          <div
            key={s.id}
            className="glass-obsidian-cmd rounded-2xl p-4 border border-white/5"
          >
            <div className="flex items-center gap-2">
              <s.Icon className="h-4 w-4" style={{ color: s.tint }} />
              <span className="text-sm font-semibold text-white/90">{s.label}</span>
            </div>
            <p className="mt-2 text-xs text-white/50">{s.blurb}</p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-white/30">
              Coming soon
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}