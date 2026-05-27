import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send, Loader2, HeartPulse, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendTelegramReply } from "@/lib/telegram-inbox.functions";
import { bossBotHealthCheck } from "@/lib/bot-health.functions";

export const Route = createFileRoute("/boss/telegram-test")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/telegram-test") {
      throw redirect({ to: "/boss/infrastructure", hash: "telegram-test", replace: true });
    }
  },
  component: () => null,
});

export function TelegramTestPage() {
  const sendFn = useServerFn(sendTelegramReply);
  const healthFn = useServerFn(bossBotHealthCheck);
  const [chatId, setChatId] = useState("");
  const [text, setText] = useState("Hello from 0G-STREAMZ boss dashboard 👋");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
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
      setLastResult(`Delivered. message_id: ${mid}`);
      toast.success("Message sent");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setLastResult(`Failed: ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Telegram test send</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sends a message via @Ogstreamzbot to any chat_id the bot can reach.
          Member chat_ids appear in the inbox or via /me in Telegram.
        </p>
      </header>

      <form
        onSubmit={handleSend}
        className="space-y-4 rounded-lg border border-border bg-card p-5"
      >
        <div className="space-y-2">
          <Label htmlFor="chat-id">Chat ID</Label>
          <Input
            id="chat-id"
            inputMode="numeric"
            placeholder="e.g. 123456789"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">
            Use your own Telegram numeric ID to test. The bot must have an open
            chat with that user.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="msg">Message</Label>
          <Textarea
            id="msg"
            rows={5}
            maxLength={4096}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">{text.length}/4096</p>
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
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {lastResult}
          </div>
        )}
      </form>

      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Bot health check</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Verifies bot auth, webhook registration, recent inbound delivery,
              and sends a live test message to the boss chat.
            </p>
          </div>
          <Button onClick={runHealth} disabled={healthBusy} variant="secondary">
            {healthBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <HeartPulse className="mr-2 h-4 w-4" />
                Run health check
              </>
            )}
          </Button>
        </div>

        {health && (
          <div className="space-y-2">
            <div className="text-sm">
              Overall:{" "}
              <span className={health.healthy ? "text-emerald-500" : "text-red-500"}>
                {health.healthy ? "Healthy" : "Degraded"}
              </span>{" "}
              <span className="text-muted-foreground">
                · {health.duration_ms}ms · {new Date(health.checked_at).toLocaleTimeString()}
              </span>
            </div>
            <ul className="divide-y divide-border rounded-md border border-border">
              {(
                [
                  ["getMe", "Bot auth (getMe)"],
                  ["webhook", "Webhook registration"],
                  ["inbound", "Inbound updates received"],
                  ["outbound", "Outbound test message"],
                ] as const
              ).map(([key, label]) => {
                const c = health.checks[key];
                return (
                  <li key={key} className="flex items-start gap-3 px-3 py-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{label}</div>
                      {!c.ok && (
                        <div className="mt-0.5 text-xs text-red-500">{c.error}</div>
                      )}
                      {c.detail && (
                        <pre className="mt-1 overflow-x-auto rounded bg-muted/40 px-2 py-1 text-[11px] leading-snug text-muted-foreground">
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