import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Tv, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { verifyAndLinkStream } from "@/lib/stream-link.functions";
import { useAuth } from "@/hooks/use-auth";

export function StreamLinkCard() {
  const { profile, refresh } = useAuth();
  const verify = useServerFn(verifyAndLinkStream);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [server, setServer] = useState("http://xiu96ctyh6-system.xyz:80");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const rank = (profile?.rank as string | undefined) ?? "";
  const linked = rank === "stream_user" || rank === "vip" || rank === "boss";
  const status = (profile as any)?.stream_status as string | undefined;
  const expiresAt = (profile as any)?.stream_expires_at as string | undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await verify({ data: { username: u, password: p, server } });
      if (res.ok) {
        setMsg({ ok: true, text: `Stream verified — upgraded to OGSTREAMZ User${res.expiresAt ? ` (expires ${new Date(res.expiresAt).toLocaleDateString()})` : ""}.` });
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
        Link your stream/IPTV username &amp; password. We verify it against the server and auto-upgrade you to <strong className="text-foreground">OGSTREAMZ User</strong>.
      </p>

      {linked && status === "Active" && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> Verified · {status}{expiresAt ? ` · expires ${new Date(expiresAt).toLocaleDateString()}` : ""}
        </p>
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