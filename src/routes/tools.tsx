import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Wand2, Loader2, Sparkles, RotateCcw, Lock, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { spawnTool, type ToolAudience } from "@/lib/tools.functions";
import { SpawnPortalCard } from "@/components/SpawnPortalCard";
import { CreditWallet } from "@/components/CreditWallet";
import { VipPaywallInline } from "@/components/VipPaywallInline";
import { PortalHeader, PortalStyleLine, mergeStyle } from "@/components/PortalHeader";

const TOOLS_STYLE = "Concise, decisive, OG-tone explanation with one actionable next step.";

import { requireUsageAccess } from "@/lib/route-guards";
export const Route = createFileRoute("/tools")({
  beforeLoad: requireUsageAccess,
  head: () => ({
    meta: [
      { title: "ToolHUB · Build Your Tool — 0G-STREAMZ" },
      { name: "description", content: "Write your brief, tap a few prompts, spawn a custom micro-tool." },
    ],
  }),
  component: ToolPromptBuilder,
});

type Prompt = { label: string; phrase: string; audience?: ToolAudience; vibe?: string };

const PROMPTS: Prompt[] = [
  { label: "Calculator",       phrase: "math calculator with a clear formula" },
  { label: "Checklist",        phrase: "step-by-step checklist that saves progress" },
  { label: "Converter",        phrase: "unit converter with two-way input" },
  { label: "Estimator",        phrase: "quick estimator with rough-but-useful output" },
  { label: "Ohm's Law",        phrase: "electrical: voltage, current, resistance, power" },
  { label: "BMI",              phrase: "body mass index from weight and height" },
  { label: "Tip Split",        phrase: "tip + bill split between people" },
  { label: "Loan Payment",     phrase: "monthly loan payment from principal, rate, term" },
  { label: "Compound Interest", phrase: "compound interest growth over time" },
  { label: "Calorie Burn",     phrase: "calories burned from activity and duration" },
  { label: "For Kids",         phrase: "kid-friendly with a fun analogy",          audience: "kids",     vibe: "playful neon" },
  { label: "For Students",     phrase: "academic tone, cite the principle",        audience: "students", vibe: "clean modern" },
  { label: "For Pros",         phrase: "precise SI units, technical depth",        audience: "pro",      vibe: "minimal terminal" },
  { label: "Neon Vibe",        phrase: "neon glow visual, dark background",        vibe: "neon glow on dark" },
  { label: "Minimal Vibe",     phrase: "minimal swiss layout, lots of whitespace", vibe: "minimal swiss" },
  { label: "Retro Vibe",       phrase: "retro 80s arcade aesthetic",               vibe: "retro 80s arcade" },
  { label: "Show Steps",       phrase: "show the working steps after solving" },
  { label: "Single Result",    phrase: "one big bold result number" },
  { label: "Multi Result",     phrase: "multiple linked results at once" },
];

