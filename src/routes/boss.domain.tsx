import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Globe, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/boss/domain")({
  head: () => ({
    meta: [
      { title: "Domain & DNS · Boss" },
      { name: "description", content: "Custom domain and DNS settings for OG-Streamz." },
    ],
  }),
  component: BossDomainPage,
});

const DOMAINS = [
  { host: "ogstreamz.co.uk", primary: true },
  { host: "www.ogstreamz.co.uk", primary: false },
];

const DNS_RECORDS = [
  { type: "A", name: "@", value: "185.158.133.1", purpose: "Root domain → Lovable hosting" },
  { type: "A", name: "www", value: "185.158.133.1", purpose: "www subdomain → Lovable hosting" },
  { type: "TXT", name: "_lovable", value: "lovable_verify=…", purpose: "Domain ownership verification" },
];

function copy(v: string) {
  navigator.clipboard?.writeText(v).then(
    () => toast.success("Copied"),
    () => toast.error("Copy failed"),
  );
}

function BossDomainPage() {
  return (
    <main className="relative max-w-4xl mx-auto px-5 sm:px-8 py-12">
      <header className="mb-8">
        <Link to="/boss" className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-3 w-3" />Back to Boss
        </Link>
        <p className="mt-3 text-xs tracking-[0.4em] uppercase font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          OG-Streamz · Domain
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-3xl sm:text-4xl text-metallic">
          Domain &amp; DNS Settings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Manage where OG-Streamz lives on the web. Connect or update DNS records at your registrar to keep the custom domain healthy.
        </p>
      </header>

      <section className="rounded-2xl border border-border/40 bg-card/50 p-5 mb-6">
        <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3 inline-flex items-center gap-2">
          <Globe className="h-3.5 w-3.5" /> Connected Domains
        </h2>
        <div className="space-y-2">
          {DOMAINS.map((d) => (
            <div key={d.host} className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-sm">{d.host}</span>
                {d.primary && (
                  <span className="text-[9px] uppercase tracking-widest rounded-full border border-border/50 px-2 py-0.5 text-muted-foreground">
                    Primary
                  </span>
                )}
              </div>
              <a
                href={`https://${d.host}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Visit <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/40 bg-card/50 p-5 mb-6">
        <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">DNS Records (at your registrar)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/30">
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Value</th>
                <th className="py-2 pr-3">Purpose</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {DNS_RECORDS.map((r) => (
                <tr key={`${r.type}-${r.name}`} className="border-b border-border/20 last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{r.type}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.name}</td>
                  <td className="py-2 pr-3 font-mono text-xs break-all">{r.value}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{r.purpose}</td>
                  <td className="py-2">
                    <button
                      onClick={() => copy(r.value)}
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />Copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          DNS changes can take up to 72 hours to propagate. SSL is provisioned automatically once verification completes.
        </p>
      </section>

      <section className="rounded-2xl border border-border/40 bg-card/50 p-5">
        <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">Manage in Lovable</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Add, remove, or verify domains and manage SSL from Project Settings → Domains.
        </p>
        <a
          href="https://docs.lovable.dev/features/custom-domain"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-4 py-2 text-xs uppercase tracking-widest hover:bg-background/70"
        >
          Open custom domain docs <ExternalLink className="h-3 w-3" />
        </a>
      </section>
    </main>
  );
}
