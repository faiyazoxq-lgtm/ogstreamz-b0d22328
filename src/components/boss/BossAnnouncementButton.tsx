import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Megaphone, Send, Sparkles, Loader2, Globe, Users, Crown,
  Info, CheckCircle2, AlertTriangle, Flame, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  composeBroadcast, sendVipNotification,
  type BroadcastAudience, type VipNotification,
} from "@/lib/notifications.functions";

type Severity = VipNotification["severity"];

const AUDIENCES: { value: BroadcastAudience; label: string; help: string; Icon: any; tint: string }[] = [
  { value: "all",     label: "Everyone",   help: "Public — every visitor & member",  Icon: Globe, tint: "text-cyan-300" },
  { value: "members", label: "Members",    help: "Every signed-in user",             Icon: Users, tint: "text-emerald-300" },
  { value: "ogs",     label: "Real OGs",   help: "VIP pass holders only",            Icon: Crown, tint: "text-yellow-300" },
];

const SEVERITIES: { value: Severity; label: string; Icon: any }[] = [
  { value: "info",    label: "Info",    Icon: Info },
  { value: "success", label: "Success", Icon: CheckCircle2 },
  { value: "warning", label: "Warning", Icon: AlertTriangle },
  { value: "alert",   label: "Alert",   Icon: Flame },
];

/** Big "Broadcast" button on the boss dashboard with AI-assisted composer. */
export function BossAnnouncementButton() {
  const compose = useServerFn(composeBroadcast);
  const send = useServerFn(sendVipNotification);

  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [audience, setAudience] = useState<BroadcastAudience>("members");
  const [severity, setSeverity] = useState<Severity>("info");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);

  const reset = () => {
    setIdea(""); setTitle(""); setBody(""); setLinkUrl("");
    setAudience("members"); setSeverity("info");
  };

  const draftWithAI = async () => {
    if (!idea.trim()) { toast.error("Drop a quick idea first"); return; }
    setDrafting(true);
    try {
      const r = await compose({ data: { idea: idea.trim(), audience, severity } });
      setTitle(r.title);
      setBody(r.body);
      setSeverity(r.severity);
      setAudience(r.audience);
      toast.success("Draft ready — tweak and send");
    } catch (e: any) {
      toast.error(e?.message ?? "AI draft failed");
    } finally {
      setDrafting(false);
    }
  };

  const broadcast = async () => {
    if (!title.trim() || !body.trim()) { toast.error("Title and message required"); return; }
    setSending(true);
    try {
      await send({
        data: {
          title: title.trim(),
          body: body.trim(),
          link_url: linkUrl.trim() || null,
          severity,
          audience,
          user_id: null,
        },
      });
      const a = AUDIENCES.find((x) => x.value === audience);
      toast.success(`📣 Broadcast sent to ${a?.label ?? audience}`);
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="h-12 px-5 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-cyan-400 hover:opacity-95 text-black font-black uppercase tracking-[0.25em] shadow-[0_0_30px_-8px_rgb(236_72_153/0.7)] border border-pink-300/40"
      >
        <Megaphone className="h-5 w-5 mr-2 stroke-[2.5]" />
        Broadcast
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-black border-2 border-pink-700/60">
          <DialogHeader>
            <DialogTitle className="text-pink-200 text-2xl font-black flex items-center gap-2">
              <Megaphone className="h-6 w-6" /> Broadcast Announcement
            </DialogTitle>
            <DialogDescription className="text-emerald-300/80">
              Drop an idea — the AI will polish it. Pick who it goes to, then send.
            </DialogDescription>
          </DialogHeader>

          {/* AI idea */}
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Your idea (AI will draft)
            </label>
            <div className="flex gap-2">
              <Input
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g. weekend double credits drop for VIPs"
                maxLength={500}
                className="h-11 bg-black/70 border-2 border-emerald-800/50 text-emerald-100"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void draftWithAI(); }}
              />
              <Button
                onClick={draftWithAI}
                disabled={drafting || !idea.trim()}
                className="h-11 bg-cyan-400 hover:bg-cyan-300 text-black font-black uppercase tracking-wider"
              >
                {drafting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Draft
              </Button>
            </div>
          </div>

          {/* Audience picker */}
          <div>
            <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black mb-2 block">Audience</label>
            <div className="grid grid-cols-3 gap-2">
              {AUDIENCES.map((a) => {
                const active = audience === a.value;
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAudience(a.value)}
                    className={
                      "rounded-xl border-2 p-3 text-left transition-all " +
                      (active
                        ? "border-pink-400 bg-pink-500/15 shadow-[0_0_20px_-8px_rgb(236_72_153/0.8)]"
                        : "border-emerald-900/60 bg-black/40 hover:border-emerald-700")
                    }
                  >
                    <a.Icon className={`h-5 w-5 mb-1 ${a.tint}`} />
                    <div className="text-sm font-black text-foreground">{a.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{a.help}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title + body */}
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Headline"
              className="h-11 bg-black/70 border-2 border-emerald-800/50 text-emerald-100 font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="What's the announcement?"
              className="bg-black/70 border-2 border-emerald-800/50 text-emerald-100"
            />
            <div className="text-[10px] text-emerald-700 text-right">{body.length}/1000</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={broadcast}
              disabled={sending || !title.trim() || !body.trim()}
              className="bg-pink-500 hover:bg-pink-400 text-black font-black uppercase tracking-wider"
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send broadcast
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}