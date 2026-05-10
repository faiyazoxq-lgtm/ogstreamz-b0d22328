import { useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe2,
  Sparkles,
  ShieldCheck,
  Coins,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Schema + types                                                     */
/* ------------------------------------------------------------------ */

export const LANGUAGES = [
  "English", "Arabic", "Urdu", "Spanish", "French", "Portuguese",
  "Turkish", "Hindi", "Bengali", "Indonesian", "Malay", "Swahili",
] as const;

export const CHARACTER_STYLES = [
  { value: "street",    label: "Street",     hint: "Raw, bold, neighborhood energy" },
  { value: "executive", label: "Executive",  hint: "Sharp, polished, boardroom calm" },
  { value: "scholar",   label: "Scholar",    hint: "Measured, evidence-led, articulate" },
  { value: "comedian",  label: "Comedian",   hint: "Quick, witty, crowd-pleasing" },
  { value: "mystic",    label: "Mystic",     hint: "Reflective, poetic, soulful" },
  { value: "operator",  label: "Operator",   hint: "Pragmatic, no-fluff, ROI-driven" },
] as const;

export const MONETIZATION = [
  { value: "free",          label: "Free access",          hint: "No paywall — built for reach" },
  { value: "credits",       label: "Per-action credits",   hint: "Spend coins per download/use" },
  { value: "subscription",  label: "Subscription",         hint: "Recurring VIP / Real OG" },
  { value: "tip_jar",       label: "Tip jar",              hint: "Optional appreciation drops" },
  { value: "ads_sponsors",  label: "Ads & sponsors",       hint: "External placements" },
] as const;

export const portalBriefSchema = z.object({
  // Step 1 — basics
  name: z.string().trim().min(2, "Name is too short").max(80, "Max 80 characters"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug is too short")
    .max(60, "Max 60 characters")
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Lowercase letters, numbers & hyphens"),
  niche: z.string().trim().min(2, "Niche is required").max(120),
  // Step 2 — languages
  languages: z.array(z.enum(LANGUAGES)).min(1, "Pick at least one language").max(6),
  primaryLanguage: z.enum(LANGUAGES),
  // Step 3 — Halalify
  halalify: z.object({
    enabled: z.boolean(),
    level: z.enum(["off", "soft", "strict"]).default("off"),
    notes: z.string().max(280).optional().default(""),
  }),
  // Step 4 — character style
  characterStyle: z.enum(CHARACTER_STYLES.map((s) => s.value) as [string, ...string[]]),
  vibe: z.string().trim().max(160).optional().default(""),
  // Step 5 — monetization
  monetization: z.object({
    modes: z.array(z.enum(MONETIZATION.map((m) => m.value) as [string, ...string[]])).min(1, "Pick at least one"),
    creditCost: z.number().int().min(0).max(50).default(2),
    vipFreePerDay: z.number().int().min(0).max(20).default(1),
  }),
});

export type PortalBrief = z.infer<typeof portalBriefSchema>;

const STEPS = [
  { id: "basics",     title: "Basics",        icon: Sparkles },
  { id: "languages",  title: "Languages",     icon: Globe2 },
  { id: "halalify",   title: "Halalify",      icon: ShieldCheck },
  { id: "character",  title: "Character",     icon: Sparkles },
  { id: "money",      title: "Monetization",  icon: Coins },
] as const;

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const initialBrief: PortalBrief = {
  name: "",
  slug: "",
  niche: "",
  languages: ["English"],
  primaryLanguage: "English",
  halalify: { enabled: false, level: "off", notes: "" },
  characterStyle: "street",
  vibe: "",
  monetization: { modes: ["credits"], creditCost: 2, vipFreePerDay: 1 },
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

type Props = {
  /** Pre-fill from a previously saved brief (e.g. re-opening a draft). */
  initial?: Partial<PortalBrief>;
  /** Called with the validated brief when the user finishes. */
  onSubmit: (brief: PortalBrief) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
};

export function PortalBriefWizard({ initial, onSubmit, onCancel, submitting = false }: Props) {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<PortalBrief>({ ...initialBrief, ...(initial ?? {}) } as PortalBrief);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = <K extends keyof PortalBrief>(key: K, value: PortalBrief[K]) =>
    setBrief((b) => ({ ...b, [key]: value }));

  // Validate just the fields visible on the current step.
  const validateStep = (idx: number): boolean => {
    const stepFields: Record<number, (keyof PortalBrief)[]> = {
      0: ["name", "slug", "niche"],
      1: ["languages", "primaryLanguage"],
      2: ["halalify"],
      3: ["characterStyle", "vibe"],
      4: ["monetization"],
    };
    const partial = portalBriefSchema.safeParse(brief);
    if (partial.success) { setErrors({}); return true; }

    const stepKeys = new Set(stepFields[idx] ?? []);
    const newErrors: Record<string, string> = {};
    for (const issue of partial.error.issues) {
      const top = issue.path[0] as string;
      if (stepKeys.has(top as keyof PortalBrief)) {
        newErrors[issue.path.join(".")] = issue.message;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const next = () => { if (validateStep(step)) setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const finish = async () => {
    const parsed = portalBriefSchema.safeParse(brief);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[i.path.join(".")] = i.message; });
      setErrors(errs);
      // Jump to the first step that has an error.
      const firstBadKey = Object.keys(errs)[0]?.split(".")[0];
      const stepIdx = ["name","slug","niche","languages","primaryLanguage","halalify","characterStyle","vibe","monetization"]
        .indexOf(firstBadKey ?? "");
      const map = [0,0,0,1,1,2,3,3,4];
      if (stepIdx >= 0) setStep(map[stepIdx]);
      return;
    }
    await onSubmit(parsed.data);
  };

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* Stepper */}
      <header className="mb-5">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{STEPS[step].title}</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="mt-3 hidden grid-cols-5 gap-2 sm:grid">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <li
                key={s.id}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                  active ? "border-primary bg-primary/10 text-foreground"
                  : done   ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
                           : "border-border text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className="truncate">{s.title}</span>
              </li>
            );
          })}
        </ol>
      </header>

      {/* Step body */}
      <div className="min-h-[280px]">
        {step === 0 && (
          <BasicsStep brief={brief} update={update} errors={errors} />
        )}
        {step === 1 && (
          <LanguagesStep brief={brief} update={update} errors={errors} />
        )}
        {step === 2 && (
          <HalalifyStep brief={brief} update={update} errors={errors} />
        )}
        {step === 3 && (
          <CharacterStep brief={brief} update={update} errors={errors} />
        )}
        {step === 4 && (
          <MonetizationStep brief={brief} update={update} errors={errors} />
        )}
      </div>

      {/* Footer */}
      <footer className="mt-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {onCancel ? "Cancel" : ""}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0 || submitting}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/40 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create portal
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Step bodies                                                        */
/* ------------------------------------------------------------------ */

type StepProps = {
  brief: PortalBrief;
  update: <K extends keyof PortalBrief>(key: K, value: PortalBrief[K]) => void;
  errors: Record<string, string>;
};

const Field = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{hint}</span>}
    <div className="mt-1.5">{children}</div>
    {error && <span className="mt-1 block text-[11px] text-destructive">{error}</span>}
  </label>
);

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function BasicsStep({ brief, update, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <Field label="Portal name" error={errors.name}>
        <input
          className={inputCls}
          maxLength={80}
          value={brief.name}
          onChange={(e) => {
            const name = e.target.value;
            update("name", name);
            // auto-suggest slug only if user hasn't customised it
            if (!brief.slug || brief.slug === slugify(brief.name)) update("slug", slugify(name));
          }}
          placeholder="OGSTREAMZ Music"
        />
      </Field>
      <Field label="Slug" hint="Used in the public URL — lowercase, numbers, hyphens only" error={errors.slug}>
        <input
          className={inputCls + " font-mono"}
          maxLength={60}
          value={brief.slug}
          onChange={(e) => update("slug", slugify(e.target.value))}
          placeholder="ogstreamz-music"
        />
      </Field>
      <Field label="Niche / focus" error={errors.niche}>
        <input
          className={inputCls}
          maxLength={120}
          value={brief.niche}
          onChange={(e) => update("niche", e.target.value)}
          placeholder="Underground hip-hop discovery"
        />
      </Field>
    </div>
  );
}