function ToolPromptBuilder() {
  const { user, profile, isAdmin } = useAuth();
  const isVip = profile?.status === "vip" || isAdmin;
  const navigate = useNavigate();
  const spawnFn = useServerFn(spawnTool);

  const [used, setUsed] = useState<string[]>([]);
  const [audience, setAudience] = useState<ToolAudience>("students");
  const [vibe, setVibe] = useState("clean modern");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vip, setVip] = useState(false);
  const [busy, setBusy] = useState(false);

  const available = useMemo(() => PROMPTS.filter((p) => !used.includes(p.label)), [used]);

  const tap = (p: Prompt) => {
    setDescription((d) => {
      const t = d.trim();
      if (!t) return p.phrase;
      if (t.toLowerCase().includes(p.phrase.toLowerCase())) return d;
      return `${t}, ${p.phrase}`;
    });
    if (p.audience) setAudience(p.audience);
    if (p.vibe) setVibe(p.vibe);
    setUsed((u) => [...u, p.label]);
  };

  const reset = () => {
    setUsed([]);
    setDescription("");
  };

  const onGenerate = async () => {
    if (!user) {
      toast.error("Sign in to spawn a tool");
      navigate({ to: "/auth" });
      return;
    }
    if (!isAdmin) {
      toast.error("Admin only — ask the boss to spawn this");
      return;
    }
    if (!name.trim()) return toast.error("Name your tool first");
    if (!description.trim()) return toast.error("Describe the logic");
    setBusy(true);
    try {
      const res = await spawnFn({
        data: { name: name.trim(), audience, logic: mergeStyle(TOOLS_STYLE, description), vibe, vip },
      });
      toast.success("⚡ Tool spawned");
      navigate({ to: "/t/$slug", params: { slug: res.slug } });
    } catch (e: any) {
      toast.error(e?.message ?? "Spawn failed");
    } finally {
      setBusy(false);
    }
  };

  const [spawned, setSpawned] = useState<Array<{ id: string; slug: string; name: string; description: string | null; vip: boolean; config: any }>>([]);
  useEffect(() => {
    supabase
      .from("calculators")
      .select("id, slug, name, description, vip, config")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSpawned((data ?? []) as any));
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
      <PortalHeader
        portalKey="tools"
        name="ToolHUB"
        tagline="Prompt Studio"
        seed="precision instruments, glowing dials, terminal grid, neon blueprint"
        accent="gold"
      />

      <section className="rounded-3xl border border-gold/40 bg-gradient-to-br from-card to-background p-4 sm:p-6 shadow-[0_0_80px_oklch(0.82_0.16_88_/_0.1)] backdrop-blur-xl">
        <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Tool Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ohm's Law Solver"
          className="mt-1 mb-4 bg-background/60 text-base font-bold"
          maxLength={80}
        />

        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your Brief</label>
          {used.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tap a prompt below or type freely. Be vivid — the AI follows your lead."
          className="min-h-44 sm:min-h-56 bg-background/60 font-mono text-sm leading-relaxed resize-y"
          maxLength={500}
        />

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
            Tap to add · {available.length} left
          </div>
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">All prompts stacked. Reset to start over.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {available.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => tap(p)}
                  className="px-3 py-1.5 rounded-full text-xs sm:text-sm border border-border bg-background/40 text-foreground hover:border-gold/60 hover:bg-gold/10 hover:scale-105 active:scale-95 transition-all"
                >
                  + {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setVip((v) => !v)}
          className={
            "mt-5 w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all " +
            (vip
              ? "border-gold/70 bg-gold/10 shadow-[0_0_30px_-5px_oklch(0.82_0.16_88_/_0.6)]"
              : "border-border bg-secondary/40 hover:border-gold/50")
          }
        >
          <div className="flex items-center gap-3 text-left">
            <Lock className="h-4 w-4 text-gold" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-[0.25em]">VIP Only</span>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] px-2 py-0.5 rounded-full border border-gold/50 text-gold">VIP</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Lock this tool to Syndicate members.</p>
            </div>
          </div>
          <span className={"text-[10px] font-bold uppercase tracking-[0.3em] " + (vip ? "text-gold" : "text-muted-foreground")}>
            {vip ? "ON" : "OFF"}
          </span>
        </button>

        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold shrink-0" />
          <span className="truncate">0G-BRAIN designs the tool around your prompt · audience: {audience} · vibe: {vibe}</span>
        </div>

        <PortalStyleLine sentence={TOOLS_STYLE} />

        {isVip ? (
          <Button
            onClick={onGenerate}
            disabled={busy}
            size="lg"
            className="mt-3 w-full bg-gold text-primary-foreground hover:bg-gold/90 font-bold tracking-wide"
          >
            {busy ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Spawning…</>
            ) : (
              <><Wand2 className="h-4 w-4 mr-2" /> Spawn Tool</>
            )}
          </Button>
        ) : (
          <VipPaywallInline hub="tools" isAuthenticated={!!user} />
        )}
      </section>

      {spawned.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs tracking-[0.4em] uppercase text-gold font-semibold mb-4">Agent-Spawned Tools</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spawned.map((t) => (
              <Link
                key={t.id}
                to="/t/$slug"
                params={{ slug: t.slug }}
                className="group rounded-2xl border border-border bg-card p-5 hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{t.config?.theme?.emoji ?? "⚡"}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.config?.audience}</span>
                  {t.vip && <span className="ml-auto text-[10px] text-gold"><Lock className="inline h-3 w-3 mr-1" />VIP</span>}
                </div>
                <h3 className="font-bold text-lg text-metallic group-hover:text-primary">{t.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <BadgeCheck className="inline h-3 w-3 mr-1" />Syndicate Member
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
      <CreditWallet className="mt-10" />
      <SpawnPortalCard kind="tools" />
    </main>
  );
}

function VerifyStreamAccessCard({ signedIn }: { signedIn: boolean }) {
  const verifyFn = useServerFn(verifyMyStreamAccess);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | null
    | {
        ok: boolean;
        rank?: string | null;
        status?: string | null;
        expiresAt?: string | null;
        message: string;
      }
  >(null);

  const onVerify = async () => {
    if (!signedIn) {
      toast.error("Sign in first");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res: any = await verifyFn();
      if (res?.ok) {
        const rank = res.profile?.rank ?? null;
        const status = res.status ?? res.profile?.stream_status ?? null;
        const expiresAt = res.expiresAt ?? res.profile?.stream_expires_at ?? null;
        setResult({
          ok: true,
          rank,
          status,
          expiresAt,
          message: "Stream access verified — tag refreshed.",
        });
        toast.success("Stream access verified");
      } else {
        const msg = res?.error || "Verification failed";
        setResult({ ok: false, message: msg });
        toast.error(msg);
      }
    } catch (e: any) {
      const msg = e?.message || "Verification failed";
      setResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const expiryLabel = (() => {
    const iso = result?.expiresAt;
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  })();

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card/60 p-4 sm:p-5 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-gold mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold uppercase tracking-[0.25em]">
            Verify Stream Access
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pings your line through the secure proxy and refreshes your
            OGStreamz tag instantly.
          </p>
          {result && (
            <div
              className={
                "mt-3 text-xs rounded-lg border px-3 py-2 " +
                (result.ok
                  ? "border-gold/40 bg-gold/5 text-foreground"
                  : "border-destructive/40 bg-destructive/10 text-destructive-foreground")
              }
            >
              <div className="font-semibold">{result.message}</div>
              {result.ok && (
                <div className="mt-1 text-muted-foreground">
                  Rank: <span className="text-foreground">{result.rank ?? "—"}</span>
                  {" · "}Status: <span className="text-foreground">{result.status ?? "—"}</span>
                  {expiryLabel ? (
                    <>
                      {" · "}Expires:{" "}
                      <span className="text-foreground">{expiryLabel}</span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
        <Button
          onClick={onVerify}
          disabled={busy}
          size="sm"
          variant="outline"
          className="shrink-0"
        >
          {busy ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking…</>
          ) : (
            <><ShieldCheck className="h-4 w-4 mr-2" />Verify</>
          )}
        </Button>
      </div>
    </section>
  );
}
