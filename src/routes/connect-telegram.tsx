import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Loader2, Send, Copy, ExternalLink, ShieldCheck, Users, Bell, Ticket, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  generateTelegramLinkCode,
  getTelegramLinkStatus,
} from "@/lib/account-passes.functions";
import { MyTelegramInbox } from "@/components/telegram/MyTelegramInbox";

const BOT_USERNAME = "Ogstreamzbot";

export const Route = createFileRoute("/connect-telegram")({
  head: () => ({
    meta: [
      { title: "Connect Telegram — required for group access · 0G-PORTAL" },
      { name: "description", content: "Link your Telegram to unlock Syndicate group invites, live drops and pass alerts. Required for all group features." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConnectTelegramPage,
});

type Status = {
  chat_id: number | null;
  tg_username: string | null;
  link_code: string | null;
  code_expires_at: string | null;
  linked_at: string | null;
} | null;

function ChecklistItem({
  done,
  Icon,
  title,
  desc,
}: {
  done: boolean;
  Icon: typeof ShieldCheck;
  title: string;
  desc: string;
}) {
  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
        done
          ? "border-emerald-500/40 bg-emerald-950/20"
          : "border-border bg-black/40"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-white/40"
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${done ? "text-emerald-200" : "text-white"}`}>
          <Icon className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{desc}</p>
      </div>
    </li>
  );
}

function ConnectTelegramPage() {
  const { user, profile, loading } = useAuth();
  const ogPassNo = profile?.og_pass_no ?? null;
  const ogPassTag = ogPassNo
    ? `OG#${String(ogPassNo).padStart(5, "0")}`
    : null;
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getTelegramLinkStatus);
  const genCode = useServerFn(generateTelegramLinkCode);

  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);
  const [openedTelegram, setOpenedTelegram] = useState(false);
  const pollRef = useRef<number | null>(null);
  const linkedToastRef = useRef(
    typeof window !== "undefined" &&
      !!window.localStorage?.getItem("tg_linked_v1"),
  );

  const fireLinkedToast = (boundAtIso: string | null) => {
    if (linkedToastRef.current) return;
    linkedToastRef.current = true;
    const boundDate = boundAtIso ? new Date(boundAtIso) : new Date();
    const boundLabel = boundDate.toLocaleString();
    try {
      sessionStorage.setItem("tg_bound_at", boundDate.toISOString());
    } catch { /* ignore */ }
    try {
      localStorage.setItem("tg_linked_v1", boundDate.toISOString());
    } catch { /* ignore */ }
    toast.success("Telegram linked — group features unlocked", {
      id: "tg-linked",
      description: `Bound at ${boundLabel}`,
    });
  };

  // Unauthenticated users belong on /auth.
  useEffect(() => {
    if (!loading && !user) {
      try { sessionStorage.setItem("post_auth_redirect", "/connect-telegram"); } catch { /* ignore */ }
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  const refresh = async (): Promise<Status> => {
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
    if (!user) return;
    refresh().finally(() => setInitialLoad(false));
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Re-check whenever the tab regains focus — covers the common path of
  // jumping to Telegram, pressing Start, then swiping back to the browser.
  useEffect(() => {
    if (!user) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && !status?.chat_id) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, status?.chat_id]);

  // Once we've issued a code, poll until chat_id appears (the user pressed
  // Start in Telegram and the webhook bound the chat).
  useEffect(() => {
    if (!status?.link_code || status?.chat_id) {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(async () => {
      const s = await refresh();
      if (s?.chat_id) {
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        fireLinkedToast(s.linked_at ?? null);
        // Bounce them back to where they were trying to go (or home).
        let dest = "/";
        try {
          const stash = sessionStorage.getItem("post_telegram_redirect");
          if (stash && stash.startsWith("/") && stash !== "/connect-telegram") dest = stash;
          sessionStorage.removeItem("post_telegram_redirect");
        } catch { /* ignore */ }
        setTimeout(() => navigate({ to: dest as any }), 800);
      }
    }, 4000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.link_code, status?.chat_id]);

  const code = status?.link_code ?? null;
  const linked = !!status?.chat_id;

  // Telegram's `start` parameter only accepts [A-Za-z0-9_-], so we join the
  // link code and the OG Pass tag with a double underscore. The bot splits
  // on `__` to recover both halves and bind the chat to the right profile.
  const startParam = code
    ? ogPassTag
      ? `${code}__${ogPassTag}`
      : code
    : null;
  const tgUrl = startParam
    ? `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(startParam)}`
    : null;

  const handleConnect = async () => {
    setBusy(true);
    try {
      let active = code;
      if (!active) {
        await genCode();
        const s = await refresh();
        active = s?.link_code ?? null;
      }
      if (active) {
        const param = ogPassTag ? `${active}__${ogPassTag}` : active;
        const url = `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(param)}`;
        setOpenedTelegram(true);
        // Mobile browsers block window.open() after an awaited server call
        // (the click is no longer a "trusted" user gesture). Navigate the
        // current tab instead — Telegram's universal link opens the app and
        // the browser restores this tab when the user returns.
        window.location.href = url;
      } else {
        toast.error("Could not issue link code — try again");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start Telegram link");
    } finally {
      setBusy(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const s = await refresh();
      setLastCheckAt(Date.now());
      if (s?.chat_id) {
        fireLinkedToast(s.linked_at ?? null);
      } else if (s?.link_code) {
        toast.error("Not bound yet — open the link and press Start in Telegram");
      } else {
        toast.error("No active link code — tap Connect Telegram first");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Verification failed");
    } finally {
      setChecking(false);
    }
  };

  const handleCopy = async () => {
    if (!tgUrl) return;
    try {
      await navigator.clipboard.writeText(tgUrl);
      toast.success("Link copied — paste it in Telegram or your browser");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleCopyPass = async () => {
    if (!ogPassTag) return;
    try {
      await navigator.clipboard.writeText(ogPassTag);
      toast.success("OG Pass # copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const codeIssued = !!code;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <section
        role="region"
        aria-labelledby="tg-gate-title"
        className="w-full max-w-lg rounded-3xl border-2 border-sky-500/40 bg-gradient-to-b from-sky-950/30 via-black/80 to-black p-6 sm:p-8 shadow-[0_0_60px_-20px_rgba(56,189,248,0.7)]"
      >
        <div className="flex items-center gap-3 mb-5">
          <span
            aria-hidden
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/20 border border-sky-400/40"
          >
            <Send className="h-6 w-6 text-sky-300" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-sky-300">
              Required step
            </p>
            <h1 id="tg-gate-title" className="font-[Montserrat] font-black text-2xl sm:text-3xl tracking-tight text-white">
              Connect your Telegram
            </h1>
          </div>
        </div>

        <p className="text-sm text-white/70 leading-relaxed mb-5">
          Group invites, live drops and pass alerts are delivered through
          Telegram. To use any group feature you must link your account to
          @{BOT_USERNAME} first — it takes 10 seconds.
        </p>

        {ogPassTag && !linked && (
          <div className="mb-5 rounded-2xl border-2 border-amber-400/60 bg-amber-500/10 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-amber-300 mb-1.5 inline-flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5" /> Your OG Pass number
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="font-mono text-lg sm:text-xl font-black tracking-wider text-amber-100 bg-black/40 border border-amber-300/40 rounded-lg px-3 py-1.5 select-all">
                {ogPassTag}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyPass}
                className="h-9 px-2 border-amber-400/50 text-amber-100 hover:bg-amber-500/10"
                aria-label="Copy OG Pass number"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-100/80 leading-snug">
              <b>Paste this OG Pass # into Telegram</b> right after your link
              code so the bot can confirm the chat belongs to you. The full
              command will look like{" "}
              <code className="font-mono bg-black/40 border border-amber-300/30 rounded px-1.5 py-0.5">
                /link CODE {ogPassTag}
              </code>
              .
            </p>
          </div>
        )}

        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/55 mb-2">
          Permission checklist
        </p>
        <ul className="space-y-2 mb-6" aria-label="Telegram permission checklist">
          <ChecklistItem
            done={!!user}
            Icon={ShieldCheck}
            title="Account verified"
            desc="You are signed in to your member profile."
          />
          <ChecklistItem
            done={codeIssued || linked}
            Icon={ShieldCheck}
            title="Link code issued"
            desc="A one-time 30-minute code is generated for the bot."
          />
          <ChecklistItem
            done={linked}
            Icon={Bell}
            title="DM permission granted"
            desc="Pressing Start in Telegram lets the bot send you direct messages — pass updates, expiry reminders, live drops."
          />
          <ChecklistItem
            done={linked}
            Icon={Users}
            title="Group invite delivery ready"
            desc="Once your chat ID is bound, the Syndicate can push private group invites straight to your Telegram."
          />
        </ul>

        {linked ? (
          <>
            <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-950/30 p-4 text-emerald-200">
              <p className="font-bold text-sm flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> Telegram connected
                {status?.tg_username ? ` · @${status.tg_username}` : ""}
              </p>
              <p className="text-xs text-emerald-300/80 mt-1">
                Group features unlocked. Your DM thread with the bot lives below — VIP only.
              </p>
            </div>
            <div className="mt-5">
              <MyTelegramInbox />
            </div>
          </>
        ) : (
          <>
            {code && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/55 mb-2">
                  Your personal connect link
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-xs sm:text-sm bg-background/60 border border-border rounded px-2 py-1 select-all break-all">
                    {tgUrl}
                  </code>
                  <Button
                    asChild
                    size="sm"
                    className="h-8 px-3 bg-sky-500 hover:bg-sky-400 text-black font-black uppercase tracking-wider"
                  >
                    <a href={tgUrl ?? "#"} target="_blank" rel="noopener noreferrer" aria-label="Open link in Telegram">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Open
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCopy} className="h-8 px-2" aria-label="Copy link command">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Verification banner — shows the live result of polling */}
                <div
                  role="status"
                  aria-live="polite"
                  className={`mt-3 flex items-start gap-2 rounded-xl border p-3 ${
                    openedTelegram || lastCheckAt
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                      : "border-sky-400/30 bg-sky-500/5 text-sky-100"
                  }`}
                >
                  {openedTelegram || lastCheckAt ? (
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-snug">
                      {openedTelegram || lastCheckAt
                        ? "Not confirmed yet — open Telegram and press Start, then check again"
                        : "Waiting for you to press Start in Telegram…"}
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-80 leading-snug">
                      We auto-check every few seconds and whenever you return to this tab.
                      {lastCheckAt
                        ? ` Last checked ${new Date(lastCheckAt).toLocaleTimeString()}.`
                        : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCheckNow}
                    disabled={checking}
                    className="h-8 px-2 shrink-0 border-current bg-transparent"
                    aria-label="Check connection now"
                  >
                    {checking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5 text-[11px] font-black uppercase tracking-wider">Check</span>
                  </Button>
                </div>

                {ogPassTag && (
                  <p className="mt-2 text-[11px] text-white/55 leading-snug">
                    Tap or paste this link in Telegram — it opens @{BOT_USERNAME}
                    and binds the chat to your profile ({ogPassTag}).
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleConnect}
                disabled={busy || initialLoad}
                className="font-black uppercase tracking-wider bg-sky-500 hover:bg-sky-400 text-black"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                {code ? "Re-open Telegram" : "Connect Telegram"}
              </Button>
              <Button asChild variant="ghost" className="text-white/60 hover:text-white">
                <Link to="/">Back to home</Link>
              </Button>
            </div>

            <p className="mt-4 text-[11px] text-white/45 leading-relaxed">
              Group features (Syndicate Mesh, private group invites, broadcast
              channels) stay locked until your chat ID is bound. Solo features
              and your dashboard remain accessible without Telegram.
            </p>
          </>
        )}
      </section>
    </main>
  );
}