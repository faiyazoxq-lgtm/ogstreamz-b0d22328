import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Wand2, Sparkles, ExternalLink, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { spawnPortal } from "@/lib/portals.functions";
import { useAuth } from "@/hooks/use-auth";

type Kind = "jokes" | "music" | "trade" | "connect" | "tools";

type Copy = { title: string; subtitle: string; namePh: string; nichePh: string; vibePh: string; viewPath: (slug: string) => string };
const COPY: Record<Kind, Copy> = {
  jokes:   { title: "Spawn a Jokes Portal",   subtitle: "5 fresh AI jokes + custom theme",      namePh: "Chinese Smelly Jokes",  nichePh: "Traditional Chinese style, smelly humor",      vibePh: "Ancient Chinese architecture",   viewPath: (s: string) => `/p/${s}` },
  music:   { title: "Spawn a Music Portal",   subtitle: "Themed landing page for your sound",   namePh: "Late Night Drill",      nichePh: "UK drill, melodic, late-night driving energy", vibePh: "Foggy neon underpass",           viewPath: (s: string) => `/m/${s}` },
  trade:   { title: "Spawn a Trade Portal",   subtitle: "Themed scout for an asset / sector",   namePh: "Gold Bull Watch",       nichePh: "Spot gold momentum + central-bank flow",       vibePh: "Vault chrome, ticker glow",      viewPath: (s: string) => `/p/${s}` },
  connect: { title: "Spawn a Connect Portal", subtitle: "Themed outbound landing for an offer", namePh: "B2B SaaS CMO Outreach", nichePh: "ICP: Series-B SaaS marketing leaders, EU",     vibePh: "Editorial, slate, gold accents", viewPath: (s: string) => `/p/${s}` },
  tools:   { title: "Spawn a Tools Portal",   subtitle: "Themed wrapper for a calculator/tool", namePh: "Position Sizer Pro",    nichePh: "Risk-aware position sizing for FX traders",    vibePh: "Cockpit dashboard, amber HUD",   viewPath: (s: string) => `/p/${s}` },
};

export function SpawnPortalCard({ kind }: { kind: Kind }) {
  const { user, profile, refresh } = useAuth();
  const spawn = useServerFn(spawnPortal);
  const copy = COPY[kind];

  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [vibe, setVibe] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ slug: string; name: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const credits = profile?.credits ?? 0;
  const hasCredits = credits >= 1;

  const requestSpawn = () => {
    if (!user) { toast.error("Sign in to spawn a portal"); return; }
    if (!name.trim() || !niche.trim()) { toast.error("Name and niche required"); return; }
    if (!hasCredits) { toast.error("Not enough credits — top up to spawn"); return; }
    setConfirmOpen(true);
  };

  const run = async () => {
    setConfirmOpen(false);
    setLoading(true);
    setCreated(null);
    try {
      const r = await spawn({ data: { name: name.trim(), niche: niche.trim(), vibe: vibe.trim(), language, kind, useScout: true } });
      setCreated({ slug: r.portal.slug, name: r.portal.name });
      toast.success(`Spawned "${r.portal.name}" — 1 credit spent`);
      setName(""); setNiche(""); setVibe("");
      // Refresh wallet so the new credit balance shows everywhere immediately
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-1 flex-wrap">
        <Sparkles className="h-5 w-5 text-[oklch(0.72_0.22_245)]" />
        <h2 className="font-[Montserrat] font-black text-xl text-foreground">{copy.title}</h2>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border border-border rounded-full px-2 py-1">
          <Coins className="h-3 w-3" /> 1 credit
        </span>
      </header>
      <p className="text-xs text-muted-foreground mb-4">{copy.subtitle}. Public on the home grid.</p>

      {!user ? (
        <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
          <Link to="/auth" className="underline text-foreground">Sign in</Link> to spawn portals with credits.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.namePh} className="mt-1 h-11 bg-background" disabled={loading} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Language</label>
              <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="English" className="mt-1 h-11 bg-background" disabled={loading} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Niche / Theme</label>
              <textarea
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder={copy.nichePh}
                rows={2}
                disabled={loading}
                className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-y disabled:opacity-50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Mood / Visual Vibe</label>
              <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder={copy.vibePh} className="mt-1 h-11 bg-background" disabled={loading} />
            </div>
          </div>
          <Button
            onClick={requestSpawn}
            disabled={loading}
            className="mt-5 h-12 px-8 text-xs uppercase tracking-[0.25em] font-bold w-full sm:w-auto min-h-[48px]"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Spawning…</>
              : <><Wand2 className="h-4 w-4 mr-2" />Generate Portal · 1 credit</>}
          </Button>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Balance: <span className={hasCredits ? "text-foreground" : "text-destructive"}>{credits} credit{credits === 1 ? "" : "s"}</span>
            {!hasCredits && (
              <> · <Link to="/store" className="underline text-foreground">Top up</Link></>
            )}
          </p>

          {created && (
            <div className="mt-6 p-4 rounded-xl border border-border bg-background/60 flex items-center gap-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Live</span>
              <code className="text-sm text-foreground font-mono">{copy.viewPath(created.slug)}</code>
              <a
                href={copy.viewPath(created.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs underline text-foreground"
              >
                Open <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[oklch(0.72_0.22_245)]" />
              Generate this portal?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  We&apos;ll spawn{" "}
                  <span className="font-semibold text-foreground">&ldquo;{name || "Untitled"}&rdquo;</span>{" "}
                  and publish it to the home grid.
                </p>
                <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em]">
                    <Coins className="h-3.5 w-3.5 text-gold" /> Cost
                  </span>
                  <span className="font-mono text-sm font-bold">1 credit</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Balance after</span>
                  <span className="font-mono">
                    {credits} → {Math.max(0, credits - 1)} credits
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void run(); }}
              disabled={loading}
              className="min-w-[160px]"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Spawning…</>
                : <><Wand2 className="h-4 w-4 mr-2" />Confirm · spend 1</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}