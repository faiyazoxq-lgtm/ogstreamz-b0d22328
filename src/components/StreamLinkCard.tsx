import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Tv, CheckCircle2, Loader2, AlertTriangle, Clock, CalendarClock } from "lucide-react";
import { verifyAndLinkStream } from "@/lib/stream-link.functions";
import { useAuth } from "@/hooks/use-auth";

export function StreamLinkCard({ compact = false }: { compact?: boolean } = {}) {
  const { profile, refresh } = useAuth();
  const verify = useServerFn(verifyAndLinkStream);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [server, setServer] = useState("http://xiu96ctyh6-system.xyz:80");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const rank = (profile?.rank as string | undefined) ?? "";
  const linked = rank === "stream_user" || rank === "vip" || rank === "boss";
  const status = profile?.stream_status ?? undefined;
  const expiresAt = profile?.stream_expires_at ?? undefined;
  const username = profile?.stream_username ?? undefined;

  const expiryDate = expiresAt ? new Date(expiresAt) : null;
  const expired = expiryDate ? expiryDate.getTime() < Date.now() : false;
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / 86_400_000) : null;
  const expiryLabel = expiryDate
    ? expiryDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await verify({ data: { username: u, password: p, server } });
      if (res.ok) {
        setMsg({ ok: true, text: res.message || "Submitted to Boss for OGSTREAMZ approval." });
        setP("");
        await refresh();
      } else {
        setMsg({ ok: false, text: res.error || "Verification failed" });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Verification failed" });
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-[0.3em]">
        <Tv className="h-4 w-4" /> Stream Account Link
      </div>
      <h3 className="mt-3 font-[Montserrat] font-black text-2xl text-metallic">OGSTREAMZ Verification</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Link your stream/IPTV username &amp; password. We auto-check it against the server, then submit it to <strong className="text-foreground">Boss</strong> for OGSTREAMZ approval.
      </p>

      {(status || expiryLabel || username) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {username && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2.5 py-1 font-mono text-foreground/80">
              <Tv className="h-3.5 w-3.5" /> {username}
            </span>
          )}
          {status && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-bold uppercase tracking-[0.18em] ${
                expired
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : status === "Active"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-400/40 bg-amber-400/10 text-amber-300"
              }`}
            >
              {expired ? <AlertTriangle className="h-3.5 w-3.5" /> : status === "Active" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {expired ? "Expired" : status}
            </span>
          )}
          {expiryLabel && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${
                expired
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : daysLeft !== null && daysLeft <= 7
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    : "border-border bg-background/50 text-foreground/80"
              }`}
              title={`Stream profile expiry: ${expiryLabel}`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {expired
                ? `Expired ${expiryLabel}`
                : `Expires ${expiryLabel}${daysLeft !== null ? ` · ${daysLeft}d left` : ""}`}
            </span>
          )}
        </div>
      )}
      {linked && !status && (
        <p className="mt-3 text-xs text-muted-foreground">Linked — awaiting fresh status check.</p>
      )}

      <form onSubmit={submit} className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          required value={u} onChange={(e) => setU(e.target.value)} placeholder="Stream username" autoComplete="username"
          className="bg-background/60 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          required type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="Stream password" autoComplete="current-password"
          className="bg-background/60 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          value={server} onChange={(e) => setServer(e.target.value)} placeholder="Server URL"
          className="sm:col-span-2 bg-background/60 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit" disabled={busy}
          className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tv className="h-4 w-4" />}
          {busy ? "Verifying…" : linked ? "Re-verify Stream Account" : "Verify & Upgrade"}
        </button>
      </form>

      {msg && (
        <p className={`mt-3 inline-flex items-center gap-2 text-sm ${msg.ok ? "text-emerald-400" : "text-destructive"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {msg.text}
        </p>
      )}
    </div>
  );
}