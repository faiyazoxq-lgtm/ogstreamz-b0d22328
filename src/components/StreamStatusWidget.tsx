import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Tv, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

type State = "loading" | "no_creds" | "active" | "expiring" | "expired" | "inactive";

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

export function StreamStatusWidget() {
  const { user, profile, loading } = useAuth();

  const view = useMemo(() => {
    if (loading) return { state: "loading" as State };
    if (!user) return { state: "no_creds" as State };
    const exp = profile?.stream_expires_at ? new Date(profile.stream_expires_at) : null;
    const status = (profile?.stream_status || "").toLowerCase();
    const rank = profile?.rank;
    const now = Date.now();

    if (!exp && !status && rank !== "stream_user" && rank !== "vip" && rank !== "boss") {
      return { state: "no_creds" as State };
    }

    if (exp) {
      const ms = exp.getTime() - now;
      if (ms <= 0 || status === "expired") {
        return { state: "expired" as State, exp, ms };
      }
      if (ms <= 3 * 86_400_000) {
        return { state: "expiring" as State, exp, ms };
      }
      if (status === "active" || rank === "stream_user" || rank === "vip" || rank === "boss") {
        return { state: "active" as State, exp, ms };
      }
    }

    if (status === "active" || rank === "stream_user" || rank === "vip" || rank === "boss") {
      return { state: "active" as State, exp: null, ms: null };
    }

    return { state: "inactive" as State };
  }, [user, profile, loading]);

  const tone = (() => {
    switch (view.state) {
      case "active":
        return {
          ring: "border-emerald-500/40 bg-emerald-500/5",
          chip: "bg-emerald-500/15 text-emerald-300",
          Icon: CheckCircle2,
          label: "Active",
        };
      case "expiring":
        return {
          ring: "border-amber-500/40 bg-amber-500/5",
          chip: "bg-amber-500/15 text-amber-300",
          Icon: AlertTriangle,
          label: "Expiring soon",
        };
      case "expired":
        return {
          ring: "border-destructive/40 bg-destructive/10",
          chip: "bg-destructive/15 text-destructive-foreground",
          Icon: XCircle,
          label: "Expired",
        };
      case "no_creds":
      case "inactive":
        return {
          ring: "border-border bg-card/60",
          chip: "bg-muted text-muted-foreground",
          Icon: Clock,
          label: view.state === "no_creds" ? "Not linked" : "Inactive",
        };
      default:
        return {
          ring: "border-border bg-card/60",
          chip: "bg-muted text-muted-foreground",
          Icon: Clock,
          label: "Checking…",
        };
    }
  })();

  const expiryText = (() => {
    if (!("exp" in view) || !view.exp) return null;
    try {
      return view.exp.toLocaleString();
    } catch {
      return view.exp.toISOString();
    }
  })();

  const remainingText = (() => {
    if (!("ms" in view) || view.ms == null) return null;
    return view.ms > 0
      ? `${formatRemaining(view.ms)} left`
      : `expired ${formatRemaining(view.ms)} ago`;
  })();

  return (
    <section
      className={`rounded-2xl border p-4 sm:p-5 backdrop-blur-md ${tone.ring}`}
      aria-label="Stream access status"
    >
      <div className="flex items-start gap-3">
        <Tv className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold uppercase tracking-[0.25em]">
              Stream Access
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone.chip}`}
            >
              <tone.Icon className="h-3 w-3" />
              {tone.label}
            </span>
          </div>

          <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
            {view.state === "loading" && <p>Checking your line…</p>}

            {view.state === "no_creds" && (
              <p>
                {user
                  ? "No stream line on file yet. Link your credentials to get tagged as an OGSTREAMZ user."
                  : "Sign in to view your stream status."}
              </p>
            )}

            {view.state === "active" && (
              <>
                <p className="text-foreground">Your line is live. Stream away.</p>
                {expiryText && (
                  <p>
                    Expires <span className="text-foreground">{expiryText}</span>
                    {remainingText ? <> · <span>{remainingText}</span></> : null}
                  </p>
                )}
              </>
            )}

            {view.state === "expiring" && (
              <>
                <p className="text-foreground">Heads up — your access expires soon.</p>
                {expiryText && (
                  <p>
                    Expires <span className="text-foreground">{expiryText}</span>
                    {remainingText ? <> · <span>{remainingText}</span></> : null}
                  </p>
                )}
              </>
            )}

            {view.state === "expired" && (
              <>
                <p className="text-foreground">Your stream access has expired.</p>
                {expiryText && (
                  <p>
                    Ended <span className="text-foreground">{expiryText}</span>
                    {remainingText ? <> · <span>{remainingText}</span></> : null}
                  </p>
                )}
              </>
            )}

            {view.state === "inactive" && (
              <p>Your line isn't currently active. Re-verify or renew to restore access.</p>
            )}
          </div>

          {/* Next actions */}
          {user && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(view.state === "active" || view.state === "expiring") && (
                <>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/dashboard">Open dashboard</Link>
                  </Button>
                  {view.state === "expiring" && (
                    <Button asChild size="sm">
                      <Link to="/store/catalog">Renew now</Link>
                    </Button>
                  )}
                </>
              )}
              {view.state === "expired" && (
                <>
                  <Button asChild size="sm">
                    <Link to="/store/catalog">Renew access</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/account/passes">Re-verify line</Link>
                  </Button>
                </>
              )}
              {(view.state === "no_creds" || view.state === "inactive") && (
                <>
                  <Button asChild size="sm">
                    <Link to="/account/passes">Link your line</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/store/catalog">Get a pass</Link>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
