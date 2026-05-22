import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Send, Tv, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getTelegramLinkStatus } from "@/lib/account-passes.functions";
import { verifyAndLinkStream } from "@/lib/stream-link.functions";

/**
 * Compact "connect your accounts" banner shown at the top of the profile
 * page after sign-in. Surfaces Telegram bot link status and OG Streamz
 * (m3u) link status + expiry. Linking persists on the account so users
 * never have to re-link.
 */
export function ConnectionsStatusBanner({ hideWhenComplete = false }: { hideWhenComplete?: boolean } = {}) {
  const { profile, refresh } = useAuth();
  const fetchTg = useServerFn(getTelegramLinkStatus);
  const linkStream = useServerFn(verifyAndLinkStream);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tg, setTg] = useState<{ chat_id: number | null; tg_username: string | null } | null>(null);
  const [loadingTg, setLoadingTg] = useState(true);
  const [streamOpen, setStreamOpen] = useState(false);
  const [streamUser, setStreamUser] = useState("");
  const [streamPass, setStreamPass] = useState("");
  const [streamBusy, setStreamBusy] = useState(false);

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
    if (pathname === "/profile") {
      const el = document.getElementById("connections");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    navigate({ to: "/profile", hash: "connections" });
  };

  const openStreamDialog = () => {
    setStreamUser("");
    setStreamPass("");
    setStreamOpen(true);
  };

  const submitStream = async () => {
    if (!streamUser.trim() || !streamPass) {
      toast.error("Enter your m3u username and password");
      return;
    }
    setStreamBusy(true);
    try {
      const res: any = await linkStream({ data: { username: streamUser.trim(), password: streamPass } });
      if (res?.ok) {
        toast.success(res.message ?? "OG Streamz profile linked");
        setStreamOpen(false);
        await refresh();
      } else {
        toast.error(res?.error ?? "Could not link OG Streamz profile");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not link OG Streamz profile");
    } finally {
      setStreamBusy(false);
    }
  };

  const bothConnected = tgLinked && streamLinked;

  if (hideWhenComplete && bothConnected && !loadingTg) return null;

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
            onClick={tgLinked && !streamLinked ? openStreamDialog : scrollToConnections}
            className="connections-cta connections-cta--mini"
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
          accent="blue"
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
          accent="gold"
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
          onConnect={openStreamDialog}
        />
      </div>

      <Dialog open={streamOpen} onOpenChange={(o) => !streamBusy && setStreamOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link OG Streamz profile</DialogTitle>
            <DialogDescription>
              Enter your m3u username and password. We'll verify with the server and link your account so you can see your expiry here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="m3u-username">m3u username</Label>
              <Input
                id="m3u-username"
                value={streamUser}
                onChange={(e) => setStreamUser(e.target.value)}
                autoComplete="username"
                disabled={streamBusy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m3u-password">m3u password</Label>
              <Input
                id="m3u-password"
                type="password"
                value={streamPass}
                onChange={(e) => setStreamPass(e.target.value)}
                autoComplete="current-password"
                disabled={streamBusy}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStreamOpen(false)} disabled={streamBusy}>
              Cancel
            </Button>
            <Button onClick={submitStream} disabled={streamBusy}>
              {streamBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Verify & link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatusPill({
  icon, label, loading, linked, warning, primary, secondary, onConnect, accent = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  linked: boolean;
  warning?: boolean;
  primary: string;
  secondary: string;
  onConnect: () => void;
  accent?: "blue" | "gold";
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
            className={`connections-cta mt-2.5 ${accent === "gold" ? "connections-cta--gold" : "connections-cta--blue"}`}
          >
            <span>Connect</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ConnectionsStatusBanner;