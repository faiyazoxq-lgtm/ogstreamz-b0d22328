import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowLeft, CheckCircle2, ClipboardList, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getFormPortal, submitFormPortal } from "@/lib/form-portals.functions";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "textarea" | "select" | "radio" | "checkbox" | "rating";
  required: boolean;
  placeholder?: string;
  options?: string[];
  max?: number;
};

type Portal = {
  id: string;
  slug: string;
  name: string;
  schema: { formType: "contact" | "survey"; fields: Field[]; submitLabel: string; thankYou: string };
};

export const Route = createFileRoute("/f/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Form · 0G-STREAMZ` },
      { name: "description", content: "Submit this form on 0G-STREAMZ." },
    ],
  }),
  component: FormPortalPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="max-w-md mx-auto p-10 text-center">
        <h1 className="text-2xl font-black mb-3">Couldn't load this form</h1>
        <p className="text-sm text-muted-foreground mb-6">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="text-sm underline">Retry</button>
      </div>
    );
  },
});

function FormPortalPage() {
  const { slug } = Route.useParams();
  const fetchPortal = useServerFn(getFormPortal);
  const submitFn = useServerFn(submitFormPortal);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetchPortal({ data: { slug } }).then((res) => {
      if (!alive) return;
      if (!res.portal) { setState("missing"); return; }
      setPortal(res.portal as Portal);
      setState("ok");
    }).catch(() => { if (alive) setState("missing"); });
    return () => { alive = false; };
  }, [slug, fetchPortal]);

  const set = (name: string, v: any) => setValues((s) => ({ ...s, [name]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal) return;
    setSubmitting(true);
    try {
      const res = await submitFn({ data: { slug, payload: values } });
      setDone(res.thankYou ?? "Thanks — we got it.");
    } catch (err: any) {
      toast.error(err?.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center text-muted-foreground text-sm">
        <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading form…
      </main>
    );
  }

  if (state === "missing" || !portal) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-black mb-3">Form not found</h1>
        <p className="text-sm text-muted-foreground mb-6">This form may be unpublished or no longer exists.</p>
        <Link to="/" className="text-sm underline">← Back home</Link>
      </main>
    );
  }

  if (done) {
    return (
      <main className="max-w-md mx-auto px-6 py-24 text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-400" />
        <h1 className="text-2xl font-black mb-3">{done}</h1>
        <Link to="/" className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground">← Home</Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3 w-3" /> Home
      </Link>
      <header className="mb-8">
        <p className="text-[10px] tracking-[0.4em] uppercase font-semibold text-sky-300">
          0G · {portal.schema.formType === "contact" ? "Contact" : "Survey"}
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-4xl tracking-tight flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-sky-300" /> {portal.name}
        </h1>
      </header>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
        {portal.schema.fields.map((f) => (
          <FieldRow key={f.name} field={f} value={values[f.name]} onChange={(v) => set(f.name, v)} />
        ))}
        <Button type="submit" disabled={submitting} className="w-full font-bold uppercase tracking-[0.18em]">
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {portal.schema.submitLabel}
        </Button>
      </form>
    </main>
  );
}

function FieldRow({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const label = (
    <label className="block text-xs uppercase tracking-[0.18em] font-bold mb-1.5">
      {field.label}{field.required && <span className="text-destructive ml-1">*</span>}
    </label>
  );

  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          maxLength={2000}
          placeholder={field.placeholder}
          className="bg-background/60 min-h-24"
        />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div>
        {label}
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="w-full h-10 rounded-md bg-background/60 border border-border px-2 text-sm"
        >
          <option value="">— Choose —</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === "radio") {
    return (
      <div>
        {label}
        <div className="space-y-1.5">
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.name}
                value={o}
                checked={value === o}
                onChange={() => onChange(o)}
                required={field.required}
              /> {o}
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (field.type === "checkbox") {
    const arr: string[] = Array.isArray(value) ? value : [];
    return (
      <div>
        {label}
        <div className="space-y-1.5">
          {(field.options ?? []).map((o) => {
            const checked = arr.includes(o);
            return (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, o] : arr.filter((x) => x !== o);
                    onChange(next);
                  }}
                /> {o}
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.type === "rating") {
    const max = field.max ?? 5;
    const n = Number(value) || 0;
    return (
      <div>
        {label}
        <div className="flex gap-1">
          {Array.from({ length: max }).map((_, i) => {
            const v = i + 1;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(v)}
                aria-label={`Rate ${v}`}
                className="p-1"
              >
                <Star className={`h-6 w-6 ${v <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  // text + email
  return (
    <div>
      {label}
      <Input
        type={field.type === "email" ? "email" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        maxLength={500}
        placeholder={field.placeholder}
        className="bg-background/60"
      />
    </div>
  );
}
