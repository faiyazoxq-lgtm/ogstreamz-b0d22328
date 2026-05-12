import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing, Check, Info, CheckCircle2, AlertTriangle, Flame, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  listInboxNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type VipNotification,
} from "@/lib/notifications.functions";

type Item = VipNotification & { read: boolean };
type Sev = VipNotification["severity"];

const META: Record<Sev, { tint: string; Icon: any }> = {
  info:    { tint: "border-cyan-700/50 bg-cyan-500/10 text-cyan-200",        Icon: Info },
  success: { tint: "border-emerald-700/50 bg-emerald-500/10 text-emerald-200", Icon: CheckCircle2 },
  warning: { tint: "border-yellow-700/50 bg-yellow-500/10 text-yellow-200",  Icon: AlertTriangle },
  alert:   { tint: "border-pink-700/50 bg-pink-500/10 text-pink-200",        Icon: Flame },
};

/** VIP-only inbox surfaced on the user dashboard. */
export function VipNotificationsInbox() {
  const list = useServerFn(listInboxNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setItems(await list());
    } catch {
      // silent — non-VIPs may not have access
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      // Scope the realtime channel + postgres_changes filter to the current
      // user so subscribers only receive their own notification events,
      // never broadcast rows belonging to other users.
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      const filter = `user_id=eq.${uid}`;
      channel = supabase
        .channel(`vip_notifications:${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "vip_notifications", filter }, () => {
          void refresh();
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "vip_notifications", filter }, () => {
          void refresh();
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const dismiss = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await markRead({ data: { id } }); } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const dismissAll = async () => {
    setBusy(true);
    try {
      await markAll();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("Inbox cleared");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  const unread = items.filter((n) => !n.read);
  const visible = unread.length > 0 ? unread : items.slice(0, 3);

  return (
    <section className="rounded-2xl border-2 border-pink-700/50 bg-gradient-to-br from-pink-950/40 via-black/60 to-fuchsia-950/30 p-4 sm:p-5 shadow-[0_0_30px_-15px_oklch(0.65_0.25_0)]">
      <header className="flex items-center gap-3 mb-3">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-200">
          <BellRing className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-pink-200">VIP Comms</h3>
          <p className="text-[11px] text-pink-300/70">
            {unread.length > 0
              ? `${unread.length} new notification${unread.length === 1 ? "" : "s"} from the boss`
              : "Recent transmissions"}
          </p>
        </div>
        {unread.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={dismissAll}
            disabled={busy}
            className="text-pink-200 hover:text-white hover:bg-pink-500/20"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
            Mark all read
          </Button>
        )}
      </header>

      <ul className="space-y-2">
        {visible.map((n) => {
          const m = META[n.severity] ?? META.info;
          return (
            <li key={n.id} className={`rounded-xl border p-3 ${m.tint} ${n.read ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <m.Icon className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black tracking-tight">{n.title}</span>
                    <span className="text-[10px] opacity-60 ml-auto">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap break-words">{n.body}</p>
                  {n.link_url && (
                    <a
                      href={n.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs underline opacity-90 hover:opacity-100 break-all"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {!n.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => dismiss(n.id)}
                    className="h-8 w-8 text-current hover:bg-white/10"
                    aria-label="Dismiss"
                    title="Dismiss"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}