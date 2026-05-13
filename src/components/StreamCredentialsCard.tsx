import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Tv, Copy, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { getMyStreamCredentials } from "@/lib/stream-credentials.functions";
import { useAuth } from "@/hooks/use-auth";
import { OgPassBadge } from "@/components/OgPassBadge";

export function StreamCredentialsCard() {
  const { profile } = useAuth();
  const fetchCreds = useServerFn(getMyStreamCredentials);
  const [loading, setLoading] = useState(true);
  const [creds, setCreds] = useState<{
    username: string;
    password: string | null;
    status: string | null;
    expires_at: string | null;
  } | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState<"u" | "p" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchCreds();
        if (!cancelled) setCreds(r.credentials);
      } catch {
        if (!cancelled) setCreds(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCreds]);

  const copy = async (which: "u" | "p", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading stream profile…
      </div>
    );
  }
  if (!creds) return null;

  const exp = creds.expires_at
    ? new Date(creds.expires_at).toLocaleDateString()
    : "—";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-gold" />
          <h3 className="font-[Montserrat] font-bold text-sm uppercase tracking-wider">
            Your Stream Profile
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <OgPassBadge number={(profile as any)?.og_pass_no} size="sm" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Expires {exp}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div className="rounded-md bg-secondary/40 border border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Username
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <code className="text-xs break-all font-mono">{creds.username}</code>
            <button
              onClick={() => copy("u", creds.username)}
              className="shrink-0 p-1 rounded hover:bg-secondary"
              aria-label="Copy username"
            >
              {copied === "u" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <div className="rounded-md bg-secondary/40 border border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Password
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <code className="text-xs break-all font-mono">
              {creds.password
                ? showPw
                  ? creds.password
                  : "•".repeat(Math.min(creds.password.length, 12))
                : "—"}
            </code>
            <div className="flex items-center gap-1 shrink-0">
              {creds.password && (
                <>
                  <button
                    onClick={() => setShowPw((s) => !s)}
                    className="p-1 rounded hover:bg-secondary"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => copy("p", creds.password!)}
                    className="p-1 rounded hover:bg-secondary"
                    aria-label="Copy password"
                  >
                    {copied === "p" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        OG-STREAMZ MEMBER · Below VIP status. Renew to keep streaming.
      </p>
    </div>
  );
}