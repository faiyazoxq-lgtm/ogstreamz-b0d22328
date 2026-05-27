import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Send,
  Loader2,
  HeartPulse,
  CheckCircle2,
  XCircle,
  Activity,
  MessageSquare,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { sendTelegramReply } from "@/lib/telegram-inbox.functions";
import { bossBotHealthCheck } from "@/lib/bot-health.functions";

export const Route = createFileRoute("/boss/telegram-test")({
  beforeLoad: exactPathRedirect("/boss/telegram-test", () => ({
    to: "/boss/infrastructure",
    hash: "telegram-test",
  })),
  component: () => null,
});

export function TelegramTestPage() {
  const sendFn = useServerFn(sendTelegramReply);
  const healthFn = useServerFn(bossBotHealthCheck);
  const [chatId, setChatId] = useState("");
  const [text, setText] = useState("Hello from 0G-STREAMZ boss dashboard 👋");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    ok: boolean;
    message: string;
    detail?: string;
  } | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof bossBotHealthCheck>> | null>(null);

  async function runHealth() {
    setHealthBusy(true);
    try {
      const res = await healthFn({});
      setHealth(res);
      if (res.healthy) toast.success("Bot is healthy");
      else toast.error("One or more checks failed");
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setHealthBusy(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(chatId.trim());
    if (!Number.isFinite(id) || id === 0) {
      toast.error("Enter a valid numeric chat_id");
      return;
    }
    if (!text.trim()) {
      toast.error("Message cannot be empty");
      return;
    }
    setBusy(true);
    setLastResult(null);
    try {
      const res = await sendFn({ data: { chatId: id, text: text.trim() } });
      const mid = res?.message_id ?? "—";
      setLastResult({ ok: true, message: "Delivered", detail: `message_id: ${mid}` });
      toast.success("Message sent");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setLastResult({ ok: false, message: "Failed", detail: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Telegram Test & Diagnostics</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Send a live test message via <strong>@Ogstreamzbot</strong> and run health checks to verify connectivity.
        </p>
      </div>

      {/* Send form */}
      <form
        onSubmit={handleSend}
        className="rounded-xl border border-border bg-card p-5 space-y-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-foreground">Send test message</h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="chat-id" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Chat ID
          </Label>
          <Input
            id="chat-id"
            inputMode="numeric"
            placeholder="e.g. 123456789"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            disabled={busy}
            className="text-sm tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            Use your own Telegram numeric ID to test. The bot must have an open chat with that user.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="msg" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Message
            </Label>
            <span className="text-[10px] text-muted-foreground tabular-nums">{text.length}/4096</span>
          </div>
          <Textarea
            id="msg"
            rows={4}
            maxLength={4096}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            className="text-sm resize-none"
          />
        </div>

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send test message
            </>
          )}
        </Button>

        {lastResult && (
          <div className={`rounded-lg border px-3 py-2.5 text-sm flex items-start gap-2 ${
            lastResult.ok
              ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-100"
              : "border-red-500/20 bg-red-500/[0.04] text-red-100"
          }`}>
            {lastResult.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            )}
            <div className="min-w-0">
              <span className="font-medium">{lastResult.message}</span>
              {lastResult.detail && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{lastResult.detail}</p>
              )}
            </div>
          </div>
        )}
      </form>

      {/* Health check */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">Bot health check</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground max-w-lg leading-relaxed">
              Verifies bot authentication, webhook registration, inbound delivery, and outbound reachability.
            </p>
          </div>
          <Button onClick={runHealth} disabled={healthBusy} size="sm" variant="secondary" className="shrink-0 gap-1.5">
            {healthBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <HeartPulse className="h-3.5 w-3.5" />
            )}
            {healthBusy ? "Checking…" : "Run check"}
          </Button>
        </div>

        {health && (
          <div className="space-y-3">
            {/* Overall status */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs gap-1 font-medium ${
                  health.healthy
                    ? "text-emerald-400 border-emerald-400/20"
                    : "text-red-400 border-red-400/20"
                }`}
              >
                {health.healthy ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {health.healthy ? "Healthy" : "Degraded"}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {health.duration_ms}ms · {new Date(health.checked_at).toLocaleTimeString()}
              </span>
            </div>

            {/* Per-check rows */}
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {(
                [
                  ["getMe", "Bot auth (getMe)", "Can the bot authenticate with Telegram?"],
                  ["webhook", "Webhook registration", "Is the webhook URL registered and reachable?"],
                  ["inbound", "Inbound updates", "Has the bot received recent inbound messages?"],
                  ["outbound", "Outbound delivery", "Can the bot send a test message?"],
                ] as const
              ).map(([key, label, hint]) => {
                const c = health.checks[key];
                return (
                  <li key={key} className="flex items-start gap-3 px-3 py-3 text-sm hover:bg-muted/20 transition-colors">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
                      {!c.ok && c.error && (
                        <div className="mt-1.5 text-xs text-red-400">{c.error}</div>
                      )}
                      {c.ok && c.detail && (
                        <pre className="mt-1.5 overflow-x-auto rounded-md bg-muted/40 px-2 py-1 text-[10px] leading-snug text-muted-foreground font-mono">
                          {JSON.stringify(c.detail, null, 2)}
                        </pre>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
