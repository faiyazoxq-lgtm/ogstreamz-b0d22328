import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Portal = {
  id: string;
  slug: string;
  name: string;
  niche: string;
  language: string;
  vibe: string | null;
  theme: string;
  jokes: string[];
};

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("portals")
      .select("id, slug, name, niche, language, vibe, theme, jokes")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound();
    return { portal: data as Portal };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.portal
      ? [
          { title: `${loaderData.portal.name} · 0G-PORTAL` },
          { name: "description", content: loaderData.portal.niche.slice(0, 160) },
        ]
      : [],
  }),
  component: PortalPage,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">Portal failed to load</h1>
        <p className="text-muted-foreground text-sm">{error.message}</p>
      </div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-3xl font-bold">Portal not found</h1>
        <Link to="/" className="text-sm underline mt-3 inline-block">Back to 0G-PORTAL</Link>
      </div>
    </main>
  ),
});

const THEMES: Record<string, { bg: string; accent: string; font: string; ornament: string; cardBg: string; text: string; label: string }> = {
  street: {
    bg: "linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)",
    accent: "#ff3b3b",
    font: "'Bebas Neue', 'Impact', sans-serif",
    ornament: "🚧",
    cardBg: "rgba(255,59,59,0.08)",
    text: "#fff",
    label: "STREET CODE",
  },
  "ancient-china": {
    bg: "linear-gradient(180deg, #2a0a0a 0%, #4a1a0a 100%)",
    accent: "#d4af37",
    font: "'Noto Serif SC', 'Songti SC', serif",
    ornament: "龍",
    cardBg: "rgba(212,175,55,0.08)",
    text: "#fdf6e3",
    label: "古卷",
  },
  cyber: {
    bg: "linear-gradient(180deg, #050018 0%, #1a0033 100%)",
    accent: "#00ffea",
    font: "'Orbitron', 'Rajdhani', sans-serif",
    ornament: "◆",
    cardBg: "rgba(0,255,234,0.08)",
    text: "#e0f7ff",
    label: "// NODE",
  },
  desert: {
    bg: "linear-gradient(180deg, #2a1a05 0%, #5a3a15 100%)",
    accent: "#e8c468",
    font: "'Amiri', 'Scheherazade New', serif",
    ornament: "☾",
    cardBg: "rgba(232,196,104,0.08)",
    text: "#fff5dd",
    label: "حكاية",
  },
  norse: {
    bg: "linear-gradient(180deg, #0a1014 0%, #1a2530 100%)",
    accent: "#a8c8e0",
    font: "'Cinzel', 'IM Fell English', serif",
    ornament: "ᚱ",
    cardBg: "rgba(168,200,224,0.08)",
    text: "#e8f0f8",
    label: "SAGA",
  },
  jungle: {
    bg: "linear-gradient(180deg, #0a2010 0%, #1a4525 100%)",
    accent: "#ffd54f",
    font: "'Fredoka', 'Quicksand', sans-serif",
    ornament: "🌿",
    cardBg: "rgba(255,213,79,0.08)",
    text: "#f0fff0",
    label: "TRIBE",
  },
};

function PortalPage() {
  const { portal } = Route.useLoaderData();
  const theme = THEMES[portal.theme] ?? THEMES.street;
  const [idx, setIdx] = useState(0);
  const jokes = portal.jokes?.length ? portal.jokes : ["No jokes loaded yet."];

  const next = () => setIdx((i) => (i + 1) % jokes.length);

  return (
    <div style={{ background: theme.bg, color: theme.text, minHeight: "100vh" }} className="flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-16">
        <Link to="/" className="absolute top-24 left-5 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.3em] opacity-60 hover:opacity-100">
          <ArrowLeft className="h-3.5 w-3.5" /> 0G
        </Link>

        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.5em] opacity-70" style={{ color: theme.accent }}>
            {theme.label} · {portal.language}
          </p>
          <h1
            className="mt-3 text-4xl sm:text-6xl font-black leading-tight"
            style={{ fontFamily: theme.font, color: theme.text, textShadow: `0 0 40px ${theme.accent}66` }}
          >
            <span className="mr-3" style={{ color: theme.accent }}>{theme.ornament}</span>
            {portal.name}
            <span className="ml-3" style={{ color: theme.accent }}>{theme.ornament}</span>
          </h1>
          <p className="mt-3 text-sm opacity-70 max-w-xl mx-auto">{portal.niche}</p>
        </div>

        <div
          className="w-full max-w-2xl rounded-2xl p-8 sm:p-12 border min-h-[220px] flex items-center justify-center"
          style={{
            background: theme.cardBg,
            borderColor: `${theme.accent}55`,
            boxShadow: `0 0 60px ${theme.accent}22, inset 0 0 40px ${theme.accent}11`,
          }}
        >
          <p
            key={idx}
            className="text-xl sm:text-2xl text-center leading-relaxed animate-in fade-in duration-500"
            style={{ fontFamily: theme.font }}
          >
            {jokes[idx]}
          </p>
        </div>

        <Button
          onClick={next}
          className="mt-8 h-12 px-8 text-sm uppercase tracking-[0.3em] font-bold border-2"
          style={{
            background: theme.accent,
            color: theme.bg.includes("0a0a0a") || theme.bg.includes("050018") || theme.bg.includes("0a1014") ? "#000" : "#000",
            borderColor: theme.accent,
            boxShadow: `0 0 30px ${theme.accent}88`,
          }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Next Joke ({idx + 1}/{jokes.length})
        </Button>
      </div>

      <footer className="border-t py-6 text-center text-xs uppercase tracking-[0.4em] opacity-60" style={{ borderColor: `${theme.accent}33` }}>
        <Link to="/" className="hover:opacity-100">
          <span style={{ color: theme.accent }}>▣</span> Powered by 0G-PORTAL
        </Link>
      </footer>
    </div>
  );
}