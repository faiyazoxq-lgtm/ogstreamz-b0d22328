import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles, Shuffle, Power, Skull, SprayCan, Crown, Drama, Flame, Radio } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { VaultLockedDialog } from "@/components/VaultLockedDialog";

export type StylePreset = { id: string; label: string; Icon: typeof Skull };

export const STYLE_PRESETS: StylePreset[] = [
  { id: "street", label: "Street Wit", Icon: SprayCan },
  { id: "dark", label: "Dark Humor", Icon: Skull },
  { id: "sarcastic", label: "Sarcastic", Icon: Drama },
  { id: "legendary", label: "Legendary", Icon: Crown },
  { id: "gritty", label: "Gritty", Icon: Flame },
];

export const Route = createFileRoute("/jokes")({
  head: () => ({
    meta: [
      { title: "JokesHUB — Style Mixer · 0G-STREAMZ" },
      { name: "description", content: "Pick your joke styles, mix and launch a personalized punchline portal." },
    ],
  }),
  component: JokesSetup,
});

function JokesSetup() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [selected, setSelected] = useState<string[]>(["street"]);
  const [custom, setCustom] = useState("");
  const [locked, setLocked] = useState(false);
  const [liveWire, setLiveWire] = useState(false);
  const isVip = profile?.status === "vip" || isAdmin;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const surprise = () => {
    const ids = STYLE_PRESETS.map((s) => s.id);
    const count = 1 + Math.floor(Math.random() * 3);
    const shuffled = [...ids].sort(() => Math.random() - 0.5).slice(0, count);
    setSelected(shuffled);
  };

  const canLaunch = selected.length > 0 || custom.trim().length > 0;

  const launch = () => {
    if (!canLaunch) return;
    if (!user) {
      setLocked(true);
      return;
    }
    if (liveWire && !isVip) {
      setLocked(true);
      return;
    }
    navigate({
      to: "/jokes/portal",
      search: { styles: selected.join(","), custom: custom.trim(), live: liveWire ? 1 : 0 },
    });
  };

  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <header className="text-center mb-12">
        <p className="text-xs tracking-[0.4em] uppercase font-semibold mb-3" style={{ color: "var(--neon-blue-bright)" }}>
          JokesHUB · Style Mixer
        </p>
        <h1 className="font-[Montserrat] font-black text-4xl sm:text-6xl tracking-tight text-metallic">
          Build Your Mix
        </h1>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Tag the joke styles you want. Add your own flavor. Then launch the portal.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-10 space-y-10">
        {/* Style tags */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Joke Styles
            </h2>
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {STYLE_PRESETS.map(({ id, label, Icon }) => {
              const active = selected.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={
                    "inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wider border transition-all " +
                    (active
                      ? "btn-glass-blue text-white border-transparent"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-[oklch(0.72_0.22_245/0.5)]")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom input */}
        <div>
          <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold mb-4">
            Custom Style Keywords
          </h2>
          <div className="relative">
            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--neon-blue-bright)" }} />
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Mix in your own style keywords..."
              className="pl-11 h-12 bg-background border-border text-base"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Try: "deadpan", "wholesome", "tech bro", "90s hip-hop"...
          </p>
        </div>

        {/* Randomizer */}
        <div>
          <Button
            type="button"
            onClick={surprise}
            variant="outline"
            className="w-full h-12 border-[oklch(0.72_0.22_245/0.4)] text-foreground hover:bg-[oklch(0.72_0.22_245/0.1)] uppercase tracking-wider font-bold"
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Surprise Me
          </Button>
        </div>

        {/* Live Wire VIP toggle */}
        <div>
          <button
            type="button"
            onClick={() => setLiveWire((v) => !v)}
            className={
              "w-full flex items-center justify-between gap-3 px-5 py-4 rounded-xl border transition-all " +
              (liveWire
                ? "border-[oklch(0.72_0.22_245/0.7)] bg-[oklch(0.72_0.22_245/0.12)] shadow-[0_0_30px_-5px_oklch(0.72_0.22_245/0.6)]"
                : "border-border bg-secondary/40 hover:border-[oklch(0.72_0.22_245/0.5)]")
            }
          >
            <div className="flex items-center gap-3 text-left">
              <span
                className={
                  "relative h-3 w-3 rounded-full " +
                  (liveWire ? "bg-[var(--neon-blue-bright)] animate-pulse" : "bg-muted-foreground/40")
                }
              >
                {liveWire && (
                  <span className="absolute inset-0 rounded-full bg-[var(--neon-blue-bright)] blur-[6px] opacity-80" />
                )}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4" style={{ color: "var(--neon-blue-bright)" }} />
                  <span className="text-sm font-bold uppercase tracking-[0.25em] text-white">Live Wire</span>
                  <span className="text-[9px] font-black uppercase tracking-[0.25em] px-2 py-0.5 rounded-full border border-[oklch(0.72_0.22_245/0.5)] text-[var(--neon-blue-bright)]">
                    VIP
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pull today's most viral news. Roast it 0G-style.
                </p>
              </div>
            </div>
            <span
              className={
                "text-[10px] font-bold uppercase tracking-[0.3em] " +
                (liveWire ? "text-[var(--neon-blue-bright)]" : "text-muted-foreground")
              }
            >
              {liveWire ? "ON" : "OFF"}
            </span>
          </button>
        </div>
      </section>

      {/* Activate portal */}
      <div className="relative mt-12 flex flex-col items-center">
        <div
          aria-hidden
          className={
            "pointer-events-none absolute inset-0 flex items-center justify-center " +
            (canLaunch ? "opacity-100" : "opacity-0")
          }
        >
          <div className="h-40 w-[28rem] max-w-full rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.72_0.22_245_/_0.7),transparent)] animate-pulse-gold" />
        </div>
        <button
          type="button"
          onClick={launch}
          disabled={!canLaunch}
          className="relative btn-glass-blue rounded-2xl px-14 sm:px-24 py-7 sm:py-8 text-white font-black text-base sm:text-2xl tracking-[0.35em] uppercase disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-4 shadow-[0_0_60px_-5px_oklch(0.72_0.22_245/0.85),0_0_120px_-10px_oklch(0.72_0.22_245/0.6),inset_0_1px_0_oklch(1_0_0/0.15)] hover:shadow-[0_0_90px_-5px_oklch(0.72_0.22_245/1),0_0_180px_-10px_oklch(0.72_0.22_245/0.8),inset_0_1px_0_oklch(1_0_0/0.2)] transition-shadow"
        >
          <Power className="h-7 w-7" />
          Activate Portal
        </button>
        <p className="mt-4 text-xs text-muted-foreground uppercase tracking-[0.3em]">
          {canLaunch ? "Ready · Frequency locked" : "Pick at least one style"}
        </p>
      </div>
      <VaultLockedDialog
        open={locked}
        onOpenChange={setLocked}
        itemName={liveWire ? "Live Wire (VIP)" : "Portal Activation"}
        isAuthenticated={!!user}
      />
    </main>
  );
}