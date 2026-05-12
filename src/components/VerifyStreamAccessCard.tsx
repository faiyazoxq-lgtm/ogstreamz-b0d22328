import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { verifyMyStreamAccess } from "@/lib/stream-link.functions";

function formatRemaining(ms: number): string {
  const abs = Math.abs(ms);
  const day = 86_400_000;
  const hr = 3_600_000;
  const min = 60_000;
  if (abs >= day) {
    const d = Math.floor(abs / day);
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  if (abs >= hr) {
    const h = Math.floor(abs / hr);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const m = Math.max(1, Math.floor(abs / min));
  return `${m} min${m === 1 ? "" : "s"}`;
}

export function VerifyStreamAccessCard({ signedIn }: { signedIn: boolean }) {
  const verifyFn = useServerFn(verifyMyStreamAccess);
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [result, setResult] = useState<
    | null
    | {
        ok: boolean;
        rank?: string | null;
        status?: string | null;
        expiresAt?: string | null;
        message: string;
        errorCode?: string | null;
      }
  >(null);

  const onVerify = async () => {
    if (!signedIn) {
      toast.error("Sign in first", {
        description: "You need an account to verify your stream line.",
      });
      return;
    }
    setBusy(true);
    // Keep previous result visible during re-check; loading UI overlays it.
    const tId = toast.loading("Checking your stream line…", {
      description: "Pinging the proxy with your saved credentials.",
    });
    try {
      const res: any = await verifyFn();
      setCheckedAt(new Date());
      if (res?.ok) {
        const rank = res.profile?.rank ?? null;
        const status = res.status ?? res.profile?.stream_status ?? null;
        const expiresAt = res.expiresAt ?? res.profile?.stream_expires_at ?? null;
        const expMs = expiresAt ? new Date(expiresAt).getTime() - Date.now() : null;
        const expSummary =
          expMs == null
            ? "no expiry on file"
            : expMs > 0
              ? `${formatRemaining(expMs)} left`
              : `expired ${formatRemaining(expMs)} ago`;
        setResult({
          ok: true,
          rank,
          status,
          expiresAt,
          message: `Stream access verified — ${expSummary}.`,
        });
        toast.success(`Stream ${String(status || "active").toLowerCase()}`, {
          id: tId,
          description: `Rank: ${rank ?? "—"} · ${expSummary}${expiresAt ? ` (until ${new Date(expiresAt).toLocaleString()})` : ""}`,
        });
      } else {
        const msg = res?.error || "Verification failed";
        const code = res?.reason || res?.cause || null;
        setResult({ ok: false, message: msg, errorCode: code });
        toast.error("Stream check failed", {
          id: tId,
          description: msg,
          action: { label: "Retry", onClick: () => onVerify() },
        });
      }
    } catch (e: any) {
      const msg = e?.message || "Verification failed";
      setResult({ ok: false, message: msg, errorCode: "exception" });
      toast.error("Stream check failed", {
        id: tId,
        description: msg,
        action: { label: "Retry", onClick: () => onVerify() },
      });
    } finally {
      setBusy(false);
    }
  };

  const expiry = (() => {
    const iso = result?.expiresAt;
    if (!iso) return null;
    let d: Date;
    try { d = new Date(iso); } catch { return { label: iso, ms: null as number | null }; }
    return { label: d.toLocaleString(), ms: d.getTime() - Date.now() };
  })();

  const statusTone = (() => {
    if (!result?.ok) return null;
    const s = (result.status || "").toLowerCase();
    if (s === "active") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    if (s.includes("expir")) return "bg-destructive/15 text-destructive-foreground border-destructive/40";
    return "bg-muted text-foreground border-border";
  })();

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
        {busy ? (
          <Loader2 className="h-5 w-5 text-primary mt-0.5 shrink-0 animate-spin" aria-hidden />
        ) : result?.ok ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" aria-hidden />
        ) : result && !result.ok ? (
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" aria-hidden />
        ) : (
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em]">
              Verify Stream Access
            </div>
            {checkedAt && !busy && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3 w-3" />
                checked {checkedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pings your line through the secure proxy and refreshes your
            OGStreamz tag instantly.
          </p>

          {busy && (
            <div className="mt-3 space-y-2" aria-live="polite" aria-busy="true">
              <div className="h-2.5 w-2/3 rounded bg-muted/60 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded bg-muted/40 animate-pulse" />
              <div className="h-2.5 w-1/3 rounded bg-muted/30 animate-pulse" />
              <p className="text-[11px] text-muted-foreground">Calling provider · refreshing tag · saving status…</p>
            </div>
          )}

          {!busy && result && (
            <div
              className={
                "mt-3 text-xs rounded-lg border px-3 py-2 " +
                (result.ok
                  ? "border-emerald-500/40 bg-emerald-500/5 text-foreground"
                  : "border-destructive/40 bg-destructive/10 text-destructive-foreground")
              }
              aria-live="polite"
            >
              <div className="font-semibold">{result.message}</div>
              {result.ok ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {result.status && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone}`}>
                      {result.status}
                    </span>
                  )}
                  {result.rank && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                      rank · {result.rank}
                    </span>
                  )}
                  {expiry && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                      <Clock className="h-3 w-3" />
                      {expiry.ms != null
                        ? expiry.ms > 0
                          ? `${formatRemaining(expiry.ms)} left`
                          : `expired ${formatRemaining(expiry.ms)} ago`
                        : "no expiry"}
                    </span>
                  )}
                  {expiry?.label && (
                    <span className="text-muted-foreground">until {expiry.label}</span>
                  )}
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {result.errorCode && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {result.errorCode}
                    </span>
                  )}
                  <Button onClick={onVerify} size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                    <RefreshCw className="h-3 w-3 mr-1" /> Try again
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
        <Button
          onClick={onVerify}
          disabled={busy}
          size="sm"
          variant="outline"
          className="shrink-0 w-full sm:w-auto sm:self-start"
        >
          {busy ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking…</>
          ) : result ? (
            <><RefreshCw className="h-4 w-4 mr-2" />Re-check</>
          ) : (
            <><ShieldCheck className="h-4 w-4 mr-2" />Verify</>
          )}
        </Button>
      </div>
    </section>
  );
}
