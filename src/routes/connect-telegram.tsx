import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Loader2, Send, Copy, ExternalLink, ShieldCheck, Users, Bell } from "lucide-react";
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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getTelegramLinkStatus);
  const genCode = useServerFn(generateTelegramLinkCode);

  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const pollRef = useRef<number | null>(null);

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
        toast.success("Telegram linked — group features unlocked");
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
      toast.success(`Copied — paste it to @${BOT_USERNAME}`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const codeIssued = !!code;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-black via-zinc-950 to-black">
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
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <code className="font-mono text-sm bg-background/60 border border-border rounded px-2 py-1 select-all">
                  /link {code}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopy} className="h-8 px-2" aria-label="Copy link command">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] uppercase tracking-widest text-white/50 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Waiting for Telegram…
                </span>
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