import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardList, Sparkles, Loader2, Eye, EyeOff, Plus, Send,
  Mail, MessageSquare, Star, Inbox, ChevronDown, ChevronUp, ExternalLink, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireBossHub } from "@/lib/route-guards";
import {
  generateFormSchema,
  createFormPortal,
  listMyFormPortals,
  togglePublishFormPortal,
  listFormSubmissions,
} from "@/lib/form-portals.functions";

export const Route = createFileRoute("/formhub")({
  beforeLoad: requireBossHub,
  head: () => ({
    meta: [
      { title: "FormHUB — Spawn form portals · 0G-STREAMZ" },
      { name: "description", content: "Boss-only hub: design contact and survey form portals from a prompt, publish them, and route submissions to Telegram." },
    ],
  }),
  component: FormHubPage,
});

type Schema = {
  formType: "contact" | "survey";
  fields: Array<{
    name: string; label: string;
    type: "text" | "email" | "textarea" | "select" | "radio" | "checkbox" | "rating";
    required: boolean; placeholder?: string; options?: string[]; max?: number;
  }>;
  submitLabel: string;
  thankYou: string;
};

type Portal = {
  id: string; slug: string; name: string; published: boolean; created_at: string;
  brief: any; telegram_config: any;
};

function FormHubPage() {
  const genFn = useServerFn(generateFormSchema);
  const createFn = useServerFn(createFormPortal);
  const listFn = useServerFn(listMyFormPortals);
  const toggleFn = useServerFn(togglePublishFormPortal);
  const subsFn = useServerFn(listFormSubmissions);

  const [formType, setFormType] = useState<"contact" | "survey">("contact");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [chatId, setChatId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [schema, setSchema] = useState<Schema | null>(null);

  const [portals, setPortals] = useState<Portal[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [openInbox, setOpenInbox] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const reload = async () => {
    const [p, s] = await Promise.all([listFn(), subsFn({ data: {} })]);
    setPortals(p.portals as Portal[]);
    setSubmissions(s.submissions);
  };

  useEffect(() => { void reload(); }, []);

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const res = await genFn({ data: { formType, name, prompt } });
      setSchema(res.schema as Schema);
      toast.success("Form designed — review and create");
    } catch (e: any) {
      toast.error(e?.message ?? "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const onCreate = async () => {
    if (!schema) return;
    setCreating(true);
    try {
      await createFn({
        data: {
          name,
          formType,
          schema,
          telegramChatId: chatId.trim() || undefined,
        },
      });
      toast.success("Form portal created — publish it to go live");
      setSchema(null);
      setName("");
      setPrompt("");
      setChatId("");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = async (p: Portal) => {
    try {
      await toggleFn({ data: { id: p.id, published: !p.published } });
      toast.success(!p.published ? "Published" : "Unpublished");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Toggle failed");
    }
  };

  const copyLink = async (p: Portal) => {
    try {
      await navigator.clipboard.writeText(`${origin}/f/${p.slug}`);
      toast.success("Link copied");
    } catch { toast.error("Copy failed"); }
  };

  const inboxFor = (portalId: string) => submissions.filter((s) => s.portal_id === portalId);

  const fieldIcon = (t: string) => {
    if (t === "email") return Mail;
    if (t === "textarea") return MessageSquare;
    if (t === "rating") return Star;
    return ClipboardList;
  };

  const hasGenerated = !!schema;

  return (
    <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-14 pb-24 md:pb-14 animate-fade-in">
      <header className="mb-8">
        <p className="text-[10px] sm:text-xs tracking-[0.4em] uppercase font-semibold text-sky-300">
          0G · Boss Authoring
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-4xl sm:text-5xl tracking-tight flex items-center gap-3">
          <ClipboardList className="h-9 w-9 text-sky-300" /> FormHUB
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl">
          Describe the form you need. Lovable AI designs the fields, you review and publish, submissions land in this inbox and your Telegram.
        </p>
      </header>

      {/* Wizard */}
      <section className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-card to-background p-5 sm:p-7 mb-12">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Form type</label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(["contact", "survey"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFormType(t)}
                  className={`rounded-md border px-3 py-2 text-[11px] uppercase tracking-[0.18em] font-bold transition ${
                    formType === t
                      ? "border-sky-400 bg-sky-500/15 text-sky-200"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Form name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={formType === "contact" ? "VIP early access — interest form" : "Drop preference survey · Q4"}
              className="mt-1.5 bg-background/60"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Prompt</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={800}
            placeholder={formType === "contact"
              ? "Capture leads for the VIP pre-launch list. Ask for name, email, phone, and what they want to unlock first."
              : "Survey VIPs about which stream times they prefer, their favorite genres, and how often they watch live."}
            className="mt-1.5 min-h-24 bg-background/60 font-mono text-sm"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">{prompt.length}/800</p>
        </div>

        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Telegram chat ID (optional)</label>
          <Input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            maxLength={40}
            placeholder="e.g. -1001234567890 or your personal chat ID"
            className="mt-1.5 bg-background/60 font-mono"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">Submissions will be DM'd here via the Telegram bot. Leave empty to store DB-only.</p>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onGenerate}
            disabled={generating || name.trim().length < 2 || prompt.trim().length < 10}
            className="bg-sky-500 hover:bg-sky-500/90 text-primary-foreground font-bold tracking-wide"
          >
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {hasGenerated ? "Regenerate fields" : "Design fields"}
          </Button>
          {hasGenerated && (
            <Button
              onClick={onCreate}
              disabled={creating}
              variant="outline"
              className="font-bold tracking-wide"
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Save form portal
            </Button>
          )}
        </div>

        {/* Schema preview */}
        {schema && (
          <div className="mt-6 rounded-xl border border-border bg-background/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-sky-300 mb-3">Generated fields · review before saving</p>
            <ul className="space-y-2">
              {schema.fields.map((f) => {
                const Icon = fieldIcon(f.type);
                return (
                  <li key={f.name} className="flex items-start gap-2.5 text-sm">
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-bold">{f.label}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{f.type}{f.required ? " · required" : ""}</span>
                      </div>
                      {f.options && (
                        <p className="text-xs text-muted-foreground mt-0.5">{f.options.join(" · ")}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground italic">Submit label: "{schema.submitLabel}" · Thank-you: "{schema.thankYou}"</p>
          </div>
        )}
      </section>

      {/* Existing portals + inbox */}
      <section>
        <h2 className="mb-4 text-sm uppercase tracking-[0.3em] text-muted-foreground">Your form portals</h2>
        {portals.length === 0 && (
          <p className="text-sm text-muted-foreground">No form portals yet — design your first one above.</p>
        )}
        <div className="grid gap-3">
          {portals.map((p) => {
            const inbox = inboxFor(p.id);
            const fields = (p.brief?.form_schema?.fields ?? []) as Schema["fields"];
            const expanded = openInbox === p.id;
            return (
              <article key={p.id} className="rounded-xl border border-border bg-card/60 backdrop-blur p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold tracking-tight">{p.name}</span>
                      <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                        p.published
                          ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                          : "border-border text-muted-foreground"
                      }`}>{p.published ? "Live" : "Draft"}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {fields.length} field{fields.length === 1 ? "" : "s"} · {inbox.length} submission{inbox.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {origin.replace(/^https?:\/\//, "")}/f/{p.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => copyLink(p)} title="Copy public link">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Link to="/f/$slug" params={{ slug: p.slug }} className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border border-border hover:border-sky-400">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <Button size="sm" variant={p.published ? "outline" : "default"} onClick={() => togglePublish(p)}>
                      {p.published ? <><EyeOff className="h-3.5 w-3.5 mr-1" />Unpublish</> : <><Eye className="h-3.5 w-3.5 mr-1" />Publish</>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setOpenInbox(expanded ? null : p.id)}>
                      <Inbox className="h-3.5 w-3.5 mr-1" />
                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4 border-t border-border pt-3">
                    {inbox.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No submissions yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {inbox.slice(0, 50).map((s) => (
                          <li key={s.id} className="rounded-md border border-border bg-background/40 p-3 text-xs">
                            <div className="flex items-center justify-between mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                              <span>{new Date(s.created_at).toLocaleString()}</span>
                              {s.telegram_sent && <span className="inline-flex items-center gap-1 text-sky-300"><Send className="h-3 w-3" />tg</span>}
                            </div>
                            <SubmissionPayload payload={s.payload} fields={fields} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function SubmissionPayload({ payload, fields }: { payload: Record<string, any>; fields: Schema["fields"] }) {
  const labels = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fields) m.set(f.name, f.label);
    return m;
  }, [fields]);
  const entries = Object.entries(payload ?? {});
  if (entries.length === 0) return <p className="text-muted-foreground">Empty</p>;
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-bold text-foreground/80 truncate">{labels.get(k) ?? k}</dt>
          <dd className="text-muted-foreground break-words">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
