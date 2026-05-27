import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { sendBossMessage } from "@/lib/boss-message.functions";

const MAX = 2000;

/**
 * "Message the Boss" — signed-in members can send a short message that lands
 * directly in the boss Telegram chat via the existing notifyBoss helper.
 */
export function MessageBossForm() {
  const { user, loading } = useAuth();
  const send = useServerFn(sendBossMessage);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const trimmed = message.trim();
  const remaining = MAX - message.length;
  const tooShort = trimmed.length > 0 && trimmed.length < 2;
  const canSend = !submitting && !loading && !!user && trimmed.length >= 2 && message.length <= MAX;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setSubmitting(true);
    try {
      const res = await send({ data: { message: trimmed } });
      if (res?.ok) {
        setSent(true);
        setMessage("");
        toast.success("Message delivered to the Boss.");
      } else {
        toast.error(res?.error || "Could not deliver your message.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not deliver your message.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="glass-obsidian-cmd rounded-2xl p-5 text-sm text-white/70">
        Sign in to send the Boss a message.
      </div>
    );
  }

  if (sent) {
    return (
      <div className="glass-obsidian-cmd rounded-2xl p-6 space-y-3 text-center">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h3 className="syndicate-header text-base text-white/95">Message delivered</h3>
        <p className="text-sm text-white/60">
          The Boss has it in Telegram. You'll hear back if a reply is needed.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSent(false)}
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="glass-obsidian-cmd rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2 text-white/85">
        <MessageSquare className="h-4 w-4" style={{ color: "#3ad6ff" }} />
        <h3 className="syndicate-header text-base">Message the Boss</h3>
      </div>
      <p className="text-xs text-white/55">
        Sends straight to the Boss on Telegram. Keep it short and clear — include any
        order number or link that helps.
      </p>
      <label className="sr-only" htmlFor="message-boss-input">Message</label>
      <textarea
        id="message-boss-input"
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
        placeholder="What do you need to tell the Boss?"
        rows={5}
        maxLength={MAX}
        disabled={submitting}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-white/25 focus:outline-none focus:ring-1 focus:ring-white/15 disabled:opacity-50 resize-y min-h-[120px]"
      />
      <div className="flex items-center justify-between gap-3 text-[11px] text-white/45">
        <span aria-live="polite">
          {tooShort ? "Message is too short." : `${remaining} characters left`}
        </span>
        <Button type="submit" size="sm" disabled={!canSend}>
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" /> Send to Boss
            </>
          )}
        </Button>
      </div>
    </form>
  );
}