import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendTelegramReply } from "@/lib/telegram-inbox.functions";

export const Route = createFileRoute("/boss/telegram-test")({
  head: () => ({
    meta: [
      { title: "Telegram Test · 0G Boss" },
      { name: "description", content: "Send a test Telegram message from the dashboard." },
    ],
  }),
  component: TelegramTestPage,
});

function TelegramTestPage() {
  const sendFn = useServerFn(sendTelegramReply);
  const [chatId, setChatId] = useState("");
  const [text, setText] = useState("Hello from 0G-STREAMZ boss dashboard 👋");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

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
    </div>
  );
}