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

export const Route = createFileRoute("/tools")({
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
  const { user, isAdmin } = useAuth();
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
        data: { name: name.trim(), audience, logic: description.trim(), vibe, vip },
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
      <header className="mb-6 text-center">
        <p className="text-[10px] sm:text-xs tracking-[0.4em] text-gold uppercase font-semibold">
          ToolHUB · Prompt Studio
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-3xl sm:text-5xl tracking-tight leading-[1.05]">
          Write the <span className="text-gradient-gold">Tool.</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe the logic. Tap prompts to stack ideas — they vanish as you use them.
        </p>
      </header>

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
    </main>
  );
}
