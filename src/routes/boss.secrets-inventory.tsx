import { createFileRoute } from "@tanstack/react-router";
import { Lock, Webhook, KeyRound, Settings as SettingsIcon, ShieldAlert, ExternalLink } from "lucide-react";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/secrets-inventory")({
  beforeLoad: requireBoss,
  component: SecretsInventoryPage,
  head: () => ({
    meta: [
      { title: "Secrets Inventory — Boss" },
      { name: "description", content: "Boss-only inventory of platform-managed runtime secrets, webhook secrets and API keys." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Tag = "managed" | "connector" | "boss" | "config";
type Entry = { name: string; purpose: string; tags?: Tag[] };
type Section = { id: string; label: string; Icon: typeof Lock; tint: string; blurb: string; entries: Entry[] };

const SECTIONS: Section[] = [
  {
    id: "webhook-secrets",
    label: "Webhook & Hook Secrets",
    Icon: Webhook,
    tint: "#a855f7",
    blurb: "Shared secrets that verify inbound callbacks and cron pings. Never expose to the browser — server-side only.",
    entries: [
      { name: "PAYMENTS_LIVE_WEBHOOK_SECRET", purpose: "Verifies live Stripe webhook signatures.", tags: ["managed"] },
      { name: "PAYMENTS_SANDBOX_WEBHOOK_SECRET", purpose: "Verifies sandbox Stripe webhook signatures.", tags: ["managed"] },
      { name: "SUNO_WEBHOOK_SECRET", purpose: "Validates ?secret= on Suno callback URL.", tags: [] },
      { name: "REMINDER_HOOK_SECRET", purpose: "Validates x-hook-secret on Telegram reminder cron.", tags: [] },
      { name: "SYNDICATE_TICK_SECRET", purpose: "Validates the Syndicate tick cron endpoint.", tags: [] },
    ],
  },
  {
    id: "api-keys",
    label: "API Keys (Third-Party)",
    Icon: KeyRound,
    tint: "#ffd166",
    blurb: "Outbound credentials for third-party services. Connector-managed keys can only be edited from Connectors.",
    entries: [
      { name: "LOVABLE_API_KEY", purpose: "Lovable AI Gateway (Gemini/GPT/etc).", tags: ["managed"] },
      { name: "GEMINI_API_KEY", purpose: "Google Gemini direct API.", tags: [] },
      { name: "PERPLEXITY_API_KEY", purpose: "Perplexity research/search.", tags: ["connector"] },
      { name: "FIRECRAWL_API_KEY", purpose: "Firecrawl scraping.", tags: ["connector"] },
      { name: "TELEGRAM_API_KEY", purpose: "Telegram bot send/receive.", tags: ["connector"] },
      { name: "SUNO_API_KEY", purpose: "Suno music generation.", tags: [] },
      { name: "SHAPES_API_KEY", purpose: "Shapes inference API.", tags: [] },
      { name: "APOLLO_API_KEY", purpose: "Apollo lead enrichment.", tags: [] },
      { name: "INSTANTLY_API_KEY", purpose: "Instantly outbound sequencing.", tags: [] },
      { name: "STRIPE_LIVE_API_KEY", purpose: "Live Stripe secret key for payments.", tags: ["managed"] },
      { name: "STRIPE_SANDBOX_API_KEY", purpose: "Sandbox Stripe secret key for test payments.", tags: ["managed"] },
    ],
  },
  {
    id: "config",
    label: "Config & Identity",
    Icon: SettingsIcon,
    tint: "#94a3b8",
    blurb: "Non-credential runtime values. Not sensitive on their own but live in the same store.",
    entries: [
      { name: "BOSS_EMAIL", purpose: "Email used to bootstrap the Boss role.", tags: ["boss"] },
      { name: "STREAM_SERVER_URL", purpose: "Default streaming server endpoint.", tags: ["config"] },
      { name: "VAULT_PORTAL_DOMAIN", purpose: "Public domain for VIP / vault portals.", tags: ["config"] },
    ],
  },
];

const TAG_STYLES: Record<Tag, string> = {
  managed: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  connector: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  boss: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  config: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
};

function SecretsInventoryPage() {
  const total = SECTIONS.reduce((n, s) => n + s.entries.length, 0);
  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/40">
            <Lock className="h-5 w-5 text-gold" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="syndicate-header text-2xl text-foreground">Secrets Inventory</h1>
            <p className="text-sm text-muted-foreground">
              Read-only catalogue of every platform-managed runtime secret in use ({total} total). Values are never shown
              here — they live encrypted in the Lovable Cloud secret store and are only injected into server functions.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            For per-agent keys you rotate yourself, use{" "}
            <a href="/boss/api-keys" className="underline decoration-dotted underline-offset-2 hover:text-amber-100">
              Agent API Keys
            </a>
            . To edit a runtime secret listed here, open Lovable Cloud → Backend → Secrets.
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1"
                style={{ background: `${s.tint}1a`, borderColor: `${s.tint}55` }}
              >
                <s.Icon className="h-4 w-4" style={{ color: s.tint }} />
              </span>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">{s.label}</h2>
              <span className="ml-auto text-[11px] text-muted-foreground">{s.entries.length}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{s.blurb}</p>
            <ul className="mt-3 space-y-2">
              {s.entries.map((e) => (
                <li key={e.name} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-xs font-bold text-foreground">{e.name}</code>
                    {(e.tags ?? []).map((t) => (
                      <span
                        key={t}
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${TAG_STYLES[t]}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.purpose}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <footer className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          When this list drifts from the actual store, update <code className="font-mono">src/routes/boss.secrets-inventory.tsx</code>.
        </p>
      </footer>
    </section>
  );
}