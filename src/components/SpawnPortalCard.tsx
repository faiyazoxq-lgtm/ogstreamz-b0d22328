import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Wand2, Sparkles, ExternalLink, Coins, Check, AlertTriangle, RotateCcw, Lock, UserPlus, LogIn, Gift, Languages, Tag, Palette, Zap } from "lucide-react";
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
import { describePortal } from "@/lib/portal-describe.functions";
import { useAuth } from "@/hooks/use-auth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const describe = useServerFn(describePortal);
  const copy = COPY[kind];

  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [vibe, setVibe] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ slug: string; name: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [describing, setDescribing] = useState(false);
  // Stage progress: 0=idle, 1=queued, 2=generating, 3=publishing, 4=done
  const [stage, setStage] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const stageTimers = useRef<number[]>([]);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const retryBtnRef = useRef<HTMLButtonElement | null>(null);

  // Move keyboard focus to the error panel when a new error appears so
  // screen-reader and keyboard users land on the message immediately.
  useEffect(() => {
    if (errorMsg && !loading) {
      // Defer to next tick so the panel is mounted before focusing.
      const id = window.setTimeout(() => {
        (errorRef.current ?? retryBtnRef.current)?.focus();
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [errorMsg, loading]);

  const clearStageTimers = () => {
    stageTimers.current.forEach((id) => window.clearTimeout(id));
    stageTimers.current = [];
  };
  useEffect(() => () => clearStageTimers(), []);

  const credits = profile?.credits ?? 0;
  const PORTAL_COST = 1;
  const hasCredits = credits >= PORTAL_COST;
  const creditsNeeded = Math.max(0, PORTAL_COST - credits);

  // Trimmed values + lightweight per-field validation. Mirrors the server
  // schema (name + niche required) and powers the confirm-dialog gating.
  const nameTrim = name.trim();
  const nicheTrim = niche.trim();
  const langTrim = language.trim();
  const NAME_MAX = 60;
  const NICHE_MAX = 240;
  const LANG_MAX = 40;
  const fieldErrors = {
    name:
      nameTrim.length === 0 ? "Portal name is required"
      : nameTrim.length > NAME_MAX ? `Max ${NAME_MAX} characters`
      : null,
    niche:
      nicheTrim.length === 0 ? "Niche / theme is required"
      : nicheTrim.length < 4 ? "Add a few more words"
      : nicheTrim.length > NICHE_MAX ? `Max ${NICHE_MAX} characters`
      : null,
    language:
      langTrim.length === 0 ? "Language is required"
      : langTrim.length > LANG_MAX ? `Max ${LANG_MAX} characters`
      : null,
  };
  const isValid = !fieldErrors.name && !fieldErrors.niche && !fieldErrors.language;

  const requestSpawn = () => {
    if (!user) { toast.error("Sign in to spawn a portal"); return; }
    if (!isValid) {
      toast.error(fieldErrors.name || fieldErrors.niche || fieldErrors.language || "Check the form");
      return;
    }
    if (!hasCredits) { toast.error("Not enough 🪙 — top up to spawn"); return; }
    setConfirmOpen(true);
  };

  const run = async () => {
    setConfirmOpen(false);
    setLoading(true);
    setCreated(null);
    setErrorMsg(null);
    clearStageTimers();
    setStage(1); // queued
    const toastId = `spawn-${kind}-${Date.now()}`;
    toast.loading("Queued — reserving 🪙 & slot", {
      id: toastId,
      description: "Stage 1 of 3",
    });
    // Optimistic stage progression — server returns when fully published
    stageTimers.current.push(window.setTimeout(() => {
      setStage((s) => (s < 2 ? 2 : s));
      toast.loading("Spawning — scouting + AI seed content", {
        id: toastId,
        description: "Stage 2 of 3",
      });
    }, 600));
    stageTimers.current.push(window.setTimeout(() => {
      setStage((s) => (s < 3 ? 3 : s));
      toast.loading("Publishing — writing portal & going live", {
        id: toastId,
        description: "Stage 3 of 3",
      });
    }, 6000));
    try {
      const r = await spawn({ data: { name: name.trim(), niche: niche.trim(), vibe: vibe.trim(), language, kind, useScout: true } });
      clearStageTimers();
      setStage(4);
      setCreated({ slug: r.portal.slug, name: r.portal.name });
      toast.success(`Spawned "${r.portal.name}"`, {
        id: toastId,
        description: "Portal is live · 1 🪙 spent",
      });
      setName(""); setNiche(""); setVibe("");
      // Refresh wallet so the new credit balance shows everywhere immediately
      void refresh();
    } catch (e: any) {
      clearStageTimers();
      setStage(0);
      const msg = e?.message ?? "Spawn failed — please try again";
      setErrorMsg(msg);
      toast.error("Spawn failed", { id: toastId, description: msg });
      // If the server refunded credits, surface the new balance immediately.
      if (/refunded\s+\d+\s+credit/i.test(msg)) {
        void refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const retry = () => { setErrorMsg(null); void run(); };

  const autoDescribe = async () => {
    if (describing) return;
    if (!user) { toast.error("Sign in to use AI auto-describe"); return; }
    const seedName = name.trim();
    const seedNiche = niche.trim();
    const seedVibe = vibe.trim();
    if (!seedName && !seedNiche && !seedVibe) {
      toast.error("Type a name or a few keywords first");
      return;
    }
    setDescribing(true);
    const tid = `describe-${kind}-${Date.now()}`;
    toast.loading("Generating richer description…", { id: tid });
    try {
      const r = await describe({ data: { kind, name: seedName, niche: seedNiche, vibe: seedVibe, language } });
      setNiche(r.description);
      toast.success("Description expanded", { id: tid, description: "Edit anything you don't like" });
    } catch (e: any) {
      toast.error("Auto-describe failed", { id: tid, description: e?.message ?? "Try again in a moment" });
    } finally {
      setDescribing(false);
    }
  };

  const STAGES: ReadonlyArray<{ key: 1 | 2 | 3 | 4; label: string; hint: string }> = [
    { key: 1, label: "Queued",      hint: "Reserving 🪙 & slot" },
    { key: 2, label: "Generating",  hint: "Scouting + AI seed content" },
    { key: 3, label: "Publishing",  hint: "Writing portal & going live" },
    { key: 4, label: "Ready",       hint: "Portal is live" },
  ];

  const SpawnProgress = ({ stage }: { stage: 0 | 1 | 2 | 3 | 4 }) => (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Spawn progress"
      className="mt-5 rounded-xl border border-border bg-background/60 p-3"
    >
      {/* Visually hidden, plain-language description that the live region
          announces whenever the stage changes. */}
      <p className="sr-only">
        {stage === 0
          ? "Spawn idle."
          : stage === 4
          ? "Spawn complete. Portal is live."
          : `Step ${stage} of 4: ${
              STAGES.find((s) => s.key === stage)?.label ?? ""
            } — ${STAGES.find((s) => s.key === stage)?.hint ?? ""}.`}
      </p>
      <ol className="grid grid-cols-1 sm:grid-cols-4 gap-2">
      {STAGES.map((s) => {
        const done = stage > s.key;
        const active = stage === s.key;
        return (
          <li
            key={s.key}
            aria-current={active ? "step" : undefined}
            aria-label={`Step ${s.key} of 4: ${s.label}. ${
              done ? "Complete." : active ? "In progress." : "Pending."
            } ${s.hint}.`}
            className={[
              "flex items-center gap-2 rounded-md px-3 py-2 border text-xs",
              done
                ? "border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.72_0.22_245/0.08)] text-foreground"
                : active
                ? "border-gold/60 bg-gold/10 text-foreground"
                : "border-border text-muted-foreground",
            ].join(" ")}
          >
            <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current shrink-0">
              {done
                ? <Check className="h-3 w-3" />
                : active
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <span className="text-[10px] font-bold">{s.key}</span>}
            </span>
            <div aria-hidden="true" className="leading-tight min-w-0">
              <div className="font-bold uppercase tracking-[0.18em] truncate">{s.label}</div>
              <div className="text-[10px] text-muted-foreground truncate">{s.hint}</div>
            </div>
          </li>
        );
      })}
      </ol>
    </div>
  );

  return (
    <section className="mt-10 rounded-2xl border border-[oklch(0.72_0.22_245/0.4)] bg-card p-6 sm:p-8">
      <header className="flex items-center gap-3 mb-1 flex-wrap">
        <Sparkles className="h-5 w-5 text-[oklch(0.72_0.22_245)]" />
        <h2 className="font-[Montserrat] font-black text-xl text-foreground">{copy.title}</h2>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground border border-border rounded-full px-2 py-1">
          <Coins className="h-3 w-3" /> 1 🪙
        </span>
      </header>
      <p className="text-xs text-muted-foreground mb-4">{copy.subtitle}. Public on the home grid.</p>

      {!user ? (
        <div className="relative rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 via-background/60 to-[oklch(0.72_0.22_245/0.12)] p-5 sm:p-6 overflow-hidden">
          <div className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full blur-3xl bg-[radial-gradient(closest-side,oklch(0.78_0.18_85/0.4),transparent)]" />
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-300/15 border border-amber-300/40 flex items-center justify-center">
              <Lock className="h-5 w-5 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/90 font-bold">Members only</p>
              <h3 className="mt-1 font-[Montserrat] font-black text-lg text-foreground">
                Sign in to spawn portals
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Spawning a portal costs 1 🪙. Create a free account and we&apos;ll drop{" "}
                <span className="text-amber-200 font-bold">5 🪙</span> in your wallet — no card needed.
              </p>
            </div>
          </div>

          {/* Disabled preview of the form so the gating is obvious */}
          <fieldset
            disabled
            aria-hidden="true"
            className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-50 pointer-events-none select-none"
          >
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portal Name</label>
              <Input value="" placeholder={copy.namePh} className="mt-1 h-11 bg-background" readOnly />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Language</label>
              <Input value="English" className="mt-1 h-11 bg-background" readOnly />
            </div>
          </fieldset>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-300 hover:bg-amber-200 text-black px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] font-bold transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Create free account
              <Gift className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] font-bold text-foreground hover:border-amber-300/60"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Link>
          </div>
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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Niche / Theme</label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={autoDescribe}
                    disabled={describing || loading}
                    aria-label="Auto-generate a richer description from your keywords"
                    title="Use your name + keywords to draft a richer description"
                    className="h-7 px-2.5 text-[10px] uppercase tracking-[0.22em] font-bold border-[oklch(0.72_0.22_245/0.5)] hover:border-[oklch(0.72_0.22_245)] hover:bg-[oklch(0.72_0.22_245/0.08)]"
                  >
                    {describing
                      ? <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Drafting…</>
                      : <><Sparkles className="h-3 w-3 mr-1.5 text-[oklch(0.72_0.22_245)]" />Auto-describe</>}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={autoDescribe}
                    disabled={describing || loading || (!niche.trim() && !name.trim() && !vibe.trim())}
                    aria-label="Regenerate description from the same keywords"
                    title="Draft a fresh description using your existing keywords"
                    className="h-7 px-2.5 text-[10px] uppercase tracking-[0.22em] font-bold border-amber-300/50 hover:border-amber-300 hover:bg-amber-300/10"
                  >
                    {describing
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><RotateCcw className="h-3 w-3 mr-1.5 text-amber-300" />Regenerate</>}
                  </Button>
                </div>
              </div>
              <textarea
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder={copy.nichePh}
                rows={2}
                disabled={loading || describing}
                className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-y disabled:opacity-50"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Tip: drop a few keywords then tap <span className="font-bold text-foreground">Auto-describe</span> for a richer prompt.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Mood / Visual Vibe</label>
              <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder={copy.vibePh} className="mt-1 h-11 bg-background" disabled={loading} />
            </div>
          </div>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* span wrapper so tooltip still fires when button is disabled */}
                <span className="mt-6 inline-block w-full sm:w-auto">
                  <Button
                    onClick={requestSpawn}
                    disabled={loading || !isValid || !hasCredits}
                    aria-disabled={loading || !isValid || !hasCredits}
                    aria-describedby={!hasCredits ? "spawn-credits-hint" : undefined}
                    className="h-14 px-10 text-sm sm:text-base uppercase tracking-[0.28em] font-black w-full sm:w-auto min-h-[56px] rounded-xl text-black bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 hover:from-amber-200 hover:via-yellow-200 hover:to-amber-300 border border-amber-200/70 shadow-[0_0_0_1px_oklch(0.78_0.18_85/0.35),0_18px_48px_-12px_oklch(0.78_0.18_85/0.55)] hover:shadow-[0_0_0_1px_oklch(0.78_0.18_85/0.55),0_22px_60px_-10px_oklch(0.78_0.18_85/0.7)] transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:shadow-none"
                  >
                    {loading
                      ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Spawning…</>
                      : <><Zap className="h-5 w-5 mr-2 fill-black" />Generate Portal · {PORTAL_COST} 🪙</>}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs leading-snug">
                {!hasCredits ? (
                  <div className="space-y-1.5">
                    <p className="font-bold uppercase tracking-[0.18em] text-amber-300">
                      Not enough 🪙
                    </p>
                    <p>
                      Spawning costs <span className="font-bold">{PORTAL_COST} 🪙</span>.
                      You have <span className="font-bold">{credits}</span> — need{" "}
                      <span className="font-bold text-amber-300">
                        {creditsNeeded} more 🪙
                      </span>.
                    </p>
                    <Link to="/store" className="block underline text-foreground">
                      Top up in the store →
                    </Link>
                  </div>
                ) : !isValid ? (
                  <p>{fieldErrors.name || fieldErrors.niche || fieldErrors.language}</p>
                ) : (
                  <p>Spawn this portal · {PORTAL_COST} 🪙</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {!hasCredits && (
            <p id="spawn-credits-hint" className="sr-only">
              You need {creditsNeeded} more 🪙 to spawn a portal.
            </p>
          )}
          {!isValid && (
            <p className="mt-2 text-[11px] text-destructive">
              {fieldErrors.name || fieldErrors.niche || fieldErrors.language}
            </p>
          )}
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Balance: <span className={hasCredits ? "text-foreground" : "text-destructive"}>{credits} 🪙</span>
            {!hasCredits && (
              <> · <Link to="/store" className="underline text-foreground">Top up</Link></>
            )}
          </p>

          {(loading || stage === 4) && (
            <SpawnProgress stage={stage} />
          )}

          {errorMsg && !loading && (
            <div
              ref={errorRef}
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              tabIndex={-1}
              className="mt-5 rounded-xl border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-[0.3em] text-destructive font-bold">
                  Spawn failed
                </div>
                <p className="text-sm text-foreground mt-1 break-words">{errorMsg}</p>
                {(() => {
                  const refundMatch = errorMsg.match(/refunded\s+(\d+)\s+credit/i);
                  if (refundMatch) {
                    const n = Number(refundMatch[1]);
                    return (
                      <>
                        <div
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                          aria-label={`Refunded ${n} 🪙`}
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          Refunded {n} 🪙
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          The spawn didn't complete, so we returned your credit{n === 1 ? "" : "s"} to your balance. You can retry safely — you won't be double-charged.
                        </p>
                      </>
                    );
                  }
                  return (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {/insufficient|not enough credits/i.test(errorMsg)
                        ? <>Top up 🪙 to continue. <Link to="/store" className="underline text-foreground">Open store</Link>.</>
                        : /name and niche/i.test(errorMsg)
                        ? "Add both a portal name and a niche, then try again."
                        : "No 🪙 was charged. You can retry safely."}
                    </p>
                  );
                })()}
              </div>
              <Button
                ref={retryBtnRef}
                size="sm"
                variant="outline"
                onClick={retry}
                disabled={!hasCredits}
                className="shrink-0"
                aria-label="Retry spawning the portal"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            </div>
          )}

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
                  <span className="font-semibold text-foreground">&ldquo;{nameTrim || "Untitled"}&rdquo;</span>{" "}
                  and publish it to the home grid.
                </p>
                <div className="rounded-md border border-border bg-background/60 divide-y divide-border">
                  <div className="flex items-start gap-3 px-3 py-2">
                    <Languages className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Language</div>
                      <div className="text-foreground font-medium truncate">{langTrim || "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-3 py-2">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Niche / theme</div>
                      <div className="text-foreground font-medium line-clamp-3 break-words">{nicheTrim || "—"}</div>
                    </div>
                  </div>
                  {vibe.trim() && (
                    <div className="flex items-start gap-3 px-3 py-2">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Vibe</div>
                        <div className="text-foreground font-medium line-clamp-2 break-words">{vibe.trim()}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em]">
                    <Coins className="h-3.5 w-3.5 text-gold" /> Cost
                  </span>
                  <span className="font-mono text-sm font-bold">1 🪙</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Balance after</span>
                  <span className="font-mono">
                    {credits} → {Math.max(0, credits - 1)} credits
                  </span>
                </div>
                {!isValid && (
                  <p className="text-[11px] text-destructive">
                    {fieldErrors.name || fieldErrors.niche || fieldErrors.language}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void run(); }}
              disabled={loading || !isValid || !hasCredits}
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