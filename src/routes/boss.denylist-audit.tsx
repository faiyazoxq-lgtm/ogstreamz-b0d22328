import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ScanSearch, Loader2, AlertTriangle, CheckCircle2, Database, Globe, ArrowRightLeft, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runDenylistAudit, type AuditHit, type AuditReport } from "@/lib/denylist-audit.functions";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/denylist-audit")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Denylist Audit · Boss · 0G-STREAMZ" },
      { name: "description", content: "Scan stored fields, rendered pages, and redirects for blocked domains." },
    ],
  }),
  component: DenylistAuditPage,
});

const SOURCE_META: Record<AuditHit["source"], { label: string; Icon: typeof Database; tint: string }> = {
  db:       { label: "Stored field",     Icon: Database,       tint: "#a78bfa" },
  page:     { label: "Rendered page",    Icon: Globe,          tint: "#3ad6ff" },
  redirect: { label: "Redirect target",  Icon: ArrowRightLeft, tint: "#ffd166" },
};

export function DenylistAuditPage() {
  const audit = useServerFn(runDenylistAudit);
  const [report, setReport] = useState<AuditReport | null>(null);

  const m = useMutation({
    mutationFn: () => audit({ data: undefined as never }),
    onSuccess: (r) => {
      setReport(r);
      if (r.hits.length === 0) toast.success("Audit complete — no leaks found.");
      else toast.warning(`Audit complete — ${r.hits.length} match${r.hits.length === 1 ? "" : "es"} found.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = report
    ? (Object.entries(
        report.hits.reduce<Record<string, AuditHit[]>>((acc, h) => {
          (acc[h.source] ??= []).push(h);
          return acc;
        }, {}),
      ) as [AuditHit["source"], AuditHit[]][])
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 text-foreground">
      <header className="mb-8 flex items-start gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in oklab, #00e08a 18%, transparent)", color: "#00e08a" }}
        >
          <ScanSearch className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Denylist Audit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scans every Boss-managed denylist domain against (1) stored database fields,
            (2) the HTML of public pages on the live site, and (3) redirect targets.
            The runtime guard already hides matches from visitors — this finds anywhere
            they live so you can clean them up at the source.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
        <Button onClick={() => m.mutate()} disabled={m.isPending} className="gap-2">
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          {m.isPending ? "Scanning…" : report ? "Re-run audit" : "Run audit"}
        </Button>
        {report && (
          <p className="mt-3 text-xs text-muted-foreground">
            Last run {new Date(report.ranAt).toLocaleString()} · scanned{" "}
            <strong>{report.scanned.dbColumns}</strong> DB columns and{" "}
            <strong>{report.scanned.pages}</strong> pages against{" "}
            <strong>{report.blockedDomains.length}</strong> blocked domain
            {report.blockedDomains.length === 1 ? "" : "s"}.
          </p>
        )}
      </section>

      {report && report.blockedDomains.length === 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur text-sm">
          <div className="flex items-center gap-2 text-amber-400">
            <ShieldOff className="h-4 w-4" />
            The denylist is empty. Add domains in <strong>Domain Denylist</strong> first.
          </div>
        </section>
      )}

      {report && report.blockedDomains.length > 0 && report.hits.length === 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur text-sm">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Clean. No blocked domains found in any scanned location.
          </div>
        </section>
      )}

      {grouped.map(([source, list]) => {
        const meta = SOURCE_META[source];
        return (
          <section key={source} className="mt-6 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider" style={{ color: meta.tint }}>
              <meta.Icon className="h-4 w-4" />
              {meta.label} <span className="text-muted-foreground">({list.length})</span>
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {list.map((h, i) => (
                <li key={i} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <code className="rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-rose-300">{h.domain}</code>
                    <span className="text-muted-foreground">in</span>
                    <span className="font-mono text-xs">{h.location}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{h.snippet}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {report && report.errors.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 backdrop-blur">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <AlertTriangle className="h-4 w-4" /> Scan warnings
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-amber-300/80">
            {report.errors.map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}