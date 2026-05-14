import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2, Copy, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  generateTelegramLinkCode,
  getTelegramLinkStatus,
} from "@/lib/account-passes.functions";

const BOT_USERNAME = "Ogstreamzbot";
const DISMISS_KEY = "tg-connect-banner:dismissed-session";

type Status = {
  chat_id: number | null;
  link_code: string | null;
  code_expires_at: string | null;
} | null;

/**
 * Persistent prompt shown on the home page for signed-in members
 * who have not yet linked Telegram. Dismissible per-session, but
 * re-appears on the next visit until the bot is linked. Linking the
 * bot via /start <code> also grants us DM permission so we can
 * later push them invite links to groups we create.
 */
export function TelegramConnectBanner({ userId }: { userId: string | null }) {
  const fetchStatus = useServerFn(getTelegramLinkStatus);
  const genCode = useServerFn(generateTelegramLinkCode);

  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Code minted in *this* browser session for *this* signed-in user.
  // We never trust a pre-existing DB code for the deep-link, so a leaked
  // /link CODE from a previous device/session can't be redeemed by someone
  // else's Telegram against this account.
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Per-session dismissal — clears when the tab closes, so they get
  // re-prompted on the next visit until they're linked.
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  const refresh = async () => {
    try {
      const s = (await fetchStatus()) as Status;
      setStatus(s);
      return s;
    } catch {
      setStatus(null);
      return null;
    }
  };

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    refresh().finally(() => setLoading(false));
    // New auth identity → drop any code minted for a previous opener.
    setSessionCode(null);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Once a code exists, poll status so the banner flips to "Connected"
  // automatically as soon as the user hits Start in Telegram.
  useEffect(() => {
    if (!sessionCode || status?.chat_id) {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(async () => {
      const s = await refresh();
      if (s?.chat_id) {
        toast.success("Telegram connected — you'll get group invites here");
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 4000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode, status?.chat_id]);

  if (!userId || loading || dismissed) return null;
  if (status?.chat_id) return null; // Already linked → never show.

  // Only the code minted in this opener's session is shown / used.
  const code = sessionCode;

  const handleConnect = async () => {
    setBusy(true);
    try {
      // Always mint a fresh code for the *current* signed-in opener.
      // Server upserts on user_id, invalidating any prior code so a
      // leaked link from a previous session/device can't be redeemed.
      const minted = await genCode();
      const active = (minted as { code?: string })?.code ?? null;
      if (active) setSessionCode(active);
      await refresh();
      if (active) {
        // Deep-link straight into the bot with the token as /start arg —
        // pressing Start in Telegram triggers the webhook to bind chat_id.
        const url = `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(active)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start Telegram link");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`/link ${code}`);
      toast.success("Copied — paste it to @" + BOT_USERNAME);
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleDismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* */ }
    setDismissed(true);
  };

  return (
    <section
      role="region"
      aria-label="Connect Telegram to your member profile"
      className="relative rounded-2xl border border-sky-400/40 bg-gradient-to-r from-sky-500/10 via-sky-400/5 to-transparent p-4 sm:p-5 shadow-[0_0_24px_-12px_rgba(56,189,248,0.6)]"
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss for this session"
        className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <span
          aria-hidden
          className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 border border-sky-400/40"
        >
          <Send className="h-5 w-5 text-sky-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-base font-extrabold text-white">
            Connect Telegram to your profile
          </p>
          <p className="mt-0.5 text-xs sm:text-[13px] text-white/70 leading-snug">
            Get pass updates, expiry reminders and exclusive group invites
            sent straight to you. One-tap setup — opens @{BOT_USERNAME}.
          </p>

          {code && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="font-mono text-xs sm:text-sm bg-background/60 border border-border rounded px-2 py-1 select-all">
                /link {code}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="h-7 px-2"
                aria-label="Copy link command"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] uppercase tracking-widest text-white/50">
                Waiting for Telegram…
              </span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={busy}
              className="font-bold bg-sky-500 hover:bg-sky-400 text-black"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              {code ? "Re-open Telegram" : "Connect Telegram"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-white/60 hover:text-white"
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}