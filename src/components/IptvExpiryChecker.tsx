import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, User, Loader2, CalendarClock, ShieldCheck, AlertTriangle, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkIptvExpiry } from "@/lib/iptv-expiry.functions";

type Result = Awaited<ReturnType<typeof checkIptvExpiry>>;

function formatRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "—";
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

export function IptvExpiryChecker() {
  const check = useServerFn(checkIptvExpiry);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await check({ data: { username: username.trim(), password: password.trim() } });
      setResult(r);
    } catch (err: any) {
      setResult({ ok: false, error: err?.message ?? "Request failed" } as Result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-2xl border-2 border-cyan-300/30 bg-gradient-to-b from-[#0b1424] via-[#06101e] to-[#020611] p-1 shadow-[0_0_60px_-15px_rgba(56,189,248,0.6)]">
        <div className="rounded-[14px] border border-cyan-200/15 bg-black/60 p-5 sm:p-7 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-400/10 text-cyan-200">
              <Tv className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-cyan-200/70 font-bold">M3U Vault</div>
              <h2 className="text-lg sm:text-xl font-black text-cyan-50">IPTV Expiry Check</h2>
            </div>
          </div>
          <p className="text-xs text-cyan-100/70 mb-5">
            Enter your IPTV username &amp; password. We&apos;ll check your line on the vault and show your expiry date. Your credentials are never stored, and the upstream URL stays server-side.
          </p>

          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="iptv-user" className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">Username</Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-300/70" />
                <Input
                  id="iptv-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="line username"
                  autoComplete="off"
                  required
                  className="pl-10 h-11 bg-black/50 border-cyan-300/30 focus-visible:ring-cyan-400/50"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="iptv-pass" className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">Password</Label>
              <div className="relative mt-1.5">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-300/70" />
                <Input
                  id="iptv-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="line password"
                  autoComplete="off"
                  required
                  className="pl-10 h-11 bg-black/50 border-cyan-300/30 focus-visible:ring-cyan-400/50 font-mono tracking-widest"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black uppercase tracking-[0.25em]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><ShieldCheck className="h-4 w-4 mr-2" /> Check Expiry</>)}
              </Button>
            </div>
          </form>

          {result && (
            <div className="mt-5">
              {result.ok ? (
                <div className="rounded-xl border border-cyan-300/40 bg-cyan-400/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-100">
                    <CalendarClock className="h-4 w-4" />
                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-cyan-200/80">Line active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/60">Status</div>
                      <div className="text-cyan-50 font-bold">{result.status ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/60">Expires</div>
                      <div className="text-cyan-50 font-bold">
                        {result.expiresAt ? new Date(result.expiresAt).toLocaleString() : "Never"}
                      </div>
                      {result.expiresAt && (
                        <div className="text-[11px] text-cyan-200/70 mt-0.5">{formatRemaining(result.expiresAt)}</div>
                      )}
                    </div>
                    {result.activeConnections != null && (
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/60">Active conns</div>
                        <div className="text-cyan-50 font-bold">{result.activeConnections}{result.maxConnections != null ? ` / ${result.maxConnections}` : ""}</div>
                      </div>
                    )}
                    {result.isTrial && (
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/60">Type</div>
                        <div className="text-amber-300 font-bold">Trial</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-red-400/40 bg-red-500/5 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-red-300" />
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-red-200">Check failed</div>
                    <div className="text-sm text-red-100 mt-1">{result.error}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}