import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Tv, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getTelegramLinkStatus } from "@/lib/account-passes.functions";

/**
 * Compact "connect your accounts" banner shown at the top of the profile
 * page after sign-in. Surfaces Telegram bot link status and OG Streamz
 * (m3u) link status + expiry. Linking persists on the account so users
 * never have to re-link.
 */
export function ConnectionsStatusBanner() {
  const { profile } = useAuth();
  const fetchTg = useServerFn(getTelegramLinkStatus);
  const [tg, setTg] = useState<{ chat_id: number | null; tg_username: string | null } | null>(null);
  const [loadingTg, setLoadingTg] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchTg()
      .then((s: any) => { if (alive) setTg(s as any); })
      .catch(() => { if (alive) setTg(null); })
      .finally(() => { if (alive) setLoadingTg(false); });
    return () => { alive = false; };
  }, [fetchTg]);

  const tgLinked = !!tg?.chat_id;
  const streamStatus = profile?.stream_status ?? null;
  const streamExpires = profile?.stream_expires_at ?? null;
  const streamLinked = !!streamStatus;
  const expiryDate = streamExpires ? new Date(streamExpires) : null;
  const expired = expiryDate ? expiryDate.getTime() < Date.now() : false;
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / 86_400_000) : null;
  const expiryLabel = expiryDate
    ? expiryDate.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : null;

  const scrollToConnections = () => {
    const el = document.getElementById("connections");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const bothConnected = tgLinked && streamLinked;

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card/60 backdrop-blur p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground">
          Your connections
        </p>
        {bothConnected ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> All set
          </span>
        ) : (
          <button
            onClick={scrollToConnections}
            className="text-[10px] uppercase tracking-widest font-bold text-[var(--neon-blue-bright)] inline-flex items-center gap-1 hover:opacity-80"
          >
            Set up <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Telegram pill */}
        <StatusPill
          icon={<Send className="h-4 w-4 text-sky-400" />}
          label="Telegram bot"
          loading={loadingTg}
          linked={tgLinked}
          primary={tgLinked
            ? (tg?.tg_username ? `@${tg.tg_username}` : "Connected")
            : "Not connected"}
          secondary={tgLinked
            ? "Pass alerts & expiry reminders enabled"
            : "Get pass alerts straight to Telegram"}
          onConnect={scrollToConnections}
        />

        {/* OG Streamz pill */}
        <StatusPill
          icon={<Tv className="h-4 w-4 text-[var(--gold)]" />}
          label="OG Streamz profile"
          loading={false}
          linked={streamLinked}
          warning={expired}
          primary={streamLinked
            ? (expired ? "Expired" : (streamStatus === "Active" ? "Active" : streamStatus ?? "Linked"))
            : "Not linked"}
          secondary={streamLinked
            ? (expiryLabel
                ? (expired
                    ? `Ended ${expiryLabel}`
                    : `Expires ${expiryLabel}${daysLeft !== null && daysLeft <= 30 ? ` · ${daysLeft}d left` : ""}`)
                : "Linked to your account")
            : "Link your m3u username to see expiry"}
          onConnect={scrollToConnections}
        />
      </div>
    </section>
  );
}

function StatusPill({
  icon, label, loading, linked, warning, primary, secondary, onConnect,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  linked: boolean;
  warning?: boolean;
  primary: string;
  secondary: string;
  onConnect: () => void;
}) {
  const ring = warning
    ? "border-amber-500/40"
    : linked
      ? "border-emerald-500/30"
      : "border-border";
  return (
    <div className={`rounded-xl border ${ring} bg-background/40 p-3.5 flex items-start gap-3`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</p>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : linked ? (
            warning ? (
              <AlertCircle className="h-3 w-3 text-amber-400" />
            ) : (
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            )
          ) : null}
        </div>
        <p className={`mt-1 text-sm font-bold ${warning ? "text-amber-300" : linked ? "text-white" : "text-muted-foreground"}`}>
          {loading ? "Checking…" : primary}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{secondary}</p>
        {!loading && !linked && (
          <button
            onClick={onConnect}
            className="mt-2 text-[11px] uppercase tracking-widest font-bold text-[var(--neon-blue-bright)] inline-flex items-center gap-1 hover:opacity-80"
          >
            Connect <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ConnectionsStatusBanner;