import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2, Copy, CheckCircle2, Unlink, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  generateTelegramLinkCode,
  getTelegramLinkStatus,
  unlinkTelegram,
  updateTelegramPrefs,
} from "@/lib/account-passes.functions";

const BOT_USERNAME = "Ogstreamzbot";

type Status = {
  chat_id: number | null;
  tg_username: string | null;
  link_code: string | null;
  code_expires_at: string | null;
  linked_at: string | null;
  notify_purchases: boolean;
  notify_reminders: boolean;
  notify_live: boolean;
} | null;

export function TelegramLinkCard() {
  const fetchStatus = useServerFn(getTelegramLinkStatus);
  const genCode = useServerFn(generateTelegramLinkCode);
  const unlink = useServerFn(unlinkTelegram);
  const updatePrefs = useServerFn(updateTelegramPrefs);

  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const pollRef = useRef<number | null>(null);

  const refresh = () =>
    fetchStatus().then((s: any) => setStatus(s as Status)).catch(() => setStatus(null));

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);

  // Once a code is issued and we're not linked yet, poll until the
  // webhook binds the chat_id (user pressed Start in Telegram).
  useEffect(() => {
    if (!status?.link_code || status?.chat_id) {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(() => {
      refresh().then(() => {
        if (pollRef.current && (status?.chat_id)) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
          toast.success("Telegram connected");
        }
      });
    }, 4000);
    return () => {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.link_code, status?.chat_id]);

  const linked = !!status?.chat_id;
  const code = status?.link_code;

  const onConnect = async () => {
    setOpening(true);
    try {
      let active = code ?? null;
      if (!active) {
        const res: any = await genCode();
        active = res?.code ?? null;
        await refresh();
      }
      if (active) {
        const url = `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(active)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start Telegram link");
    } finally {
      setOpening(false);
    }
  };

  const onGenerate = async () => {
    setBusy(true);
    try { await genCode(); await refresh(); }
    catch (e: any) { toast.error(e.message ?? "Failed to generate code"); }
    finally { setBusy(false); }
  };

  const onUnlink = async () => {
    setBusy(true);
    try { await unlink(); await refresh(); toast.success("Telegram unlinked"); }
    catch (e: any) { toast.error(e.message ?? "Unlink failed"); }
    finally { setBusy(false); }
  };

  const onCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(`/link ${code}`);
    toast.success("Copied — paste it to the bot");
  };

  const togglePref = async (key: "notify_purchases" | "notify_reminders" | "notify_live", v: boolean) => {
    setStatus(s => s ? { ...s, [key]: v } : s);
    try { await updatePrefs({ data: { [key]: v } as any }); }
    catch (e: any) { toast.error(e.message ?? "Update failed"); refresh(); }
  };

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
      <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Loading Telegram link…
    </div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-metallic">
          <Send className="inline h-4 w-4 mr-2 text-sky-400" />Telegram bot
        </p>
        {linked && <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />Linked
        </span>}
      </div>

      {!linked ? (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Get your VIP pass details, expiry reminders and live drops sent straight to Telegram.
          </p>
          <Button
            onClick={onConnect}
            disabled={opening}
            className="font-bold bg-sky-500 hover:bg-sky-400 text-black w-full sm:w-auto"
          >
            {opening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            {code ? "Re-open Telegram" : "Connect Telegram"}
          </Button>
          {code ? (
            <div className="space-y-3">
              <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Waiting for Telegram… or paste manually
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-base bg-background border border-border rounded px-3 py-2 select-all">/link {code}</code>
                  <Button size="sm" variant="outline" onClick={onCopy}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Code expires {status?.code_expires_at ? new Date(status.code_expires_at).toLocaleTimeString() : "in 30 minutes"}.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={onGenerate} disabled={busy} className="text-xs">
                {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}Generate fresh code
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Linked{status?.tg_username ? ` to @${status.tg_username}` : ""} on{" "}
            {status?.linked_at ? new Date(status.linked_at).toLocaleDateString() : ""}.
          </p>
          <div className="space-y-3">
            <PrefRow label="Purchase confirmations" desc="Pass issued, credits added, etc." checked={!!status?.notify_purchases} onChange={v => togglePref("notify_purchases", v)} />
            <PrefRow label="Expiry reminders" desc="7 days, 1 day and on expiry." checked={!!status?.notify_reminders} onChange={v => togglePref("notify_reminders", v)} />
            <PrefRow label="Live updates" desc="Drops, battles, and Boss announcements." checked={!!status?.notify_live} onChange={v => togglePref("notify_live", v)} />
          </div>
          <Button variant="outline" size="sm" onClick={onUnlink} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Unlink className="h-3 w-3 mr-1" />}Unlink
          </Button>
        </div>
      )}
    </div>
  );
}

function PrefRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-white">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}