import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Link2,
  AlertTriangle,
  Loader2,
  Users,
  ExternalLink,
} from "lucide-react";
import { getTelegramBotStatus } from "@/lib/telegram-inbox.functions";

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/45">
        {label}
      </div>
      <div
        className={`mt-1 text-sm text-white/95 break-all ${
          mono ? "terminal-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function TelegramConnectionPanel() {
  const fetchStatus = useServerFn(getTelegramBotStatus);
  const q = useQuery({
    queryKey: ["tg-bot-status"],
    queryFn: () => fetchStatus({}),
    refetchInterval: 60_000,
  });

  const s = q.data;
  const connected = !!s?.connected;
  const botHandle = s?.bot?.username ? `@${s.bot.username}` : "—";
  const botUrl = s?.bot?.username
    ? `https://t.me/${s.bot.username}`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: connected
                ? "rgba(0, 224, 138, 0.15)"
                : "rgba(255, 85, 119, 0.15)",
              color: connected ? "#00e08a" : "#ff5577",
            }}
          >
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white/95 truncate">
                {s?.bot?.first_name || "Telegram Bot"}
              </span>
              {q.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white/55" />
              ) : connected ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-rose-400">
                  <XCircle className="h-3 w-3" /> Not connected
                </span>
              )}
            </div>
            <div className="text-xs text-white/55 truncate">
              {botHandle}
              {botUrl && (
                <a
                  href={botUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 inline-flex items-center gap-0.5 text-white/70 hover:text-white"
                >
                  open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white hover:bg-white/5"
        >
          <RefreshCw
            className={`h-3 w-3 ${q.isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {s?.error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{s.error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat
          label="Bot ID"
          mono
          value={s?.bot?.id ?? "—"}
        />
        <Stat
          label="Chats reached"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-white/55" />
              {s?.chat_count ?? 0}
            </span>
          }
        />
        <Stat
          label="Pending updates"
          value={s?.webhook?.pending_update_count ?? 0}
        />
        <Stat
          label="Group reads"
          value={
            s?.bot?.can_read_all_group_messages
              ? "All messages"
              : "Mentions only"
          }
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-white/45">
          <Link2 className="h-3 w-3" /> Webhook
        </div>
        <div className="mt-1 text-xs text-white/85 break-all terminal-mono">
          {s?.webhook?.url || (
            <span className="text-white/45">not registered</span>
          )}
        </div>
        {s?.webhook?.last_error_message && (
          <div className="mt-1 text-[11px] text-rose-300">
            Last error: {s.webhook.last_error_message}
          </div>
        )}
      </div>

      <p className="text-[11px] text-white/45 leading-relaxed">
        The bot can only see DMs sent to it and groups/channels where it has
        been added as a member. To list a new chat, add{" "}
        <span className="terminal-mono text-white/70">{botHandle}</span> to the
        group, then send any message — it will appear in the inbox below.
      </p>
    </div>
  );
}
