import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ShieldCheck, Rocket, ChevronRight } from "lucide-react";
import { runPublishChecks, type CheckResult } from "@/lib/publish-check.functions";
import { requireBoss } from "@/lib/route-guards";

const STATIC_CHECKLIST: Array<{ label: string; detail: string }> = [
  { label: "Replace placeholder home page content", detail: "Verify /, /portals, and key landing pages render real copy and imagery." },
  { label: "Set custom domain & canonical URLs", detail: "Confirm www.ogstreamz.co.uk + ogstreamz.co.uk both resolve and redirect canonically." },
  { label: "Open-graph & social previews", detail: "Each portal/hub has an og:image; share to Slack/Discord to preview." },
  { label: "robots.txt & sitemap.xml", detail: "Visit /robots.txt and /sitemap.xml on production and confirm both load." },
  { label: "Mobile QA pass", detail: "Walk through auth → portal → checkout flow on a real phone." },
  { label: "Stripe live keys & webhook signature", detail: "Switch to live mode in Power Controls and run a £1 test purchase." },
  { label: "Backups & instance size", detail: "Cloud → Overview → Advanced settings: confirm tier matches launch traffic." },
];

function statusPill(status: CheckResult["status"]) {
  if (status === "pass") return { Icon: CheckCircle2, cls: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/40", label: "Pass" };
  if (status === "warn") return { Icon: AlertTriangle, cls: "text-amber-300 bg-amber-500/10 ring-amber-500/40", label: "Warn" };
  return { Icon: XCircle, cls: "text-rose-300 bg-rose-500/10 ring-rose-500/40", label: "Fail" };
}

export function PublishCheckPanel() {
  const fetchChecks = useServerFn(runPublishChecks);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const mutation = useMutation({
    mutationFn: () => fetchChecks({ data: {} as never }),
    onSuccess: () => setLastRun(new Date()),
  });

  const data = mutation.data;
  const score = data?.score;
  const blocking = (score?.fail ?? 0) > 0;

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/40">
            <Rocket className="h-5 w-5 text-gold" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="syndicate-header text-2xl text-foreground">Publish-Ready Checklist</h1>
            <p className="text-sm text-muted-foreground">Automated validation of permissions, exposed data, and configuration before going live.</p>
          </div>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/25 disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {mutation.isPending ? "Running…" : data ? "Re-run validation" : "Run validation"}
          </button>
        </div>

        {score && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScoreCard label="Total" value={score.total} cls="text-foreground" />
            <ScoreCard label="Pass" value={score.pass} cls="text-emerald-300" />
            <ScoreCard label="Warn" value={score.warn} cls="text-amber-300" />
            <ScoreCard label="Fail" value={score.fail} cls="text-rose-300" />
          </div>
        )}

        {data && (
          <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${blocking ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}>
            {blocking
              ? "Blocking failures detected — resolve all FAIL items before publishing."
              : "No blocking failures. Review WARN items, then publish when ready."}
            {lastRun && <span className="ml-2 text-xs opacity-70">· last run {lastRun.toLocaleTimeString()}</span>}
          </div>
        )}
      </header>

      {mutation.isError && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          Failed to run validation: {(mutation.error as Error).message}
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <h2 className="text-[11px] uppercase tracking-[0.3em] text-gold font-bold">Automated checks</h2>
          <ul className="space-y-2">
            {data.checks.map((c) => {
              const pill = statusPill(c.status);
              return (
                <li key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${pill.cls}`}>
                      <pill.Icon className="h-3.5 w-3.5" /> {pill.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{c.label}</p>
                      {c.detail && <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>}
                      {c.items && c.items.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {c.items.slice(0, 12).map((it) => (
                            <li key={it} className="rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground font-mono">
                              {it}
                            </li>
                          ))}
                          {c.items.length > 12 && (
                            <li className="text-[11px] text-muted-foreground">+{c.items.length - 12} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{c.category}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-[0.3em] text-gold font-bold">Manual checklist</h2>
        <ul className="space-y-2">
          {STATIC_CHECKLIST.map((s) => (
            <li key={s.label} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <ChevronRight className="mt-0.5 h-4 w-4 text-gold/70 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ScoreCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}