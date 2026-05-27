import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ShieldCheck,
  Rocket,
  ChevronRight,
  Shield,
  Database,
  Settings,
  Link2,
  FileText,
  ListChecks,
  Info,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runPublishChecks, type CheckResult } from "@/lib/publish-check.functions";

const STATIC_CHECKLIST: Array<{ label: string; detail: string }> = [
  { label: "Replace placeholder home page content", detail: "Verify /, /portals, and key landing pages render real copy and imagery." },
  { label: "Set custom domain & canonical URLs", detail: "Confirm www.ogstreamz.co.uk + ogstreamz.co.uk both resolve and redirect canonically." },
  { label: "Open-graph & social previews", detail: "Each portal/hub has an og:image; share to Slack/Discord to preview." },
  { label: "robots.txt & sitemap.xml", detail: "Visit /robots.txt and /sitemap.xml on production and confirm both load." },
  { label: "Mobile QA pass", detail: "Walk through auth → portal → checkout flow on a real phone." },
  { label: "Stripe live keys & webhook signature", detail: "Switch to live mode in Power Controls and run a £1 test purchase." },
  { label: "Backups & instance size", detail: "Cloud → Overview → Advanced settings: confirm tier matches launch traffic." },
];

function statusMeta(status: CheckResult["status"]) {
  if (status === "pass")
    return {
      Icon: CheckCircle2,
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      dot: "bg-emerald-400",
      label: "Pass",
    };
  if (status === "warn")
    return {
      Icon: AlertTriangle,
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      dot: "bg-amber-400",
      label: "Warn",
    };
  return {
    Icon: XCircle,
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    dot: "bg-rose-400",
    label: "Fail",
  };
}

const CATEGORY_META: Record<
  CheckResult["category"],
  { label: string; Icon: typeof Shield; cls: string; border: string }
> = {
  security: { label: "Security", Icon: Shield, cls: "text-rose-300", border: "border-rose-500/20" },
  data: { label: "Data safety", Icon: Database, cls: "text-sky-300", border: "border-sky-500/20" },
  config: { label: "Configuration", Icon: Settings, cls: "text-amber-300", border: "border-amber-500/20" },
  links: { label: "Links", Icon: Link2, cls: "text-violet-300", border: "border-violet-500/20" },
  content: { label: "Content", Icon: FileText, cls: "text-emerald-300", border: "border-emerald-500/20" },
};

function groupByCategory(checks: CheckResult[]) {
  const map = new Map<CheckResult["category"], CheckResult[]>();
  for (const c of checks) {
    if (!map.has(c.category)) map.set(c.category, []);
    map.get(c.category)!.push(c);
  }
  return map;
}

function ProgressBar({ pass, warn, fail, total }: { pass: number; warn: number; fail: number; total: number }) {
  if (total === 0) return null;
  const pPass = (pass / total) * 100;
  const pWarn = (warn / total) * 100;
  const pFail = (fail / total) * 100;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {pass > 0 && <div className="bg-emerald-400" style={{ width: `${pPass}%` }} />}
      {warn > 0 && <div className="bg-amber-400" style={{ width: `${pWarn}%` }} />}
      {fail > 0 && <div className="bg-rose-400" style={{ width: `${pFail}%` }} />}
    </div>
  );
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
  const hasWarnings = (score?.warn ?? 0) > 0;

  const grouped = useMemo(() => {
    if (!data?.checks) return new Map<CheckResult["category"], CheckResult[]>();
    return groupByCategory(data.checks);
  }, [data?.checks]);

  return (
    <section className="space-y-8">
      {/* Header */}
      <header className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/40">
            <Rocket className="h-5 w-5 text-gold" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="syndicate-header text-2xl text-foreground">Publish-Ready Checklist</h1>
            <p className="text-sm text-muted-foreground">
              Automated validation of permissions, exposed data, and configuration before going live.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="gap-2 border-gold/40 bg-gold/15 uppercase tracking-[0.15em] text-gold hover:bg-gold/25"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : data ? <ShieldCheck className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {mutation.isPending ? "Running…" : data ? "Re-run" : "Run validation"}
          </Button>
        </div>

        {/* Overall status */}
        {score && (
          <div className={`mt-5 rounded-xl border px-4 py-3 ${blocking ? "border-rose-500/30 bg-rose-500/10" : hasWarnings ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
            <div className="flex items-center gap-2">
              {blocking ? (
                <XCircle className="h-5 w-5 shrink-0 text-rose-300" />
              ) : hasWarnings ? (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
              )}
              <p className={`text-sm font-semibold ${blocking ? "text-rose-200" : hasWarnings ? "text-amber-200" : "text-emerald-200"}`}>
                {blocking
                  ? `Not ready — ${score.fail} blocking ${score.fail === 1 ? "issue" : "issues"}`
                  : hasWarnings
                    ? `Ready with warnings — ${score.warn} ${score.warn === 1 ? "item" : "items"} to review`
                    : "Ready to publish"}
              </p>
            </div>
            <ProgressBar pass={score.pass} warn={score.warn} fail={score.fail} total={score.total} />
            <div className="mt-2 flex items-center gap-1.5 text-xs opacity-70">
              <Info className="h-3 w-3" />
              <span>
                {score.pass} pass · {score.warn} warn · {score.fail} fail · {score.total} total
                {lastRun && <span className="ml-1">· last run {lastRun.toLocaleTimeString()}</span>}
              </span>
            </div>
          </div>
        )}

        {/* Score cards */}
        {score && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ScoreCard label="Total" value={score.total} cls="text-foreground" />
            <ScoreCard label="Pass" value={score.pass} cls="text-emerald-300" dot="bg-emerald-400" />
            <ScoreCard label="Warn" value={score.warn} cls="text-amber-300" dot="bg-amber-400" />
            <ScoreCard label="Fail" value={score.fail} cls="text-rose-300" dot="bg-rose-400" />
          </div>
        )}

        {/* Pre-run hint */}
        {!data && !mutation.isPending && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
            <Play className="h-4 w-4 text-gold/70" />
            <span>Run the validation to generate a full pre-flight report.</span>
          </div>
        )}
      </header>

      {/* Error */}
      {mutation.isError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <div className="flex items-center gap-2 font-semibold">
            <XCircle className="h-4 w-4" />
            Validation failed
          </div>
          <p className="mt-1 opacity-80">{(mutation.error as Error).message}</p>
        </div>
      )}

      {/* Automated checks grouped by category */}
      {data && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-gold" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gold">Automated checks</h2>
          </div>

          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([category, checks]) => {
              const meta = CATEGORY_META[category];
              const failCount = checks.filter((c) => c.status === "fail").length;
              const warnCount = checks.filter((c) => c.status === "warn").length;
              return (
                <div key={category} className="space-y-2">
                  {/* Category header */}
                  <div className={`flex items-center gap-2 rounded-lg border ${meta.border} bg-card/40 px-3 py-2`}>
                    <meta.Icon className={`h-4 w-4 ${meta.cls}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{meta.label}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {checks.length}
                    </Badge>
                    {failCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/30">
                        <XCircle className="h-3 w-3" /> {failCount}
                      </span>
                    )}
                    {warnCount > 0 && !failCount && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">
                        <AlertTriangle className="h-3 w-3" /> {warnCount}
                      </span>
                    )}
                    {!failCount && !warnCount && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" /> All clear
                      </span>
                    )}
                  </div>

                  {/* Checks in this category */}
                  <ul className="space-y-2">
                    {checks.map((c) => {
                      const metaStatus = statusMeta(c.status);
                      return (
                        <li
                          key={c.id}
                          className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-card/80"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                            <div className="flex items-center gap-2 sm:w-24 sm:shrink-0">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${metaStatus.badge}`}>
                                <metaStatus.Icon className="h-3.5 w-3.5" />
                                {metaStatus.label}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">{c.label}</p>
                              {c.detail && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.detail}</p>}
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
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual checklist */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-gold" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gold">Manual checklist</h2>
        </div>
        <ul className="space-y-2">
          {STATIC_CHECKLIST.map((s) => (
            <li
              key={s.label}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-card/80"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold/70 group-hover:bg-gold/20 group-hover:text-gold">
                <ChevronRight className="h-3 w-3" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{s.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ScoreCard({
  label,
  value,
  cls,
  dot,
}: {
  label: string;
  value: number;
  cls: string;
  dot?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        {dot && <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />}
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}
