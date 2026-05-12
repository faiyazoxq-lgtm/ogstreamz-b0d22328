import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { verifyMyStreamAccess } from "@/lib/stream-link.functions";

export function VerifyStreamAccessCard({ signedIn }: { signedIn: boolean }) {
  const verifyFn = useServerFn(verifyMyStreamAccess);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | null
    | {
        ok: boolean;
        rank?: string | null;
        status?: string | null;
        expiresAt?: string | null;
        message: string;
      }
  >(null);

  const onVerify = async () => {
    if (!signedIn) {
      toast.error("Sign in first");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res: any = await verifyFn();
      if (res?.ok) {
        const rank = res.profile?.rank ?? null;
        const status = res.status ?? res.profile?.stream_status ?? null;
        const expiresAt = res.expiresAt ?? res.profile?.stream_expires_at ?? null;
        setResult({
          ok: true,
          rank,
          status,
          expiresAt,
          message: "Stream access verified — tag refreshed.",
        });
        toast.success("Stream access verified");
      } else {
        const msg = res?.error || "Verification failed";
        setResult({ ok: false, message: msg });
        toast.error(msg);
      }
    } catch (e: any) {
      const msg = e?.message || "Verification failed";
      setResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const expiryLabel = (() => {
    const iso = result?.expiresAt;
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  })();

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold uppercase tracking-[0.25em]">
            Verify Stream Access
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pings your line through the secure proxy and refreshes your
            OGStreamz tag instantly.
          </p>
          {result && (
            <div
              className={
                "mt-3 text-xs rounded-lg border px-3 py-2 " +
                (result.ok
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-destructive/40 bg-destructive/10 text-destructive-foreground")
              }
            >
              <div className="font-semibold">{result.message}</div>
              {result.ok && (
                <div className="mt-1 text-muted-foreground">
                  Rank: <span className="text-foreground">{result.rank ?? "—"}</span>
                  {" · "}Status: <span className="text-foreground">{result.status ?? "—"}</span>
                  {expiryLabel ? (
                    <>
                      {" · "}Expires:{" "}
                      <span className="text-foreground">{expiryLabel}</span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
        <Button
          onClick={onVerify}
          disabled={busy}
          size="sm"
          variant="outline"
          className="shrink-0"
        >
          {busy ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking…</>
          ) : (
            <><ShieldCheck className="h-4 w-4 mr-2" />Verify</>
          )}
        </Button>
      </div>
    </section>
  );
}
