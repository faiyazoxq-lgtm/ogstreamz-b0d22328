import { createFileRoute } from "@tanstack/react-router";
import { Lock, Webhook, KeyRound, Settings as SettingsIcon, ShieldAlert, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { requireBoss } from "@/lib/route-guards";
import {
  listSecretsInventory,
  type SecretsInventorySection,
  type SecretsInventoryTag,
} from "@/lib/secrets-inventory.functions";

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

const ICONS = {
  webhook: Webhook,
  key: KeyRound,
  settings: SettingsIcon,
} as const;

const TAG_STYLES: Record<SecretsInventoryTag, string> = {
  managed: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  connector: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  boss: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  config: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
};

function SecretsInventoryPage() {
  const fetchInventory = useServerFn(listSecretsInventory);
  const { data, isLoading, error } = useQuery({
    queryKey: ["boss", "secrets-inventory"],
    queryFn: () => fetchInventory(),
    staleTime: 60_000,
  });

  const sections: SecretsInventorySection[] = data?.sections ?? [];
  const total = sections.reduce((n, s) => n + s.entries.length, 0);

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
              Read-only catalogue of every platform-managed runtime secret in use
              {data ? ` (${total} total)` : ""}. Names and values never ship to the
              browser bundle — they're delivered to this Boss-only page over an
              authenticated server call.
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

        <Link
          to="/boss/api-keys"
          className="mt-3 flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/10 transition"
        >
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong className="font-bold">Encrypted Vault →</strong> Any blank or rotated secret can be parked in the
            offline-encrypted vault (pgp_sym_encrypt at rest, decrypted only on explicit Reveal). Use this for keys you
            need to keep but aren't ready to wire into runtime yet.
          </span>
        </Link>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading inventory…
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Failed to load inventory: {(error as Error).message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((s) => {
          const Icon = ICONS[s.iconKey];
          return (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1"
                  style={{ background: `${s.tint}1a`, borderColor: `${s.tint}55` }}
                >
                  <Icon className="h-4 w-4" style={{ color: s.tint }} />
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
          );
        })}
      </div>

      <footer className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          When this list drifts from the actual store, update <code className="font-mono">src/lib/secrets-inventory.functions.ts</code>.
        </p>
      </footer>
    </section>
  );
}