function LanguagesStep({ brief, update, errors }: StepProps) {
  const toggle = (l: typeof LANGUAGES[number]) => {
    const has = brief.languages.includes(l);
    const next = has ? brief.languages.filter((x) => x !== l) : [...brief.languages, l];
    if (next.length > 6) return;
    update("languages", next as PortalBrief["languages"]);
    if (!next.includes(brief.primaryLanguage) && next[0]) {
      update("primaryLanguage", next[0] as PortalBrief["primaryLanguage"]);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Languages spoken in the portal" hint="Pick up to 6 — primary will lead the UI" error={errors.languages}>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => {
            const active = brief.languages.includes(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => toggle(l)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  active ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Primary language" error={errors.primaryLanguage}>
        <select
          className={inputCls}
          value={brief.primaryLanguage}
          onChange={(e) => update("primaryLanguage", e.target.value as PortalBrief["primaryLanguage"])}
        >
          {brief.languages.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>
    </div>
  );
}

function HalalifyStep({ brief, update, errors }: StepProps) {
  const h = brief.halalify;
  const setH = (patch: Partial<PortalBrief["halalify"]>) =>
    update("halalify", { ...h, ...patch });

  return (
    <div className="space-y-4">
      <Field label="Halalify" hint="Filter content for halal-friendly audiences">
        <button
          type="button"
          onClick={() => setH({ enabled: !h.enabled, level: !h.enabled ? "soft" : "off" })}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            h.enabled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-border text-muted-foreground"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          {h.enabled ? "Enabled" : "Disabled"}
        </button>
      </Field>
      {h.enabled && (
        <>
          <Field label="Strictness level">
            <div className="flex gap-2">
              {(["soft","strict"] as const).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setH({ level: lv })}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize ${
                    h.level === lv ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-secondary/40"
                  }`}
                >
                  {lv}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notes for moderators" hint="Optional — context for what to allow or block" error={errors["halalify.notes"]}>
            <textarea
              className={inputCls + " min-h-[80px] resize-y"}
              maxLength={280}
              value={h.notes ?? ""}
              onChange={(e) => setH({ notes: e.target.value })}
              placeholder="No alcohol references, instrumental music only, etc."
            />
          </Field>
        </>
      )}
    </div>
  );
}

function CharacterStep({ brief, update, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <Field label="Character style" error={errors.characterStyle}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CHARACTER_STYLES.map((s) => {
            const active = brief.characterStyle === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => update("characterStyle", s.value)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                  active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/40"
                }`}
              >
                <div className="font-bold">{s.label}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{s.hint}</div>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Vibe (optional)" hint="A one-line vibe statement to season the writing" error={errors.vibe}>
        <input
          className={inputCls}
          maxLength={160}
          value={brief.vibe ?? ""}
          onChange={(e) => update("vibe", e.target.value)}
          placeholder="Late-night, neon-soaked, all heart"
        />
      </Field>
    </div>
  );
}

function MonetizationStep({ brief, update, errors }: StepProps) {
  const m = brief.monetization;
  const setM = (patch: Partial<PortalBrief["monetization"]>) =>
    update("monetization", { ...m, ...patch });
  const toggleMode = (val: string) => {
    const has = m.modes.includes(val);
    const next = has ? m.modes.filter((x) => x !== val) : [...m.modes, val];
    setM({ modes: next as PortalBrief["monetization"]["modes"] });
  };

  const usesCredits = m.modes.includes("credits");

  return (
    <div className="space-y-4">
      <Field label="Monetization modes" hint="Pick all that apply" error={errors["monetization.modes"]}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MONETIZATION.map((opt) => {
            const active = m.modes.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleMode(opt.value)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                  active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{opt.label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </Field>

      {usesCredits && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Credit cost per action" hint="🪙 spent per full download / paid use">
            <input
              type="number"
              min={0}
              max={50}
              className={inputCls + " font-mono"}
              value={m.creditCost}
              onChange={(e) => setM({ creditCost: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
            />
          </Field>
          <Field label="VIP free passes / day" hint="Free unlocks for Real OG users per portal/day">
            <input
              type="number"
              min={0}
              max={20}
              className={inputCls + " font-mono"}
              value={m.vipFreePerDay}
              onChange={(e) => setM({ vipFreePerDay: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

export default PortalBriefWizard;