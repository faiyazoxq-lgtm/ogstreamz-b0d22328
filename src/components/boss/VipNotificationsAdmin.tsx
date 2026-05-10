import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing, Send, Trash2, Loader2, Users, User as UserIcon, Link2, Info, CheckCircle2, AlertTriangle, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  sendVipNotification,
  listVipNotifications,
  deleteVipNotification,
  type VipNotification,
} from "@/lib/notifications.functions";

type Severity = VipNotification["severity"];

const SEVERITY_META: Record<Severity, { label: string; tint: string; Icon: any }> = {
  info:    { label: "Info",    tint: "text-cyan-300 border-cyan-700/50 bg-cyan-500/10",       Icon: Info },
  success: { label: "Success", tint: "text-emerald-300 border-emerald-700/50 bg-emerald-500/10", Icon: CheckCircle2 },
  warning: { label: "Warning", tint: "text-yellow-300 border-yellow-700/50 bg-yellow-500/10",  Icon: AlertTriangle },
  alert:   { label: "Alert",   tint: "text-pink-300 border-pink-700/50 bg-pink-500/10",        Icon: Flame },
};

type VipRow = { id: string; email: string; rank: string; status: string; display_name: string | null };

/** Boss-only: send notifications to all VIPs or a specific VIP user. */
export function VipNotificationsAdmin({ rows }: { rows: VipRow[] }) {
  const send = useServerFn(sendVipNotification);
  const list = useServerFn(listVipNotifications);
  const remove = useServerFn(deleteVipNotification);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");
  const [target, setTarget] = useState<string>("__all__"); // __all__ = broadcast
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<VipNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const vipUsers = useMemo(
    () => rows.filter((r) => r.rank === "vip" || r.status === "vip" || r.rank === "boss")
               .sort((a, b) => a.email.localeCompare(b.email)),
    [rows],
  );

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await list());
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setBusy(true);
    try {
      await send({
        data: {
          title: title.trim(),
          body: body.trim(),
          link_url: linkUrl.trim() || null,
          severity,
          user_id: target === "__all__" ? null : target,
        },
      });
      toast.success(target === "__all__" ? "Broadcast sent to all VIPs" : "Notification sent");
      setTitle("");
      setBody("");
      setLinkUrl("");
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this notification for everyone?")) return;
    try {
      await remove({ data: { id } });
      setItems((prev) => prev.filter((n) => n.id !== id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  };

  const targetEmail = (uid: string | null) =>
    uid ? (vipUsers.find((u) => u.id === uid)?.email ?? "user") : "All VIPs";

  return (
    <div className="rounded-2xl border-2 border-emerald-800/50 bg-black/60 backdrop-blur p-5 sm:p-6 shadow-xl">
      <div className="mb-5 flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-400 grid place-items-center text-black shadow-lg ring-4 ring-pink-500/30">
          <BellRing className="h-6 w-6 stroke-[2.5]" />
        </div>
        <div className="min-w-0">
          <span className="inline-block text-[10px] uppercase tracking-[0.4em] font-black px-2 py-0.5 rounded border bg-pink-500/15 text-pink-300 border-pink-700/40 mb-1.5">
            Comms
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-pink-200 leading-tight">VIP Notifications</h2>
          <p className="mt-1 text-sm text-emerald-400/80 leading-snug">
            Push live alerts to every VIP — or target a single user. Appears on their dashboard instantly.
          </p>
        </div>
      </div>

      {/* Composer */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Drop incoming · 0G-VAULT rotated"
            className="mt-1 h-11 bg-black/70 border-2 border-emerald-800/50 text-emerald-100 font-bold"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black">Message</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Tell the VIPs what's going down…"
            className="mt-1 bg-black/70 border-2 border-emerald-800/50 text-emerald-100"
          />
          <div className="text-[10px] text-emerald-700 mt-1 text-right">{body.length}/1000</div>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Link (optional)
          </label>
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 h-11 bg-black/70 border-2 border-emerald-800/50 text-emerald-100"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black">Severity</label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
            <SelectTrigger className="mt-1 h-11 bg-black/70 border-2 border-emerald-800/50 text-emerald-100 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SEVERITY_META) as Severity[]).map((k) => (
                <SelectItem key={k} value={k}>{SEVERITY_META[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Target
          </label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="mt-1 h-11 bg-black/70 border-2 border-emerald-800/50 text-emerald-100 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="__all__">📣 Broadcast to all VIPs</SelectItem>
              {vipUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.email}{u.display_name ? ` · ${u.display_name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button
            onClick={submit}
            disabled={busy || !title.trim() || !body.trim()}
            className="h-11 bg-pink-500 hover:bg-pink-400 text-black font-black uppercase tracking-wider shadow-lg"
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send notification
          </Button>
        </div>
      </div>

      {/* Recent */}
      <div className="mt-8">
        <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-500 font-black mb-3">Recent ({items.length})</div>
        {loading ? (
          <div className="text-center py-8 text-emerald-700"><Loader2 className="h-4 w-4 inline animate-spin mr-2" />Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-emerald-700">No notifications sent yet.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const m = SEVERITY_META[n.severity] ?? SEVERITY_META.info;
              return (
                <li key={n.id} className={`rounded-xl border p-3 ${m.tint}`}>
                  <div className="flex items-start gap-3">
                    <m.Icon className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black tracking-tight">{n.title}</span>
                        <Badge variant="outline" className="text-[10px] uppercase border-current">
                          {n.user_id ? <UserIcon className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
                          {targetEmail(n.user_id)}
                        </Badge>
                        <span className="text-[10px] opacity-70 ml-auto">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-sm text-emerald-100/90 whitespace-pre-wrap break-words">{n.body}</p>
                      {n.link_url && (
                        <a href={n.link_url} target="_blank" rel="noreferrer" className="text-xs underline opacity-80 break-all">
                          {n.link_url}
                        </a>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(n.id)}
                      className="text-pink-300 hover:text-pink-100 hover:bg-pink-500/20"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}