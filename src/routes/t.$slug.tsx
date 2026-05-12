import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Sparkles, Lock, Lightbulb, BadgeCheck, RotateCcw, Calculator, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ToolConfig } from "@/lib/tools.functions";
import { OgWordmark } from "@/components/OgWordmark";

type ToolRow = { id: string; slug: string; name: string; description: string | null; vip: boolean; config: ToolConfig };

export const Route = createFileRoute("/t/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("calculators")
      .select("id, slug, name, description, vip, config")
      .eq("slug", params.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound();
    return { tool: data as unknown as ToolRow };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.tool.name ?? "Tool"} · ToolHUB · 0G-PORTAL` },
      { name: "description", content: loaderData?.tool.description ?? "0G-PORTAL micro-tool." },
    ],
  }),
  notFoundComponent: () => (
    <main className="px-5 py-20 text-center">
      <h1 className="text-2xl font-black mb-4">Tool not found</h1>
      <Link to="/tools" className="text-primary underline">Back to ToolHUB</Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="px-5 py-20 text-center text-destructive">{error.message}</main>
  ),
  component: ToolPage,
});

function safeEval(expr: string, scope: Record<string, number>): number {
  // Defense-in-depth: even if a row in `calculators` was tampered with directly
  // in the DB, only allow a strict whitelist of characters before constructing
  // a Function. Blocks arbitrary JS injection at runtime.
  const SAFE_FORMULA = /^[\sA-Za-z0-9_+\-*/().,**Math]+$/;
  if (!SAFE_FORMULA.test(expr)) {
    throw new Error("Formula contains unsafe characters");
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const fn = new Function("Math", ...Object.keys(scope), `return (${expr});`);
  return Number(fn(Math, ...Object.values(scope)));
}

function ToolPage() {
  const { tool } = Route.useLoaderData();
  const { user } = useAuth();
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    if (!user) return setIsVip(false);
    supabase.from("profiles").select("status").eq("id", user.id).maybeSingle().then(({ data }) => {
      setIsVip(data?.status === "vip");
    });
  }, [user]);

  const cfg = tool.config;
  const accent = cfg.theme?.accent || "#3ad6ff";
  const bg = cfg.theme?.bg || "#06121f";

  return (
    <main className="relative min-h-screen text-white overflow-hidden" style={{ background: bg }}>
      <StaticOverlay />
      <div className="relative max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <Link to="/tools" className="text-xs uppercase tracking-[0.4em] text-white/60 hover:text-white">← ToolHUB</Link>

        <header className="mt-6 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{cfg.theme?.emoji}</span>
            <span className="px-2 py-1 rounded-full text-[10px] font-bold tracking-widest" style={{ background: accent, color: bg }}>
              {cfg.theme?.tagline || "0G TOOL"}
            </span>
            {tool.vip && (
              <span className="px-2 py-1 rounded-full text-[10px] font-bold tracking-widest border border-yellow-400/60 text-yellow-300">
                <BadgeCheck className="inline h-3 w-3 mr-1" />VIP
              </span>
            )}
            <span className="px-2 py-1 rounded-full text-[10px] font-bold tracking-widest border border-white/30 text-white/70 uppercase">
              {cfg.audience}
            </span>
          </div>
          <h1 className="font-[Montserrat] font-black text-4xl sm:text-5xl tracking-tight" style={{ color: accent }}>
            {tool.name}
          </h1>
          <p className="mt-3 text-white/70">{cfg.intro}</p>
        </header>

        {cfg.kind === "calculator" ? (
          <CalculatorView cfg={cfg} accent={accent} isVip={isVip} />
        ) : (
          <ChecklistView cfg={cfg} slug={tool.slug} accent={accent} isVip={isVip} />
        )}

        {cfg.audience === "kids" && (
          <MentorSidebar cfg={cfg} accent={accent} isVip={isVip} />
        )}

        <footer className="mt-16 pt-8 border-t border-white/10 text-center text-xs uppercase tracking-[0.4em] text-white/40">
          <BadgeCheck className="inline h-3 w-3 mr-2" />Syndicate Member · Powered by <OgWordmark suffix="-PORTAL" />
        </footer>
      </div>
    </main>
  );
}

function MentorSidebar({ cfg, accent, isVip }: { cfg: ToolConfig; accent: string; isVip: boolean }) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-8 rounded-2xl border p-5"
      style={{ borderColor: `${accent}55`, background: `linear-gradient(135deg, ${accent}12, transparent)` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <GraduationCap className="h-4 w-4" style={{ color: accent }} />
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: accent }}>
          Mentor Mode · Kid-Friendly
        </p>
      </div>
      <p className="text-sm text-white/85 leading-relaxed">
        {cfg.kidExplain || cfg.basicExplanation}
      </p>
      {isVip ? (
        <div className="mt-3 rounded-md border border-white/10 p-3 bg-black/30">
          <p className="text-[10px] uppercase tracking-[0.25em] opacity-70 mb-1" style={{ color: accent }}>
            Mentor Deep Dive
          </p>
          <p className="text-sm text-white/80 whitespace-pre-line">{cfg.deepExplanation}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-white/60">
          <Lock className="inline h-3 w-3 mr-1" />
          Upgrade to unlock the Mentor Deep Dive — step-by-step coaching for grown-ups.
        </p>
      )}
    </motion.aside>
  );
}

function StaticOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-screen"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 30%, #3ad6ff 0, transparent 1px), radial-gradient(circle at 80% 70%, #3ad6ff 0, transparent 1px), radial-gradient(circle at 50% 50%, #3ad6ff 0, transparent 1px)",
        backgroundSize: "3px 3px, 5px 5px, 7px 7px",
        animation: "pulse 4s ease-in-out infinite",
      }}
    />
  );
}

function CalculatorView({ cfg, accent, isVip }: { cfg: ToolConfig; accent: string; isVip: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    cfg.inputs.forEach((i) => (o[i.key] = i.defaultValue ?? ""));
    return o;
  });
  const [out, setOut] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);

  const compute = () => {
    try {
      const scope: Record<string, number> = {};
      for (const inp of cfg.inputs) {
        scope[inp.key] = parseFloat(values[inp.key] || "0");
      }
      const result = safeEval(cfg.formula || "0", scope);
      if (!Number.isFinite(result)) throw new Error("Result is not a number");
      setOut(result);
      setErr(null);
      if (cfg.audience === "kids") {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: [accent, "#fff", "#ffd400"] });
      }
    } catch (e: any) {
      setErr(e?.message ?? "Could not compute");
      setOut(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        {cfg.inputs.map((inp) => (
          <div key={inp.key}>
            <Label className="text-xs uppercase tracking-widest text-white/60">
              {inp.label} {inp.unit ? <span className="text-white/40">({inp.unit})</span> : null}
            </Label>
            <Input
              type={inp.type}
              inputMode={inp.type === "number" ? "decimal" : "text"}
              placeholder={inp.placeholder}
              value={values[inp.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [inp.key]: e.target.value }))}
              className="mt-1 bg-black/40 border-white/20 text-white"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button onClick={compute} className="flex-1 font-bold uppercase tracking-widest" style={{ background: accent, color: "#000" }}>
          <Calculator className="h-4 w-4 mr-2" />Solve
        </Button>
        <Button variant="outline" onClick={() => { setOut(null); setErr(null); }} className="border-white/20 text-white">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}

      <AnimatePresence>
        {out !== null && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl p-5 text-center"
            style={{ background: `linear-gradient(135deg, ${accent}22, transparent)`, border: `1px solid ${accent}55` }}
          >
            <p className="text-xs uppercase tracking-widest text-white/60">{cfg.result?.label || "Result"}</p>
            <p className="mt-2 text-5xl font-black" style={{ color: accent }}>
              {cfg.result?.decimals != null ? out.toFixed(cfg.result.decimals) : out}
              <span className="ml-2 text-2xl text-white/60">{cfg.result?.unit}</span>
            </p>

            {cfg.audience === "kids" && cfg.kidExplain && (
              <Button onClick={() => setExplainOpen((o) => !o)} variant="ghost" className="mt-3 text-white">
                <Lightbulb className="h-4 w-4 mr-2" />Explain it to me
              </Button>
            )}

            <AnimatePresence>
              {explainOpen && cfg.kidExplain && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 text-sm text-white/80 italic"
                >
                  {cfg.kidExplain}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explanations */}
      <div className="space-y-3 pt-2">
        <div className="rounded-lg border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Basic Mode · Free</p>
          <p className="text-sm text-white/85">{cfg.basicExplanation}</p>
        </div>

        <div className="rounded-lg border p-4 relative" style={{ borderColor: `${accent}55` }}>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: accent }}>
            <Sparkles className="inline h-3 w-3 mr-1" />Deep Explanation · VIP
          </p>
          {isVip ? (
            <>
              <p className="text-sm text-white/85 whitespace-pre-line">{cfg.deepExplanation}</p>
              {cfg.steps && cfg.steps.length > 0 && (
                <ol className="mt-3 space-y-1 text-sm text-white/75 list-decimal list-inside">
                  {cfg.steps.map((s, i) => (<li key={i}>{s}</li>))}
                </ol>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white/60"><Lock className="inline h-3 w-3 mr-1" />Unlock the full derivation, edge cases, and step-by-step.</p>
              <Link to="/store" className="text-xs uppercase tracking-widest font-bold underline" style={{ color: accent }}>Upgrade</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistView({ cfg, slug, accent, isVip }: { cfg: ToolConfig; slug: string; accent: string; isVip: boolean }) {
  const items = cfg.checklistItems ?? [];
  const storageKey = `tool-progress:${slug}`;
  const [checked, setChecked] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...checked])); } catch { /* */ }
    if (items.length && checked.size === items.length) {
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: [accent, "#fff"] });
    }
  }, [checked, items.length, storageKey, accent]);

  const toggle = (i: number) =>
    setChecked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const pct = items.length ? Math.round((checked.size / items.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 space-y-4">
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div className="h-full" style={{ background: accent }} animate={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs uppercase tracking-widest text-white/60">{checked.size} / {items.length} done · {pct}%</p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <motion.li
            key={i}
            whileTap={{ scale: 0.98 }}
            onClick={() => toggle(i)}
            className={`cursor-pointer rounded-lg border p-3 flex items-center gap-3 transition-colors ${
              checked.has(i) ? "border-transparent" : "border-white/10 hover:border-white/30"
            }`}
            style={checked.has(i) ? { background: `${accent}22`, borderColor: `${accent}55` } : undefined}
          >
            <span
              className="h-5 w-5 rounded border flex items-center justify-center text-[10px] font-bold"
              style={{ borderColor: accent, background: checked.has(i) ? accent : "transparent", color: "#000" }}
            >
              {checked.has(i) ? "✓" : ""}
            </span>
            <span className={checked.has(i) ? "line-through text-white/50" : "text-white"}>{it}</span>
          </motion.li>
        ))}
      </ul>

      <div className="rounded-lg border border-white/10 p-4">
        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Basic Mode</p>
        <p className="text-sm text-white/85">{cfg.basicExplanation}</p>
      </div>
      <div className="rounded-lg border p-4" style={{ borderColor: `${accent}55` }}>
        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: accent }}>
          <Sparkles className="inline h-3 w-3 mr-1" />Deep Mode · VIP
        </p>
        {isVip ? (
          <p className="text-sm text-white/85 whitespace-pre-line">{cfg.deepExplanation}</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/60"><Lock className="inline h-3 w-3 mr-1" />Sync progress to cloud + advanced coaching.</p>
            <Link to="/store" className="text-xs uppercase tracking-widest font-bold underline" style={{ color: accent }}>Upgrade</Link>
          </div>
        )}
      </div>
    </div>
  );
}