import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Lock, Webhook, KeyRound, Settings as SettingsIcon, ShieldAlert,
  ExternalLink, ShieldCheck, Loader2, Eye, EyeOff, RefreshCw, Search,
  Sparkles, Copy, Check,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { requireBoss } from "@/lib/route-guards";
import {
  listSecretsInventory,
  discoverUncataloguedSecrets,
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

/**
 * Vault-style mask: keeps the first 2 chars + the suffix marker
 * (e.g. "ST••••••••••_KEY") so admins can spot a row at a glance
 * without the full identifier rendering by default.
 */
function maskName(name: string): string {
  if (!name) return "••••••••";
  const m = name.match(/^([A-Z0-9]{1,3})(.+?)(_KEY|_SECRET|_TOKEN|_WEBHOOK_SECRET|_API_KEY|_PASSWORD)?$/i);
  const head = m?.[1] ?? name.slice(0, 2);
  const tail = m?.[3] ?? "";
  return `${head}${"•".repeat(8)}${tail}`;
}

function SecretsInventoryPage() {
  const fetchInventory = useServerFn(listSecretsInventory);
  const discoverFn = useServerFn(discoverUncataloguedSecrets);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["boss", "secrets-inventory"],
    queryFn: () => fetchInventory(),
    staleTime: 60_000,
  });
  const discovery = useQuery({
    queryKey: ["boss", "secrets-inventory", "discover"],
    queryFn: () => discoverFn(),
    staleTime: 60_000,
  });

  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [revealAll, setRevealAll] = useState(false);
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const toggle = (name: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const copyName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(name);
      setTimeout(() => setCopied((c) => (c === name ? null : c)), 1200);
    } catch {
      toast.error("Clipboard blocked");
    }
  };

  const handleRefresh = async () => {
    const [, d] = await Promise.all([refetch(), discovery.refetch()]);
    const n = d.data?.unknown.length ?? 0;
    toast.success(n ? `Found ${n} uncatalogued secret${n === 1 ? "" : "s"}` : "Inventory up to date");
  };

  const sections: SecretsInventorySection[] = data?.sections ?? [];
  const total = sections.reduce((n, s) => n + s.entries.length, 0);

  const filteredSections = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        entries: s.entries.filter(
          (e) => e.name.toLowerCase().includes(q) || e.purpose.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.entries.length > 0);
  }, [sections, filter]);

  const unknown = discovery.data?.unknown ?? [];

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
              Vault catalogue of every platform-managed runtime secret in use
              {data ? ` (${total} total)` : ""}. Names are masked by default
              and only revealed on explicit click — values never ship to the
              browser at all.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setRevealAll((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-secondary/40 transition"
              title={revealAll ? "Hide all names" : "Reveal all names"}
            >
              {revealAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealAll ? "Hide all" : "Reveal all"}
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isFetching || discovery.isFetching}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/15 transition disabled:opacity-60"
              title="Re-scan runtime env for new keys"
            >
              {isFetching || discovery.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh & scan
            </button>
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or purpose…"
            className="w-full rounded-md border border-border bg-card/60 pl-9 pr-3 py-2 text-xs outline-none focus:border-gold/40"
          />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            For per-agent keys you rotate yourself, use{" "}
            <a href="/boss/infrastructure#agent-keys" className="underline decoration-dotted underline-offset-2 hover:text-amber-100">
              Agent API Keys
            </a>
            . To edit a runtime secret listed here, open Lovable Cloud → Backend → Secrets.
          </span>
        </div>

        <Link
          to="/boss/infrastructure"
          hash="agent-keys"
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

      {unknown.length > 0 && (
        <div className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/5 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-300" />
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-200">
              Newly detected · uncatalogued
            </h2>
            <span className="ml-auto text-[11px] text-muted-foreground">{unknown.length}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            These keys exist in the live runtime environment but are not yet catalogued. Add them to{" "}
            <code className="font-mono">src/lib/secrets-inventory.functions.ts</code> with a purpose.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {unknown.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 rounded-lg border border-fuchsia-500/30 bg-card/60 px-3 py-2"
              >
                <code className="font-mono text-xs text-fuchsia-100 truncate">
                  {revealAll || revealed.has(name) ? name : maskName(name)}
                </code>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggle(name)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    title={revealed.has(name) ? "Hide" : "Reveal"}
                  >
                    {revealed.has(name) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredSections.map((s) => {
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
                {s.entries.map((e) => {
                  const isOpen = revealAll || revealed.has(e.name);
                  return (
                    <li
                      key={e.name}
                      className="rounded-lg border border-border bg-secondary/30 p-3 transition hover:border-gold/30"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <code
                          className={`font-mono text-xs font-bold ${
                            isOpen ? "text-foreground" : "text-muted-foreground tracking-wider select-none"
                          }`}
                        >
                          {isOpen ? e.name : maskName(e.name)}
                        </code>
                        {(e.tags ?? []).map((t) => (
                          <span
                            key={t}
                            className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${TAG_STYLES[t]}`}
                          >
                            {t}
                          </span>
                        ))}
                        <div className="ml-auto flex items-center gap-1">
                          {isOpen && (
                            <button
                              type="button"
                              onClick={() => copyName(e.name)}
                              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                              title="Copy name"
                            >
                              {copied === e.name ? (
                                <Check className="h-3.5 w-3.5 text-emerald-300" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggle(e.name)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] hover:bg-secondary/40"
                            title={isOpen ? "Hide name" : "Reveal name"}
                          >
                            {isOpen ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {isOpen ? "Hide" : "Reveal"}
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{e.purpose}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {filteredSections.length === 0 && !isLoading && (
          <div className="rounded-xl border border-border bg-card/40 p-6 text-center text-xs text-muted-foreground lg:col-span-2">
            No secrets match "{filter}".
          </div>
        )}
      </div>

      <footer className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground">
        <p className="flex flex-wrap items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          When this list drifts from the actual store, update <code className="font-mono">src/lib/secrets-inventory.functions.ts</code>.
          {discovery.data?.checkedAt && (
            <span className="ml-auto">Last scan: {new Date(discovery.data.checkedAt).toLocaleTimeString()}</span>
          )}
        </p>
      </footer>
    </section>
  );
}
