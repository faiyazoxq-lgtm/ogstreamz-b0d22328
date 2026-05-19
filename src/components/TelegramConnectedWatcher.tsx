import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { getTelegramLinkStatus } from "@/lib/account-passes.functions";

/**
 * Global watcher: while a signed-in user has no bound Telegram chat_id,
 * polls the link status. The moment the webhook claim succeeds and a
 * chat_id appears, fires a visible toast confirming the connection —
 * no matter which page the user is currently on. Only fires once per
 * (user, chat_id) so repeat visits stay quiet.
 */
export function TelegramConnectedWatcher({ userId }: { userId: string | null }) {
  const fetchStatus = useServerFn(getTelegramLinkStatus);
  const pollRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    firedRef.current = false;

    const seenKey = `tg_connected_seen:${userId}`;
    let stop = false;

    const check = async () => {
      try {
        const s: any = await fetchStatus();
        const chatId = s?.chat_id ?? null;
        if (chatId) {
          let prev: string | null = null;
          try { prev = localStorage.getItem(seenKey); } catch { /* ignore */ }
          if (prev !== String(chatId) && !firedRef.current) {
            firedRef.current = true;
            try { localStorage.setItem(seenKey, String(chatId)); } catch { /* ignore */ }
            toast.success("Telegram connected", {
              id: "tg-connected-global",
              description: "You'll get pass updates and group invites here.",
              icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
              duration: 6000,
            });
          }
          // Already linked → stop polling.
          if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }
        // Not yet linked → make sure poll is running.
        if (!pollRef.current && !stop) {
          pollRef.current = window.setInterval(check, 4000);
        }
      } catch { /* ignore — try again next tick */ }
    };

    check();

    const onVis = () => {
      if (document.visibilityState === "visible" && !firedRef.current) check();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop = true;
      document.removeEventListener("visibilitychange", onVis);
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}

export default TelegramConnectedWatcher;